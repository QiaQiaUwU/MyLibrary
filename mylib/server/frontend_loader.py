# -*- coding: utf-8 -*-
"""前端文件加载器（阶段 B）。
把书房/阅读器/管理/设置的 HTML、JS、CSS 从 frontend/ 目录读进来，
替代原来内嵌在 Python 字符串里的常量。启动时读一次缓存到内存。
"""
import os
from pathlib import Path

# frontend 目录：项目根/frontend。优先 MYLIB_FRONTEND 环境变量，否则相对本文件回推。
def _frontend_dir() -> Path:
    env = os.environ.get('MYLIB_FRONTEND')
    if env:
        return Path(env)
    here = Path(__file__).parent           # mylib/server
    cand = here.parent.parent / 'frontend'  # 项目根/frontend
    return cand

FRONTEND_DIR = _frontend_dir()

def _read(rel: str) -> str:
    p = FRONTEND_DIR / rel
    try:
        return p.read_text(encoding='utf-8')
    except Exception:
        return ''

# ── 书房 JS 模块化（v4.2）：源码拆在 frontend/home/js/ 下，按文件名顺序拼接成一份下发 ──
# 这样既有"分文件、各管一摊"的工程结构，又不引入任何构建步——离线双击即用的哲学不变。
def _home_js_read() -> str:
    jsdir = FRONTEND_DIR / 'home' / 'js'
    try:
        if jsdir.is_dir():
            parts = sorted(p for p in jsdir.glob('*.js'))
            if parts:
                banner = '// MyLibrary home.js —— 由 frontend/home/js/ 下 %d 个模块按文件名顺序拼接而成（源码请改那边）\n' % len(parts)
                return banner + '\n\n'.join(p.read_text(encoding='utf-8') for p in parts)
    except Exception:
        pass
    return _read('home/home.js')   # 旧布局兜底

# 读入并缓存（与旧常量同名，pages.py 直接用）—— 仅作启动兜底，实际页面用下面的 live 函数实时读盘
HOME_HTML = _read('home/index.html')
HOME_JS = _home_js_read()
READER_HTML = _read('reader/index.html')
READER_JS = _read('reader/reader.js')
ADMIN_HTML = _read('admin/index.html')
SETTINGS_HTML = _read('settings/index.html')
INJECT_SCRIPT = _read('shared/inject.html')

# ── 实时读盘：每次请求都从 frontend/ 直接读最新内容 ──
# 这样你覆盖了代码、刷新页面就能立刻看到新版，不必纠结后台是不是还跑着旧进程。
# 本地单用户、文件不大（操作系统还会帮你缓存），开销可忽略。
def live_home_html():     return _read('home/index.html')     or HOME_HTML
def live_home_js():       return _home_js_read()              or HOME_JS
def live_reader_html():   return _read('reader/index.html')   or READER_HTML
def live_reader_js():     return _read('reader/reader.js')    or READER_JS
def live_admin_html():    return _read('admin/index.html')    or ADMIN_HTML
def live_settings_html(): return _read('settings/index.html') or SETTINGS_HTML

