# -*- coding: utf-8 -*-
"""自动拆分自 mylib_server_v2.py —— media 路由。
所有路由注册在共享的 app 上（from _state import *）。逻辑与原文件逐字一致，仅做了物理分文件。"""
from _state import (app, get_lib, load_config, save_config, CONFIG, STATIC_DIR,
                     FastAPI, Query, HTTPException, Request, UploadFile, File,
                     HTMLResponse, JSONResponse, FileResponse, Path, json, os, re,
                     shutil, socket, subprocess, sys, datetime, Library)

@app.get('/api/ambient/list')
async def api_ambient_list():
    """列出环境音：优先项目自带的 _ambient，也含母库 _ambient（用户自己放/上传的）。
    user=True 的是用户自己上传的，前端给它显示删除按钮（内置的删不了）。"""
    lib_dir = get_lib().root / '_ambient'
    dirs = [(STATIC_DIR / '_ambient', False), (lib_dir, True)]
    files = []
    seen = set()
    for amb_dir, is_user in dirs:
        if amb_dir.exists():
            for f in sorted(amb_dir.iterdir()):
                if f.stem == '翻页' or f.stem in seen:
                    continue
                if f.suffix.lower() in ('.mp3', '.ogg', '.wav', '.m4a', '.flac'):
                    files.append({'id': f.stem, 'name': f.stem, 'file': f.name, 'user': is_user})
                    seen.add(f.stem)
    return {'sounds': files}

@app.post('/api/ambient/upload')
async def api_ambient_upload(file: UploadFile = File(...)):
    """上传自己的白噪音/环境音到母库 _ambient 目录，之后就出现在环境音列表里。"""
    lib = get_lib()
    amb_dir = lib.root / '_ambient'
    amb_dir.mkdir(exist_ok=True)
    raw = file.filename or 'sound.mp3'
    ext = raw.rsplit('.', 1)[-1].lower() if '.' in raw else 'mp3'
    if ext not in ('mp3', 'ogg', 'wav', 'm4a', 'flac'):
        raise HTTPException(400, '只支持 mp3 / ogg / wav / m4a / flac')
    stem = (raw.rsplit('.', 1)[0] if '.' in raw else raw)
    stem = re.sub(r'[\\/:*?"<>|]', '', stem).strip() or '环境音'   # 去危险字符，保留中文名做显示
    dst = amb_dir / f'{stem}.{ext}'
    i = 2
    while dst.exists():                                            # 同名不覆盖，加序号
        dst = amb_dir / f'{stem}_{i}.{ext}'
        i += 1
    content = await file.read()
    if len(content) > 30 * 1024 * 1024:
        raise HTTPException(400, '文件太大（限 30MB）')
    with open(dst, 'wb') as f:
        f.write(content)
    return {'ok': True, 'name': dst.stem, 'file': dst.name}

@app.delete('/api/ambient/user/{name}')
async def api_ambient_delete(name: str):
    """删除用户自己上传的环境音（只动母库 _ambient，内置的删不掉）。"""
    lib = get_lib()
    amb_dir = lib.root / '_ambient'
    safe = name.replace('..', '').replace('/', '')
    removed = False
    if amb_dir.exists():
        for f in list(amb_dir.iterdir()):
            if f.stem == safe and f.suffix.lower() in ('.mp3', '.ogg', '.wav', '.m4a', '.flac'):
                try:
                    f.unlink(); removed = True
                except Exception:
                    pass
    return {'ok': removed}

@app.get('/api/sfx/pageturn')
async def api_sfx_pageturn():
    """翻页音效（独立的 _sfx 目录，与环境音分开）。
    优先用户放的 mp3（音质更好），否则用内置合成的 wav（开箱即响，不用自己找音频）。"""
    from fastapi.responses import FileResponse, Response
    cands = [get_lib().root / '_sfx' / 'pageturn.mp3',   # 用户自定义优先
             STATIC_DIR / '_sfx' / 'pageturn.mp3',
             STATIC_DIR / '_sfx' / 'pageturn.wav',        # 内置合成，随包发布
             get_lib().root / '_sfx' / 'pageturn.wav']
    for cand in cands:
        try:
            if cand.exists():
                mt = 'audio/mpeg' if cand.suffix == '.mp3' else 'audio/wav'
                return FileResponse(str(cand), media_type=mt)
        except Exception:
            pass
    return Response(status_code=404)

@app.get('/api/sfx/tarot-bgm')
async def api_sfx_tarot_bgm():
    """塔罗抽牌背景音乐（氛围向，音量前端自己压低+淡入，这里只管把文件给出去）。"""
    from fastapi.responses import FileResponse, Response
    cands = [get_lib().root / '_sfx' / 'tarot_bgm.mp3',   # 用户自定义优先
             STATIC_DIR / '_sfx' / 'tarot_bgm.mp3']
    for cand in cands:
        try:
            if cand.exists():
                return FileResponse(str(cand), media_type='audio/mpeg')
        except Exception:
            pass
    return Response(status_code=404)

@app.get('/api/ambient/file/{name}')
async def api_ambient_file(name: str):
    """播放环境音文件（项目目录优先，再母库）"""
    from fastapi.responses import FileResponse, Response
    safe = name.replace('..', '').replace('/', '')
    for amb_dir in [STATIC_DIR / '_ambient', get_lib().root / '_ambient']:
        if amb_dir.exists():
            for f in amb_dir.iterdir():
                if f.stem == safe and f.suffix.lower() in ('.mp3', '.ogg', '.wav', '.m4a', '.flac'):
                    return FileResponse(str(f))
    return Response(status_code=404)

@app.get('/api/ambient/{sound}')
async def api_ambient(sound: str):
    """白噪音由前端 Web Audio API 实时合成，此端点保留扩展用"""
    return {'sound': sound, 'method': 'web_audio_synthesis'}

# ── 快速筛选带走 ────────────────────────────────────────────────────────────
