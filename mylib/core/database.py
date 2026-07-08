# -*- coding: utf-8 -*-
"""数据层入口（core.database）。
Library 类与表结构的实现在 mylib_core.py（历史名，内容稳定）。
这里重新导出并提供线程安全连接工具，作为"数据库层"的清晰入口。
新代码请 `from database import Library, open_threadsafe`。
"""
import sqlite3
from pathlib import Path

from mylib_core import Library, SCHEMA  # 实际实现


def open_threadsafe(lib: 'Library', timeout: int = 30) -> None:
    """把 Library 的连接换成线程安全模式。
    FastAPI 用线程池处理请求，多设备并发读 + 后台任务写需要
    check_same_thread=False，配 WAL 写不阻塞读。
    """
    try:
        lib.conn.close()
    except Exception:
        pass
    conn = sqlite3.connect(str(lib.db_path), check_same_thread=False, timeout=timeout)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode = WAL')
    conn.execute('PRAGMA synchronous = NORMAL')
    conn.execute('PRAGMA busy_timeout = %d' % (timeout * 1000))
    lib.conn = conn


__all__ = ['Library', 'SCHEMA', 'open_threadsafe']


