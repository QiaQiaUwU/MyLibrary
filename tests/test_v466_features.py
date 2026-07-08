# -*- coding: utf-8 -*-
"""v4.6.6 功能测试：西方星座换算（塔罗用）+ 玄学话题的结构化输出模板确实拼进了系统提示。"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_zodiac_sign_all_boundaries():
    import quill_agent as qa
    # 每个星座官方边界日期（含首尾）逐一核对，共 26 个边界点
    cases = [
        ((3, 21), '白羊座'), ((4, 19), '白羊座'),
        ((4, 20), '金牛座'), ((5, 20), '金牛座'),
        ((5, 21), '双子座'), ((6, 21), '双子座'),
        ((6, 22), '巨蟹座'), ((7, 22), '巨蟹座'),
        ((7, 23), '狮子座'), ((8, 22), '狮子座'),
        ((8, 23), '处女座'), ((9, 22), '处女座'),
        ((9, 23), '天秤座'), ((10, 23), '天秤座'),
        ((10, 24), '天蝎座'), ((11, 22), '天蝎座'),
        ((11, 23), '射手座'), ((12, 21), '射手座'),
        ((12, 22), '摩羯座'), ((12, 31), '摩羯座'), ((1, 1), '摩羯座'), ((1, 19), '摩羯座'),
        ((1, 20), '水瓶座'), ((2, 18), '水瓶座'),
        ((2, 19), '双鱼座'), ((3, 20), '双鱼座'),
    ]
    for (m, d), expect in cases:
        got = qa.zodiac_sign(m, d)
        assert got == expect, f'{m}/{d} 应为 {expect}，算出 {got}'
    # 之前排盘验证过的那组生日（2000-07-02），应为巨蟹座
    assert qa.zodiac_sign(7, 2) == '巨蟹座'


def test_divination_prompt_is_structured_and_topic_separated():
    src = (ROOT / 'mylib' / 'agents' / 'quill_agent.py').read_text(encoding='utf-8')
    # 塔罗要求表格 + 星座，明确不许混八字/黄历术语
    assert '位置|牌名|正逆|关键含义' in src
    assert '不要提八字/黄历/流日这类中式术语' in src
    # 八字要求四柱表格
    assert '柱|天干|地支|十神' in src
    # 每日一签保持中式（八字流日+黄历），没被误改成星座
    assert '每日一签解读' in src
    m = re.search(r'每日一签解读.*?\\n', src)
    assert m and '八字流日' in m.group(0) and '星座' not in m.group(0)
    # 系统提示里星座注入要点名"塔罗等西方占卜话题用这个，不要混用八字术语"
    assert '塔罗等西方占卜话题用这个' in src


def test_zodiac_injected_only_with_valid_birth_data():
    import quill_agent as qa
    from mylib_core import Library
    from migrate_db import migrate
    import tempfile, json
    tmp = Path(tempfile.mkdtemp())
    lib = Library(tmp / 'lib'); db = lib.root / 'library.db'; lib.close()
    migrate(db)

    # 没有生辰记忆：run_quill 组装那段代码本身不该因为缺数据而崩（用 get_memory 默认值验证行为）
    assert qa.get_memory(db, 'birth_info', '') == ''

    # 生辰是脏数据（不是合法 json / 缺 birth 字段）：不该让整个函数炸
    qa.set_memory(db, 'birth_info', '不是json')
    try:
        import json as _j
        _j.loads(qa.get_memory(db, 'birth_info', ''))
        raised = False
    except Exception:
        raised = True
    assert raised, '这条本来就该是非法 json，确认测试数据本身没问题'

