# -*- coding: utf-8 -*-
"""自动拆分自 mylib_server_v2.py —— reader 路由。
所有路由注册在共享的 app 上（from _state import *）。逻辑与原文件逐字一致，仅做了物理分文件。"""
from _state import (app, get_lib, load_config, save_config, CONFIG, STATIC_DIR,
                     FastAPI, Query, HTTPException, Request, UploadFile, File,
                     HTMLResponse, JSONResponse, FileResponse, Path, json, os, re,
                     shutil, socket, subprocess, sys, datetime, Library)

@app.get('/api/book/{book_id}/full_text')
async def api_book_full_text(book_id: int):
    """返回全文（agent 用，不分页）"""
    lib = get_lib()
    r = lib.conn.execute('SELECT file_path, file_ext FROM books WHERE id=?', (book_id,)).fetchone()
    if not r: raise HTTPException(404)
    full = lib.root / r['file_path']
    if not full.exists(): raise HTTPException(404)
    ext = (r['file_ext'] or '').lower().lstrip('.')
    if ext not in ('txt', 'text'):
        return {'text': '', 'error': f'{ext} not supported'}
    return {'text': _read_txt(full)}

def _read_txt(path: Path) -> str:
    raw = path.read_bytes()
    for enc in ('utf-8', 'gbk', 'gb18030', 'big5', 'utf-16'):
        try:
            text = raw.decode(enc, errors='ignore')
            cn = sum(1 for c in text[:3000] if '\u4e00' <= c <= '\u9fff')
            if cn / max(len(text[:3000]), 1) > 0.05:
                return text
        except Exception:
            continue
    return raw.decode('utf-8', errors='ignore')

# ── 阅读进度 ────────────────────────────────────────────────────────────────

@app.get('/api/book/{book_id}/progress')
async def api_get_progress(book_id: int, device: str = 'web'):
    lib = get_lib()
    try:
        r = lib.conn.execute('SELECT position, percentage, updated_at FROM reading_progress WHERE book_id=? AND device_id=?',
                             (book_id, device)).fetchone()
        if r:
            return {'position': r['position'], 'percentage': r['percentage'], 'updated_at': r['updated_at']}
    except Exception:
        pass
    return {'position': 0, 'percentage': 0, 'updated_at': None}

@app.get('/api/book/{book_id}/reads')
async def api_book_reads(book_id: int):
    """这本书的阅读回顾：你哪些天读过它、估算读了几遍（第二遍/第三遍的时间）。
    数据来自 reading_diary（每天读了什么），不需要额外记录。"""
    from datetime import date as _date
    lib = get_lib()
    c = lib.conn
    rows = []
    try:
        rows = c.execute(
            "SELECT date, minutes_read, start_pct, end_pct FROM reading_diary "
            "WHERE book_id=? AND date IS NOT NULL ORDER BY date", (book_id,)
        ).fetchall()
    except Exception:
        rows = []
    # v4.5.0 口径统一：阅读器上报的是 0~100 整数，但历史数据里可能混着旧版 0~1 小数
    # ——这里全部归一成 0~100，修掉"读到 4300%"那类显示（旧逻辑把 43 当 0.43 再 ×100）。
    def _pct(v):
        try:
            v = float(v or 0)
        except Exception:
            return 0.0
        if 0 < v <= 1 and v != int(v):   # 0.43 这类旧格式小数 → 43；整数 1 视为 1%
            v *= 100
        return max(0.0, min(100.0, v))
    days = [{'date': r['date'], 'minutes': r['minutes_read'] or 0,
             'start': _pct(r['start_pct']), 'end': _pct(r['end_pct'])} for r in rows]
    # v4.5.0 遍数新口径：进度从 0 走到 100 才算一遍（≥97% 视为读完）。
    # 旧的"隔 10 天以上算新一遍"是猜法——6/19 读 1 分钟、7/05 再读就被算成"第 2 遍"，不对。
    # 现在：读完（end≥97）的那天记「第 N 遍读完」；读完之后再读，才进入下一遍；
    # 没读完的只算"本遍进行中"，接口给出 current_pct 供前端显示"本遍读到 x%"。
    DONE = 97
    passes = 0                 # 已读完的遍数
    pass_marks = []            # [{'date','n'}] 第 n 遍读完落在哪一天
    in_pass = False            # 当前是否有一遍在进行中
    cur_pct = 0.0
    for d in days:
        if not in_pass and (d['minutes'] > 0 or d['end'] > 0):
            in_pass = True     # 读完后（或第一次）再翻开，开启新一遍
        if in_pass:
            cur_pct = max(cur_pct, d['end'])   # 本遍到过的最远处
            if d['end'] >= DONE:
                passes += 1
                pass_marks.append({'date': d['date'], 'n': passes})
                in_pass = False
                cur_pct = 0.0
    total_min = sum(d['minutes'] for d in days)
    return {
        'days': list(reversed(days)),          # 最近在前
        'day_count': len(days),
        'passes': passes,                      # 读完的遍数（0→100 才算一遍）
        'pass_marks': list(reversed(pass_marks)),
        'in_pass': in_pass,                    # 有一遍在进行中
        'current_pct': round(cur_pct) if in_pass else 0,   # 本遍读到百分之几
        'total_minutes': total_min,
        'first': days[0]['date'] if days else '',
        'last': days[-1]['date'] if days else '',
    }

@app.post('/api/book/{book_id}/progress')
async def api_save_progress(book_id: int, request: Request):
    body = await request.json()
    lib = get_lib()
    try:
        lib.conn.execute('''INSERT INTO reading_progress (book_id, device_id, position, percentage, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(book_id, device_id) DO UPDATE SET position=excluded.position,
            percentage=excluded.percentage, updated_at=excluded.updated_at''',
            (book_id, body.get('device', 'web'), body.get('position', 0), body.get('percentage', 0)))
        # 同步盖一个"最近阅读时间"到 books.last_open —— 书架"最新在读放最前"靠它排序
        try:
            lib.conn.execute("UPDATE books SET last_open=datetime('now') WHERE id=?", (book_id,))
        except Exception:
            pass
        lib.conn.commit()
    except Exception:
        pass
    return {'ok': True}

# ── AI Agent ─────────────────────────────────────────────────────────────────

@app.get('/api/notes/{book_id}')
async def api_get_notes(book_id: int):
    lib = get_lib()
    try:
        rows = lib.conn.execute('SELECT * FROM reading_notes WHERE book_id=? ORDER BY position', (book_id,)).fetchall()
        return {'notes': [dict(r) for r in rows]}
    except Exception:
        return {'notes': []}

@app.post('/api/notes')
async def api_save_note(request: Request):
    body = await request.json()
    lib = get_lib()
    try:
        lib.conn.execute(
            '''INSERT INTO reading_notes (book_id, position, title, content, source, image_path)
               VALUES (?, ?, ?, ?, ?, ?)''',
            (body['book_id'], body.get('position', 0), body.get('title', ''),
             body.get('content', ''), body.get('source', 'manual'), body.get('image_path', '')))
    except Exception:
        lib.conn.execute(
            '''INSERT INTO reading_notes (book_id, position, title, content, source)
               VALUES (?, ?, ?, ?, ?)''',
            (body['book_id'], body.get('position', 0), body.get('title', ''),
             body.get('content', ''), body.get('source', 'manual')))
    lib.conn.commit()
    return {'ok': True}

@app.post('/api/notes/image')
async def api_note_image(book_id: int = Query(...), file: UploadFile = File(...)):
    """笔记配图上传（手账化）"""
    lib = get_lib()
    note_dir = lib.root / '_note_images'
    note_dir.mkdir(exist_ok=True)
    ext = (file.filename or 'img.jpg').rsplit('.', 1)[-1].lower()
    if ext not in ('jpg', 'jpeg', 'png', 'webp', 'gif'):
        ext = 'jpg'
    import time as _t
    fname = f'note_{book_id}_{int(_t.time()*1000)}.{ext}'
    content = await file.read()
    if len(content) > 12 * 1024 * 1024:
        raise HTTPException(400, '图片太大（限12MB）')
    with open(note_dir / fname, 'wb') as f:
        f.write(content)
    return {'ok': True, 'image_path': fname, 'url': f'/api/notes/image/{fname}'}

@app.get('/api/notes/image/{name}')
async def api_get_note_image(name: str):
    from fastapi.responses import FileResponse, Response
    lib = get_lib()
    safe = name.replace('..', '').replace('/', '')
    p = lib.root / '_note_images' / safe
    if p.exists():
        return FileResponse(str(p))
    return Response(status_code=404)

@app.delete('/api/notes/{note_id}')
async def api_delete_note(note_id: int):
    lib = get_lib()
    lib.conn.execute('DELETE FROM reading_notes WHERE id=?', (note_id,))
    lib.conn.commit()
    return {'ok': True}

# ── 高亮/划句收藏 ────────────────────────────────────────────────────────────

@app.get('/api/highlights/{book_id}')
async def api_get_highlights(book_id: int):
    lib = get_lib()
    try:
        rows = lib.conn.execute('SELECT * FROM highlights WHERE book_id=? ORDER BY position', (book_id,)).fetchall()
        return {'highlights': [dict(r) for r in rows]}
    except Exception:
        return {'highlights': []}

@app.post('/api/highlights')
async def api_add_highlight(request: Request):
    body = await request.json()
    lib = get_lib()
    lib.conn.execute(
        'INSERT INTO highlights (book_id, position, text, color, note) VALUES (?,?,?,?,?)',
        (body['book_id'], body.get('position', 0), body.get('text', ''),
         body.get('color', 'yellow'), body.get('note', '')))
    lib.conn.commit()
    hid = lib.conn.execute('SELECT last_insert_rowid()').fetchone()[0]
    return {'ok': True, 'id': hid}

@app.delete('/api/highlights/{hl_id}')
async def api_del_highlight(hl_id: int):
    lib = get_lib()
    lib.conn.execute('DELETE FROM highlights WHERE id=?', (hl_id,))
    lib.conn.commit()
    return {'ok': True}

@app.patch('/api/highlights/{hl_id}')
async def api_update_highlight(hl_id: int, request: Request):
    """改划线的笔记/颜色（点 15：笔记可修改）"""
    body = await request.json()
    lib = get_lib()
    sets, vals = [], []
    if 'note' in body:
        sets.append('note=?'); vals.append(body.get('note', ''))
    if 'color' in body:
        sets.append('color=?'); vals.append(body.get('color', 'yellow'))
    if 'position' in body:   # 调整划线起点（改长度时会动）
        sets.append('position=?'); vals.append(int(body.get('position') or 0))
    if 'text' in body:       # 调整划线覆盖的文字（长度=文字长度）
        sets.append('text=?'); vals.append(body.get('text', ''))
    if not sets:
        return {'ok': True}
    vals.append(hl_id)
    lib.conn.execute('UPDATE highlights SET ' + ', '.join(sets) + ' WHERE id=?', vals)
    lib.conn.commit()
    return {'ok': True}

# ── 书签 ─────────────────────────────────────────────────────────────────────

@app.get('/api/bookmarks/{book_id}')
async def api_get_bookmarks(book_id: int):
    lib = get_lib()
    try:
        rows = lib.conn.execute('SELECT * FROM bookmarks WHERE book_id=? ORDER BY position', (book_id,)).fetchall()
        return {'bookmarks': [dict(r) for r in rows]}
    except Exception:
        return {'bookmarks': []}

@app.post('/api/bookmarks')
async def api_add_bookmark(request: Request):
    body = await request.json()
    lib = get_lib()
    lib.conn.execute(
        'INSERT INTO bookmarks (book_id, position, percentage, label) VALUES (?,?,?,?)',
        (body['book_id'], body.get('position', 0), body.get('percentage', 0), body.get('label', '')))
    lib.conn.commit()
    bid = lib.conn.execute('SELECT last_insert_rowid()').fetchone()[0]
    return {'ok': True, 'id': bid}

@app.delete('/api/bookmarks/{bm_id}')
async def api_del_bookmark(bm_id: int):
    lib = get_lib()
    lib.conn.execute('DELETE FROM bookmarks WHERE id=?', (bm_id,))
    lib.conn.commit()
    return {'ok': True}

# ── 阅读日记 ─────────────────────────────────────────────────────────────────

@app.post('/api/diary/record')
async def api_diary_record(request: Request):
    """记录今天读了某本书（前端阅读时自动调用）"""
    from datetime import date
    body = await request.json()
    lib = get_lib()
    today = date.today().isoformat()
    book_id = body['book_id']
    r = lib.conn.execute('SELECT title, author FROM books WHERE id=?', (book_id,)).fetchone()
    title = r['title'] if r else ''
    author = r['author'] if r else ''
    try:
        lib.conn.execute('''INSERT INTO reading_diary
            (date, book_id, book_title, book_author, chars_read, minutes_read, start_pct, end_pct, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(date, book_id) DO UPDATE SET
              chars_read=chars_read+excluded.chars_read,
              minutes_read=minutes_read+excluded.minutes_read,
              end_pct=excluded.end_pct,
              updated_at=excluded.updated_at''',
            (today, book_id, title, author, body.get('chars_read', 0),
             body.get('minutes_read', 0), body.get('start_pct', 0), body.get('end_pct', 0)))
        lib.conn.commit()
    except Exception:
        pass
    return {'ok': True}

@app.get('/api/diary')
async def api_diary_list(days: int = 30):
    """获取阅读日记（最近N天）"""
    lib = get_lib()
    try:
        rows = lib.conn.execute(
            '''SELECT date, book_id, book_title, book_author, chars_read, minutes_read, start_pct, end_pct
               FROM reading_diary ORDER BY date DESC, updated_at DESC LIMIT 500''').fetchall()
        # 按日期分组
        by_date = {}
        for r in rows:
            d = dict(r)
            by_date.setdefault(d['date'], []).append(d)
        result = [{'date': k, 'books': v} for k, v in by_date.items()][:days]
        return {'diary': result}
    except Exception:
        return {'diary': []}

# ── 阅读偏好（皮肤设置）──────────────────────────────────────────────────────

@app.delete('/api/diary/entry')
async def api_diary_delete(book_id: int = Query(...), date: str = Query(...)):
    """删除某天某本书的阅读记录"""
    lib = get_lib()
    try:
        lib.conn.execute('DELETE FROM reading_diary WHERE book_id=? AND date=?', (book_id, date))
        lib.conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.get('/api/reading-prefs')
async def api_get_prefs():
    lib = get_lib()
    try:
        rows = lib.conn.execute('SELECT key, value FROM reading_prefs').fetchall()
        return {r['key']: r['value'] for r in rows}
    except Exception:
        return {}

@app.post('/api/reading-prefs')
async def api_save_prefs(request: Request):
    body = await request.json()
    lib = get_lib()
    try:
        for k, v in body.items():
            lib.conn.execute('INSERT INTO reading_prefs (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
                             (k, str(v)))
        lib.conn.commit()
    except Exception:
        pass
    return {'ok': True}

# ── 环境音 ───────────────────────────────────────────────────────────────────

