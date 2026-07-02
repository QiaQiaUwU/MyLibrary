# -*- coding: utf-8 -*-
"""自动拆分自 mylib_server_v2.py —— theme 路由。
所有路由注册在共享的 app 上（from _state import *）。逻辑与原文件逐字一致，仅做了物理分文件。"""
from _state import (app, get_lib, load_config, save_config, CONFIG, STATIC_DIR,
                     FastAPI, Query, HTTPException, Request, UploadFile, File,
                     HTMLResponse, JSONResponse, FileResponse, Path, json, os, re,
                     shutil, socket, subprocess, sys, datetime, Library)

@app.get('/api/theme/asset/{name}')
async def api_theme_asset(name: str):
    """预设主题素材图"""
    from fastapi.responses import FileResponse, Response
    safe = name.replace('..', '').replace('/', '')
    p = STATIC_DIR / 'themes' / safe
    if p.exists():
        return FileResponse(str(p))
    return Response(status_code=404)

@app.post('/api/theme/upload')
async def api_theme_upload(slot: str = Query(...), file: UploadFile = File(...)):
    """上传自定义背景/装饰图。slot: bg(主背景)/strip(顶部插画条)/corner(边角)"""
    lib = get_lib()
    theme_dir = lib.root / '_theme'
    theme_dir.mkdir(exist_ok=True)
    ext = (file.filename or 'img.jpg').rsplit('.', 1)[-1].lower()
    if ext not in ('jpg', 'jpeg', 'png', 'webp', 'gif'):
        ext = 'jpg'
    safe_slot = slot.replace('..', '').replace('/', '')
    dst = theme_dir / f'{safe_slot}.{ext}'
    # 删旧的同 slot 不同扩展名
    for old in theme_dir.glob(f'{safe_slot}.*'):
        try: old.unlink()
        except Exception: pass
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(400, '图片太大（限15MB）')
    with open(dst, 'wb') as f:
        f.write(content)
    return {'ok': True, 'slot': safe_slot, 'url': f'/api/theme/user/{safe_slot}.{ext}'}

@app.get('/api/theme/user/{name}')
async def api_theme_user(name: str):
    """用户上传的主题图"""
    from fastapi.responses import FileResponse, Response
    lib = get_lib()
    safe = name.replace('..', '').replace('/', '')
    p = lib.root / '_theme' / safe
    if p.exists():
        return FileResponse(str(p))
    return Response(status_code=404)

@app.get('/api/theme/list')
async def api_theme_list():
    """列出用户已上传的主题图"""
    lib = get_lib()
    theme_dir = lib.root / '_theme'
    slots = {}
    if theme_dir.exists():
        for f in theme_dir.iterdir():
            if f.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp', '.gif'):
                slots[f.stem] = f'/api/theme/user/{f.name}'
    return {'slots': slots}

@app.delete('/api/theme/user/{slot}')
async def api_theme_delete(slot: str):
    lib = get_lib()
    theme_dir = lib.root / '_theme'
    safe = slot.replace('..', '').replace('/', '')
    if theme_dir.exists():
        for f in theme_dir.glob(f'{safe}.*'):
            try: f.unlink()
            except Exception: pass
    return {'ok': True}

# ── Quill 书库精灵 ────────────────────────────────────────────────────────────
