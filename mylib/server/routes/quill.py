# -*- coding: utf-8 -*-
"""自动拆分自 mylib_server_v2.py —— quill 路由。
所有路由注册在共享的 app 上（from _state import *）。逻辑与原文件逐字一致，仅做了物理分文件。"""
from _state import (app, get_lib, load_config, save_config, CONFIG, STATIC_DIR,
                     FastAPI, Query, HTTPException, Request, UploadFile, File,
                     HTMLResponse, JSONResponse, FileResponse, Path, json, os, re,
                     shutil, socket, subprocess, sys, datetime, Library)

@app.post('/api/quill/chat')
async def api_quill_chat(request: Request):
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
    result = run_quill(msg, db, cfg, tone, custom, history, interaction_style)
    # 存 Quill 回复
    reply_id = add_message(db, session_id, 'assistant', result.get('reply', ''))
    result['session_id'] = session_id
    result['user_msg_id'] = user_msg_id
    result['reply_id'] = reply_id
    return result

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
