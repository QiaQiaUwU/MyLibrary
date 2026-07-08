# -*- coding: utf-8 -*-
"""v4.6.2 功能测试：每日一签按八字流日算（有生辰记忆时不再是纯随机）、
PDF 能拖进库里+阅读器能打开、端口占用自动换端口的逻辑。"""
import json
import re
import time
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_daily_fortune_personalized_and_deterministic():
    import quill_agent as qa
    from mylib_core import Library
    from migrate_db import migrate
    import tempfile
    tmp = Path(tempfile.mkdtemp())
    lib = Library(tmp / 'lib'); db = lib.root / 'library.db'; lib.close()
    migrate(db)

    # 没生辰：随机兜底，但级别必须落在合法池子里
    r0 = qa.daily_fortune_level(db)
    assert r0['personalized'] is False
    assert r0['level'] in [x[0] for x in qa._QDRAW_POOL]

    # 有生辰：真算，同一天算两次必须一致（不是碰运气）
    qa.set_memory(db, 'birth_info', json.dumps({'birth': '2000-07-02 13:06', 'gender': '女'}))
    r1 = qa.daily_fortune_level(db)
    r2 = qa.daily_fortune_level(db)
    assert r1['personalized'] is True
    assert r1['level'] == r2['level'] and r1['basis'] == r2['basis']
    assert r1['level'] in ['大吉', '中吉', '小吉', '吉', '末吉']

    # 生辰记忆坏掉也不该报错，退回随机
    qa.set_memory(db, 'birth_info', '不是合法json')
    r3 = qa.daily_fortune_level(db)
    assert r3['personalized'] is False


def test_pdf_allowed_in_drag_drop_import():
    src = (ROOT / 'mylib' / 'server' / 'routes' / 'books.py').read_text(encoding='utf-8')
    m = re.search(r"if ext not in \(([^)]+)\):\s*\n\s*skipped \+= 1; continue", src)
    assert m, '找不到拖拽导入的扩展名白名单'
    allowed = m.group(1)
    assert "'pdf'" in allowed, 'pdf 还是被拖拽导入拦在外面——和文件夹扫描的支持范围不一致'


def test_reader_dispatches_pdf_to_native_viewer():
    js = (ROOT / 'frontend' / 'reader' / 'reader.js').read_text(encoding='utf-8')
    assert "if(bookExt==='pdf'){await loadPdf();return;}" in js, 'loadBook 里没有接 pdf 分支'
    assert 'async function loadPdf()' in js, '找不到 loadPdf 函数'
    m = re.search(r'async function loadPdf\(\)\{.*?\n\}', js, re.S)
    assert m, '找不到 loadPdf 函数体'
    body = m.group(0)
    assert '/api/book/\'+bookId+\'/file' in body, 'loadPdf 应该指向原始文件路由（浏览器自带查看器要整份文件）'
    assert '<iframe' in body


def test_book_file_route_serves_pdf_mimetype():
    src = (ROOT / 'mylib' / 'server' / 'routes' / 'books.py').read_text(encoding='utf-8')
    assert "'pdf': 'application/pdf'" in src, '/api/book/{id}/file 没有给 pdf 配对的 mimetype'


def test_port_auto_pick_wired_into_startup():
    # 端口被占用时自动往后找空端口——这段代码已经存在且确实接进了 main()，这里钉死别被后续改动悄悄拆掉
    src = (ROOT / 'mylib' / 'server' / 'mylib_server_v2.py').read_text(encoding='utf-8')
    assert 'def _pick_port(host, port):' in src
    m = re.search(r'def main\(\):.*', src, re.S)
    assert m, '找不到 main 函数'
    body = m.group(0)
    assert '_picked = _pick_port(host, port)' in body, 'main() 没有调用 _pick_port'
    assert 'port = _picked' in body, '选到的新端口没有被后续启动流程实际使用'
    assert 'uvicorn.run(app, host=host, port=port' in body, 'uvicorn.run 用的不是 _pick_port 选出来的端口'


