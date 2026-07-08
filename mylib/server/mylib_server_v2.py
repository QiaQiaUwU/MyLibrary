#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mylib_server_v2.py — 装配入口（v3 拆分后）
=========================================
本文件不再包含路由实现。它只负责：
  1) 从 _state 取得共享 app 和状态
  2) 导入 routes 包（触发所有路由注册）
  3) 提供 main() 启动 uvicorn

路由实现已拆分到 routes/ 下：pages / books / reader / media / collect /
journey / theme / quill / settings / admin。
共享状态（app / CONFIG / LIB / get_lib / load_config 等）在 _state.py。
前端 HTML/CSS/JS 已提取为 frontend/ 下的独立文件，由 frontend_loader.py 读取。
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import threading, webbrowser, socket, argparse
import uvicorn
from _state import (app, CONFIG, LIB, load_config, save_config, get_lib, Library)
import routes             # 导入触发所有路由注册到 app

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]; s.close(); return ip
    except Exception:
        return '127.0.0.1'

def _find_browser_win():
    """在 Windows 上稳妥地找到 Edge/Chrome。优先读注册表 App Paths（系统登记的真实安装路径），
    其次猜常见目录，最后看 PATH。找不到才返回 None。"""
    import os
    # 1) 注册表 App Paths（最可靠）
    try:
        import winreg
        for hive in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
            for exe_name in ('msedge.exe', 'chrome.exe'):
                try:
                    with winreg.OpenKey(hive, r'SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\\' + exe_name) as k:
                        path, _ = winreg.QueryValueEx(k, None)  # 默认值=完整 exe 路径
                        if path:
                            path = os.path.expandvars(path.strip('"'))
                            if os.path.exists(path):
                                return path
                except Exception:
                    pass
    except Exception:
        pass
    # 2) 常见安装目录
    pf = os.environ.get('ProgramFiles', r'C:\Program Files')
    pfx86 = os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)')
    local = os.environ.get('LocalAppData', '')
    for c in (os.path.join(pfx86, r'Microsoft\Edge\Application\msedge.exe'),
              os.path.join(pf, r'Microsoft\Edge\Application\msedge.exe'),
              os.path.join(local, r'Microsoft\Edge\Application\msedge.exe'),
              os.path.join(pf, r'Google\Chrome\Application\chrome.exe'),
              os.path.join(pfx86, r'Google\Chrome\Application\chrome.exe'),
              os.path.join(local, r'Google\Chrome\Application\chrome.exe')):
        if c and os.path.exists(c):
            return c
    # 3) PATH
    try:
        import shutil
        for name in ('msedge', 'chrome'):
            p = shutil.which(name)
            if p:
                return p
    except Exception:
        pass
    return None

def _open_app_window(port):
    """用 Edge / Chrome 的 --app 模式打开成「独立窗口」（无标签栏/地址栏，像本地应用）。
    关键：加一个独立的 --user-data-dir，这样即使你已经开着 Edge，也会**新开一个独立的应用窗口**，
    而不是在已有浏览器里多开一个标签页。找不到 Edge/Chrome 才退回默认浏览器。"""
    url = f'http://127.0.0.1:{port}/'
    try:
        import subprocess, shutil
        exe = None
        if sys.platform.startswith('win'):
            exe = _find_browser_win()
        elif sys.platform == 'darwin':
            for c in ('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'):
                if os.path.exists(c):
                    exe = c; break
        else:  # linux
            for name in ('google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'):
                p = shutil.which(name)
                if p:
                    exe = p; break
        if exe:
            base = os.environ.get('LOCALAPPDATA') or os.path.expanduser('~')
            profile = os.path.join(base, 'MyLibrary', 'appwindow')
            try:
                os.makedirs(profile, exist_ok=True)
            except Exception:
                profile = None
            args = [exe, f'--app={url}', '--window-size=1200,820',
                    '--no-first-run', '--no-default-browser-check']
            if profile:
                args.append(f'--user-data-dir={profile}')   # 独立配置目录 → 一定新开独立应用窗口
            try:
                print(f'  打开独立应用窗口：{exe}  --app={url}')
            except Exception:
                pass
            subprocess.Popen(args)
            return
        else:
            try:
                print('  ⚠ 没找到 Edge/Chrome，退回默认浏览器（会是标签页，不是独立窗口）')
            except Exception:
                pass
    except Exception as e:
        try:
            print(f'  ⚠ 打开独立窗口失败：{type(e).__name__}: {e}，退回默认浏览器')
        except Exception:
            pass
    try:
        webbrowser.open(url)   # 实在找不到浏览器：默认浏览器开标签页兜底
    except Exception:
        pass

def _free_port(port):
    """如果端口被一个旧的实例占着（pythonw 没窗口，你可能没发现它还在跑），
    先把它关掉，让这次启动用上磁盘上最新的代码（newest-wins）。否则新进程绑不上端口、
    你打开的还是旧服务、看到的就还是旧界面。"""
    if not sys.platform.startswith('win'):
        return
    try:
        import subprocess, time
        me = str(os.getpid())
        out = subprocess.run(['netstat', '-ano', '-p', 'tcp'],
                             capture_output=True, text=True, timeout=6).stdout
        pids = set()
        for line in out.splitlines():
            up = line.upper()
            if 'LISTEN' not in up:
                continue
            parts = line.split()
            if len(parts) >= 5 and parts[-1].isdigit() and parts[-1] != me:
                local = parts[1] if len(parts) > 1 else ''
                if local.endswith(':' + str(port)):
                    pids.add(parts[-1])
        for pid in pids:
            subprocess.run(['taskkill', '/F', '/PID', pid], capture_output=True, timeout=6)
        if pids:
            time.sleep(0.8)   # 给端口一点释放时间
    except Exception:
        pass

def _port_free(host, port):
    """端口能不能绑（用来判断是否被别的程序占着）。"""
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(('127.0.0.1' if host in ('0.0.0.0', '::') else host, port))
        return True
    except OSError:
        return False
    finally:
        try: s.close()
        except Exception: pass

def _pick_port(host, port):
    """端口被别的程序占了就往后找一个空的（最多试 20 个），找不到就返回原端口让 uvicorn 报错。"""
    for p in [port] + list(range(port + 1, port + 21)):
        if _port_free(host, p):
            return p
    return port

def _open_when_ready(port):
    """等服务真正起来能响应了，再打开应用窗口——避免窗口先开、服务还没起来导致「加载失败」。
    （13万本的库初始化要一点时间，固定延时不够稳，改成轮询。）"""
    import time, urllib.request
    url = f'http://127.0.0.1:{port}/'
    ready = False
    for _ in range(300):              # 最多等 ~60 秒，但每 0.2 秒探一次 → 服务一好立刻开窗
        try:
            with urllib.request.urlopen(url, timeout=1):
                ready = True
                break
        except Exception:
            time.sleep(0.2)
    try:
        if ready:
            print('  ✓ 服务就绪，正在打开独立应用窗口 …')
        else:
            print('  ⚠ 等待服务超时，仍尝试打开窗口（若加载失败，刷新或检查书库硬盘）')
    except Exception:
        pass
    _open_app_window(port)

def main():
    import _state
    p = argparse.ArgumentParser()
    p.add_argument('root', nargs='?', default=None)
    p.add_argument('--host', default=None)
    p.add_argument('--port', type=int, default=None)
    p.add_argument('--no-browser', action='store_true')
    args = p.parse_args()

    _state.CONFIG = CONFIG = load_config()
    root_str = str(args.root) if args.root else (CONFIG['library'].get('root') or '')
    host = args.host or CONFIG['server'].get('host', '0.0.0.0')
    port = args.port or CONFIG['server'].get('port', 8765)
    do_open = (not args.no_browser) and CONFIG['server'].get('open_browser', True)

    # 命令行传了路径就写回配置（作为新的默认库）
    if args.root:
        CONFIG['library']['root'] = root_str
        _state.CONFIG = CONFIG
        save_config(CONFIG)

    # ① 先关掉可能还在后台跑的旧实例（newest-wins，确保用最新代码）
    _free_port(port)
    # ② 端口若仍被【别的程序】占着，自动往后找一个空端口，避免绑不上直接崩
    _picked = _pick_port(host, port)
    if _picked != port:
        print(f'  ⚠ 端口 {port} 被占用，自动改用 {_picked}')
        port = _picked

    # 尝试打开图书馆。打不开也照常启动——进入"待配置"状态，
    # 用户可在浏览器「设置 → 图书馆」里填/改路径，即时生效，无需重启。
    from _state import init_library
    ok, msg = init_library(root_str)
    LIB = _state.LIB

    from mylib_html import HTML
    _state._HTML_CACHE = HTML

    lip = get_local_ip()
    print(f'\n  MyLibrary v3 已启动')
    print(f'  ─────────────────────────────────')
    if ok:
        print(f'  图书馆:    {LIB.root}')
    else:
        print(f'  图书馆:    ⚠ 未就绪（{msg}）')
        print(f'             打开下面的地址 → 右上角「设置 → 图书馆」填写书库路径即可')
    print(f'  本机:      http://127.0.0.1:{port}/')
    if host in ('0.0.0.0','::'):
        print(f'  局域网: http://{lip}:{port}/')
    ak = CONFIG['ai'].get('api_key')
    print(f'  AI 助手:   {"就绪" if ak else "未配置 → 设置"}')
    print(f'  设置页:    http://127.0.0.1:{port}/settings')
    print(f'  API 文档:  http://127.0.0.1:{port}/docs')
    print(f'  按 Ctrl+C 关闭\n')

    if do_open:
        threading.Thread(target=_open_when_ready, args=(port,), daemon=True).start()

    # 心跳自动退出（和 exe 版一致，这条 python/启动.bat 路之前漏了）：网页每 ~20s ping /api/heartbeat，
    # 看门狗发现超过宽限期没人 ping（= 浏览器全关了）就自己退出进程、释放端口 → 关掉浏览器后不必再去任务管理器杀。
    import time as _t
    _HB = {'t': _t.time() + 60}   # 启动给 60s 宽限，等浏览器打开并连上
    @app.get('/api/heartbeat')
    def _heartbeat():
        _HB['t'] = _t.time()
        return {'ok': True}
    def _watchdog():
        while True:
            _t.sleep(10)
            if _t.time() - _HB['t'] > 90:   # 宽限 90s：手机锁屏/切后台定时器降频也不误杀；网页真关掉则彻底没心跳
                try: print('\n  浏览器已全部关闭，MyLibrary 自动退出。')
                except Exception: pass
                os._exit(0)
    threading.Thread(target=_watchdog, daemon=True).start()

    # pythonw.exe（无黑窗）下 sys.stdout / sys.stderr 可能是 None，uvicorn 初始化日志时会调用
    # sys.stdout.isatty() 直接崩溃（'NoneType' has no attribute 'isatty'）——表现就是"快捷方式点不开"。
    # 这里再兜底一次（即便启动脚本是旧版、没接流也不怕）：给它们接上一个带 isatty() 的真实流。
    import sys as _sys, os as _os
    for _nm in ('stdout', 'stderr'):
        _s = getattr(_sys, _nm, None)
        if _s is None or not hasattr(_s, 'isatty'):
            try:
                setattr(_sys, _nm, open(_os.devnull, 'w', encoding='utf-8'))
            except Exception:
                import io as _io
                setattr(_sys, _nm, _io.StringIO())

    try:
        uvicorn.run(app, host=host, port=port, log_level='warning')
    except KeyboardInterrupt:
        pass
    finally:
        try:
            if _state.LIB: _state.LIB.close()
        except Exception:
            pass
        print('\n再见')

if __name__ == '__main__':
    main()
