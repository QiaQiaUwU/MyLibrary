# -*- coding: utf-8 -*-
"""自动拆分自 mylib_server_v2.py —— admin 路由。
所有路由注册在共享的 app 上（from _state import *）。逻辑与原文件逐字一致，仅做了物理分文件。"""
from _state import (app, get_lib, load_config, save_config, CONFIG, STATIC_DIR,
                     FastAPI, Query, HTTPException, Request, UploadFile, File,
                     HTMLResponse, JSONResponse, FileResponse, Path, json, os, re,
                     shutil, socket, subprocess, sys, datetime, Library)

_STATS_CACHE = {'at': 0, 'data': None}

@app.get('/api/admin/stats')
async def api_admin_stats(fresh: int = 0):
    """母库概览统计。带 60 秒缓存——独立窗口里反复点「管理」不会每次都全库重算。
    任务跑完会传 fresh=1 强制刷新。"""
    import time as _t
    if not fresh and _STATS_CACHE['data'] is not None and (_t.time() - _STATS_CACHE['at'] < 60):
        return _STATS_CACHE['data']
    lib = get_lib()
    c = lib.conn
    total = c.execute('SELECT COUNT(*) FROM books').fetchone()[0]
    authors = c.execute('SELECT COUNT(DISTINCT author) FROM books WHERE author IS NOT NULL AND author != ""').fetchone()[0]
    # 有体裁标签的
    tagged = c.execute('''SELECT COUNT(DISTINCT bt.book_id) FROM book_tags bt
                          JOIN tags t ON t.id=bt.tag_id WHERE t.kind='genre' ''').fetchone()[0]
    take = 0
    try:
        take = c.execute('SELECT COUNT(*) FROM books WHERE take_to_tablet=1').fetchone()[0]
    except Exception:
        pass
    dups = 0
    try:
        dups = c.execute('SELECT COUNT(*) FROM duplicates').fetchone()[0]
    except Exception:
        pass
    data = {'total': total, 'authors': authors, 'tagged': tagged,
            'untagged': total - tagged, 'take_to_tablet': take, 'duplicates_recorded': dups}
    _STATS_CACHE['at'] = _t.time()
    _STATS_CACHE['data'] = data
    return data

@app.get('/api/admin/processing')
async def api_admin_processing():
    """各维护任务的处理进度：已完成 N / 共 M + 上次时间。
    done 取自 books 上的 proc_*_at 标记列；上次时间取自 processing_batch。"""
    lib = get_lib(); c = lib.conn
    total = c.execute('SELECT COUNT(*) FROM books').fetchone()[0]
    def done_count(col):
        try:
            return c.execute(f'SELECT COUNT(*) FROM books WHERE {col} IS NOT NULL').fetchone()[0]
        except Exception:
            return None
    items = [
        {'kind': 'dedup',    'name': '去重',     'done': done_count('proc_dedup_at')},
        {'kind': 'classify', 'name': 'AI打标签', 'done': done_count('proc_classify_at')},
        {'kind': 'meta',     'name': '元数据/作者', 'done': done_count('proc_meta_at')},
        {'kind': 'finish',   'name': '完结判定', 'done': done_count('proc_finish_at')},
    ]
    # 上次运行时间/备注
    last = {}
    try:
        for r in c.execute('''SELECT kind, status, total, done, note, finished_at, started_at
                              FROM processing_batch ORDER BY id DESC'''):
            k = r['kind'] if not isinstance(r, tuple) else r[0]
            if k not in last:
                last[k] = {'status': r['status'], 'total': r['total'], 'done': r['done'],
                           'note': r['note'], 'at': r['finished_at'] or r['started_at']}
    except Exception:
        pass
    for it in items:
        lk = last.get(it['kind']) or last.get(it['kind'] + '_scan')
        it['last'] = lk
        if it['done'] is None:
            it['done'] = (lk or {}).get('done')
    return {'total': total, 'items': items}

@app.get('/api/admin/duplicates')
async def api_admin_duplicates(limit: int = 200):
    """版本管理：列出去重时被判为副本的记录，按保留的主版本分组。"""
    lib = get_lib(); c = lib.conn
    groups = {}
    try:
        rows = c.execute('''SELECT d.id, d.primary_book_id, d.original_path, d.dup_path,
                                   d.dup_size, d.reason, d.quarantine_time,
                                   b.title, b.author, b.word_count
                            FROM duplicates d LEFT JOIN books b ON b.id=d.primary_book_id
                            ORDER BY d.id DESC LIMIT ?''', (limit,))
        for r in rows:
            pid = r['primary_book_id']
            g = groups.setdefault(pid, {'primary_id': pid, 'title': r['title'], 'author': r['author'],
                                        'word_count': r['word_count'], 'dups': []})
            g['dups'].append({'dup_id': r['id'], 'original_path': r['original_path'],
                              'dup_path': r['dup_path'], 'size': r['dup_size'],
                              'reason': r['reason'], 'time': r['quarantine_time']})
    except Exception as e:
        return {'groups': [], 'error': str(e)}
    return {'groups': list(groups.values()), 'count': len(groups)}

@app.post('/api/admin/duplicate/restore')
async def api_admin_duplicate_restore(request: Request):
    """把某个被隔离的副本文件找回：从隔离区拷回 books/_restored/ 并重新登记入库。"""
    from books import _insert_book
    body = await request.json()
    dup_id = body.get('dup_id')
    if not dup_id:
        raise HTTPException(400, 'missing dup_id')
    lib = get_lib(); c = lib.conn
    r = c.execute('SELECT dup_path, original_path FROM duplicates WHERE id=?', (dup_id,)).fetchone()
    if not r:
        return {'ok': False, 'error': '找不到该副本记录'}
    dup_path = r['dup_path'] or ''
    src = (Path(lib.root) / dup_path) if dup_path else None
    if not src or not src.exists():
        return {'ok': False, 'error': '副本文件不在隔离区（可能未保留实体）'}
    dest = lib.books_dir / '_restored'
    dest.mkdir(parents=True, exist_ok=True)
    target = dest / src.name
    i = 1
    while target.exists():
        target = dest / f'{src.stem}_{i}{src.suffix}'; i += 1
    try:
        shutil.copy2(str(src), str(target))
    except Exception as e:
        return {'ok': False, 'error': '拷回失败: ' + str(e)}
    rel = str(target.relative_to(lib.root)).replace('\\', '/')
    nid = _insert_book(lib, target, rel, target.stem, '', '副本找回')
    c.execute('DELETE FROM duplicates WHERE id=?', (dup_id,))
    lib.conn.commit()
    return {'ok': bool(nid), 'new_id': nid}

@app.get('/api/admin/metadata/export')
async def api_admin_metadata_export():
    """导出每本书的元数据（书名/作者/标签/评分/状态/笔记）为 JSON，做备份信息表。"""
    lib = get_lib(); c = lib.conn
    tags_by = {}
    try:
        for r in c.execute('''SELECT bt.book_id, t.name FROM book_tags bt
                              JOIN tags t ON t.id=bt.tag_id WHERE t.kind='genre' '''):
            tags_by.setdefault(r['book_id'], []).append(r['name'])
    except Exception:
        pass
    out = []
    for r in c.execute('''SELECT id, title, author, raw_title, rating, is_read, is_favorite,
                                 reading_status, is_finished, user_notes FROM books'''):
        out.append({'title': r['title'], 'author': r['author'], 'raw_title': r['raw_title'],
                    'rating': r['rating'], 'is_read': r['is_read'], 'is_favorite': r['is_favorite'],
                    'reading_status': r['reading_status'], 'is_finished': r['is_finished'],
                    'notes': r['user_notes'], 'genres': tags_by.get(r['id'], [])})
    return {'version': 1, 'count': len(out), 'books': out}

@app.post('/api/admin/metadata/import')
async def api_admin_metadata_import(request: Request = None, file: UploadFile = File(None)):
    """导入备份信息表：按(书名+作者)或原始文件名匹配现有书，回填评分/状态/收藏/笔记 + 题材标签。
    支持本工具导出的 JSON；也支持 Moon+ Reader 的 .mrpro（读取里面的 31.tag）。"""
    lib = get_lib(); c = lib.conn
    incoming = []
    # A) .mrpro 上传
    if file is not None and (file.filename or '').lower().endswith('.mrpro'):
        import zipfile, tempfile, sqlite3 as _sq
        data = await file.read()
        try:
            with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as tf:
                tf.write(data); zp = tf.name
            with zipfile.ZipFile(zp, 'r') as z:
                names = [n for n in z.namelist() if n.endswith('31.tag')]
                if not names:
                    return {'ok': False, 'error': '.mrpro 里没找到 31.tag 信息表'}
                db_bytes = z.read(names[0])
            with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tf2:
                tf2.write(db_bytes); mdb = tf2.name
            mc = _sq.connect(mdb)
            for row in mc.execute('SELECT book, author, category FROM books'):
                book, author, category = row
                m = re.search(r'《([^》]+)》', book or '')
                title = (m.group(1).strip() if m else re.sub(r'^[\s\d\._\-\[【（(]+', '', book or '')[:60])
                cats = [x.strip() for x in (category or '').split('\n') if x.strip() and x.strip() != '(TXT)']
                incoming.append({'title': title, 'author': (author or '').strip(), 'genres': cats})
            mc.close()
        except Exception as e:
            return {'ok': False, 'error': '读取 .mrpro 失败: ' + str(e)}
    else:
        # B) JSON 体
        try:
            body = await request.json()
        except Exception:
            return {'ok': False, 'error': '需要 JSON 体或 .mrpro 文件'}
        incoming = body.get('books') or []

    # 建索引：raw_title / (title+author) / title
    idx_raw, idx_ta, idx_t = {}, {}, {}
    for r in c.execute('SELECT id, title, author, raw_title FROM books'):
        if r['raw_title']: idx_raw.setdefault(r['raw_title'].lower(), r['id'])
        idx_ta.setdefault(((r['title'] or '').lower(), (r['author'] or '').lower()), r['id'])
        idx_t.setdefault((r['title'] or '').lower(), r['id'])

    matched, tags_added, meta_set = 0, 0, 0
    for it in incoming:
        t = (it.get('title') or '').strip().lower()
        a = (it.get('author') or '').strip().lower()
        rawt = (it.get('raw_title') or '').strip().lower()
        bid = idx_raw.get(rawt) or idx_ta.get((t, a)) or idx_t.get(t)
        if not bid:
            continue
        matched += 1
        # 回填元数据（只覆盖给了的字段）
        sets, vals = [], []
        for k_in, k_db in [('rating', 'rating'), ('is_read', 'is_read'), ('is_favorite', 'is_favorite'),
                           ('reading_status', 'reading_status'), ('is_finished', 'is_finished'), ('notes', 'user_notes')]:
            if it.get(k_in) not in (None, ''):
                sets.append(f'{k_db}=?'); vals.append(it[k_in])
        if sets:
            try:
                vals.append(bid); c.execute(f'UPDATE books SET {",".join(sets)} WHERE id=?', vals); meta_set += 1
            except Exception:
                pass
        # 题材标签
        for g in (it.get('genres') or []):
            g = (g or '').strip()
            if not g:
                continue
            try:
                tid = lib.get_or_create_tag(g, kind='genre')
                cur = c.execute('INSERT OR IGNORE INTO book_tags(book_id,tag_id) VALUES(?,?)', (bid, tid))
                if cur.rowcount: tags_added += 1
            except Exception:
                pass
    lib.conn.commit()
    return {'ok': True, 'incoming': len(incoming), 'matched': matched, 'meta_updated': meta_set, 'tags_added': tags_added}

@app.post('/api/admin/task/{kind}')
async def api_admin_start_task(kind: str, request: Request):
    """启动后台任务"""
    from mylib_admin import (TASK_MANAGER, task_dedup_scan, task_dedup_apply,
                             task_classify, task_merge_authors, task_audit_coverage,
                             task_detect_finished, task_recover_authors, task_normalize_authors,
                             task_author_by_content, estimate_classify_cost,
                             task_recover_reviews,
                             task_import_folder, task_auto_collect)
    lib = get_lib()
    body = await request.json() if request.headers.get('content-type', '').startswith('application/json') else {}

    if kind == 'dedup_scan':
        task = TASK_MANAGER.create('dedup_scan')
        TASK_MANAGER.run_async(task, task_dedup_scan, lib.root)
        return {'task_id': task.id}

    elif kind == 'auto_collect':
        task = TASK_MANAGER.create('auto_collect')
        TASK_MANAGER.run_async(task, task_auto_collect, lib.root,
                               bool(body.get('move')), bool(body.get('dry_run', True)))
        return {'task_id': task.id}

    elif kind == 'import_folder':
        folder = (body.get('folder') or '').strip()
        if not folder:
            raise HTTPException(400, '请填要导入的文件夹路径')
        task = TASK_MANAGER.create('import_folder')
        TASK_MANAGER.run_async(task, task_import_folder, lib.root, folder)
        return {'task_id': task.id}

    elif kind == 'dedup_apply':
        scan_id = body.get('scan_task_id')
        scan_task = TASK_MANAGER.get(scan_id)
        if not scan_task:
            raise HTTPException(400, '请先扫描')
        overrides = body.get('overrides') or {}
        task = TASK_MANAGER.create('dedup_apply')
        TASK_MANAGER.run_async(task, task_dedup_apply, lib.root, scan_task, overrides)
        return {'task_id': task.id}

    elif kind == 'classify':
        cfg = load_config().get('ai', {})
        if not cfg.get('api_key'):
            raise HTTPException(400, 'API key 未配置')
        scope = body.get('scope', 'untagged')
        scope_value = body.get('scope_value')
        task = TASK_MANAGER.create('classify')
        TASK_MANAGER.run_async(task, task_classify, lib.root, cfg, scope, scope_value, True)
        return {'task_id': task.id}

    elif kind == 'merge_authors':
        apply = body.get('apply', False)
        task = TASK_MANAGER.create('merge')
        TASK_MANAGER.run_async(task, task_merge_authors, lib.root, apply)
        return {'task_id': task.id}

    elif kind == 'audit':
        mrpro = body.get('mrpro_path') or load_config()['library'].get('mrpro_path', '')
        if not mrpro or not Path(mrpro).exists():
            raise HTTPException(400, 'mrpro 路径无效')
        task = TASK_MANAGER.create('audit')
        TASK_MANAGER.run_async(task, task_audit_coverage, lib.root, Path(mrpro))
        return {'task_id': task.id}

    elif kind == 'detect_finished':
        resume = body.get('resume', True)
        task = TASK_MANAGER.create('detect_finished')
        TASK_MANAGER.run_async(task, task_detect_finished, lib.root, resume)
        return {'task_id': task.id}

    elif kind == 'recover_authors':
        apply = body.get('apply', False)
        task = TASK_MANAGER.create('recover_authors')
        TASK_MANAGER.run_async(task, task_recover_authors, lib.root, apply)
        return {'task_id': task.id}

    elif kind == 'normalize_authors':
        apply = body.get('apply', False)
        task = TASK_MANAGER.create('normalize_authors')
        TASK_MANAGER.run_async(task, task_normalize_authors, lib.root, apply)
        return {'task_id': task.id}

    elif kind == 'author_by_content':
        apply = body.get('apply', False)
        task = TASK_MANAGER.create('author_by_content')
        TASK_MANAGER.run_async(task, task_author_by_content, lib.root, apply)
        return {'task_id': task.id}

    elif kind == 'recover_reviews':
        apply = body.get('apply', False)
        task = TASK_MANAGER.create('recover_reviews')
        TASK_MANAGER.run_async(task, task_recover_reviews, lib.root, apply)
        return {'task_id': task.id}

    elif kind == 'list_reviews':
        from mylib_admin import task_list_all_reviews
        task = TASK_MANAGER.create('list_reviews')
        TASK_MANAGER.run_async(task, task_list_all_reviews, lib.root)
        return {'task_id': task.id}

    elif kind == 'sync_same_title':
        from mylib_admin import task_sync_same_title
        apply = body.get('apply', False)
        task = TASK_MANAGER.create('sync_same_title')
        TASK_MANAGER.run_async(task, task_sync_same_title, lib.root, apply)
        return {'task_id': task.id}

    raise HTTPException(404, f'未知任务: {kind}')

@app.get('/api/admin/task/{task_id}')
async def api_admin_task_status(task_id: str):
    """查询任务状态"""
    from mylib_admin import TASK_MANAGER
    task = TASK_MANAGER.get(task_id)
    if not task:
        raise HTTPException(404, 'task not found')
    return task.to_dict()

@app.get('/api/admin/active')
async def api_admin_active():
    """返回当前正在运行的后台任务（供全局指示条轮询）"""
    from mylib_admin import TASK_MANAGER
    running = [t for t in TASK_MANAGER.tasks.values() if t.status == 'running']
    if not running:
        return {'active': False}
    t = running[-1]
    names = {'dedup_scan':'扫描重复','dedup_apply':'执行去重','classify':'AI 打标签',
             'merge_authors':'作者合并','recover_authors':'找回作者','normalize_authors':'整理作者名','audit':'带走补全核查',
             'detect_finished':'完结识别','import_folder':'批量入库','auto_collect':'自动收拢小说'}
    return {'active': True, 'task_id': t.id, 'kind': t.kind,
            'name': names.get(t.kind, t.kind), 'progress': t.progress, 'message': t.message}

@app.post('/api/admin/task/{task_id}/cancel')
async def api_admin_cancel_task(task_id: str):
    from mylib_admin import TASK_MANAGER
    task = TASK_MANAGER.get(task_id)
    if task:
        task.cancel()
    return {'ok': True}

@app.get('/api/admin/classify/estimate')
async def api_classify_estimate(scope: str = 'untagged', scope_value: str = None):
    """预估打标签成本"""
    from mylib_admin import estimate_classify_cost
    lib = get_lib()
    return estimate_classify_cost(lib.root, scope, scope_value)

@app.get('/api/admin/authors')
async def api_admin_authors(limit: int = 50):
    """作者列表（按书数排序，供打标签选范围）"""
    lib = get_lib()
    rows = lib.conn.execute(
        '''SELECT author, COUNT(*) AS n FROM books WHERE author IS NOT NULL AND author != ""
           GROUP BY author ORDER BY n DESC LIMIT ?''', (limit,)).fetchall()
    return {'authors': [{'name': r['author'], 'count': r['n']} for r in rows]}

# ── 拖放上传入库 ─────────────────────────────────────────────────────────────

