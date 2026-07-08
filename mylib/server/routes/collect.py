# -*- coding: utf-8 -*-
"""自动拆分自 mylib_server_v2.py —— collect 路由。
所有路由注册在共享的 app 上（from _state import *）。逻辑与原文件逐字一致，仅做了物理分文件。"""
from _state import (app, get_lib, load_config, save_config, CONFIG, STATIC_DIR,
                     FastAPI, Query, HTTPException, Request, UploadFile, File,
                     HTMLResponse, JSONResponse, FileResponse, Path, json, os, re,
                     shutil, socket, subprocess, sys, datetime, Library)

@app.get('/api/pick/list')
async def api_pick_list():
    lib = get_lib()
    try:
        rows = lib.conn.execute(
            '''SELECT id, title, author, file_ext, word_count, reading_status, file_size
               FROM books WHERE take_to_tablet=1 ORDER BY author, title'''
        ).fetchall()
        return {'books': [dict(r) for r in rows], 'total': len(rows)}
    except Exception:
        return {'books': [], 'total': 0}

@app.post('/api/pick/toggle')
async def api_pick_toggle(request: Request):
    body = await request.json()
    lib = get_lib()
    book_ids = body.get('book_ids', [])
    take = body.get('take', True)
    if not book_ids: raise HTTPException(400)
    placeholders = ','.join(['?'] * len(book_ids))
    lib.conn.execute(f'UPDATE books SET take_to_tablet=? WHERE id IN ({placeholders})',
                     [1 if take else 0] + book_ids)
    lib.conn.commit()
    return {'ok': True, 'updated': len(book_ids)}

@app.post('/api/pick/set-status')
async def api_pick_set_status(request: Request):
    body = await request.json()
    lib = get_lib()
    bid = body.get('book_id')
    status = body.get('status')  # want_read / reading / read / null
    if not bid: raise HTTPException(400)
    lib.conn.execute('UPDATE books SET reading_status=? WHERE id=?', (status, bid))
    # 自动维护带走清单
    if status in ('want_read', 'reading'):
        lib.conn.execute('UPDATE books SET take_to_tablet=1 WHERE id=?', (bid,))
    lib.conn.commit()
    return {'ok': True}

# ── 全文检索 ─────────────────────────────────────────────────────────────────

@app.get('/api/search')
async def api_search(q: str = Query(...), mode: str = 'keyword', limit: int = 20):
    lib = get_lib()
    if mode == 'fts':
        try:
            rows = lib.conn.execute(
                'SELECT rowid, highlight(books_fts, 2, "<b>", "</b>") AS snippet FROM books_fts WHERE books_fts MATCH ? LIMIT ?',
                (q, limit)).fetchall()
            results = []
            for r in rows:
                book = lib.conn.execute('SELECT id, title, author FROM books WHERE id=?', (r['rowid'],)).fetchone()
                if book:
                    results.append({'id': book['id'], 'title': book['title'],
                                    'author': book['author'], 'snippet': r['snippet']})
            return {'results': results, 'mode': 'fts', 'total': len(results)}
        except Exception as e:
            return {'results': [], 'mode': 'fts', 'error': str(e),
                    'hint': 'FTS 索引可能未构建，请运行 migrate_db.py'}
    else:
        # 简单的 title/author LIKE 搜索
        q_like = f'%{q}%'
        rows = lib.conn.execute(
            'SELECT id, title, author, word_count FROM books WHERE title LIKE ? OR author LIKE ? LIMIT ?',
            (q_like, q_like, limit)).fetchall()
        return {'results': [dict(r) for r in rows], 'mode': 'keyword', 'total': len(rows)}

# ── 下载篮：打包下载 ─────────────────────────────────────────────────────────

@app.post('/api/download/pack')
async def api_download_pack(request: Request):
    """把选中的书打包成 zip 返回（下载篮的核心）"""
    from fastapi.responses import Response
    import zipfile, io
    body = await request.json()
    book_ids = body.get('book_ids', [])
    if not book_ids:
        raise HTTPException(400, 'no books')
    lib = get_lib()

    buf = io.BytesIO()
    added = 0
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for bid in book_ids:
            r = lib.conn.execute('SELECT title, author, file_path, file_ext FROM books WHERE id=?', (bid,)).fetchone()
            if not r:
                continue
            src = lib.root / r['file_path']
            if not src.exists():
                continue
            # 按作者分目录存放
            author = (r['author'] or '佚名').replace('/', '_')
            title = (r['title'] or 'book').replace('/', '_')
            ext = (r['file_ext'] or 'txt').lstrip('.')
            arcname = f'{author}/{title}.{ext}'
            try:
                zf.write(str(src), arcname)
                added += 1
            except Exception:
                continue
        # 记录下载历史
        try:
            from datetime import date
            for bid in book_ids:
                r = lib.conn.execute('SELECT title FROM books WHERE id=?', (bid,)).fetchone()
                if r:
                    lib.conn.execute('''INSERT INTO reading_diary (date, book_id, book_title, book_author, chars_read, minutes_read, updated_at)
                        VALUES (?, ?, ?, '', 0, 0, datetime('now')) ON CONFLICT(date, book_id) DO NOTHING''',
                        (date.today().isoformat()+'_dl', bid, r['title'] or ''))
            lib.conn.commit()
        except Exception:
            pass

    buf.seek(0)
    return Response(content=buf.read(), media_type='application/zip',
                    headers={'Content-Disposition': 'attachment; filename="books.zip"'})

# ── 书单导出 ─────────────────────────────────────────────────────────────────

@app.post('/api/booklist/export')
async def api_booklist_export(request: Request):
    """把选中的书导出成精致书单（text/markdown/svg）"""
    from booklist_export import export_booklist
    body = await request.json()
    book_ids = body.get('book_ids', [])
    title = body.get('title', '我的书单')
    fmt = body.get('format', 'text')
    theme = body.get('theme', 'paper')
    use_ai = body.get('use_ai', False)

    lib = get_lib()
    books = []
    for bid in book_ids:
        r = lib.conn.execute(
            'SELECT id, title, author, rating, is_favorite, user_notes FROM books WHERE id=?',
            (bid,)).fetchone()
        if not r:
            continue
        note = r['user_notes'] or ''
        # 取该书最近一条阅读笔记作为"一句话"（如果 user_notes 为空）
        if not note:
            try:
                n = lib.conn.execute(
                    'SELECT content FROM reading_notes WHERE book_id=? ORDER BY id DESC LIMIT 1',
                    (bid,)).fetchone()
                if n:
                    note = (n['content'] or '')[:40]
            except Exception:
                pass
        books.append({'title': r['title'], 'author': r['author'] or '',
                      'rating': r['rating'] or 0, 'note': note})

    # AI 辅助写一句话推荐语（只给没有笔记的书）
    if use_ai:
        no_note = [b for b in books if not b.get('note')]
        if no_note:
            try:
                await _ai_fill_recommendations(no_note)
            except Exception:
                pass

    result = export_booklist(title, books, fmt, theme)
    return result


async def _ai_fill_recommendations(books: list):
    """用 AI 给书写一句话推荐语（基于书名+作者的常识）"""
    cfg = load_config()
    api_key = cfg.get('ai', {}).get('api_key', '')
    base_url = cfg.get('ai', {}).get('base_url', 'https://api.deepseek.com/v1').rstrip('/')
    model = cfg.get('ai', {}).get('model', 'deepseek-chat')
    if not api_key:
        return
    # 兼容用户填的 base_url：可能带 /v1，也可能不带
    endpoint = base_url + ('/chat/completions' if base_url.endswith('/v1') or '/v1' in base_url else '/v1/chat/completions')
    import httpx
    titles = '、'.join(f'《{b["title"]}》' for b in books[:20])
    prompt = f'为这些中文小说各写一句话推荐（15字内，点出看点/CP/类型），按顺序每行一句，不要序号：{titles}'
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                endpoint,
                headers={'Authorization': f'Bearer {api_key}'},
                json={'model': model, 'messages': [{'role': 'user', 'content': prompt}],
                      'temperature': 0.7, 'max_tokens': 500})
            if resp.status_code == 200:
                lines = resp.json()['choices'][0]['message']['content'].strip().split('\n')
                lines = [l.strip() for l in lines if l.strip()]
                for b, line in zip(books, lines):
                    b['note'] = line[:40]
    except Exception:
        pass

# ── 封面上传/读取 ────────────────────────────────────────────────────────────

@app.post('/api/cover/upload')
async def api_cover_upload(book_id: int = Query(...), file: UploadFile = File(...)):
    """上传自定义封面"""
    lib = get_lib()
    r = lib.conn.execute('SELECT id FROM books WHERE id=?', (book_id,)).fetchone()
    if not r:
        raise HTTPException(404, 'book not found')
    # 封面存到母库下的 _covers 目录
    cover_dir = lib.root / '_covers'
    cover_dir.mkdir(exist_ok=True)
    ext = (file.filename or 'cover.jpg').rsplit('.', 1)[-1].lower()
    if ext not in ('jpg', 'jpeg', 'png', 'webp', 'gif'):
        ext = 'jpg'
    cover_file = cover_dir / f'{book_id}.{ext}'
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, '封面太大（限 10MB）')
    with open(cover_file, 'wb') as f:
        f.write(content)
    rel = f'_covers/{book_id}.{ext}'
    lib.conn.execute('UPDATE books SET cover_path=? WHERE id=?', (rel, book_id))
    lib.conn.commit()
    return {'ok': True, 'cover_path': rel}

@app.get('/api/cover/{book_id}')
async def api_cover_get(book_id: int):
    """读取封面图片"""
    from fastapi.responses import FileResponse, Response
    lib = get_lib()
    r = lib.conn.execute('SELECT cover_path FROM books WHERE id=?', (book_id,)).fetchone()
    if not r or not r['cover_path']:
        return Response(status_code=404)
    fp = lib.root / r['cover_path']
    if not fp.exists():
        return Response(status_code=404)
    return FileResponse(str(fp))

@app.delete('/api/cover/{book_id}')
async def api_cover_delete(book_id: int):
    """删除自定义封面"""
    lib = get_lib()
    r = lib.conn.execute('SELECT cover_path FROM books WHERE id=?', (book_id,)).fetchone()
    if r and r['cover_path']:
        fp = lib.root / r['cover_path']
        try:
            if fp.exists():
                fp.unlink()
        except Exception:
            pass
    lib.conn.execute('UPDATE books SET cover_path=NULL WHERE id=?', (book_id,))
    lib.conn.commit()
    return {'ok': True}

# ── 阅读历程总览 ──────────────────────────────────────────────────────────────

@app.post('/api/upload')
async def api_upload(file: UploadFile = File(...)):
    """接收上传的文件，保存到投递文件夹"""
    cfg = load_config()
    inbox = cfg['library'].get('inbox', '')
    if not inbox:
        inbox = str(Path(cfg['library'].get('root', '')).parent / '新书_待入库')
    inbox_path = Path(inbox)
    inbox_path.mkdir(parents=True, exist_ok=True)

    dst = inbox_path / file.filename
    # 防重名
    if dst.exists():
        stem = dst.stem
        ext = dst.suffix
        i = 1
        while dst.exists():
            dst = inbox_path / f'{stem}_{i}{ext}'
            i += 1

    content = await file.read()
    dst.write_bytes(content)
    return {'ok': True, 'filename': file.filename, 'saved_to': str(dst),
            'message': f'已保存到 {dst}，运行入库脚本即可导入'}

# ── 语义检索端点 ─────────────────────────────────────────────────────────────

@app.get('/api/search/semantic')
async def api_search_semantic(q: str = Query(...), limit: int = 10):
    """语义检索（需要先 build_search_index.py --semantic 构建索引）"""
    lib = get_lib()
    cfg = load_config()
    ai = cfg.get('ai', {})
    if not ai.get('api_key'):
        return {'results': [], 'error': 'API key 未配置'}

    db_path = lib.root / 'library.db'
    try:
        from build_search_index import semantic_search
        results = semantic_search(q, db_path, ai['api_key'],
                                  ai.get('base_url', 'https://api.deepseek.com/v1'), top_k=limit)
        return {'results': results, 'mode': 'semantic', 'total': len(results)}
    except Exception as e:
        return {'results': [], 'error': str(e)}

# ── 一键导出带走清单 ─────────────────────────────────────────────────────────

@app.post('/api/pick/export')
async def api_pick_export(request: Request):
    """导出 take_to_tablet=1 的书到导出目录"""
    lib = get_lib()
    cfg = load_config()
    export_dir = Path(cfg['library'].get('export_dir', '')) or (lib.root.parent / 'MyLibrary_export')
    export_dir.mkdir(parents=True, exist_ok=True)

    rows = lib.conn.execute(
        'SELECT id, title, author, file_path FROM books WHERE take_to_tablet=1'
    ).fetchall()

    copied = 0
    errors = []
    for r in rows:
        src = lib.root / r['file_path']
        if not src.exists():
            errors.append(f'{r["title"]}: 文件不存在')
            continue
        # 按作者分目录
        author = r['author'] or '_未分类'
        dst_dir = export_dir / author
        dst_dir.mkdir(parents=True, exist_ok=True)
        dst = dst_dir / src.name
        if not dst.exists():
            try:
                shutil.copy2(str(src), str(dst))
                copied += 1
            except Exception as e:
                errors.append(f'{r["title"]}: {e}')

    return {'ok': True, 'total': len(rows), 'copied': copied,
            'errors': errors[:20], 'export_dir': str(export_dir)}

# ============================================================
# 注入到主页面的增强脚本（在线阅读/带走/上传/导航）

