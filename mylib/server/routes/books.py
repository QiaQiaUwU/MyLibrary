# -*- coding: utf-8 -*-
"""自动拆分自 mylib_server_v2.py —— books 路由。
所有路由注册在共享的 app 上（from _state import *）。逻辑与原文件逐字一致，仅做了物理分文件。"""
from _state import (app, get_lib, load_config, save_config, CONFIG, STATIC_DIR,
                     FastAPI, Query, HTTPException, Request, UploadFile, File,
                     HTMLResponse, JSONResponse, FileResponse, Path, json, os, re,
                     shutil, socket, subprocess, sys, datetime, Library)
from _state import read_txt_cached, read_txt  # 正文读取（共享，带缓存）

@app.get('/api/library')
async def api_library():
    lib = get_lib()
    c = lib.conn
    books = []
    for r in c.execute('''
        SELECT b.id, b.title, b.author, b.file_path, b.file_size, b.file_ext,
               b.word_count, b.quality_score, b.is_read, b.is_favorite, b.rating,
               b.mrpro_used_ms, b.mrpro_words, b.mrpro_days, b.import_time,
               b.user_notes, b.source,
               (SELECT COUNT(*) FROM notes WHERE book_id = b.id) AS note_count
        FROM books b
    '''):
        row = {
            'id': r['id'], 't': r['title'], 'a': r['author'],
            'fp': r['file_path'], 's': r['file_size'], 'e': r['file_ext'],
            'wc': r['word_count'], 'q': r['quality_score'],
            'r': r['is_read'], 'f': r['is_favorite'], 'rt': r['rating'],
            'rms': r['mrpro_used_ms'] or 0, 'rdays': r['mrpro_days'] or 0,
            'src': r['source'] or '', 'nc': r['note_count'], 'it': r['import_time'],
            'un': r['user_notes'] or '',
        }
        # 新字段（如果迁移过）
        try:
            row['rs'] = r['reading_status'] or ''
            row['tt'] = r['take_to_tablet'] or 0
        except (IndexError, KeyError):
            row['rs'] = ''
            row['tt'] = 0
        books.append(row)

    book_tags = {}
    for r in c.execute('SELECT bt.book_id, t.name, t.kind FROM book_tags bt JOIN tags t ON t.id=bt.tag_id'):
        book_tags.setdefault(r['book_id'], []).append({'n': r['name'], 'k': r['kind']})
    for b in books:
        b['tags'] = book_tags.get(b['id'], [])

    tag_stats = []
    for r in c.execute('SELECT t.name, t.kind, COUNT(bt.book_id) AS n FROM tags t LEFT JOIN book_tags bt ON bt.tag_id=t.id GROUP BY t.id ORDER BY n DESC'):
        if r['n'] > 0:
            tag_stats.append({'n': r['name'], 'k': r['kind'], 'c': r['n']})

    return {'books': books, 'tags': tag_stats}

@app.get('/api/shelf')
def api_shelf(offset: int = 0, limit: int = 0, q: str = ''):
    """精简版书架数据，专为新主页优化（最小字段 + 聚合查询，13万本也快）。
    用同步函数 + 独立只读连接：FastAPI 会把它放到线程池里跑，这样这条 13 万行的
    重查询不再卡住事件循环——加载书房时去点「设置」或翻页都能立刻响应，不会再"卡住"。
    支持分页：传 offset/limit 时只返回那一段（手机端首屏先取一页秒开，剩下的后台再取），
    不传则返回全部（桌面端 / 搜索筛选仍可在本地一次拿全）。
    支持关键词搜索：传 q 时按书名/作者在「整个库」里匹配（不依赖前端已加载的部分）。"""
    from _state import read_conn
    try:
        c = read_conn()
    except Exception as e:
        # 数据库打不开（最常见：放书的盘没插好 / 盘符变了 / 路径不对），把原因说清楚而不是让前端只显示“加载失败”
        return {'books': [], 'count': 0, 'total': 0, 'offset': offset,
                'error': f'打不开藏书数据库（{type(e).__name__}: {e}）。请确认放书的硬盘已连接、盘符没变；可在「设置 → 藏书目录」里改路径。'}
    try:
        # 聚合（笔记数 / 体裁标签）改到拿到"这一页的书"之后再按需算——分页时只对这一页聚合，
        # 不再对 13 万本全表 GROUP BY / JOIN，首屏因此快很多。
        note_counts = {}
        book_genres = {}
        # 主查询：只取书架需要的字段
        books = []
        has_new_cols = True
        try:
            c.execute('SELECT reading_status FROM books LIMIT 1')
        except Exception:
            has_new_cols = False
        has_cover = True
        try:
            c.execute('SELECT cover_path FROM books LIMIT 1')
        except Exception:
            has_cover = False
        has_finished = True
        try:
            c.execute('SELECT is_finished FROM books LIMIT 1')
        except Exception:
            has_finished = False
        has_chap = True
        try:
            c.execute('SELECT chapter_count FROM books LIMIT 1')
        except Exception:
            has_chap = False
        has_lo = True
        try:
            c.execute('SELECT last_open FROM books LIMIT 1')
        except Exception:
            has_lo = False
        cols = 'id, title, author, word_count, is_favorite, rating, mrpro_used_ms'
        if has_cover:
            cols += ', cover_path'
        if has_new_cols:
            cols += ', reading_status'
        if has_finished:
            cols += ', is_finished'
        if has_chap:
            cols += ', chapter_count, extra_count'
        if has_lo:
            cols += ', last_open'
        # 关键词搜索：书名 / 作者 模糊匹配（整库），参数化防注入
        where_clause = ''
        params = []
        qs = (q or '').strip()
        if qs:
            where_clause = ' WHERE (title LIKE ? OR author LIKE ?)'
            params = ['%' + qs + '%', '%' + qs + '%']
        # 分页：只在 limit>0 时切片；否则取全部（保持旧行为）
        total = None
        page_clause = ''
        if limit and limit > 0:
            try:
                total = c.execute('SELECT COUNT(*) n FROM books' + where_clause, params).fetchone()['n']
            except Exception:
                total = None
            page_clause = f' LIMIT {int(limit)} OFFSET {int(offset)}'
        rows = list(c.execute(f'SELECT {cols} FROM books{where_clause} ORDER BY id{page_clause}', params))
        ids = [r['id'] for r in rows]
        # 聚合笔记数 / 体裁标签：分页时只对这一页的书算（IN 分批，避开 SQLite 变量上限）；不分页时维持全表聚合（旧行为）
        def _chunks(seq, n=800):
            for i in range(0, len(seq), n):
                yield seq[i:i + n]
        if limit and limit > 0 and len(ids) <= 2000:
            for chunk in _chunks(ids):
                ph = ','.join('?' * len(chunk))
                try:
                    for r in c.execute(f'SELECT book_id, COUNT(*) n FROM reading_notes WHERE book_id IN ({ph}) GROUP BY book_id', chunk):
                        note_counts[r['book_id']] = r['n']
                except Exception:
                    pass
                try:
                    for r in c.execute(f"SELECT bt.book_id, t.name FROM book_tags bt JOIN tags t ON t.id=bt.tag_id WHERE t.kind='genre' AND bt.book_id IN ({ph})", chunk):
                        book_genres.setdefault(r['book_id'], []).append(r['name'])
                except Exception:
                    pass
        else:
            try:
                for r in c.execute('SELECT book_id, COUNT(*) n FROM reading_notes GROUP BY book_id'):
                    note_counts[r['book_id']] = r['n']
            except Exception:
                pass
            try:
                for r in c.execute("SELECT bt.book_id, t.name FROM book_tags bt JOIN tags t ON t.id=bt.tag_id WHERE t.kind='genre'"):
                    book_genres.setdefault(r['book_id'], []).append(r['name'])
            except Exception:
                pass
        for r in rows:
            books.append({
                'id': r['id'], 't': r['title'] or '未命名', 'a': r['author'] or '佚名',
                'wc': r['word_count'] or 0, 'f': r['is_favorite'] or 0, 'rt': r['rating'] or 0,
                'rms': r['mrpro_used_ms'] or 0,
                'rs': (r['reading_status'] if has_new_cols else '') or '',
                'cv': 1 if (has_cover and r['cover_path']) else 0,
                'fin': (r['is_finished'] if has_finished else None),
                'ch': (r['chapter_count'] if has_chap else None),
                'ex': (r['extra_count'] if has_chap else None),
                'g': book_genres.get(r['id'], []),
                'nc': note_counts.get(r['id'], 0),
                'lo': (r['last_open'] if has_lo else '') or '',
            })
        return {'books': books, 'count': len(books), 'total': (total if total is not None else len(books)), 'offset': offset}
    except Exception as e:
        return {'books': [], 'count': 0, 'total': 0, 'offset': offset,
                'error': f'读取藏书出错（{type(e).__name__}: {e}）。'}
    finally:
        try:
            c.close()
        except Exception:
            pass

@app.get('/api/book')
async def api_book(id: int = Query(...)):
    lib = get_lib()
    c = lib.conn
    r = c.execute('SELECT * FROM books WHERE id = ?', (id,)).fetchone()
    if not r: raise HTTPException(404, 'not found')
    book = dict(r)
    notes = [dict(n) for n in c.execute('SELECT * FROM notes WHERE book_id=? ORDER BY note_time DESC', (id,))]
    tags = [dict(t) for t in c.execute('SELECT t.* FROM tags t JOIN book_tags bt ON bt.tag_id=t.id WHERE bt.book_id=?', (id,))]
    dups = [dict(d) for d in c.execute('SELECT * FROM duplicates WHERE primary_book_id=?', (id,))]
    # 阅读笔记
    rnotes = []
    try:
        rnotes = [dict(n) for n in c.execute('SELECT * FROM reading_notes WHERE book_id=? ORDER BY position', (id,))]
    except Exception:
        pass
    return {'book': book, 'notes': notes, 'tags': tags, 'duplicates': dups, 'reading_notes': rnotes}

@app.get('/api/book/check-chapters')
async def api_check_chapters(id: int = Query(...)):
    """查缺章：检测某本书的章节编号是否连续"""
    from chapter_counter import detect_missing_chapters
    lib = get_lib()
    r = lib.conn.execute('SELECT file_path, title FROM books WHERE id=?', (id,)).fetchone()
    if not r:
        raise HTTPException(404, 'not found')
    full = lib.root / r['file_path']
    if not full.exists():
        return {'ok': False, 'error': '文件不存在'}
    result = detect_missing_chapters(full)
    result['title'] = r['title']
    return result

@app.post('/api/book/parse-chapters')
async def api_parse_chapters(request: Request):
    """手动「理清章节」：解析正文的章节/番外数并存回库（给没有明确目录的书用，做完即保存）。"""
    body = await request.json()
    bid = body.get('id')
    if not bid:
        raise HTTPException(400, 'missing id')
    from chapter_counter import count_chapters
    lib = get_lib()
    r = lib.conn.execute('SELECT file_path, title FROM books WHERE id=?', (bid,)).fetchone()
    if not r:
        raise HTTPException(404, 'not found')
    full = lib.root / r['file_path']
    if not full.exists():
        return {'ok': False, 'error': '文件不存在'}
    try:
        res = count_chapters(full)
    except Exception as e:
        return {'ok': False, 'error': '解析失败：' + str(e)}
    ch = int(res.get('chapters') or 0)
    ex = int(res.get('extras') or 0)
    try:
        lib.conn.execute('UPDATE books SET chapter_count=?, extra_count=? WHERE id=?', (ch, ex, bid))
        # 处理标记 + 完结状态（置信度够才写），列不存在就跳过，不影响主流程
        try:
            lib.conn.execute("UPDATE books SET proc_finish_at=datetime('now') WHERE id=?", (bid,))
        except Exception:
            pass
        if res.get('finished') is not None and res.get('finish_confidence') in ('high', 'medium'):
            try:
                lib.conn.execute('UPDATE books SET is_finished=? WHERE id=?', (1 if res.get('finished') else 0, bid))
            except Exception:
                pass
        lib.conn.commit()
    except Exception as e:
        return {'ok': False, 'error': '保存失败：' + str(e)}
    return {'ok': True, 'chapters': ch, 'extras': ex, 'volumes': res.get('volumes', 0),
            'has_structure': bool(res.get('has_structure')), 'samples': res.get('sample_titles', [])}

@app.get('/api/open')
async def api_open(id: int = Query(...)):
    lib = get_lib()
    r = lib.conn.execute('SELECT file_path FROM books WHERE id=?', (id,)).fetchone()
    if not r: raise HTTPException(404)
    full = lib.root / r['file_path']
    if not full.exists(): raise HTTPException(404, f'file missing')
    if sys.platform == 'win32': os.startfile(str(full))
    elif sys.platform == 'darwin': subprocess.Popen(['open', str(full)])
    else: subprocess.Popen(['xdg-open', str(full)])
    lib.conn.execute("UPDATE books SET last_open=datetime('now') WHERE id=?", (id,))
    lib.conn.commit()
    return {'ok': True}

@app.get('/api/reveal')
async def api_reveal(id: int = Query(...)):
    lib = get_lib()
    r = lib.conn.execute('SELECT file_path FROM books WHERE id=?', (id,)).fetchone()
    if not r: raise HTTPException(404)
    full = lib.root / r['file_path']
    if sys.platform == 'win32': subprocess.Popen(['explorer', '/select,', str(full)])
    elif sys.platform == 'darwin': subprocess.Popen(['open', '-R', str(full)])
    else: subprocess.Popen(['xdg-open', str(full.parent)])
    return {'ok': True}

@app.post('/api/update')
async def api_update(request: Request):
    body = await request.json()
    bid = body.get('id')
    if not bid: raise HTTPException(400, 'missing id')
    lib = get_lib()
    allowed = {'is_read', 'is_favorite', 'rating', 'user_notes', 'reading_status', 'take_to_tablet', 'is_finished', 'cover_path', 'title', 'author'}
    sets, vals = [], []
    for k, v in body.items():
        if k in allowed:
            sets.append(f'{k}=?'); vals.append(v)
    if sets:
        # 打开/标在读时也更新"最近阅读时间"，让书架"最新在读放最前"立刻生效
        if body.get('reading_status') == 'reading':
            sets.append("last_open=datetime('now')")
        vals.append(bid)
        lib.conn.execute(f'UPDATE books SET {",".join(sets)} WHERE id=?', vals)
        lib.conn.commit()
    return {'ok': True}

@app.get('/api/tags/taxonomy')
async def api_tags_taxonomy():
    """返回分维度的标签词库（给前端筛选面板做分类用）。"""
    try:
        from classify_genres import TAG_GROUPS
        return {'groups': TAG_GROUPS}
    except Exception as e:
        return {'groups': {}, 'error': str(e)}

def _soft_delete_book(lib, book_id):
    """把一本书的文件移到 书库/_recycle/（不直接抹），删库里的记录及关联数据。"""
    c = lib.conn
    row = c.execute('SELECT file_path FROM books WHERE id=?', (book_id,)).fetchone()
    if not row:
        return False
    rel = row['file_path'] if not isinstance(row, tuple) else row[0]
    try:
        src = Path(lib.root) / rel
        if src.exists():
            recycle = Path(lib.root) / '_recycle' / datetime.now().strftime('%Y%m%d')
            recycle.mkdir(parents=True, exist_ok=True)
            dst = recycle / src.name
            i = 1
            while dst.exists():
                dst = recycle / f'{src.stem}_{i}{src.suffix}'; i += 1
            shutil.move(str(src), str(dst))
    except Exception:
        pass
    for sql in ['DELETE FROM book_tags WHERE book_id=?',
                'DELETE FROM reading_progress WHERE book_id=?',
                'DELETE FROM reading_diary WHERE book_id=?',
                'DELETE FROM bookmarks WHERE book_id=?',
                'DELETE FROM highlights WHERE book_id=?',
                'DELETE FROM reading_notes WHERE book_id=?',
                'DELETE FROM notes WHERE book_id=?',
                'DELETE FROM books WHERE id=?']:
        try:
            c.execute(sql, (book_id,))
        except Exception:
            pass
    return True

@app.delete('/api/book/{book_id}')
async def api_delete_book(book_id: int):
    """删除一本书：文件移到 书库/_recycle/，删库记录及标签/笔记/划线/书签/进度。"""
    lib = get_lib()
    ok = _soft_delete_book(lib, book_id)
    if not ok:
        return {'ok': False, 'error': '找不到这本书'}
    lib.conn.commit()
    return {'ok': True}

def _insert_book(lib, abs_path: Path, rel_path: str, title: str, author: str = '', source: str = '拖拽导入'):
    """把一个磁盘文件登记成一本书。返回新 id；若该 file_path 已存在则返回 None。"""
    import hashlib
    c = lib.conn
    if c.execute('SELECT 1 FROM books WHERE file_path=?', (rel_path,)).fetchone():
        return None
    try:
        data = abs_path.read_bytes()
    except Exception:
        data = b''
    raw_hash = hashlib.sha256(data).hexdigest()
    ext = abs_path.suffix.lower().lstrip('.') or 'txt'
    size = len(data)
    wc = 0
    if ext in ('txt', 'md', 'html', 'htm'):
        try:
            wc = len(read_txt(abs_path)) // 10000  # 万字
        except Exception:
            wc = 0
    now = datetime.now().isoformat(timespec='seconds')
    try:
        cur = c.execute('''INSERT INTO books
            (title, author, raw_title, file_path, file_size, file_ext, content_hash, raw_hash,
             encoding, word_count, quality_score, source, import_time)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            (title or abs_path.stem, author or '', abs_path.name, rel_path, size, ext,
             raw_hash, raw_hash, 'utf-8', wc, 0, source, now))
        return cur.lastrowid
    except Exception:
        return None

@app.post('/api/import/files')
async def api_import_files(files: list[UploadFile] = File(...)):
    """拖拽导入：把上传的 txt/epub 等存进 书库/books/_import/ 并登记入库（基础版，不做去重/元数据精提取）。"""
    lib = get_lib()
    dest = lib.books_dir / '_import'
    dest.mkdir(parents=True, exist_ok=True)
    added, skipped = 0, 0
    for f in files:
        name = (f.filename or 'book.txt')
        ext = name.rsplit('.', 1)[-1].lower() if '.' in name else 'txt'
        if ext not in ('txt', 'epub', 'md', 'html', 'htm', 'mobi', 'azw3'):
            skipped += 1; continue
        safe = re.sub(r'[\\/:*?"<>|]', '_', name)
        target = dest / safe
        i = 1
        while target.exists():
            target = dest / f'{Path(safe).stem}_{i}{Path(safe).suffix}'; i += 1
        try:
            content = await f.read()
            if len(content) > 200 * 1024 * 1024:
                skipped += 1; continue
            target.write_bytes(content)
        except Exception:
            skipped += 1; continue
        rel = str(target.relative_to(lib.root)).replace('\\', '/')
        # 从文件名猜书名（去扩展名）
        title = Path(safe).stem
        nid = _insert_book(lib, target, rel, title, '', '拖拽导入')
        if nid:
            added += 1
        else:
            skipped += 1
    lib.conn.commit()
    return {'ok': True, 'added': added, 'skipped': skipped}

@app.post('/api/books/batch')
async def api_books_batch(request: Request):
    """编辑模式的批量操作。
    body: {ids:[...], action:'delete'|'tag'|'untag'|'favorite'|'unfavorite', name?}
    - tag/untag：给/去题材标签（kind=genre，能进筛选），需 name
    - delete：批量软删除（移 _recycle）
    - favorite/unfavorite：批量收藏/取消
    """
    body = await request.json()
    ids = body.get('ids') or []
    action = body.get('action')
    name = (body.get('name') or '').strip()
    if not ids or not action:
        raise HTTPException(400, 'missing ids/action')
    lib = get_lib(); c = lib.conn
    done = 0
    if action == 'tag':
        if not name: raise HTTPException(400, 'missing name')
        tid = lib.get_or_create_tag(name, kind='genre')
        for bid in ids:
            try:
                c.execute('INSERT OR IGNORE INTO book_tags(book_id,tag_id) VALUES(?,?)', (bid, tid)); done += 1
            except Exception: pass
    elif action == 'untag':
        if not name: raise HTTPException(400, 'missing name')
        for bid in ids:
            try:
                c.execute('DELETE FROM book_tags WHERE book_id=? AND tag_id IN (SELECT id FROM tags WHERE name=?)', (bid, name)); done += 1
            except Exception: pass
    elif action in ('favorite', 'unfavorite'):
        val = 1 if action == 'favorite' else 0
        for bid in ids:
            try:
                c.execute('UPDATE books SET is_favorite=? WHERE id=?', (val, bid)); done += 1
            except Exception: pass
    elif action == 'status':
        rs = (body.get('status') or '').strip()
        if rs not in ('finished', 'reading', 'unread'):
            raise HTTPException(400, 'bad status')
        from datetime import datetime as _dt
        now = _dt.now().isoformat(timespec='seconds')
        for bid in ids:
            try:
                if rs == 'finished':
                    c.execute('UPDATE books SET reading_status=?, is_read=1, last_open=? WHERE id=?', (rs, now, bid))
                elif rs == 'reading':
                    c.execute('UPDATE books SET reading_status=?, last_open=? WHERE id=?', (rs, now, bid))
                else:
                    c.execute('UPDATE books SET reading_status=? WHERE id=?', (rs, bid))
                done += 1
            except Exception:
                pass
    elif action == 'delete':
        for bid in ids:
            if _soft_delete_book(lib, bid): done += 1
    else:
        raise HTTPException(400, 'unknown action')
    lib.conn.commit()
    return {'ok': True, 'done': done}

@app.post('/api/tag')
async def api_tag(request: Request):
    body = await request.json()
    bid, action, name = body.get('id'), body.get('action'), (body.get('name') or '').strip()
    kind = body.get('kind') or 'tag'   # 手动给书贴的题材标签用 'genre'，这样能在题材筛选里出现
    if not all([bid, action, name]): raise HTTPException(400)
    lib = get_lib()
    if action == 'add':
        tid = lib.get_or_create_tag(name, kind=kind)
        lib.conn.execute('INSERT OR IGNORE INTO book_tags(book_id,tag_id) VALUES(?,?)', (bid, tid))
    elif action == 'remove':
        lib.conn.execute('DELETE FROM book_tags WHERE book_id=? AND tag_id IN (SELECT id FROM tags WHERE name=?)', (bid, name))
    lib.conn.commit()
    return {'ok': True}

@app.get('/api/book/{book_id}/file')
async def api_book_file(book_id: int):
    """返回书的原始文件（epub.js 需要加载整个 epub 文件）"""
    lib = get_lib()
    r = lib.conn.execute('SELECT file_path, file_ext FROM books WHERE id=?', (book_id,)).fetchone()
    if not r: raise HTTPException(404)
    full = lib.root / r['file_path']
    if not full.exists(): raise HTTPException(404, 'file missing')
    ext = (r['file_ext'] or 'txt').lower().lstrip('.')
    media_types = {'epub': 'application/epub+zip', 'pdf': 'application/pdf',
                   'txt': 'text/plain; charset=utf-8', 'mobi': 'application/octet-stream'}
    return FileResponse(str(full), media_type=media_types.get(ext, 'application/octet-stream'),
                        filename=full.name)

# ── 阅读器 API ──────────────────────────────────────────────────────────────

@app.get('/api/book/{book_id}/content')
async def api_book_content(book_id: int, offset: int = 0, limit: int = 80000):
    lib = get_lib()
    r = lib.conn.execute('SELECT file_path, file_ext, word_count FROM books WHERE id=?', (book_id,)).fetchone()
    if not r: raise HTTPException(404)
    full = lib.root / r['file_path']
    if not full.exists(): raise HTTPException(404, 'file missing')
    ext = (r['file_ext'] or '').lower().lstrip('.')
    if ext not in ('txt', 'text'):
        return {'text': f'[{ext} 暂不支持在线阅读]', 'total_chars': 0, 'offset': 0, 'has_more': False}
    text = read_txt_cached(full)
    total = len(text)
    chunk = text[offset:offset + limit]
    return {'text': chunk, 'total_chars': total, 'offset': offset, 'has_more': offset + limit < total}

@app.post('/api/ai/chat')
async def api_ai_chat(request: Request):
    """AI agent 对话端点"""
    body = await request.json()
    book_id = body.get('book_id')
    message = body.get('message', '')
    position = body.get('position', 0)
    history = body.get('history', [])

    if not book_id or not message:
        raise HTTPException(400, 'missing book_id or message')

    lib = get_lib()
    r = lib.conn.execute('SELECT title, author, file_path, file_ext, word_count FROM books WHERE id=?',
                         (book_id,)).fetchone()
    if not r: raise HTTPException(404)

    # 读取书的文本
    full = lib.root / r['file_path']
    ext = (r['file_ext'] or '').lower().lstrip('.')
    if ext in ('txt', 'text') and full.exists():
        book_text = read_txt_cached(full)
    else:
        book_text = ''

    ai_cfg = load_config().get('ai', {})
    if not ai_cfg.get('api_key'):
        return {'reply': 'AI 功能需要配置 API key。请访问 /settings 页面配置。',
                'tool_calls': [], 'jump': None, 'error': 'no_api_key'}

    from mylib_agent import run_agent
    result = run_agent(
        user_message=message,
        book_id=book_id,
        book_title=r['title'] or '',
        book_author=r['author'] or '',
        book_text=book_text,
        position=position,
        total_chars=r['word_count'] or len(book_text),
        db_conn=lib.conn,
        ai_config=ai_cfg,
        conversation_history=history,
    )
    # 持久化对话到会话表，"历史对话"才看得到（失败不影响回复）
    try:
        from quill_agent import create_session, add_message
        dbp = lib.root / 'library.db'
        session_id = body.get('session_id')
        if not session_id:
            session_id = create_session(dbp, book_id=book_id, book_title=r['title'] or '')
        add_message(dbp, session_id, 'user', message)
        if not result.get('error'):
            add_message(dbp, session_id, 'assistant', result.get('reply', ''))
        result['session_id'] = session_id
    except Exception:
        pass
    return result

# ── 阅读笔记 CRUD ───────────────────────────────────────────────────────────
