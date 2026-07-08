# -*- coding: utf-8 -*-
"""自动拆分自 mylib_server_v2.py —— settings 路由。
所有路由注册在共享的 app 上（from _state import *）。逻辑与原文件逐字一致，仅做了物理分文件。"""
from _state import (app, get_lib, load_config, save_config, CONFIG, STATIC_DIR,
                     FastAPI, Query, HTTPException, Request, UploadFile, File,
                     HTMLResponse, JSONResponse, FileResponse, Path, json, os, re,
                     shutil, socket, subprocess, sys, datetime, Library)

@app.get('/api/serverinfo')
async def api_serverinfo(request: Request):
    """返回局域网访问地址（供扫码连接用）"""
    import socket as _sock
    def _lan_ip():
        try:
            s = _sock.socket(_sock.AF_INET, _sock.SOCK_DGRAM)
            s.connect(('8.8.8.8', 80))
            ip = s.getsockname()[0]; s.close(); return ip
        except Exception:
            return '127.0.0.1'
    ip = _lan_ip()
    # 端口从请求里拿
    port = request.url.port or 8765
    from _state import APP_VERSION
    return {'lan_url': f'http://{ip}:{port}/', 'ip': ip, 'port': port, 'version': APP_VERSION}

@app.get('/api/settings')
async def api_settings_get():
    cfg = load_config()
    safe = json.loads(json.dumps(cfg))
    ak = safe.get('ai', {}).get('api_key', '')
    safe['ai']['api_key_status'] = 'configured' if ak else 'not_configured'
    safe['ai']['api_key'] = '***' if ak else ''
    return safe

@app.post('/api/settings')
async def api_settings_post(request: Request):
    body = await request.json()
    cfg = load_config()
    for sec in ('server', 'library', 'ai'):
        if sec in body and isinstance(body[sec], dict):
            for k, v in body[sec].items():
                if k in cfg.get(sec, {}):
                    if k == 'api_key' and v == '***': continue
                    cfg[sec][k] = v
    save_config(cfg)
    import _state as _st
    _st.CONFIG = cfg
    return {'ok': True}

# ── 运行状态（首页/设置用来判断图书馆是否就绪）────────────────────────────────

@app.get('/api/status')
async def api_status():
    import _state as _st
    cfg = load_config()
    ready = _st.library_ready()
    root = ''
    try:
        if ready and _st.LIB is not None:
            root = str(_st.LIB.root)
    except Exception:
        pass
    if not root:
        root = cfg.get('library', {}).get('root', '') or ''
    return {
        'library_ready': ready,
        'library_root': root,
        'library_error': getattr(_st, 'LIB_ERROR', '') or '',
        'ai_configured': bool(cfg.get('ai', {}).get('api_key')),
    }

# ── 图书馆路径：填/改后即时生效（无需重启）──────────────────────────────────

@app.post('/api/settings/library')
async def api_settings_library(request: Request):
    """设置图书馆根目录：校验 → 即时打开 → 保存到配置。"""
    import _state as _st
    body = await request.json()
    root = (body.get('root') or '').strip()
    ok, msg = _st.init_library(root)
    if ok:
        cfg = load_config()
        cfg.setdefault('library', {})['root'] = msg  # msg 是规范化后的绝对路径
        save_config(cfg)
        _st.CONFIG = cfg
        # 顺带回报书的数量，让前端能立刻确认"指对了库"
        count = None
        try:
            count = _st.LIB.conn.execute('SELECT COUNT(*) FROM books').fetchone()[0]
        except Exception:
            pass
        return {'ok': True, 'root': msg, 'book_count': count}
    return {'ok': False, 'error': msg}


# ── AI：测试连接 + 列出可选模型（反代/中转站用）─────────────────────────────

def _ai_endpoints(base_url: str):
    base = (base_url or '').strip().rstrip('/')
    # 容忍用户少写 /v1：既支持已带 /v1 的，也支持根域名
    chat = base + '/chat/completions'
    models = base + '/models'
    return chat, models


def _extract_model_ids(data):
    """从各种可能的返回结构里抠出模型名，尽量兼容不同中转站/反代：
    - 标准 OpenAI / New API: {"data":[{"id":...}]}
    - 裸数组: [{"id":...}] 或 ["gpt-4o", ...]
    - Gemini 原生风味: {"models":[{"name":"models/gemini-..."}]}
    - 其它: 项可能是字符串，或字段叫 name/model/model_name
    """
    ids = []
    def push(x):
        if isinstance(x, str):
            if x.strip():
                ids.append(x.strip())
        elif isinstance(x, dict):
            for k in ('id', 'name', 'model', 'model_name'):
                v = x.get(k)
                if isinstance(v, str) and v.strip():
                    ids.append(v.strip())
                    break
    try:
        if isinstance(data, list):
            for it in data:
                push(it)
        elif isinstance(data, dict):
            for key in ('data', 'models', 'result', 'model_list'):
                arr = data.get(key)
                if isinstance(arr, list):
                    for it in arr:
                        push(it)
            if not ids and (data.get('id') or data.get('name')):
                push(data)
    except Exception:
        pass
    seen = set(); out = []
    for m in ids:
        if m not in seen:
            seen.add(m); out.append(m)
    return out


def _http_json(url: str, headers: dict, payload=None, timeout: int = 20):
    """用标准库发 JSON 请求（不引入额外依赖）。返回 (status, json_or_text, err)。"""
    import urllib.request, urllib.error, json as _json
    data = _json.dumps(payload).encode('utf-8') if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers,
                                 method='POST' if data is not None else 'GET')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode('utf-8', errors='ignore')
            try:
                return resp.status, _json.loads(raw), None
            except Exception:
                return resp.status, raw, None
    except urllib.error.HTTPError as e:
        body = ''
        try:
            body = e.read().decode('utf-8', errors='ignore')
        except Exception:
            pass
        return e.code, body, f'HTTP {e.code}'
    except urllib.error.URLError as e:
        return 0, '', f'连接失败：{getattr(e, "reason", e)}'
    except Exception as e:
        return 0, '', f'请求出错：{e}'


@app.post('/api/settings/test-ai')
async def api_settings_test_ai(request: Request):
    """测试 AI 接口能否正常连通（发一次极小的对话请求）。
    body 可带 base_url/api_key/model 覆盖；不带则用已保存的配置（api_key 用 *** 时回退配置）。"""
    import time as _t
    body = await request.json()
    cfg = load_config().get('ai', {})
    base_url = (body.get('base_url') or cfg.get('base_url') or '').strip()
    model = (body.get('model') or cfg.get('model') or '').strip()
    api_key = body.get('api_key')
    if not api_key or api_key == '***':
        api_key = cfg.get('api_key', '')
    if not base_url:
        return {'ok': False, 'error': '请先填 Base URL'}
    if not api_key:
        return {'ok': False, 'error': '请先填 API Key'}
    if not model:
        return {'ok': False, 'error': '请先填/选择模型'}
    chat_url, _ = _ai_endpoints(base_url)
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    payload = {'model': model,
               'messages': [{'role': 'user', 'content': 'ping'}],
               'max_tokens': 1, 'stream': False}
    t0 = _t.time()
    from fastapi.concurrency import run_in_threadpool
    status, data, err = await run_in_threadpool(_http_json, chat_url, headers, payload, 20)
    ms = int((_t.time() - t0) * 1000)
    if err:
        # 给点可读的提示
        hint = err
        if status == 401:
            hint = 'API Key 不对（401 未授权）'
        elif status == 404:
            hint = '接口地址不对（404）。检查 Base URL，多数中转站要以 /v1 结尾'
        elif status == 0:
            hint = err + '。检查 Base URL、网络/反代是否可达'
        return {'ok': False, 'error': hint, 'status': status, 'detail': (data if isinstance(data, str) else '')[:300]}
    # 拿到回复即视为连通
    reply_ok = isinstance(data, dict) and ('choices' in data or 'id' in data)
    if not reply_ok:
        return {'ok': False, 'error': '已连上但返回格式异常', 'status': status,
                'detail': (json.dumps(data)[:300] if not isinstance(data, str) else data[:300])}
    return {'ok': True, 'message': f'连接成功 · {model} · {ms}ms', 'latency_ms': ms, 'model': model}


@app.post('/api/settings/models')
async def api_settings_models(request: Request):
    """列出该接口可用的模型（反代/中转站常见，方便下拉选择，不用手敲）。"""
    body = await request.json()
    cfg = load_config().get('ai', {})
    base_url = (body.get('base_url') or cfg.get('base_url') or '').strip()
    api_key = body.get('api_key')
    if not api_key or api_key == '***':
        api_key = cfg.get('api_key', '')
    if not base_url:
        return {'ok': False, 'error': '请先填 Base URL'}
    if not api_key:
        return {'ok': False, 'error': '请先填 API Key'}
    from fastapi.concurrency import run_in_threadpool
    base = base_url.rstrip('/')
    # 候选 models 地址：优先按用户填的；若没写 /v1 再补一个 /v1 版兜底
    cands = [base + '/models']
    if '/v1' not in base.lower():
        cands.append(base + '/v1/models')
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    ids = []
    status, data, err, used = 0, None, None, None
    # 尝试 1：标准 Bearer 头（OpenAI / New API 等绝大多数）
    for mu in cands:
        s, d, e = await run_in_threadpool(_http_json, mu, headers, None, 20)
        got = _extract_model_ids(d)
        if got:
            ids, status, data, used = got, s, d, mu
            break
        if status == 0 and (s or e):     # 留住第一个有意义的诊断
            status, data, err, used = s, d, e, mu
    # 尝试 2：把 key 当查询参数（部分 Gemini 反代要 ?key=，不认 Bearer）
    if not ids:
        mu = used or cands[0]
        url2 = mu + (('&' if '?' in mu else '?') + 'key=' + api_key)
        s2, d2, e2 = await run_in_threadpool(_http_json, url2, {'Content-Type': 'application/json'}, None, 20)
        got2 = _extract_model_ids(d2)
        if got2:
            ids, status, data = got2, s2, d2
    if ids:
        return {'ok': True, 'models': sorted(set(ids)), 'count': len(set(ids))}
    # 全都没拿到：给可读诊断（状态码 + 返回片段），前端会显示出来，方便判断是 404 还是格式问题
    snippet = ''
    if isinstance(data, str):
        snippet = data[:200]
    elif data is not None:
        try:
            snippet = json.dumps(data, ensure_ascii=False)[:200]
        except Exception:
            snippet = str(data)[:200]
    hint = '这个接口没返回可识别的模型列表，直接手填模型名即可'
    if status == 401:
        hint = 'API Key 不对（401）'
    elif status == 403:
        hint = '没权限访问模型列表（403），直接手填模型名'
    elif status == 404:
        hint = '这个中转站没有 /models 列表接口（404）——常见于逆向站，去它控制台/模型广场复制完整模型名手填即可'
    elif status == 0:
        hint = (err or '连不上') + '，检查 Base URL / 网络'
    return {'ok': False, 'error': hint, 'status': status, 'detail': snippet}


# ── 连接配置档（参考 SillyTavern）：保存多套接口、一键切换 ────────────────────

@app.get('/api/settings/ai-profiles')
async def api_ai_profiles_get():
    cfg = load_config()
    ai = cfg.get('ai', {})
    out = []
    for p in (cfg.get('ai_profiles') or []):
        if not isinstance(p, dict):
            continue
        out.append({
            'name': p.get('name', '') or '(未命名)',
            'provider': p.get('provider', ''),
            'base_url': p.get('base_url', ''),
            'model': p.get('model', ''),
            'has_key': bool(p.get('api_key')),
            # 是否是当前正在用的那套
            'active': (p.get('base_url', '') == ai.get('base_url', '') and p.get('model', '') == ai.get('model', '')),
        })
    return {'profiles': out}


@app.post('/api/settings/ai-profiles')
async def api_ai_profiles_save(request: Request):
    """保存整份配置档列表。某项 api_key 为空或 *** 时，按同名旧档保留原密钥（不丢 key）。"""
    body = await request.json()
    profiles = body.get('profiles') or []
    cfg = load_config()
    ai_now = cfg.get('ai', {})
    old_by_name = {}
    for p in (cfg.get('ai_profiles') or []):
        if isinstance(p, dict) and p.get('name'):
            old_by_name[p['name']] = p
    cleaned = []
    for p in profiles:
        if not isinstance(p, dict):
            continue
        name = (p.get('name') or '').strip() or '(未命名)'
        key = p.get('api_key')
        base = (p.get('base_url') or '').strip()
        if not key or key == '***':
            # 1) 同名旧档的 key；2) 否则若就是当前在用的接口，用当前 ai 的 key
            key = (old_by_name.get(name, {}) or {}).get('api_key', '')
            if not key and base and base == ai_now.get('base_url', ''):
                key = ai_now.get('api_key', '')
        cleaned.append({
            'name': name,
            'provider': (p.get('provider') or '').strip(),
            'base_url': (p.get('base_url') or '').strip(),
            'api_key': key,
            'model': (p.get('model') or '').strip(),
        })
    cfg['ai_profiles'] = cleaned
    save_config(cfg)
    import _state as _st
    _st.CONFIG = cfg
    return {'ok': True, 'count': len(cleaned)}


@app.post('/api/settings/ai-profiles/activate')
async def api_ai_profiles_activate(request: Request):
    """把某个配置档设为当前使用的接口（写进 ai）。"""
    body = await request.json()
    name = (body.get('name') or '').strip()
    cfg = load_config()
    target = None
    for p in (cfg.get('ai_profiles') or []):
        if isinstance(p, dict) and p.get('name') == name:
            target = p
            break
    if not target:
        return {'ok': False, 'error': '找不到这个配置档'}
    cfg.setdefault('ai', {})
    for k in ('provider', 'base_url', 'api_key', 'model'):
        cfg['ai'][k] = target.get(k, cfg['ai'].get(k, ''))
    save_config(cfg)
    import _state as _st
    _st.CONFIG = cfg
    return {'ok': True, 'active': name, 'model': cfg['ai'].get('model', ''), 'base_url': cfg['ai'].get('base_url', '')}

# ── 母库管理面板 ─────────────────────────────────────────────────────────────


@app.post('/api/shutdown')
async def api_shutdown():
    """一键停止服务：设置页按钮调用。免得每次都要去任务管理器杀进程才能重启。"""
    import threading, os
    threading.Timer(0.4, lambda: os._exit(0)).start()
    return {'ok': True, 'msg': 'bye'}


# ===== 心跳自动退出（服务端核心版，任何启动方式都生效） =====
# 每个页面 ~20s ping 一次；第一次 ping 之后武装看门狗，之后 90s 没心跳（=浏览器全关）就自动退出、释放端口。
# 想关掉这个行为：设环境变量 MYLIB_NO_WATCHDOG=1
import time as _hb_time, threading as _hb_threading, os as _hb_os
_HB = {'t': 0.0, 'armed': False}

@app.get('/api/heartbeat')
async def api_heartbeat():
    _HB['t'] = _hb_time.time()
    _HB['armed'] = True
    return {'ok': True}

def _hb_watchdog():
    while True:
        _hb_time.sleep(10)
        if _HB['armed'] and (_hb_time.time() - _HB['t'] > 90):
            print('\n  浏览器已全部关闭，MyLibrary 自动退出（端口已释放）。')
            _hb_os._exit(0)

if _hb_os.environ.get('MYLIB_NO_WATCHDOG') != '1':
    _hb_threading.Thread(target=_hb_watchdog, daemon=True).start()


