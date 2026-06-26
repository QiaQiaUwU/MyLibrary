#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
mylib_server_v2.py — MyLibrary Web 服务 (FastAPI)
===================================================
完整功能：图书馆浏览 + 在线阅读 + AI agent + 笔记 + 全文检索 + 快速带走

用法:
  pip install fastapi uvicorn python-multipart
  python mylib_server_v2.py F:/MyLibrary
"""

import argparse, json, os, re, shutil, socket, subprocess, sys, threading, webbrowser
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

try:
    from fastapi import FastAPI, Query, HTTPException, Request, UploadFile, File
    from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
    import uvicorn
except ImportError:
    print('需要安装: pip install fastapi uvicorn python-multipart')
    sys.exit(1)

sys.path.insert(0, str(Path(__file__).parent))
from mylib_core import Library

# ============================================================
# 配置
# ============================================================
# 配置读写集中在 core/config.py
from config import load_config, save_config, static_dir, CONFIG_PATH  # noqa: E402
STATIC_DIR = static_dir()

CONFIG = load_config()
LIB: Optional[Library] = None
_HTML_CACHE = ''
# 最近一次初始化图书馆的提示（设置页/首页用来显示"为什么没就绪"）
LIB_ERROR = ''

def get_lib() -> Library:
    if LIB is None:
        raise HTTPException(status_code=503, detail='图书馆尚未配置，请到「设置 → 图书馆」填写书库路径')
    return LIB


def library_ready() -> bool:
    return LIB is not None


def read_conn(timeout: int = 30):
    """开一个独立的只读连接，专给"重活查询"（如全量书架）用。
    这样这类查询可以放到线程池里跑，不占用主连接、也不会卡住事件循环；
    配合 WAL，与后台写任务并存也安全。用完记得 close()。"""
    import sqlite3
    lib = get_lib()
    conn = sqlite3.connect(str(lib.db_path), check_same_thread=False, timeout=timeout)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute('PRAGMA query_only = ON')
        conn.execute('PRAGMA busy_timeout = %d' % (timeout * 1000))
    except Exception:
        pass
    return conn


def _auto_backup(lib):
    """每天给 library.db 存一份自动备份（用 sqlite 备份 API，兼容 WAL），保留最近 5 份。
    这样万一简评/评分/数据丢了，可在「管理 → 找回丢失的简评」里从备份找回。后台线程跑，不挡启动。"""
    import sqlite3, glob, os, time
    try:
        root = Path(lib.root)
        db = root / 'library.db'
        if not db.exists():
            return
        now = time.time()
        existing = sorted(glob.glob(str(root / 'library.db.bak_auto_*')))
        # 20 小时内已有自动备份就跳过，避免每次开都备份
        for f in existing:
            try:
                if now - os.path.getmtime(f) < 20 * 3600:
                    return
            except Exception:
                pass
        dest = str(db) + '.bak_auto_' + time.strftime('%Y%m%d_%H%M%S')
        src = sqlite3.connect(str(db)); dst = sqlite3.connect(dest)
        try:
            with dst:
                src.backup(dst)
        finally:
            src.close(); dst.close()
        # 只留最近 5 份自动备份
        for old in sorted(glob.glob(str(root / 'library.db.bak_auto_*')))[:-5]:
            try:
                os.remove(old)
            except Exception:
                pass
    except Exception:
        pass


def auto_backup_async(lib):
    import threading
    threading.Thread(target=_auto_backup, args=(lib,), daemon=True).start()


def init_library(root_str: str):
    """运行时(重新)初始化图书馆。成功 -> (True, 绝对路径)；失败 -> (False, 原因)。
    用于设置页改库路径后即时生效，无需重启。会做严格校验，避免误指到代码目录。"""
    global LIB, LIB_ERROR
    import _state as _st
    root_str = (root_str or '').strip()
    if not root_str:
        LIB_ERROR = '未填写图书馆路径'
        return False, LIB_ERROR
    root = Path(root_str)
    if not root.exists():
        LIB_ERROR = f'路径不存在：{root}'
        return False, LIB_ERROR
    if not root.is_dir():
        LIB_ERROR = f'不是文件夹：{root}'
        return False, LIB_ERROR
    if not (root / 'library.db').exists():
        LIB_ERROR = '该文件夹里没有 library.db。请填你的"书库数据"目录（放书和数据库的那个），不是代码目录。'
        return False, LIB_ERROR
    try:
        new_lib = Library(root)
        try:
            from database import open_threadsafe
            open_threadsafe(new_lib)
        except Exception:
            pass
        old = _st.LIB
        _st.LIB = new_lib
        globals()['LIB'] = new_lib
        try:
            auto_backup_async(new_lib)   # 启动时顺手存一份每日自动备份（后台、不挡启动）
        except Exception:
            pass
        try:
            if old is not None:
                old.close()
        except Exception:
            pass
        try:
            from mylib_admin import TASK_MANAGER
            TASK_MANAGER.set_state_file(root)
        except Exception:
            pass
        LIB_ERROR = ''
        return True, str(root)
    except Exception as e:
        LIB_ERROR = f'打开失败：{e}'
        return False, LIB_ERROR

# ============================================================
# 正文读取（共享，带小缓存）
# ============================================================
# 之前 books.py 调用了 _read_txt 却没定义它 —— 会 NameError 让 /content 直接 500，
# 正文加载不出来。这里集中提供，books/reader 都用它；并缓存解码结果，
# 分段取正文时不必每段都把整本重读一遍。
_TXT_CACHE: Dict[str, Any] = {}

def read_txt(path) -> str:
    raw = Path(path).read_bytes()
    for enc in ('utf-8', 'gbk', 'gb18030', 'big5', 'utf-16'):
        try:
            text = raw.decode(enc, errors='ignore')
            cn = sum(1 for c in text[:3000] if '\u4e00' <= c <= '\u9fff')
            if cn / max(len(text[:3000]), 1) > 0.05:
                return text
        except Exception:
            continue
    return raw.decode('utf-8', errors='ignore')

def read_txt_cached(path) -> str:
    key = str(path)
    try:
        sz = Path(path).stat().st_size
    except Exception:
        sz = -1
    c = _TXT_CACHE.get(key)
    if c and c[0] == sz:
        return c[1]
    text = read_txt(path)
    if len(_TXT_CACHE) > 2:
        _TXT_CACHE.clear()
    _TXT_CACHE[key] = (sz, text)
    return text

# ============================================================
# App
# ============================================================
app = FastAPI(title='MyLibrary', docs_url='/docs', redoc_url=None)

# ── 页面路由 ─────────────────────────────────────────────────────────────────
