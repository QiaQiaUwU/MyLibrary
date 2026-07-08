# -*- coding: utf-8 -*-
"""pytest 公共夹具：搭一个临时库 + TestClient。"""
import sys, os, tempfile, json, sqlite3
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parent.parent
for sub in ('core', 'server', 'agents', 'tools', 'utils'):
    sys.path.insert(0, str(ROOT / 'mylib' / sub))
sys.path.insert(0, str(ROOT))


@pytest.fixture(scope='session')
def app_client():
    tmp = Path(tempfile.mkdtemp())
    os.environ['MYLIB_CONFIG'] = str(tmp / 'config.json')
    os.environ['MYLIB_STATIC'] = str(ROOT / 'static')
    os.environ['MYLIB_FRONTEND'] = str(ROOT / 'frontend')
    root = tmp / 'lib'
    root.mkdir()
    cfg = {'server': {'host': '127.0.0.1', 'port': 8799, 'open_browser': False},
           'library': {'root': str(root)},
           'ai': {'provider': 'x', 'api_key': '', 'base_url': 'x', 'model': 'm'}}
    json.dump(cfg, open(tmp / 'config.json', 'w'), ensure_ascii=False)

    from mylib_core import Library
    Library(root)
    import migrate_db
    migrate_db.migrate(str(root / 'library.db'))
    conn = sqlite3.connect(str(root / 'library.db'))
    cols = [r[1] for r in conn.execute('PRAGMA table_info(books)')]

    def ins(v):
        d = {'raw_title': v['title'], 'file_size': 1, 'file_ext': 'txt',
             'content_hash': 'c' + v['title'], 'raw_hash': 'r' + v['title'],
             'import_time': '2026-01-01'}
        d.update(v)
        k = [x for x in d if x in cols]
        conn.execute(f"INSERT INTO books({','.join(k)}) VALUES ({','.join('?'*len(k))})",
                     [d[x] for x in k])
    ins({'title': '测试书一', 'author': 'priest', 'file_path': 'a.txt',
         'word_count': 120000, 'is_favorite': 1, 'reading_status': 'reading', 'tree_skin': 'cedar'})
    ins({'title': '测试书二', 'author': '淮上', 'file_path': 'b.txt',
         'word_count': 98000, 'is_favorite': 0, 'reading_status': 'read'})
    conn.execute("INSERT INTO highlights(book_id,text,position,created_at) VALUES(1,'一句划线',1500,'2026-06-01')")
    conn.commit()
    conn.close()

    import mylib_server_v2 as s
    import _state
    from database import open_threadsafe
    lib = Library(root)
    open_threadsafe(lib)
    _state.LIB = lib
    from mylib_html import HTML
    _state._HTML_CACHE = HTML
    from fastapi.testclient import TestClient
    return TestClient(s.app)

