# -*- coding: utf-8 -*-
"""自动拆分自 mylib_server_v2.py —— journey 路由。
所有路由注册在共享的 app 上（from _state import *）。逻辑与原文件逐字一致，仅做了物理分文件。"""
from _state import (app, get_lib, load_config, save_config, CONFIG, STATIC_DIR,
                     FastAPI, Query, HTTPException, Request, UploadFile, File,
                     HTMLResponse, JSONResponse, FileResponse, Path, json, os, re,
                     shutil, socket, subprocess, sys, datetime, Library)

@app.get('/api/journey/overview')
async def api_journey_overview():
    """阅读历程总览：时长、书数、标记数、收藏的话等汇总统计"""
    lib = get_lib()
    c = lib.conn
    def safe(sql, default=0):
        try:
            r = c.execute(sql).fetchone()
            return (r[0] if r and r[0] is not None else default)
        except Exception:
            return default
    # 总阅读时长（diary 的 minutes_read 累加 + mrpro 历史）
    diary_min = safe("SELECT SUM(minutes_read) FROM reading_diary")
    mrpro_ms = safe("SELECT SUM(mrpro_used_ms) FROM books")
    total_min = int(diary_min + mrpro_ms / 60000)
    # 读过的书（有进度或在读状态或diary记录）
    books_read = safe("SELECT COUNT(DISTINCT book_id) FROM reading_diary WHERE book_id IS NOT NULL")
    reading_now = 0
    try:
        c.execute("SELECT reading_status FROM books LIMIT 1")
        reading_now = safe("SELECT COUNT(*) FROM books WHERE reading_status='reading'")
    except Exception:
        pass
    # 标记统计
    notes_n = safe("SELECT COUNT(*) FROM reading_notes")
    hl_n = safe("SELECT COUNT(*) FROM highlights")
    bm_n = safe("SELECT COUNT(*) FROM bookmarks")
    # 收藏的 Quill 的话
    quill_starred = 0
    try:
        quill_starred = safe("SELECT COUNT(*) FROM quill_messages WHERE starred=1")
    except Exception:
        pass
    # 阅读天数
    days = safe("SELECT COUNT(DISTINCT date) FROM reading_diary")
    return {
        'total_minutes': total_min,
        'total_hours': round(total_min / 60, 1),
        'books_read': books_read,
        'reading_now': reading_now,
        'notes': notes_n,
        'highlights': hl_n,
        'bookmarks': bm_n,
        'marks_total': notes_n + hl_n + bm_n,
        'quill_starred': quill_starred,
        'days': days,
    }

@app.get('/api/journey/streak')
async def api_journey_streak():
    """连续阅读天数（Quill 入口小火苗）。今天还没读就从昨天往回数，读了就把今天也算上。"""
    from datetime import date, timedelta
    lib = get_lib()
    try:
        rows = lib.conn.execute('SELECT DISTINCT date FROM reading_diary').fetchall()
        days = {r[0] for r in rows if r[0]}
    except Exception:
        days = set()
    today = date.today()
    today_read = today.isoformat() in days
    cur = today if today_read else today - timedelta(days=1)
    streak = 0
    while cur.isoformat() in days:
        streak += 1
        cur -= timedelta(days=1)
    return {'streak': streak, 'today': today_read}

@app.get('/api/journey/reviews')
async def api_journey_reviews():
    """我写过的总评/简评 —— 把库里所有非空 user_notes 汇总（按最近阅读/录入排序）。
    这也是把"之前写了却看不到"的简评找回来的入口。"""
    lib = get_lib()
    c = lib.conn
    out = []
    try:
        # 优先按最近打开排序，没有 last_open 的排后面
        rows = c.execute(
            "SELECT id, title, author, rating, user_notes, last_open "
            "FROM books WHERE user_notes IS NOT NULL AND TRIM(user_notes)<>'' "
            "ORDER BY (last_open IS NULL), last_open DESC, id DESC LIMIT 500"
        ).fetchall()
        for r in rows:
            out.append({
                'id': r['id'], 'title': r['title'] or '未命名',
                'author': r['author'] or '', 'rating': r['rating'] or 0,
                'review': r['user_notes'] or '', 'last_open': r['last_open'] or '',
            })
    except Exception:
        pass
    return {'reviews': out, 'count': len(out)}

@app.get('/api/journey/timeline')
async def api_journey_timeline():
    """按日期的阅读活动流（像翻日记）"""
    lib = get_lib()
    c = lib.conn
    days = {}
    try:
        for r in c.execute('''SELECT date, book_id, book_title, book_author, chars_read, minutes_read, updated_at
                FROM reading_diary ORDER BY date DESC, updated_at DESC LIMIT 400''').fetchall():
            d = r['date']
            days.setdefault(d, {'date': d, 'books': [], 'marks': [], 'minutes': 0})
            days[d]['books'].append({'id': r['book_id'], 'title': r['book_title'] or '未知',
                                     'author': r['book_author'] or '',
                                     'chars': r['chars_read'] or 0,
                                     'minutes': r['minutes_read'] or 0,
                                     'time': (r['updated_at'] or '')})
            days[d]['minutes'] += (r['minutes_read'] or 0)
    except Exception:
        pass
    try:
        for r in c.execute('''SELECT n.created_at, n.note_text, b.title, b.id
                FROM reading_notes n LEFT JOIN books b ON b.id=n.book_id
                ORDER BY n.created_at DESC LIMIT 150''').fetchall():
            d = (r['created_at'] or '')[:10]
            if not d: continue
            days.setdefault(d, {'date': d, 'books': [], 'marks': [], 'minutes': 0})
            days[d]['marks'].append({'type': 'note', 'text': r['note_text'] or '',
                                     'book': r['title'] or '', 'book_id': r['id']})
    except Exception:
        pass
    timeline = sorted(days.values(), key=lambda x: x['date'], reverse=True)
    return {'timeline': timeline[:90]}

@app.get('/api/journey/marks')
async def api_journey_marks():
    """所有标记汇总：笔记+划线+书签，按书分组"""
    lib = get_lib()
    c = lib.conn
    marks = []
    try:
        for r in c.execute('''SELECT n.id, n.note_text, n.quote, n.created_at, b.title, b.id bid
                FROM reading_notes n LEFT JOIN books b ON b.id=n.book_id
                ORDER BY n.created_at DESC LIMIT 300''').fetchall():
            marks.append({'type': 'note', 'mark_id': r['id'], 'book': r['title'] or '未知', 'book_id': r['bid'],
                         'text': r['note_text'] or '', 'quote': r['quote'] or '',
                         'time': r['created_at'] or ''})
    except Exception:
        pass
    try:
        for r in c.execute('''SELECT h.id, h.text, h.created_at, b.title, b.id bid
                FROM highlights h LEFT JOIN books b ON b.id=h.book_id
                ORDER BY h.created_at DESC LIMIT 300''').fetchall():
            marks.append({'type': 'highlight', 'mark_id': r['id'], 'book': r['title'] or '未知', 'book_id': r['bid'],
                         'text': r['text'] or '', 'time': r['created_at'] or ''})
    except Exception:
        pass
    return {'marks': marks}

@app.get('/api/journey/collection')
async def api_journey_collection():
    """收藏汇总：把所有'留下来的东西'汇成一条时间流——
    收藏的书、划线的句子、笔记、书签（可定位到原文）、收藏的 Quill 对话。
    供总览里的'翻阅模式'使用。"""
    lib = get_lib()
    c = lib.conn
    items = []
    # 收藏的书
    try:
        for r in c.execute("SELECT id, title, author FROM books WHERE is_favorite=1 ORDER BY id DESC LIMIT 200").fetchall():
            items.append({'kind': 'book', 'book_id': r['id'], 'title': r['title'] or '未知',
                          'author': r['author'] or '', 'time': ''})
    except Exception:
        pass
    # 划线
    try:
        for r in c.execute('''SELECT h.id, h.text, h.note, h.position, h.created_at, b.title, b.id bid
                FROM highlights h LEFT JOIN books b ON b.id=h.book_id
                ORDER BY h.created_at DESC LIMIT 400''').fetchall():
            items.append({'kind': 'highlight', 'mark_id': r['id'], 'book': r['title'] or '未知', 'book_id': r['bid'],
                          'text': r['text'] or '', 'note': (r['note'] if 'note' in r.keys() else '') or '',
                          'position': r['position'] or 0, 'time': r['created_at'] or ''})
    except Exception:
        pass
    # 笔记
    try:
        for r in c.execute('''SELECT n.id, n.note_text, n.quote, n.position, n.created_at, b.title, b.id bid
                FROM reading_notes n LEFT JOIN books b ON b.id=n.book_id
                ORDER BY n.created_at DESC LIMIT 400''').fetchall():
            items.append({'kind': 'note', 'mark_id': r['id'], 'book': r['title'] or '未知', 'book_id': r['bid'],
                          'text': r['note_text'] or '', 'quote': r['quote'] or '',
                          'position': r['position'] or 0, 'time': r['created_at'] or ''})
    except Exception:
        pass
    # 书签（可定位）
    try:
        for r in c.execute('''SELECT bm.id, bm.label, bm.position, bm.percentage, bm.created_at, b.title, b.id bid
                FROM bookmarks bm LEFT JOIN books b ON b.id=bm.book_id
                ORDER BY bm.created_at DESC LIMIT 400''').fetchall():
            items.append({'kind': 'bookmark', 'mark_id': r['id'], 'book': r['title'] or '未知', 'book_id': r['bid'],
                          'text': r['label'] or '书签', 'position': r['position'] or 0,
                          'pct': r['percentage'] or 0, 'time': r['created_at'] or ''})
    except Exception:
        pass
    # 收藏的 Quill 对话
    try:
        from quill_agent import get_starred_messages
        for n in get_starred_messages(lib.root / 'library.db'):
            items.append({'kind': 'quill', 'text': n.get('content', ''),
                          'book': n.get('book_title', ''), 'time': n.get('created_at', '')})
    except Exception:
        pass
    # 每本书的阅读里程：什么时候开始看的、读到百分之几、最近看、共读多少分钟
    reading = {}
    try:
        for r in c.execute('''SELECT book_id, MIN(date) sd, MAX(date) ld, SUM(minutes_read) mins
                              FROM reading_diary WHERE book_id IS NOT NULL GROUP BY book_id''').fetchall():
            reading[r['book_id']] = {'start': r['sd'] or '', 'last': r['ld'] or '',
                                     'minutes': int(r['mins'] or 0), 'pct': 0}
    except Exception:
        pass
    try:
        for r in c.execute('''SELECT book_id, percentage FROM reading_progress
                              WHERE id IN (SELECT MAX(id) FROM reading_progress GROUP BY book_id)''').fetchall():
            d = reading.setdefault(r['book_id'], {'start': '', 'last': '', 'minutes': 0, 'pct': 0})
            d['pct'] = int(r['percentage'] or 0)
    except Exception:
        pass
    # 按时间倒序
    items.sort(key=lambda x: x.get('time', '') or '', reverse=True)
    return {'items': items, 'count': len(items), 'reading': reading}

@app.get('/api/journey/booklist')
async def api_journey_booklist():
    """读过的书单：finished / is_read / 有评分 / 有总评——带评分、简评(总评)、标签、读完时间。
    供阅读历程→回顾里的'分享书单'用，可按 作者/标签/时间 筛选。"""
    lib = get_lib(); c = lib.conn
    books = []
    try:
        has_rs = True
        try:
            c.execute("SELECT reading_status FROM books LIMIT 1")
        except Exception:
            has_rs = False
        cond = "is_read=1 OR rating>0 OR (user_notes IS NOT NULL AND user_notes!='')"
        if has_rs:
            cond = "reading_status='finished' OR " + cond
        rows = c.execute(f'''SELECT id, title, author, rating, user_notes
                             FROM books WHERE {cond}
                             ORDER BY rating DESC, id DESC LIMIT 800''').fetchall()
        ids = [r['id'] for r in rows]
        tagmap, lastmap = {}, {}
        if ids:
            qs = ','.join('?' * len(ids))
            for tr in c.execute(f"SELECT bt.book_id, t.name FROM book_tags bt JOIN tags t ON t.id=bt.tag_id WHERE t.kind='genre' AND bt.book_id IN ({qs})", ids).fetchall():
                tagmap.setdefault(tr['book_id'], []).append(tr['name'])
            for lr in c.execute(f"SELECT book_id, MAX(date) md FROM reading_diary WHERE book_id IN ({qs}) GROUP BY book_id", ids).fetchall():
                lastmap[lr['book_id']] = lr['md'] or ''
        for r in rows:
            books.append({'id': r['id'], 'title': r['title'] or '未知', 'author': r['author'] or '',
                          'rating': r['rating'] or 0, 'review': (r['user_notes'] or '').strip(),
                          'tags': tagmap.get(r['id'], []), 'time': lastmap.get(r['id'], '')})
    except Exception:
        pass
    return {'books': books, 'count': len(books)}

@app.get('/api/journey/quill-notes')
async def api_journey_quill_notes():
    """收藏的 Quill 的话"""
    from quill_agent import get_starred_messages
    lib = get_lib()
    try:
        return {'notes': get_starred_messages(lib.root / 'library.db')}
    except Exception:
        return {'notes': []}

@app.get('/api/journey/garden')
def api_journey_garden():
    """读书统计：每本读过/在读的书一棵树，按书显示，可各自选树种。
    放线程池跑 + 批量取进度/完成月份（不再每棵树单独查一次），快很多；
    并附带"完成月份"供前端按时间归类（不再堆成一片）。"""
    from _state import read_conn
    c = read_conn()
    try:
        has_rs = True
        try:
            c.execute("SELECT reading_status FROM books LIMIT 1")
        except Exception:
            has_rs = False
        has_skin = True
        try:
            c.execute("SELECT tree_skin FROM books LIMIT 1")
        except Exception:
            has_skin = False
        has_lo = True
        try:
            c.execute("SELECT last_open FROM books LIMIT 1")
        except Exception:
            has_lo = False

        # 一次性取所有进度（最新一条）与"最后阅读日期"，避免逐棵树查询
        prog_map = {}
        try:
            for r in c.execute('''SELECT book_id, percentage FROM reading_progress
                    WHERE id IN (SELECT MAX(id) FROM reading_progress GROUP BY book_id)'''):
                if r['percentage']:
                    prog_map[r['book_id']] = int(r['percentage'])
        except Exception:
            pass
        month_map = {}
        try:
            for r in c.execute("SELECT book_id, MAX(date) md FROM reading_diary GROUP BY book_id"):
                if r['md']:
                    month_map[r['book_id']] = r['md'][:7]
        except Exception:
            pass

        trees = []
        seen = set()
        skin_col = ", tree_skin" if has_skin else ""
        rs_col = ", reading_status" if has_rs else ""
        lo_col = ", last_open" if has_lo else ""
        # 只给"真正在这个软件里读过"的书种树：有阅读记录(diary) / 有阅读进度 / 用户设过在读·读完状态。
        # 不再用 is_read=1（那是导入/完结识别批量打的，会冒出几千棵假树）。
        read_ids = set(prog_map.keys()) | set(month_map.keys())
        try:
            for r in c.execute("SELECT book_id FROM reading_diary WHERE book_id IS NOT NULL"):
                read_ids.add(r['book_id'])
        except Exception:
            pass
        if has_rs:
            try:
                for r in c.execute("SELECT id FROM books WHERE reading_status IN ('reading','finished')"):
                    read_ids.add(r['id'])
            except Exception:
                pass
        if not read_ids:
            return {'trees': [], 'finished_count': 0, 'total': 0}
        # 把这些书取出来（分批 IN 查询，避免 id 太多）
        id_list = list(read_ids)
        status_map = {}
        try:
            for i in range(0, len(id_list), 800):
                chunk = id_list[i:i+800]
                q = ','.join('?' * len(chunk))
                for r in c.execute(f'''SELECT id, title, author{rs_col}{skin_col}{lo_col}
                        FROM books WHERE id IN ({q})''', chunk).fetchall():
                    if r['id'] in seen:
                        continue
                    seen.add(r['id'])
                    rs = (r['reading_status'] if has_rs else '') or ''
                    prog = prog_map.get(r['id'], 0)
                    finished = (rs == 'finished') or (prog >= 95)
                    trees.append({
                        'id': r['id'], 'title': r['title'] or '未命名', 'author': r['author'] or '',
                        'progress': (100 if finished else prog), 'finished': finished,
                        'skin': (r['tree_skin'] if has_skin and r['tree_skin'] else 'spruce'),
                        'month': month_map.get(r['id'], ''),
                        'lo': (r['last_open'] if has_lo else '') or '',
                    })
        except Exception:
            pass
        # 最新阅读的排最前（和书架一致）：先按 last_open 倒序，没有的退回按完成月份倒序
        trees.sort(key=lambda t: (t.get('lo') or '', t.get('month') or '0000-00'), reverse=True)
        finished_count = sum(1 for t in trees if t['finished'])
        # 历史树：同一本书往期读完的那几轮（读完→再读时留的档）
        try:
            for r in c.execute("SELECT id, book_id, title, author, skin, month, created_at FROM tree_history ORDER BY id"):
                trees.append({
                    'id': 'h%d' % r['id'], 'title': (r['title'] or '未命名') , 'author': r['author'] or '',
                    'progress': 100, 'finished': True, 'skin': r['skin'] or 'spruce',
                    'month': r['month'] or '', 'lo': (r['created_at'] or '')[:10], 'hist': 1,
                })
        except Exception:
            pass
        return {
            'trees': trees,
            'finished_count': finished_count,
            'total': len(trees),
        }
    finally:
        try:
            c.close()
        except Exception:
            pass

@app.post('/api/book/tree-skin')
async def api_set_tree_skin(request: Request):
    """给某本书设置树种皮肤"""
    body = await request.json()
    lib = get_lib()
    try:
        lib.conn.execute("UPDATE books SET tree_skin=? WHERE id=?", (body.get('skin', 'spruce'), body['book_id']))
        lib.conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.post('/api/journey/trees/batch')
async def api_trees_batch(request: Request):
    """对多棵树批量操作：action='skin' 一起换树种/换色；action='remove' 一起移除。"""
    data = await request.json()
    ids = [int(i) for i in (data.get('book_ids') or []) if str(i).strip()]
    action = data.get('action')
    if not ids:
        return {'ok': False, 'error': 'no ids'}
    lib = get_lib()
    c = lib.conn
    qs = ','.join('?' * len(ids))
    try:
        if action == 'skin':
            skin = data.get('skin') or 'spruce'
            c.execute(f"UPDATE books SET tree_skin=? WHERE id IN ({qs})", [skin] + ids)
        elif action == 'remove':
            c.execute(f"DELETE FROM reading_progress WHERE book_id IN ({qs})", ids)
            try:
                c.execute(f"UPDATE books SET is_read=0 WHERE id IN ({qs})", ids)
            except Exception:
                pass
            try:
                c.execute(f"UPDATE books SET reading_status='unread' WHERE id IN ({qs})", ids)
            except Exception:
                pass
        else:
            return {'ok': False, 'error': 'bad action'}
        lib.conn.commit()
        return {'ok': True, 'n': len(ids)}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.delete('/api/journey/tree-history/{hid}')
async def api_del_tree_history(hid: int):
    """删除一棵历史树（往期读完留档的那种）"""
    lib = get_lib()
    try:
        lib.conn.execute("DELETE FROM tree_history WHERE id=?", (hid,))
        lib.conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.delete('/api/journey/tree/{book_id}')
async def api_delete_tree(book_id: int):
    """移除一棵树：清掉这本书的阅读足迹（进度 + 日记 + 完结标记），
    花园里就不再显示它。不删书本身，也不动划线/笔记/书签。"""
    lib = get_lib()
    c = lib.conn
    try:
        c.execute("DELETE FROM reading_progress WHERE book_id=?", (book_id,))
        c.execute("DELETE FROM reading_diary WHERE book_id=?", (book_id,))
        try:
            c.execute("UPDATE books SET reading_status='unread' WHERE id=?", (book_id,))
        except Exception:
            pass
        lib.conn.commit()
        return {'ok': True}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

@app.delete('/api/journey/trees')
async def api_delete_all_trees():
    """清空花园里所有的树：重置所有书的"已读/在读"状态 + 清掉进度条。
    保留阅读历程/统计（不动 diary），也不删书、不动划线/笔记/书签。"""
    lib = get_lib()
    c = lib.conn
    has_rs = True
    try:
        c.execute("SELECT reading_status FROM books LIMIT 1")
    except Exception:
        has_rs = False
    cond = "is_read=1" + (" OR reading_status IN ('reading','finished')" if has_rs else "")
    try:
        n = c.execute(f"SELECT COUNT(*) FROM books WHERE {cond}").fetchone()[0]
    except Exception:
        n = 0
    try:
        c.execute("DELETE FROM reading_progress")
        try:
            c.execute("UPDATE books SET is_read=0 WHERE is_read=1")
        except Exception:
            pass
        if has_rs:
            c.execute("UPDATE books SET reading_status='unread' WHERE reading_status IN ('reading','finished')")
        lib.conn.commit()
        return {'ok': True, 'cleared': n}
    except Exception as e:
        return {'ok': False, 'error': str(e)}
async def api_journey_card(theme: str = Query('sage')):
    """生成阅读历程分享卡片（SVG）"""
    from booklist_export import build_journey_card
    from fastapi.responses import Response
    lib = get_lib()
    c = lib.conn
    def safe(sql, d=0):
        try:
            r = c.execute(sql).fetchone(); return (r[0] if r and r[0] is not None else d)
        except Exception:
            return d
    diary_min = safe("SELECT SUM(minutes_read) FROM reading_diary")
    mrpro_ms = safe("SELECT SUM(mrpro_used_ms) FROM books")
    total_min = int(diary_min + mrpro_ms / 60000)
    stats = {
        'total_hours': round(total_min / 60, 1),
        'books_read': safe("SELECT COUNT(DISTINCT book_id) FROM reading_diary WHERE book_id IS NOT NULL"),
        'days': safe("SELECT COUNT(DISTINCT date) FROM reading_diary"),
        'marks_total': safe("SELECT COUNT(*) FROM reading_notes") + safe("SELECT COUNT(*) FROM highlights") + safe("SELECT COUNT(*) FROM bookmarks"),
        'finished_count': safe("SELECT COUNT(*) FROM books WHERE is_read=1"),
    }
    svg = build_journey_card(stats, theme)
    return Response(content=svg, media_type='image/svg+xml')

# ── 书房主题 / 背景自定义 ─────────────────────────────────────────────────────


# ===== 阅读历程分享卡片（SVG） =====
# 修复：前端"生成卡片"一直在调这个接口，但它从来没被实现过 → 预览裂图、下载 404。
_CARD_SKINS = {
    #        底色        卡片        主字      辅字      点缀      描边
    'sage':  ('#e7ece3', '#f3f6f0', '#3f4a3c', '#7d8a78', '#6f8a68', '#d4ddd0'),
    'mist':  ('#e3eaef', '#f1f5f8', '#3d4a55', '#7b8894', '#6d8598', '#d2dce3'),
    'cream': ('#f4ecdd', '#faf5ea', '#574a38', '#9a8c74', '#b08d57', '#e6dcc8'),
    'paper': ('#efeae0', '#f8f5ee', '#46413a', '#8d867b', '#9d8b7a', '#e0d9cc'),
    'kraft': ('#d9c4a5', '#e6d6bd', '#4d3f2c', '#8a7658', '#7d6644', '#c9b28c'),
    'dark':  ('#2e3238', '#3a3f46', '#e8e4dc', '#a7a49c', '#c9b98a', '#4a5058'),
}

@app.get('/api/journey/card')
async def api_journey_card(theme: str = 'sage'):
    """把阅读历程画成一张可保存的 SVG 卡片（皮肤跟前端按钮一一对应）"""
    from fastapi.responses import Response
    from datetime import date
    bg, card, ink, soft, accent, line = _CARD_SKINS.get(theme, _CARD_SKINS['sage'])
    d = await api_journey_overview()   # 复用总览统计，口径保持一致
    hours = d.get('total_hours', 0) or 0
    time_num, time_unit = (int(hours) if float(hours).is_integer() else hours, '小时') if hours >= 1 \
        else (d.get('total_minutes', 0) or 0, '分钟')
    today = date.today()
    stats = [
        (time_num, time_unit, '阅读时长'),
        (d.get('days', 0), '天', '有书相伴'),
        (d.get('books_read', 0), '本', '读过的书'),
        (d.get('marks_total', 0), '处', '标记与笔记'),
    ]
    # 顶部小书堆装饰：几本高矮胖瘦不一的小书脊
    spines, x = [], 262
    for w, h, c in ((14, 34, accent), (11, 42, soft), (16, 38, accent), (10, 30, soft), (13, 44, accent), (12, 36, soft)):
        spines.append(f'<rect x="{x}" y="{126 - h}" width="{w}" height="{h}" rx="2.5" fill="{c}" opacity="0.85"/>')
        x += w + 6
    cells = []
    for i, (num, unit, label) in enumerate(stats):
        cx = 180 + (i % 2) * 300
        cy = 420 + (i // 2) * 170
        cells.append(
            f'<text x="{cx}" y="{cy}" text-anchor="middle" font-size="54" font-weight="700" fill="{accent}" '
            f'font-family="Georgia,serif">{num}<tspan font-size="20" fill="{soft}" dx="6">{unit}</tspan></text>'
            f'<text x="{cx}" y="{cy + 36}" text-anchor="middle" font-size="15" fill="{soft}" '
            f'font-family="-apple-system,PingFang SC,Microsoft YaHei,sans-serif">{label}</text>'
        )
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="660" height="880" viewBox="0 0 660 880">
<rect width="660" height="880" fill="{bg}"/>
<rect x="36" y="36" width="588" height="808" rx="26" fill="{card}" stroke="{line}" stroke-width="1.5"/>
<rect x="52" y="52" width="556" height="776" rx="18" fill="none" stroke="{line}" stroke-width="1" opacity="0.6"/>
{''.join(spines)}
<line x1="240" y1="136" x2="420" y2="136" stroke="{line}" stroke-width="1.5"/>
<text x="330" y="212" text-anchor="middle" font-size="36" font-weight="600" fill="{ink}" font-family="Georgia,STSong,serif">我的阅读历程</text>
<text x="330" y="248" text-anchor="middle" font-size="14" fill="{soft}" font-family="-apple-system,PingFang SC,Microsoft YaHei,sans-serif">{today.year} 年 {today.month} 月 {today.day} 日</text>
<line x1="150" y1="300" x2="510" y2="300" stroke="{line}" stroke-width="1"/>
{''.join(cells)}
<line x1="150" y1="736" x2="510" y2="736" stroke="{line}" stroke-width="1"/>
<text x="330" y="782" text-anchor="middle" font-size="13" fill="{soft}" font-family="-apple-system,PingFang SC,Microsoft YaHei,sans-serif" letter-spacing="2">MyLibrary · 私人书房</text>
</svg>'''
    return Response(content=svg, media_type='image/svg+xml',
                    headers={'Cache-Control': 'no-store'})

