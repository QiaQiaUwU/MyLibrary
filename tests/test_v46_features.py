# -*- coding: utf-8 -*-
"""v4.6 功能测试：日历月聚合（真实接口）、待办快捷建条/编辑、心事记忆的记录与清除、
按正文找作者的并发扫描（正确性 + 有意义的加速）。"""
import json, os, sqlite3, time
from datetime import date, timedelta
from pathlib import Path


def test_calendar_month_aggregation(app_client):
    cfg = json.load(open(os.environ['MYLIB_CONFIG'], encoding='utf-8'))
    db = Path(cfg['library']['root']) / 'library.db'
    conn = sqlite3.connect(str(db))
    try:
        # quill_todos/quill_habits/quill_habit_log 是"自愈表"——只在 _todo_conn/_habit_conn
        # 第一次被调用时才会建出来（不是 migrate_db.py 管的），这里直接用原始 SQL 操作它们之前，
        # 得先确保表真的存在，不能假设它已经在了（之前就是漏了这一步，本地一直没跑过这个真实场景）。
        conn.execute('''CREATE TABLE IF NOT EXISTS quill_todos(
            id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT, due TEXT, done INTEGER DEFAULT 0, created_at TEXT)''')
        conn.execute('''CREATE TABLE IF NOT EXISTS quill_habits(
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, remind_time TEXT DEFAULT '',
            goal INTEGER DEFAULT 21, medal_at TEXT DEFAULT '', created_at TEXT)''')
        conn.execute('''CREATE TABLE IF NOT EXISTS quill_habit_log(
            id INTEGER PRIMARY KEY AUTOINCREMENT, habit_id INTEGER, date TEXT,
            UNIQUE(habit_id, date))''')
        conn.execute("DELETE FROM quill_todos"); conn.execute("DELETE FROM quill_habits"); conn.execute("DELETE FROM quill_habit_log")
        conn.execute("INSERT INTO quill_todos(text,due,done) VALUES('交报告','2026-07-10 18:00',0)")
        conn.execute("INSERT INTO quill_todos(text,due,done) VALUES('买菜','2026-07-07 09:00',1)")
        conn.execute("INSERT INTO quill_todos(text,due,done) VALUES('下月的事','2026-08-01 09:00',0)")
        conn.execute("INSERT INTO quill_habits(name,remind_time,goal,created_at) VALUES('早起','07:00',21,'2026-07-01T00:00:00')")
        conn.execute("INSERT INTO quill_habits(name,remind_time,goal,created_at) VALUES('背单词','21:00',21,'2026-07-06T00:00:00')")
        conn.execute("INSERT INTO quill_habit_log(habit_id,date) VALUES(1,'2026-07-01')")
        conn.execute("INSERT INTO quill_habit_log(habit_id,date) VALUES(2,'2026-07-06')")
        conn.commit()
    finally:
        conn.close()   # 就算上面哪一步炸了，也不留一个没关的连接去干扰同一个数据库文件上的其他测试

    r = app_client.get('/api/quill/calendar?month=2026-07').json()
    days = r['days']
    assert len(days['2026-07-10']['todos']) == 1
    assert days['2026-07-07']['todos'][0]['done'] is True
    assert '2026-08-01' not in days, '跨月的待办不该混进当月聚合'
    assert days['2026-07-05']['habits_total'] == 1, '背单词 7/6 才建，7/5 不该算它'
    assert days['2026-07-06']['habits_total'] == 2 and days['2026-07-06']['habits_done'] == 1


def test_todo_quick_add_and_edit(app_client):
    r = app_client.post('/api/quill/todos/quick', json={'text': '倒垃圾', 'due': '2026-07-09'}).json()
    assert r['ok']
    tid = r['id']
    app_client.post(f'/api/quill/todos/{tid}', json={'text': '倒垃圾（可回收）'})
    rows = app_client.get('/api/quill/todos').json()['todos']
    hit = next(t for t in rows if t['id'] == tid)
    assert hit['text'] == '倒垃圾（可回收）' and hit['done'] is False
    app_client.post(f'/api/quill/todos/{tid}', json={'done': True})
    rows = app_client.get('/api/quill/todos').json()['todos']
    assert next(t for t in rows if t['id'] == tid)['done'] is True
    app_client.post(f'/api/quill/todos/{tid}', json={'done': False})   # 日历里点回未完成
    rows = app_client.get('/api/quill/todos').json()['todos']
    assert next(t for t in rows if t['id'] == tid)['done'] is False


def test_concern_remember_and_resolve():
    # 不经 HTTP，直接测 QuillTools——工具层是这颗"记得关心你"的核心
    import quill_agent as qa
    from mylib_core import Library
    from migrate_db import migrate
    import tempfile
    tmp = Path(tempfile.mkdtemp())
    lib = Library(tmp / 'lib'); db = lib.root / 'library.db'; lib.close()
    migrate(db)
    tools = qa.QuillTools(db)

    r = json.loads(tools.execute('remember_concern', {'text': '工作压力很大'}))
    assert r['ok']; key = r['key']

    conn = qa._mem_conn(db)
    fresh = conn.execute("SELECT updated_at FROM quill_memory WHERE key=?", (key,)).fetchone()
    conn.close()
    from datetime import datetime
    assert (datetime.now() - datetime.fromisoformat(fresh[0])).total_seconds() < 60, '刚记的应该是新鲜时间戳'

    # 手动拨回 20 小时前，模拟"过了一天"，该出现在待关心清单里
    conn = qa._mem_conn(db)
    old = (datetime.now().replace(microsecond=0) - timedelta(hours=20)).isoformat()
    conn.execute("UPDATE quill_memory SET updated_at=? WHERE key=?", (old, key))
    conn.commit(); conn.close()
    conn = qa._mem_conn(db)
    stale = [row for row in conn.execute("SELECT key,updated_at FROM quill_memory WHERE key LIKE '_concern:%'").fetchall()
             if (datetime.now() - datetime.fromisoformat(row[1])).total_seconds() > 12 * 3600]
    conn.close()
    assert len(stale) == 1 and stale[0][0] == key

    r2 = json.loads(tools.execute('resolve_concern', {'concern_id': key}))
    assert r2['ok']
    conn = qa._mem_conn(db)
    left = conn.execute("SELECT COUNT(*) FROM quill_memory WHERE key=?", (key,)).fetchone()[0]
    conn.close()
    assert left == 0


def test_author_scan_parallel_correct_and_faster(tmp_path):
    import author_from_content as afc
    src = tmp_path / 'books'; src.mkdir()
    conn = sqlite3.connect(str(tmp_path / 'library.db'))
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE books(id INTEGER PRIMARY KEY, title TEXT, author TEXT, file_path TEXT)")
    for i in range(300):
        handle = ['诗无茶', '青花', '鱼双意'][i % 3]
        author = handle if i % 5 == 0 else '佚名'
        fn = f'books/b{i}.txt'
        (tmp_path / fn).write_text(f'微博：{handle}\n正文正文……', encoding='utf-8')
        conn.execute("INSERT INTO books(id,title,author,file_path) VALUES(?,?,?,?)", (i, f'书{i}', author, fn))
    conn.commit()

    # 打个人工延迟模拟磁盘 I/O，验证并发确实overlap 等待时间而不是白等
    orig = afc._read_head
    afc._read_head = lambda fp, max_bytes=200_000: (time.sleep(0.003), orig(fp, max_bytes))[1]
    try:
        t0 = time.time()
        clusters_seq = afc.find_clusters(conn, tmp_path, max_workers=1)
        t_seq = time.time() - t0
        t0 = time.time()
        clusters_par = afc.find_clusters(conn, tmp_path, max_workers=16)
        t_par = time.time() - t0
    finally:
        afc._read_head = orig
    conn.close()

    def norm(cl):
        return sorted((c['handle'], c['suggested'], tuple(sorted(b['id'] for b in c['books']))) for c in cl)
    assert norm(clusters_seq) == norm(clusters_par), '并发扫描结果必须和顺序扫描一致'
    assert t_par < t_seq / 3, f'16 线程应比单线程明显快（seq={t_seq:.2f}s par={t_par:.2f}s）'

