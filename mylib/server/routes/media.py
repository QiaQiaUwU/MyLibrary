# -*- coding: utf-8 -*-
"""自动拆分自 mylib_server_v2.py —— media 路由。
所有路由注册在共享的 app 上（from _state import *）。逻辑与原文件逐字一致，仅做了物理分文件。"""
from _state import (app, get_lib, load_config, save_config, CONFIG, STATIC_DIR,
                     FastAPI, Query, HTTPException, Request, UploadFile, File,
                     HTMLResponse, JSONResponse, FileResponse, Path, json, os, re,
                     shutil, socket, subprocess, sys, datetime, Library)

@app.get('/api/ambient/list')
async def api_ambient_list():
    """列出环境音：优先项目自带的 _ambient，也含母库 _ambient（用户自己放的）"""
    dirs = [STATIC_DIR / '_ambient', get_lib().root / '_ambient']
    files = []
    seen = set()
    for amb_dir in dirs:
        if amb_dir.exists():
            for f in sorted(amb_dir.iterdir()):
                if f.stem == '翻页' or f.stem in seen:
                    continue
                if f.suffix.lower() in ('.mp3', '.ogg', '.wav', '.m4a', '.flac'):
                    files.append({'id': f.stem, 'name': f.stem, 'file': f.name})
                    seen.add(f.stem)
    return {'sounds': files}

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
