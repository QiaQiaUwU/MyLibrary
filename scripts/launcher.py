#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
launcher.py — MyLibrary exe 入口
==================================
打包成 exe 后的启动入口。处理：
  - 打包环境下的路径（sys._MEIPASS）
  - 首次运行引导用户选择图书馆目录
  - 配置文件读写（放在 exe 同目录，不放临时解压目录）
  - 启动服务 + 开浏览器
"""

import json
import os
import sys
import socket
import threading
import webbrowser
from pathlib import Path


def get_app_dir() -> Path:
    """获取 exe 所在目录（不是临时解压目录）"""
    if getattr(sys, 'frozen', False):
        # 打包成 exe 后，exe 在 sys.executable
        return Path(sys.executable).parent
    else:
        # 源码运行
        return Path(__file__).parent


APP_DIR = get_app_dir()
CONFIG_PATH = APP_DIR / 'config.json'

# 源码态运行时，把 mylib 各子包目录加入导入路径（打包态由 PyInstaller 处理，无需此步）
if not getattr(sys, 'frozen', False):
    _src_root = Path(__file__).resolve().parent.parent
    for _s in ('core', 'server', 'agents', 'tools', 'utils'):
        _p = _src_root / 'mylib' / _s
        if _p.is_dir() and str(_p) not in sys.path:
            sys.path.insert(0, str(_p))


def load_or_init_config() -> dict:
    """加载配置，首次运行引导设置库路径"""
    default = {
        'server': {'host': '0.0.0.0', 'port': 8765, 'open_browser': True},
        'library': {'root': '', 'inbox': '', 'export_dir': '', 'mrpro_path': ''},
        'ai': {'provider': 'deepseek', 'api_key': '', 'base_url': 'https://api.deepseek.com/v1',
               'model': 'deepseek-chat', 'embedding_model': ''},
    }

    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
            for sec, defs in default.items():
                cfg.setdefault(sec, defs)
                if isinstance(defs, dict):
                    for k, v in defs.items():
                        cfg[sec].setdefault(k, v)
            return cfg
        except Exception:
            pass

    return default


def prompt_library_path() -> str:
    """引导用户输入/选择图书馆路径"""
    print()
    print('  ========================================')
    print('   首次运行 — 请指定你的图书馆目录')
    print('  ========================================')
    print()
    print('  图书馆目录是包含 library.db 的文件夹。')
    print('  如果还没有图书馆，需要先用 CLI 初始化。')
    print()

    # 尝试用图形对话框选择
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()  # 隐藏主窗口
        root.attributes('-topmost', True)
        path = filedialog.askdirectory(title='选择书库目录（新用户可选一个空文件夹，会自动新建）')
        root.destroy()
        if path:
            return path
    except Exception:
        pass

    # 退回到命令行输入
    path = input('  请输入图书馆目录的完整路径: ').strip().strip('"')
    return path


def find_library() -> Path:
    """定位图书馆目录"""
    cfg = load_or_init_config()
    root_str = cfg['library'].get('root', '')

    # 1. 配置里有且有效
    if root_str and (Path(root_str) / 'library.db').exists():
        return Path(root_str)

    # 2. 命令行参数
    if len(sys.argv) > 1 and not sys.argv[1].startswith('--'):
        cand = Path(sys.argv[1])
        if (cand / 'library.db').exists():
            _save_root(cfg, cand)
            return cand

    # 3. exe 同目录下常见位置
    for name in ['MyLibrary', 'library', '图书馆', 'MyLibrary_书库']:
        cand = APP_DIR / name
        if (cand / 'library.db').exists():
            _save_root(cfg, cand)
            return cand

    # 4. 全新用户：自动新建一个默认书库（不弹窗、不让用户选）→ 双击即用、零操作。
    #    优先建在 exe 同目录（书和程序在一起、好携带）；该目录不可写(如放在 Downloads/Program Files)就退到用户主目录。
    for base in (APP_DIR, Path.home()):
        try:
            cand = base / 'MyLibrary_书库'
            cand.mkdir(parents=True, exist_ok=True)
            probe = cand / '.write_test'
            probe.write_text('ok', encoding='utf-8'); probe.unlink()   # 确认可写
            _save_root(cfg, cand)
            print(f'  已自动新建书库: {cand}')
            return cand
        except Exception:
            continue

    # 5. 自动新建都失败（极少见，如权限受限）才退回手动选择
    while True:
        path = prompt_library_path()
        if not path:
            print('  ❌ 未选择目录，退出')
            sys.exit(1)
        cand = Path(path)
        if (cand / 'library.db').exists():
            _save_root(cfg, cand)
            return cand
        else:
            # 空文件夹 → 问要不要在这里新建一个书库（Library 初始化会自动建 library.db）
            if _confirm_new_library(cand):
                _save_root(cfg, cand)
                return cand
            print(f'  ⚠️  {cand} 里没有书库')
            retry = input('  重新选择？(y/n): ').strip().lower()
            if retry != 'y':
                sys.exit(1)


def _confirm_new_library(folder: Path) -> bool:
    """该文件夹没有 library.db 时，问用户是否在这里新建一个空书库。"""
    try:
        import tkinter as tk
        from tkinter import messagebox
        r = tk.Tk(); r.withdraw(); r.attributes('-topmost', True)
        ok = messagebox.askyesno(
            '新建书库',
            f'这个文件夹还没有书库：\n{folder}\n\n要在这里新建一个空书库吗？\n（之后在网页里把书拖进来即可）')
        r.destroy()
        return bool(ok)
    except Exception:
        ans = input(f'  {folder} 里没有书库，在这里新建一个？(y/n): ').strip().lower()
        return ans == 'y'


def _save_root(cfg: dict, root: Path):
    cfg['library']['root'] = str(root)
    with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=4)


def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


def main():
    print()
    print('  ====================================')
    print('     MyLibrary - Personal Library')
    print('  ====================================')

    # 检查关键依赖（exe 模式下已打包，源码模式下可能缺）
    if not getattr(sys, 'frozen', False):
        try:
            import fastapi, uvicorn  # noqa
        except ImportError:
            print('\n  [缺少依赖] 需要先安装运行库:')
            print('    pip install fastapi uvicorn python-multipart')
            print()
            input('  按回车退出...')
            sys.exit(1)

    # 定位图书馆
    root = find_library()
    print(f'\n  图书馆: {root}')

    # 把 config 路径告诉 server 模块（让它读写 exe 同目录的 config）
    os.environ['MYLIB_CONFIG'] = str(CONFIG_PATH)
    os.environ['MYLIB_ROOT'] = str(root)

    # 打包(exe)态：前端与素材被解压到 _MEIPASS，告诉服务端去那里找
    if getattr(sys, 'frozen', False):
        _base = Path(getattr(sys, '_MEIPASS', APP_DIR))
        os.environ['MYLIB_FRONTEND'] = str(_base / 'frontend')
        os.environ['MYLIB_STATIC'] = str(_base / 'static')

    # 数据库迁移（确保新表存在）
    try:
        from migrate_db import migrate
        migrate(root / 'library.db')
    except Exception as e:
        print(f'  ⚠️  迁移跳过: {e}')

    # 导入服务端并启动
    import mylib_server_v2 as srv

    # 覆盖 server 的配置路径为 exe 同目录
    srv.CONFIG_PATH = CONFIG_PATH

    cfg = load_or_init_config()
    port = cfg['server'].get('port', 8765)
    host = cfg['server'].get('host', '0.0.0.0')

    # 端口已被占用 = MyLibrary 已经在跑（上次没退干净）→ 直接打开浏览器连过去，不再重复 bind
    # （否则 uvicorn 启动失败、闪退，用户以为“打不开，得去任务管理器杀进程”）
    def _port_alive(p):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.4)
        try:
            return s.connect_ex(('127.0.0.1', int(p))) == 0
        except Exception:
            return False
        finally:
            try:
                s.close()
            except Exception:
                pass
    if _port_alive(port):
        print('  MyLibrary 已经在运行，直接打开浏览器…')
        try:
            webbrowser.open(f'http://127.0.0.1:{port}/')
        except Exception:
            pass
        import time as _t
        _t.sleep(2)
        return

    # 初始化 Library
    from mylib_core import Library
    srv.LIB = Library(root)
    from mylib_html import HTML
    srv._HTML_CACHE = HTML
    srv.CONFIG = cfg

    lip = get_local_ip()
    print(f'  本机:      http://127.0.0.1:{port}/')
    print(f'  📱 局域网: http://{lip}:{port}/')
    ak = cfg['ai'].get('api_key')
    print(f'  AI 助手:   {"✅ 就绪" if ak else "❌ 未配置 (在网页 设置 里填 API key)"}')
    print(f'  -------------------------------------')
    print(f'  浏览器会自动打开。关闭此窗口停止服务。')
    print()

    # 心跳自动退出已并入服务端核心（mylib/server/routes/settings.py），任何启动方式都生效。

    # 开浏览器
    threading.Timer(1.2, lambda: webbrowser.open(f'http://127.0.0.1:{port}/')).start()

    # 启动 uvicorn
    import uvicorn
    try:
        uvicorn.run(srv.app, host=host, port=port, log_level='warning')
    except KeyboardInterrupt:
        pass
    finally:
        if srv.LIB:
            srv.LIB.close()
        print('\n  服务已停止')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f'\n  ❌ 启动失败: {e}')
        import traceback
        traceback.print_exc()
        input('\n  按回车退出...')

