# -*- coding: utf-8 -*-
"""v4.3–v4.5 功能测试：节日引擎补日、home.js 拼接含新模块、
遍数新口径（0→100 才算一遍 + 老小数归一）、网页线程内入库不炸 signal。"""
import json, os, sqlite3, threading
from pathlib import Path


def test_festival_engine_days():
    # v4.3：_FESTIVALS 补了万圣节和跨年夜；顺带钉住 current_jieqi 的边界（7/7 = 小暑）
    import quill_agent as qa
    assert qa._FESTIVALS.get((10, 31)) == '万圣节'
    assert qa._FESTIVALS.get((12, 31)) == '跨年夜'
    assert qa._FESTIVALS.get((12, 25)) == '圣诞节'   # 老的没丢
    from datetime import date
    assert qa.current_jieqi(date(2026, 7, 7)) == '小暑'
    assert qa.current_jieqi(date(2026, 1, 2)) == '冬至'   # 元旦到小寒前算冬至


def test_home_js_concat_has_new_modules():
    # v4.3/v4.4/v4.6：62_term_art / 65_tarot / 70_mood / 72_calendar 拼进下发 JS，且按文件名有序
    import frontend_loader as fl
    js = fl.live_home_js()
    for marker in ('QTERM_ART24', 'TAROT_ARCANA', 'const QM_DUR', 'function qcalOpen'):
        assert marker in js, f'拼接产物里没有 {marker}'
    i60 = js.index('QTERM_PHRASES')      # 60_quill_extras
    i62 = js.index('QTERM_ART24')        # 62_term_art
    i65 = js.index('TAROT_ARCANA')       # 65_tarot
    i70 = js.index('const QM_DUR')       # 70_mood
    i72 = js.index('function qcalOpen')  # 72_calendar
    assert i60 < i62 < i65 < i70 < i72, '模块拼接顺序不是按文件名'


def test_book_reads_pass_logic(app_client):
    # v4.5：遍数 = 进度 0→100（≥97 读完）；老 0~1 小数归一，不再出 4300%
    cfg = json.load(open(os.environ['MYLIB_CONFIG'], encoding='utf-8'))
    db = Path(cfg['library']['root']) / 'library.db'
    conn = sqlite3.connect(str(db))
    conn.execute("DELETE FROM reading_diary WHERE book_id=2")
    rows = [
        ('2026-05-01', 60, 0,    0.99),   # 老格式小数 → 99，读完第 1 遍
        ('2026-05-20', 20, 0,    35),     # 隔了 19 天重读 —— 老口径会瞎猜成新一遍，这里只是第 2 遍进行中
        ('2026-05-21', 25, 35,   62),
    ]
    for d, m, s, e in rows:
        conn.execute("INSERT INTO reading_diary(date,book_id,book_title,minutes_read,start_pct,end_pct) "
                     "VALUES(?,2,'测试书二',?,?,?)", (d, m, s, e))
    conn.commit(); conn.close()

    r = app_client.get('/api/book/2/reads').json()
    assert r['passes'] == 1, r
    assert r['pass_marks'][0]['date'] == '2026-05-01' and r['pass_marks'][0]['n'] == 1
    assert r['in_pass'] is True and r['current_pct'] == 62
    assert r['day_count'] == 3 and r['total_minutes'] == 105
    ends = {d['date']: d['end'] for d in r['days']}
    assert abs(ends['2026-05-01'] - 99) < 1e-9, '0.99 应归一成 99'
    assert all(0 <= d['end'] <= 100 for d in r['days']), '不许再出 4300%'


def test_scan_import_in_worker_thread(tmp_path):
    # v4.5：网页「开始入库」跑在工作线程里 —— signal 注册要跳过而不是抛 ValueError
    from mylib_core import Library, scan_and_import
    src = tmp_path / 'src'; src.mkdir()
    para = '第一章 试验\n' + '他推开木门，院里的桂花开了一地。' * 400 + '\n'
    (src / '样本甲.txt').write_text(para, encoding='utf-8')
    (src / '样本乙.txt').write_text(para.replace('桂花', '梅花'), encoding='utf-8')

    result = {}
    def worker():
        try:
            lib = Library(tmp_path / 'lib')            # 贴 mylib_admin 的真实姿势：连接在线程内建
            scan_and_import(lib, [src], move=False, cleanup_orphans=False)
            result['n'] = lib.conn.execute('SELECT COUNT(*) FROM books').fetchone()[0]
            lib.close()
        except Exception as e:                          # 修复前这里是 ValueError: signal only works in main thread
            result['err'] = repr(e)

    t = threading.Thread(target=worker); t.start(); t.join(120)
    assert 'err' not in result, result.get('err')
    assert result.get('n') == 2


