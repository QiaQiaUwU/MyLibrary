#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
install.py — 一键安装 + 创建桌面快捷方式
==========================================
做三件事：
  1. 检查 Python 和依赖，缺啥装啥
  2. 在桌面创建"MyLibrary 图书馆"快捷方式
  3. 之后双击桌面图标即可启动

用法: python install.py
"""

import os
import sys
import subprocess
from pathlib import Path

APP_DIR = Path(__file__).parent.resolve()


def check_deps():
    """检查并安装依赖"""
    print('  [1/3] 检查依赖...')
    try:
        import fastapi, uvicorn  # noqa
        import multipart  # noqa
        print('       依赖已就绪')
        return True
    except ImportError:
        print('       首次运行，安装依赖中（需联网，约 1-2 分钟）...')
        try:
            subprocess.check_call(
                [sys.executable, '-m', 'pip', 'install',
                 'fastapi', 'uvicorn', 'python-multipart', '--quiet'])
            print('       依赖安装完成')
            return True
        except subprocess.CalledProcessError:
            print('       [错误] 依赖安装失败，请检查网络')
            return False


def get_desktop_path() -> Path:
    """获取桌面真实路径（支持重定向到 D 盘等非默认位置）"""
    # 方法1：读注册表（最可靠，桌面移到哪盘都能查到）
    if sys.platform == 'win32':
        try:
            import winreg
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r'Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders')
            desktop, _ = winreg.QueryValueEx(key, 'Desktop')
            winreg.CloseKey(key)
            # 展开环境变量（如 %USERPROFILE%）
            desktop = os.path.expandvars(desktop)
            if Path(desktop).exists():
                return Path(desktop)
        except Exception:
            pass

    # 方法2：常见位置兜底
    for cand in [
        Path(os.path.expanduser('~')) / 'Desktop',
        Path(os.path.expanduser('~')) / 'OneDrive' / 'Desktop',
        Path(os.path.expanduser('~')) / 'OneDrive - Personal' / 'Desktop',
    ]:
        if cand.exists():
            return cand

    # 方法3：USERPROFILE 环境变量
    up = os.environ.get('USERPROFILE', '')
    if up:
        d = Path(up) / 'Desktop'
        if d.exists():
            return d

    return None


def create_shortcut():
    """在桌面创建快捷方式（Windows）"""
    print('  [2/3] 创建桌面快捷方式...')

    if sys.platform != 'win32':
        print('       非 Windows 系统，跳过')
        return

    try:
        desktop = get_desktop_path()
        if not desktop:
            print('       找不到桌面目录，跳过（可手动创建快捷方式指向 launcher.py）')
            return

        shortcut_path = desktop / 'MyLibrary 图书馆.lnk'
        launcher = APP_DIR / 'launcher.py'
        pythonw = sys.executable.replace('python.exe', 'pythonw.exe')
        if not Path(pythonw).exists():
            pythonw = sys.executable

        # 用 PowerShell 创建快捷方式（不依赖 pywin32）
        ico = APP_DIR / 'icon.ico'
        icon_line = f'$s.IconLocation = "{ico}"' if ico.exists() else ''
        ps_script = f'''
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut("{shortcut_path}")
$s.TargetPath = "{sys.executable}"
$s.Arguments = '"{launcher}"'
$s.WorkingDirectory = "{APP_DIR}"
$s.Description = "MyLibrary 个人图书馆"
{icon_line}
$s.Save()
'''
        subprocess.run(['powershell', '-NoProfile', '-Command', ps_script],
                       capture_output=True, timeout=30)
        if shortcut_path.exists():
            print(f'       已创建: {shortcut_path}')
        else:
            print('       快捷方式创建可能失败，可手动创建')
    except Exception as e:
        print(f'       创建快捷方式出错: {e}')


def init_config():
    """确保 config.json 存在"""
    print('  [3/3] 检查配置...')
    cfg = APP_DIR / 'config.json'
    example = APP_DIR / 'config.example.json'
    if not cfg.exists() and example.exists():
        import shutil
        shutil.copy(example, cfg)
        print('       已创建 config.json')
    else:
        print('       配置就绪')


def main():
    print()
    print('  ========================================')
    print('    MyLibrary 安装')
    print('  ========================================')
    print()

    if not check_deps():
        input('\n  按回车退出...')
        return

    create_shortcut()
    init_config()

    print()
    print('  ========================================')
    print('    安装完成！')
    print('  ========================================')
    print()
    print('  启动方式（任选其一）:')
    print('    · 双击桌面的 "MyLibrary 图书馆" 图标')
    print('    · 双击 MyLibrary.bat')
    print(f'    · 运行 python "{APP_DIR / "launcher.py"}"')
    print()
    print('  首次启动会让你选择图书馆目录（包含 library.db 的文件夹）')
    print()
    input('  按回车退出...')


if __name__ == '__main__':
    main()


