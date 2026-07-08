# -*- coding: utf-8 -*-
"""v4.6.1 补丁测试：阅读设置的按钮高亮同步（纸纹/字体/行距，之前只有肤色会同步，
造成明明存对了、界面看着却像没存上——用户因此可能又手动点回默认，把好端端的设置点没了）。
不需要 fastapi：直接读打包进去的静态文件，检查结构而不是跑真服务器。"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_reader_prefs_rows_have_data_v():
    html = (ROOT / 'frontend' / 'reader' / 'index.html').read_text(encoding='utf-8')
    js = (ROOT / 'frontend' / 'reader' / 'reader.js').read_text(encoding='utf-8')

    assert '_syncOptRow' in js, '高亮同步的辅助函数不见了'
    # loadPrefs 里，纸纹/字体/行距都要调 _syncOptRow——之前这三处只设了 CSS 变量、没同步按钮高亮
    m = re.search(r'async function loadPrefs\(\)\{.*?\n\}', js, re.S)
    assert m, '找不到 loadPrefs 函数体'
    body = m.group(0)
    assert body.count('_syncOptRow') == 3, f'loadPrefs 里应该调 3 次 _syncOptRow，实际 {body.count("_syncOptRow")}'
    for row_id in ('lineheight-row', 'font-row', 'texture-row'):
        assert row_id in body, f'loadPrefs 没有同步 {row_id}'

    # HTML 里三组按钮都要有 id="xxx-row" 容器 + 每个按钮有 data-v，值要和 JS 里传的字面量一致
    for row_id, expect_vals in (
        ('lineheight-row', ['1.6', '2', '2.4']),
        ('font-row', ['serif', 'kai', 'hei', 'fangsong']),
        ('texture-row', ['none', 'paper', 'linen', 'twill', 'canvas', 'grain', 'dots']),
    ):
        row_m = re.search(r'<div class="opt-row" id="' + row_id + r'">(.*?)</div>', html, re.S)
        assert row_m, f'HTML 里找不到 id="{row_id}" 的容器'
        vals = re.findall(r'data-v="([^"]+)"', row_m.group(1))
        assert vals == expect_vals, f'{row_id} 的 data-v 顺序/取值不对：{vals} != {expect_vals}'


def test_init_library_runs_migration():
    # v4.6.1 严重漏洞：main.py 的真实启动路径(init_library)从来没调用过 migrate_db.migrate()——
    # 只有 scripts/launcher.py 这条辅助路径调了。结果是任何库（哪怕全新建的）都没有 quill_sessions
    # 这类表，聊天必炸 "no such table"。这里钉死 init_library 源码里确实接了这一步。
    src = (ROOT / 'mylib' / 'server' / '_state.py').read_text(encoding='utf-8')
    m = re.search(r'def init_library\(root_str: str\):.*?(?=\ndef \w|\Z)', src, re.S)
    assert m, '找不到 init_library 函数体'
    body = m.group(0)
    assert 'from migrate_db import migrate' in body, 'init_library 没有导入 migrate'
    assert re.search(r'migrate\(root\s*/\s*[\'"]library\.db[\'"]\)', body), 'init_library 没有调用 migrate(root / "library.db")'


def test_quill_mem_tables_self_heal():
    # 双保险：就算某个路径依然没跑迁移，聊天相关的三张表也该在开连接时自己建好
    # （_todo_conn / _habit_conn 一直是这么做的，_mem_conn 之前没有，这轮补上）。
    js = (ROOT / 'mylib' / 'agents' / 'quill_agent.py').read_text(encoding='utf-8')
    m = re.search(r'def _mem_conn\(db_path\):.*?\n    return c\n', js, re.S)
    assert m, '找不到 _mem_conn 函数体'
    body = m.group(0)
    for t in ('quill_sessions', 'quill_messages', 'quill_memory'):
        assert f'CREATE TABLE IF NOT EXISTS {t}' in body, f'_mem_conn 没有自愈建 {t}'


def test_migrate_commits_incrementally():
    # v4.6.1：之前整个 migrate() 只在最后 commit 一次，任何一段中途异常都会连累前面已经建好的表
    # （包括 quill_sessions）。现在关键表创建完要立刻单独 commit。
    src = (ROOT / 'mylib' / 'core' / 'migrate_db.py').read_text(encoding='utf-8')
    m = re.search(r'def migrate\(db_path: Path\):.*', src, re.S)
    body = m.group(0)
    # quill_memory 表创建语句之后、下一段("── 5. 初始化 take_to_tablet")之前必须有一次 commit
    i_mem = body.index("CREATE TABLE IF NOT EXISTS quill_memory")
    i_sec5 = body.index("初始化 take_to_tablet")
    assert 'conn.commit()' in body[i_mem:i_sec5], 'quill_memory 建完后没有立刻 commit'
    # 第 5 段（mrpro_favorite，触碰的是老库可能没有的字段）必须包在 try 里，不能直接抛出去
    i_sec6 = body.index('性能索引')
    sec5_body = body[i_sec5:i_sec6]
    assert 'try:' in sec5_body and 'except' in sec5_body, '第 5 段没有兜底，出错会拖累后面所有段'


def test_save_pref_no_longer_swallows_errors_silently():
    js = (ROOT / 'frontend' / 'reader' / 'reader.js').read_text(encoding='utf-8')
    m = re.search(r'async function savePref\(k,v\)\{.*?\n\}', js, re.S)
    assert m, '找不到 savePref 函数体'
    body = m.group(0)
    assert 'catch(e){}' not in body, 'savePref 又在静默吞错误了——存失败时用户和开发者都看不出来'
    assert 'console.warn' in body, 'savePref 保存失败时应该至少打个 console.warn，方便排查'


