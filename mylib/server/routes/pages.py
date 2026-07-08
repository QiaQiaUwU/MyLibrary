# -*- coding: utf-8 -*-
"""自动拆分自 mylib_server_v2.py —— pages 路由。
所有路由注册在共享的 app 上（from _state import *）。逻辑与原文件逐字一致，仅做了物理分文件。"""
from _state import (app, get_lib, load_config, save_config, CONFIG, STATIC_DIR,
                     FastAPI, Query, HTTPException, Request, UploadFile, File,
                     HTMLResponse, JSONResponse, FileResponse, Path, json, os, re,
                     shutil, socket, subprocess, sys, datetime, Library)
from frontend_loader import (INJECT_SCRIPT, ADMIN_HTML, READER_JS, READER_HTML,
                             SETTINGS_HTML, HOME_HTML, HOME_JS,
                             live_home_html, live_home_js, live_reader_html,
                             live_reader_js, live_admin_html, live_settings_html)

# 心跳脚本：拼进每个页面，浏览器全关 90s 后服务端看门狗自动退出（见 settings.py）
_HB_SNIP = """<script>(function(){try{var hb=function(){fetch('/api/heartbeat').catch(function(){});};hb();setInterval(hb,20000);document.addEventListener('visibilitychange',function(){if(!document.hidden)hb();});}catch(e){}})();</script>"""
def _with_hb(html):
    return html.replace('</body>', _HB_SNIP + '</body>') if '</body>' in html else (html + _HB_SNIP)

from _state import _HTML_CACHE
import time as _time
# 每次启动都不同的资源版本号，用于给 reader.js 等加 ?v=，强制客户端取最新（破缓存）
ASSET_VER = str(int(_time.time()))

@app.get('/', response_class=HTMLResponse)
async def index():
    # 新版书房主页（实时读盘，覆盖代码刷新即生效）
    from fastapi.responses import HTMLResponse as _HTML
    html = _with_hb(live_home_html())
    try:
        html = html.replace('/static/home.js', '/static/home.js?v=' + ASSET_VER)
    except Exception:
        pass
    return _HTML(content=html, headers={'Cache-Control': 'no-store, no-cache, must-revalidate'})

@app.get('/static/home.js')
async def home_js():
    from fastapi.responses import Response
    return Response(content=live_home_js(), media_type='application/javascript', headers={'Cache-Control':'no-store, no-cache, must-revalidate'})

# ── PWA：让书房能"安装"到桌面/主屏，像独立 App（实为本地网页）──

@app.get('/manifest.webmanifest')
async def pwa_manifest():
    from fastapi.responses import JSONResponse
    av = (CONFIG.get('quill_avatar') or 'feather')
    q = '?avatar=' + av
    manifest = {
        "name": "MyLibrary 书房",
        "short_name": "书房",
        "description": "私人藏书阅读空间",
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "orientation": "any",
        "background_color": "#e8e3da",
        "theme_color": "#9d8b7a",
        "icons": [
            {"src": "/static/app-icon.svg" + q, "sizes": "any", "type": "image/svg+xml", "purpose": "any"},
            {"src": "/static/app-icon-512.png" + q, "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
            {"src": "/static/app-icon-192.png" + q, "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
        ],
    }
    return JSONResponse(manifest)

@app.get('/api/quill-avatar')
async def get_quill_avatar():
    return {'avatar': CONFIG.get('quill_avatar') or 'feather'}

@app.post('/api/quill-avatar')
async def set_quill_avatar(request: Request):
    """记住用户选的 Quill 形象（让桌面/主屏的安装图标也跟着同步）。"""
    body = await request.json()
    av = (body.get('avatar') or '').strip()
    valid = {'feather', 'sprout', 'sparkle', 'leaf', 'moon', 'clock'}
    if av in valid:
        CONFIG['quill_avatar'] = av
        try:
            save_config(CONFIG)
        except Exception:
            pass
    return {'ok': True, 'avatar': CONFIG.get('quill_avatar') or 'feather'}

@app.get('/sw.js')
async def pwa_service_worker():
    """Service Worker：**网络优先**。
    之前是缓存优先，导致你换了代码、重开后还看到旧界面（旧的书房/树/图标）。
    现在：服务在跑就永远拿最新代码，只有彻底离线才用缓存兜底，更新立刻可见。"""
    from fastapi.responses import Response
    sw = r'''
const CACHE='mylib-shell-v7';
self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
  // 清掉所有旧缓存，确保不再吐旧文件
  const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)));
  await self.clients.claim();
})());});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'){return;}
  const u=new URL(e.request.url);
  // API、书内容：直接走网络（数据要最新）
  if(u.pathname.startsWith('/api/')){return;}
  // 其余（页面/JS/图标）：网络优先，拿到就用并顺手更新缓存；只有断网才回退缓存
  e.respondWith((async()=>{
    try{
      const resp=await fetch(e.request,{cache:'no-store'});
      if(resp&&resp.status===200){const cp=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));}
      return resp;
    }catch(err){
      const c=await caches.match(e.request);
      return c||caches.match('/');
    }
  })());
});
'''
    return Response(content=sw, media_type='application/javascript',
                    headers={'Cache-Control': 'no-cache, no-store, must-revalidate'})

@app.get('/static/app-icon.svg')
async def pwa_app_icon(avatar: str = 'feather'):
    """应用图标（SVG）。可按 ?avatar= 返回不同 Quill 形象，和用户选的入口图标一致。"""
    from fastapi.responses import Response
    return Response(content=_app_icon_svg(avatar), media_type='image/svg+xml')

def _app_icon_svg(avatar='feather'):
    """应用图标：纸感书房底 + 当前 Quill 形象。
    形象用的是和书房里完全一样的那套图标轮廓（同样的路径），并居中放置，
    所以装到桌面/主屏后图标既不歪、也和你在 App 里选的 Quill 形象一致。"""
    # 与 home.js 的 QUILL_AVATARS 同源的 24×24 轮廓（filled）。clock/moon 用静态代表样式。
    glyphs = {
        'feather': '<path d="M21 1.99669C6 1.99669 4 15.9967 3 21.9967C3.66667 21.9967 4.33275 21.9967 4.99824 21.9967C5.66421 18.6636 7.33146 16.8303 10 16.4967C14 15.9967 17 12.4967 18 9.49669L16.5 8.49669C16.8333 8.16336 17.1667 7.83002 17.5 7.49669C18.5 6.49669 19.5042 4.99669 21 1.99669Z"/>',
        'sprout': '<path d="M20.998 3V5C20.998 8.86599 17.864 12 13.998 12H12.998V13H17.998V20C17.998 21.1046 17.1026 22 15.998 22H7.99805C6.89348 22 5.99805 21.1046 5.99805 20V13H10.998V10C10.998 6.13401 14.1321 3 17.998 3H20.998ZM5.49805 2C8.02667 2 10.263 3.25136 11.6216 5.1686C10.6026 6.51084 9.99805 8.18482 9.99805 10V11H9.49805C5.35591 11 1.99805 7.64214 1.99805 3.5V2H5.49805Z"/>',
        'sparkle': '<path d="M17.0007 1.20825 18.3195 3.68108 20.7923 4.99992 18.3195 6.31876 17.0007 8.79159 15.6818 6.31876 13.209 4.99992 15.6818 3.68108 17.0007 1.20825ZM8.00065 4.33325 10.6673 9.33325 15.6673 11.9999 10.6673 14.6666 8.00065 19.6666 5.33398 14.6666.333984 11.9999 5.33398 9.33325 8.00065 4.33325ZM19.6673 16.3333 18.0007 13.2083 16.334 16.3333 13.209 17.9999 16.334 19.6666 18.0007 22.7916 19.6673 19.6666 22.7923 17.9999 19.6673 16.3333Z"/>',
        'leaf': '<path d="M20.998 3V5C20.998 14.6274 15.6255 19 8.99805 19L7.0964 18.9999C7.3079 15.9876 8.24541 14.1648 10.6939 11.9989C11.8979 10.9338 11.7965 10.3189 11.2029 10.6721C7.1193 13.1016 5.09114 16.3862 5.00119 21.6302L4.99805 22H2.99805C2.99805 20.6373 3.11376 19.3997 3.34381 18.2682C3.1133 16.9741 2.99805 15.2176 2.99805 13C2.99805 7.47715 7.4752 3 12.998 3C14.998 3 16.998 4 20.998 3Z"/>',
        'moon': '<path d="M11.3807 2.01886C9.91573 3.38768 9 5.3369 9 7.49999C9 11.6421 12.3579 15 16.5 15C18.6631 15 20.6123 14.0843 21.9811 12.6193C21.6613 17.8537 17.3149 22 12 22C6.47715 22 2 17.5228 2 12C2 6.68514 6.14629 2.33869 11.3807 2.01886Z"/>',
        # 钟表用描边样式（指针停在 10:10，静态代表）
        'clock': '<g fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 12 8.6 9.4M12 12 15.2 7.6"/></g>',
    }
    g = glyphs.get(avatar, glyphs['feather'])
    # 把 24×24 的形象等比放进 192 的画布并居中（左右上下各留 30 的边距），所以不会歪
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#a8927f"/><stop offset="1" stop-color="#8c7a6a"/></linearGradient></defs>
<rect width="192" height="192" rx="42" fill="url(#bg)"/>
<g fill="#fff" transform="translate(30 30) scale(5.5)">{g}</g>
</svg>'''

@app.get('/static/app-icon-{size}.png')
async def pwa_app_icon_png(size: int, avatar: str = 'feather'):
    """PNG 图标（Android 主屏/maskable 需要）。能渲染就给 PNG，否则回退 SVG。"""
    from fastapi.responses import Response, RedirectResponse
    try:
        import cairosvg
        png = cairosvg.svg2png(bytestring=_app_icon_svg(avatar).encode('utf-8'),
                               output_width=int(size), output_height=int(size))
        return Response(content=png, media_type='image/png')
    except Exception:
        # 渲染库不可用时回退到 SVG（桌面浏览器安装可接受）
        return RedirectResponse(url=f'/static/app-icon.svg?avatar={avatar}')

@app.get('/classic', response_class=HTMLResponse)
async def index_classic():
    # 旧版（保留备用）
    return _HTML_CACHE.replace('</body>', INJECT_SCRIPT + '</body>')

@app.get('/reader', response_class=HTMLResponse)
async def reader_page():
    """在线阅读器页面（实时读盘）。注入每次启动都变的版本号给 reader.js，并禁缓存——
    彻底解决"改了阅读器代码、但桌面端/Service Worker 还在用旧 reader.js"导致改了没效果的问题。"""
    from fastapi.responses import HTMLResponse as _HTML
    html = _with_hb(live_reader_html())
    try:
        html = html.replace('/static/reader.js', '/static/reader.js?v=' + ASSET_VER)
    except Exception:
        pass
    return _HTML(content=html, headers={'Cache-Control': 'no-store, no-cache, must-revalidate'})

@app.get('/static/reader.js')
async def reader_js():
    """阅读器 JS 逻辑"""
    from fastapi.responses import Response
    return Response(content=live_reader_js(), media_type='application/javascript', headers={'Cache-Control':'no-store, no-cache, must-revalidate'})

@app.get('/static/page-flip.browser.js')
async def pageflip_lib():
    """仿真翻页库（本地版，离线可用）。把 page-flip.browser.js 放到 frontend/vendor/ 就会启用真·卷曲翻页；
    没放也不报错——阅读器自动退回内置的 CSS 3D 翻页。"""
    from fastapi.responses import Response
    from pathlib import Path as _P
    f = _P(__file__).resolve().parents[2] / 'frontend' / 'vendor' / 'page-flip.browser.js'
    if f.exists():
        return Response(content=f.read_text(encoding='utf-8'), media_type='application/javascript',
                        headers={'Cache-Control': 'max-age=86400'})
    return Response(content='/* page-flip 未安装：使用内置 CSS 3D 翻页 */', media_type='application/javascript')

@app.get('/settings', response_class=HTMLResponse)
async def settings_page():
    return _with_hb(live_settings_html())

# ── 原有 API（完全兼容旧版前端）──────────────────────────────────────────────

@app.get('/admin', response_class=HTMLResponse)
async def admin_page():
    return _with_hb(live_admin_html())

