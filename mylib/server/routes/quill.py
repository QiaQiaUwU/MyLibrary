# -*- coding: utf-8 -*-
"""自动拆分自 mylib_server_v2.py —— quill 路由。
所有路由注册在共享的 app 上（from _state import *）。逻辑与原文件逐字一致，仅做了物理分文件。"""
from _state import (app, get_lib, load_config, save_config, CONFIG, STATIC_DIR,
                     FastAPI, Query, HTTPException, Request, UploadFile, File,
                     HTMLResponse, JSONResponse, FileResponse, Path, json, os, re,
                     shutil, socket, subprocess, sys, datetime, Library)

@app.post('/api/quill/chat')
async def api_quill_chat(request: Request):
    # quill_chat 兜底:任何异常都把真实原因带回给前端,别再让用户看'走神了'
    try:
        """与 Quill 对话（带会话存储）"""
        from quill_agent import run_quill, add_message, create_session, get_session_messages
        body = await request.json()
        msg = body.get('message', '')
        tone = body.get('tone', 'warm')
        custom = body.get('custom_persona', '')
        interaction_style = body.get('interaction_style', '')
        session_id = body.get('session_id')
        book_id = body.get('book_id')
        book_title = body.get('book_title', '')
        if not msg.strip():
            raise HTTPException(400, 'empty message')
        cfg = load_config().get('ai', {})
        if not cfg.get('api_key'):
            return {'reply': '（Quill 还没醒来——需要先在设置页配置 AI 的 API key，我才能陪你聊天哦）', 'timer': None, 'session_id': session_id}
        lib = get_lib()
        db = lib.root / 'library.db'
        # 没有会话则新建
        if not session_id:
            session_id = create_session(db, book_id=book_id, book_title=book_title)
        # 从会话历史构造上下文
        stored = get_session_messages(db, session_id)
        history = [{'role': m['role'], 'content': m['content']} for m in stored]
        # 存用户消息
        user_msg_id = add_message(db, session_id, 'user', msg)
        image = body.get('image') or ''
        result = run_quill(msg, db, cfg, tone, custom, history, interaction_style, image=image)
        # 存 Quill 回复
        reply_id = add_message(db, session_id, 'assistant', result.get('reply', ''))
        result['session_id'] = session_id
        result['user_msg_id'] = user_msg_id
        result['reply_id'] = reply_id
        return result
    except Exception as _e:
        import traceback
        print(f'[quill_chat 出错] {type(_e).__name__}: {_e}')
        traceback.print_exc()   # 完整堆栈打进服务端控制台——之前只把类型+消息带回前端，丢了"到底是哪一行"，出了问题没法追
        return {'reply': None, 'error': f'{type(_e).__name__}: {str(_e)[:200]}', 'session_id': None}

@app.get('/api/quill/quickstat')
async def api_quill_quickstat(kind: str = Query(...), value: str = Query('')):
    """Quill 快捷统计（纯本地，不花 token）"""
    from quill_agent import quick_stat
    lib = get_lib()
    return quick_stat(kind, lib.root / 'library.db', value)

@app.get('/api/quill/sessions')
async def api_quill_sessions(book_id: int = Query(None)):
    """列出会话（book_id 指定则只列该书的）"""
    from quill_agent import list_sessions
    lib = get_lib()
    return {'sessions': list_sessions(lib.root / 'library.db', book_id)}

@app.post('/api/quill/session/new')
async def api_quill_session_new(request: Request):
    """新建会话"""
    from quill_agent import create_session
    body = await request.json()
    lib = get_lib()
    sid = create_session(lib.root / 'library.db',
                         book_id=body.get('book_id'),
                         book_title=body.get('book_title', ''),
                         title=body.get('title', ''))
    return {'session_id': sid}

@app.get('/api/quill/session/{session_id}')
async def api_quill_session_get(session_id: int):
    """获取某会话的所有消息"""
    from quill_agent import get_session_messages
    lib = get_lib()
    return {'messages': get_session_messages(lib.root / 'library.db', session_id)}

@app.delete('/api/quill/session/{session_id}')
async def api_quill_session_delete(session_id: int):
    from quill_agent import delete_session
    lib = get_lib()
    delete_session(lib.root / 'library.db', session_id)
    return {'ok': True}

@app.post('/api/quill/message/star')
async def api_quill_star(request: Request):
    """收藏/取消收藏一条对话（值得记下的话）"""
    from quill_agent import star_message
    body = await request.json()
    lib = get_lib()
    star_message(lib.root / 'library.db', body['message_id'], body.get('starred', True))
    return {'ok': True}

@app.post('/api/quill/messages/truncate')
async def api_quill_messages_truncate(request: Request):
    """撤回某条消息（连带它之后的一并删掉）——"撤回改问"和"重新生成"共用这一步。"""
    from quill_agent import delete_messages_from
    body = await request.json()
    session_id, from_id = body.get('session_id'), body.get('from_message_id')
    if not session_id or not from_id:
        raise HTTPException(400, 'session_id and from_message_id required')
    delete_messages_from(get_lib().root / 'library.db', session_id, from_id)
    return {'ok': True}

@app.get('/api/quill/starred')
async def api_quill_starred():
    """所有收藏的对话"""
    from quill_agent import get_starred_messages
    lib = get_lib()
    return {'starred': get_starred_messages(lib.root / 'library.db')}

@app.get('/api/quill/memory')
async def api_quill_memory():
    """查看 Quill 的全局记忆（用户画像等）"""
    from quill_agent import get_all_memory
    lib = get_lib()
    return get_all_memory(lib.root / 'library.db')

# ── 配置 ─────────────────────────────────────────────────────────────────────


# ── Quill 贴图仓库（用户上传的表情包，本地存储） ──
def _stk_dir():
    lib = get_lib()
    d = lib.root / '_quill_stickers'
    d.mkdir(exist_ok=True)
    return d

@app.get('/api/quill/stickers')
async def api_quill_stickers():
    d = _stk_dir()
    out = []
    for f in sorted(d.iterdir()):
        if f.suffix.lower() in ('.png', '.jpg', '.jpeg', '.gif', '.webp'):
            out.append({'name': f.stem, 'file': f.name})
    return {'stickers': out}

@app.post('/api/quill/sticker-upload')
async def api_quill_sticker_upload(file: UploadFile = File(...)):
    d = _stk_dir()
    ext = Path(file.filename or '').suffix.lower()
    if ext not in ('.png', '.jpg', '.jpeg', '.gif', '.webp'):
        return {'ok': False, 'error': '只收 png/jpg/gif/webp'}
    stem = re.sub(r'[\\/:*?"<>|\s]+', '_', Path(file.filename).stem)[:24] or 'sticker'
    tgt = d / (stem + ext)
    i = 1
    while tgt.exists():
        tgt = d / f'{stem}_{i}{ext}'
        i += 1
    tgt.write_bytes(await file.read())
    return {'ok': True, 'name': tgt.stem, 'file': tgt.name}

@app.post('/api/quill/sticker-import')
async def api_quill_sticker_import(request: Request):
    """批量导入表情：前端解析出 [{name,url}]，这里逐个下载进 _quill_stickers。
    只收 image/*、单张 ≤5MB；重名自动加 -2/-3；坏链接计入 fail 不中断。"""
    import requests as _rq
    body = await request.json()
    items = body.get('items') or []
    d = _stk_dir()
    ok, fail, fails = 0, 0, []
    _CT_EXT = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp'}
    for it in items[:60]:
        url = (it.get('url') or '').strip()
        name = (it.get('name') or '').strip() or 'sticker'
        try:
            r = _rq.get(url, timeout=12, stream=True, headers={'User-Agent': 'MyLibrary/4.2'})
            r.raise_for_status()
            ct = (r.headers.get('Content-Type') or '').split(';')[0].strip().lower()
            ext = _CT_EXT.get(ct)
            if not ext:  # 有些图床不给 CT，用后缀兜底
                low = url.lower().split('?')[0]
                ext = next((e for e in ('.png', '.jpg', '.jpeg', '.gif', '.webp') if low.endswith(e)), None)
            if not ext:
                raise ValueError('不是图片链接')
            data = b''
            for chunk in r.iter_content(65536):
                data += chunk
                if len(data) > 5 * 1024 * 1024:
                    raise ValueError('超过 5MB')
            if len(data) < 100:
                raise ValueError('内容为空')
            stem = re.sub(r'[\\/:*?"<>|\s]+', '_', name)[:24] or 'sticker'
            p = d / (stem + ext)
            n = 2
            while p.exists():
                p = d / (f'{stem}-{n}{ext}'); n += 1
            p.write_bytes(data)
            ok += 1
        except Exception as e:
            fail += 1
            fails.append({'url': url[:80], 'why': str(e)[:60]})
    return {'ok_count': ok, 'fail_count': fail, 'fails': fails[:10]}


async def api_quill_sticker(name: str):
    d = _stk_dir()
    for f in d.iterdir():
        if f.stem == name and f.suffix.lower() in ('.png', '.jpg', '.jpeg', '.gif', '.webp'):
            return FileResponse(str(f))
    raise HTTPException(404, 'no sticker')

@app.delete('/api/quill/sticker/{name}')
async def api_quill_sticker_del(name: str):
    d = _stk_dir()
    for f in d.iterdir():
        if f.stem == name:
            f.unlink()
            return {'ok': True}
    return {'ok': False}


@app.post('/api/quill/sticker-import')
async def api_quill_sticker_import(request: Request):
    """批量导入：[{name,url}]，服务端下载保存（≤3MB/张）。"""
    body = await request.json()
    items = body.get('items') or []
    d = _stk_dir()
    ok = fail = 0
    import requests as _rq
    for it in items[:40]:
        try:
            url = (it.get('url') or '').strip()
            if not url.startswith('http'):
                fail += 1; continue
            r = _rq.get(url, timeout=10, stream=True, headers={'User-Agent': 'MyLibrary/1.0'})
            ct = (r.headers.get('content-type') or '').lower()
            ext = '.png' if 'png' in ct else '.gif' if 'gif' in ct else '.webp' if 'webp' in ct else '.jpg'
            data = r.content
            if len(data) > 3*1024*1024:
                fail += 1; continue
            stem = re.sub(r'[\\/:*?"<>|\s]+', '_', (it.get('name') or 'sticker'))[:24] or 'sticker'
            tgt = d / (stem + ext)
            i = 1
            while tgt.exists():
                tgt = d / f'{stem}_{i}{ext}'; i += 1
            tgt.write_bytes(data)
            ok += 1
        except Exception:
            fail += 1
    return {'ok': True, 'ok_count': ok, 'fail_count': fail}


# ── 记忆管理 ──
@app.get('/api/quill/memories')
async def api_quill_memories():
    from quill_agent import _mem_conn
    lib = get_lib()
    conn = _mem_conn(lib.root / 'library.db')
    try:
        rows = conn.execute('SELECT key, value, updated_at FROM quill_memory ORDER BY updated_at DESC').fetchall()
        return {'memories': [{'key': r[0], 'value': r[1], 'updated_at': r[2]} for r in rows]}
    finally:
        conn.close()

@app.post('/api/quill/memories')
async def api_quill_memories_set(request: Request):
    from quill_agent import set_memory
    body = await request.json()
    k = (body.get('key') or '').strip()[:40]
    v = (body.get('value') or '').strip()[:400]
    if not k:
        return {'ok': False}
    set_memory(get_lib().root / 'library.db', k, v)
    return {'ok': True}

@app.delete('/api/quill/memories/{key}')
async def api_quill_memories_del(key: str):
    from quill_agent import _mem_conn
    conn = _mem_conn(get_lib().root / 'library.db')
    try:
        conn.execute('DELETE FROM quill_memory WHERE key=?', (key,))
        conn.commit()
        return {'ok': True}
    finally:
        conn.close()


# ── 待办（Quill 记的，前端到点提醒） ──
@app.get('/api/quill/todos')
async def api_quill_todos():
    from quill_agent import _todo_conn
    conn = _todo_conn(get_lib().root / 'library.db')
    try:
        rows = conn.execute('SELECT id,text,due,done FROM quill_todos ORDER BY done,(due=""),due,id').fetchall()
        return {'todos': [{'id': r[0], 'text': r[1], 'due': r[2], 'done': bool(r[3])} for r in rows]}
    finally:
        conn.close()

@app.post('/api/quill/todos/{tid}/done')
async def api_quill_todo_done(tid: int):
    from quill_agent import _todo_conn
    conn = _todo_conn(get_lib().root / 'library.db')
    try:
        conn.execute('UPDATE quill_todos SET done=1 WHERE id=?', (tid,))
        conn.commit()
        return {'ok': True}
    finally:
        conn.close()

@app.delete('/api/quill/todos/{tid}')
async def api_quill_todo_del(tid: int):
    from quill_agent import _todo_conn
    conn = _todo_conn(get_lib().root / 'library.db')
    try:
        conn.execute('DELETE FROM quill_todos WHERE id=?', (tid,))
        conn.commit()
        return {'ok': True}
    finally:
        conn.close()

@app.post('/api/quill/todos/{tid}')
async def api_quill_todo_edit(tid: int, request: Request):
    """改一条待办的文字/时间/完成状态（日历点开编辑用；之前只有勾完成/删，没法改内容或撤销完成）"""
    from quill_agent import _todo_conn
    b = await request.json()
    conn = _todo_conn(get_lib().root / 'library.db')
    try:
        if 'text' in b:
            conn.execute('UPDATE quill_todos SET text=? WHERE id=?', ((b.get('text') or '').strip()[:200], tid))
        if 'due' in b:
            conn.execute('UPDATE quill_todos SET due=? WHERE id=?', ((b.get('due') or '').strip()[:20], tid))
        if 'done' in b:
            conn.execute('UPDATE quill_todos SET done=? WHERE id=?', (1 if b.get('done') else 0, tid))
        conn.commit()
        return {'ok': True}
    finally:
        conn.close()

@app.post('/api/quill/todos/quick')
async def api_quill_todo_quick(request: Request):
    """日历「＋待办」的快捷建条：不经过 AI、不花 token，直接落库（对话里说'提醒我…'走的是另一条路 todo_add 工具）"""
    from quill_agent import _todo_conn
    from datetime import datetime as _dt
    b = await request.json()
    text = (b.get('text') or '').strip()[:200]
    if not text:
        raise HTTPException(400, 'text required')
    due = (b.get('due') or '').strip()[:20]
    conn = _todo_conn(get_lib().root / 'library.db')
    try:
        cur = conn.execute('INSERT INTO quill_todos(text,due,created_at) VALUES(?,?,?)', (text, due, _dt.now().isoformat()))
        conn.commit()
        return {'ok': True, 'id': cur.lastrowid}
    finally:
        conn.close()

@app.get('/api/quill/calendar')
async def api_quill_calendar(month: str = Query(...)):
    """月视图聚合：某月每天的待办（按 due 日期分组）+ 习惯打卡情况。
    month='YYYY-MM'。习惯只对"今天或更早、且该习惯当时已创建"的日子给出打卡状态——
    习惯是每天重复的事，不像待办有具体到期日，往未来投影没有意义。"""
    import re as _re, calendar as _cal
    from datetime import date as _date
    from quill_agent import _todo_conn, _habit_conn
    if not _re.match(r'^\d{4}-\d{2}$', month or ''):
        raise HTTPException(400, 'month must be YYYY-MM')
    y, m = int(month[:4]), int(month[5:7])
    days_in_month = _cal.monthrange(y, m)[1]
    today = _date.today()
    lib_root = get_lib().root / 'library.db'

    days = {f'{y:04d}-{m:02d}-{d:02d}': {'todos': [], 'habits_done': 0, 'habits_total': 0, 'habits': []}
            for d in range(1, days_in_month + 1)}

    tconn = _todo_conn(lib_root)
    try:
        for r in tconn.execute("SELECT id,text,due,done FROM quill_todos WHERE due LIKE ? ORDER BY due", (f'{month}-%',)):
            key = r[2][:10]
            if key in days:
                days[key]['todos'].append({'id': r[0], 'text': r[1], 'due': r[2], 'done': bool(r[3])})
    finally:
        tconn.close()

    hconn = _habit_conn(lib_root)
    try:
        habits = hconn.execute("SELECT id,name,created_at FROM quill_habits ORDER BY id").fetchall()
        logs = {(r[0], r[1]) for r in hconn.execute(
            "SELECT habit_id,date FROM quill_habit_log WHERE date LIKE ?", (f'{month}-%',)).fetchall()}
        for d in range(1, days_in_month + 1):
            dt = _date(y, m, d)
            if dt > today:
                continue   # 习惯不往未来投影
            key = dt.isoformat()
            active = [h for h in habits if (h[2] or '')[:10] <= key]
            days[key]['habits_total'] = len(active)
            done_list = []
            for h in active:
                on = (h[0], key) in logs
                if on:
                    days[key]['habits_done'] += 1
                done_list.append({'id': h[0], 'name': h[1], 'done': on})
            days[key]['habits'] = done_list
    finally:
        hconn.close()

    return {'month': month, 'days': days}


# ── 习惯打卡（每日提醒 + 连续天数 + 目标奖牌） ──
@app.get('/api/quill/habits')
async def api_quill_habits():
    from quill_agent import habit_list_op
    return {'habits': habit_list_op(get_lib().root / 'library.db')}

@app.post('/api/quill/habits')
async def api_quill_habit_add(request: Request):
    from quill_agent import habit_add_op
    b = await request.json()
    return habit_add_op(get_lib().root / 'library.db',
                        b.get('name', ''), b.get('remind_time', ''), b.get('goal', 21))

@app.post('/api/quill/habits/{hid}/checkin')
async def api_quill_habit_checkin(hid: int):
    from quill_agent import habit_checkin_op
    return habit_checkin_op(get_lib().root / 'library.db', hid=hid)

@app.post('/api/quill/habits/{hid}')
async def api_quill_habit_update(hid: int, request: Request):
    from quill_agent import _habit_conn
    b = await request.json()
    conn = _habit_conn(get_lib().root / 'library.db')
    try:
        if 'name' in b:
            conn.execute('UPDATE quill_habits SET name=? WHERE id=?', ((b['name'] or '').strip()[:40], hid))
        if 'remind_time' in b:
            conn.execute('UPDATE quill_habits SET remind_time=? WHERE id=?', ((b['remind_time'] or '').strip()[:5], hid))
        if 'goal' in b:
            # 改目标后奖牌资格重算（新目标更高时收回未达成的奖牌）
            conn.execute('UPDATE quill_habits SET goal=? WHERE id=?', (max(1, int(b['goal'] or 21)), hid))
            from quill_agent import habit_stats
            st = habit_stats(conn, hid)
            if st['streak'] < max(1, int(b['goal'] or 21)):
                conn.execute("UPDATE quill_habits SET medal_at='' WHERE id=?", (hid,))
        conn.commit()
        return {'ok': True}
    finally:
        conn.close()

@app.delete('/api/quill/habits/{hid}')
async def api_quill_habit_del(hid: int):
    from quill_agent import _habit_conn
    conn = _habit_conn(get_lib().root / 'library.db')
    try:
        conn.execute('DELETE FROM quill_habits WHERE id=?', (hid,))
        conn.execute('DELETE FROM quill_habit_log WHERE habit_id=?', (hid,))
        conn.commit()
        return {'ok': True}
    finally:
        conn.close()

@app.get('/api/quill/habits/heat')
async def api_quill_habit_heat(days: int = 150):
    """热力图数据：每天所有习惯合计打了几次卡（参考打卡类应用的月历视图）。"""
    from quill_agent import _habit_conn
    from datetime import date, timedelta
    conn = _habit_conn(get_lib().root / 'library.db')
    try:
        cutoff = (date.today() - timedelta(days=max(30, min(400, days)))).isoformat()
        out = {}
        for r in conn.execute('SELECT date, COUNT(*) FROM quill_habit_log WHERE date>=? GROUP BY date', (cutoff,)):
            out[r[0]] = r[1]
        total = conn.execute('SELECT COUNT(*) FROM quill_habits').fetchone()[0]
        return {'days': out, 'habits': total}
    finally:
        conn.close()


# ── 当前节气（Quill 入口佩饰用；不需要图书馆就绪） ──
# v4.5.1：一节气一款（此前 11 款盖 24 节气，交节日经常看不出"换皮肤"）。
_JIEQI_MOTIF = {
    '立春': 'bud', '雨水': 'rainleaf', '惊蛰': 'blossom', '春分': 'swallow', '清明': 'kite', '谷雨': 'peony',
    '立夏': 'lotus', '小满': 'greenwheat', '芒种': 'plumfruit', '夏至': 'cicada', '小暑': 'dragonfly', '大暑': 'melon',
    '立秋': 'leaf', '处暑': 'rice', '白露': 'reed', '秋分': 'osmanthus', '寒露': 'chrys', '霜降': 'persimmon',
    '立冬': 'camellia', '小雪': 'snowman', '大雪': 'pinesnow', '冬至': 'narcissus', '小寒': 'plum', '大寒': 'nandina',
}

@app.get('/api/quill/daily-fortune')
async def api_quill_daily_fortune():
    """每日一签的吉签级别：有生辰记忆按八字流日真算，没有就退回加权随机（见 quill_agent.daily_fortune_level）。"""
    from quill_agent import daily_fortune_level
    return daily_fortune_level(get_lib().root / 'library.db')

@app.get('/api/quill/season')
async def api_quill_season():
    from quill_agent import current_jieqi, today_extras, _JIEQI24
    from datetime import date
    term = current_jieqi()
    out = {'term': term, 'motif': _JIEQI_MOTIF.get(term, 'leaf')}
    t = date.today()
    for m, d, name in _JIEQI24:
        if name == term:
            out['date'] = f'{m}月{d}日'
            out['is_term_day'] = (t.month, t.day) == (m, d)
            break
    try:
        ex = today_extras()
        if ex.get('节日'):
            out['festival'] = ex['节日']
    except Exception:
        pass
    return out
