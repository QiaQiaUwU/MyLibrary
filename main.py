#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MyLibrary v3 — 启动入口
=========================
个人藏书阅读系统。本地优先、跨设备访问的 Web 应用。

用法:
    python main.py                 # 用 config.json 里的库路径
    python main.py F:\\MyLibrary    # 指定库路径

首次使用:
    pip install -r requirements.txt
    python main.py F:\\MyLibrary

目录结构:
    main.py            ← 你在这里
    config.json        ← 配置（库路径 / 端口 / AI key）
    mylib/
        core/          ← Library 底层、数据库迁移
        server/        ← FastAPI 服务、页面（书房/阅读器/管理/设置）
        agents/        ← Quill 书库精灵、阅读 AI 助手
        tools/         ← 去重 / 打标签 / 作者归一 / 章节识别 / 入库监听
        utils/         ← mrpro 读写、书单导出
    static/            ← 白噪音、翻页音、主题素材
    scripts/           ← 安装、打包等辅助脚本
"""
import sys
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# pythonw.exe（无控制台）下 sys.stdout / sys.stderr 是 None，uvicorn 初始化日志时会调用
# sys.stdout.isatty() 而崩溃（NoneType has no attribute 'isatty'）——这就是"无黑窗快捷方式点不开"。
# 给它们接上一个真实的流（写到日志文件，留个运行记录），就不会崩了。
if sys.stdout is None or sys.stderr is None:
    try:
        _logf = open(ROOT / 'mylib_log.txt', 'w', encoding='utf-8', buffering=1)
        if sys.stdout is None:
            sys.stdout = _logf
        if sys.stderr is None:
            sys.stderr = _logf
    except Exception:
        import io
        if sys.stdout is None:
            sys.stdout = io.StringIO()
        if sys.stderr is None:
            sys.stderr = io.StringIO()

# 把各子包目录加入 import 路径，让模块间的 `from mylib_core import X` 继续可用。
# 这样既有清晰的目录分层，又不必改动几十处历史 import。
for sub in ('core', 'server', 'agents', 'tools', 'utils'):
    p = ROOT / 'mylib' / sub
    if p.is_dir():
        sys.path.insert(0, str(p))
sys.path.insert(0, str(ROOT))

# 让服务端找到 config.json（在项目根）和 static 目录
os.environ.setdefault('MYLIB_CONFIG', str(ROOT / 'config.json'))
os.environ.setdefault('MYLIB_STATIC', str(ROOT / 'static'))
os.environ.setdefault('MYLIB_FRONTEND', str(ROOT / 'frontend'))


def _report_fatal(msg):
    """没有控制台（pythonw 启动）时也能让你看到启动失败的原因：
    写一份 startup_error.log，并弹一个 Windows 对话框。"""
    try:
        (ROOT / 'startup_error.log').write_text(msg, encoding='utf-8')
    except Exception:
        pass
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(0, msg[:1500], 'MyLibrary 启动失败', 0x10)
    except Exception:
        pass
    try:
        print(msg)
    except Exception:
        pass


def main():
    try:
        import mylib_server_v2 as server
    except Exception as e:
        _report_fatal('启动失败：缺少依赖或核心模块。\n请先运行:  pip install -r requirements.txt\n\n细节: ' + repr(e))
        sys.exit(1)
    try:
        server.main()
    except SystemExit:
        raise
    except KeyboardInterrupt:
        pass
    except Exception:
        import traceback
        _report_fatal('MyLibrary 启动/运行出错：\n\n' + traceback.format_exc())
        sys.exit(1)


if __name__ == '__main__':
    main()

