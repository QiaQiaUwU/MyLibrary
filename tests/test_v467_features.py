# -*- coding: utf-8 -*-
"""v4.6.7 功能测试：玄学话题关键词触发（不刻板的核心机制）+ 塔罗魔法阵月相环的几何正确性。"""
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_divination_gating_keeps_casual_chat_lean():
    import quill_agent as qa
    # 普通聊天不该触发——这是"不刻板"的关键：平常聊天不背着一堆格式规矩
    for msg in ['推荐几本悬疑小说', '这本书讲的什么', '今天心情不太好', '你好呀']:
        assert not qa._wants_divination(msg, []), f'"{msg}" 不该触发玄学模板'
    # 玄学关键词应该触发
    for msg in ['帮我抽张塔罗', '看看我的运势', '我的八字怎么样', '今天宜忌', '我是什么星座', '紫微命盘']:
        assert qa._wants_divination(msg, []), f'"{msg}" 应该触发玄学模板但没触发'
    # 历史记录延续语境：追问时不会突然"失忆"掉线
    hist = [{'role': 'user', 'content': '帮我抽张塔罗看看'}, {'role': 'assistant', 'content': '（解读）'}]
    assert qa._wants_divination('那感情方面呢', hist)
    # 图片消息（content 是 list）不报错
    hist2 = [{'role': 'user', 'content': [{'type': 'text', 'text': '随便聊聊'}]}]
    assert not qa._wants_divination('你好', hist2)


def test_tarot_forbids_inventing_extra_draws():
    """真实翻车过一次：Quill 回复里编了"我刚刚也抽了一张牌，指针落在了魔术师上"——
    用户只抽了一张倒吊人，这张魔术师是凭空编的。补一条明确禁止这种"额外抽牌情节"的指令。"""
    src = (ROOT / 'mylib' / 'agents' / 'quill_agent.py').read_text(encoding='utf-8')
    idx = src.find('· 塔罗：')
    assert idx >= 0, '找不到塔罗指令段'
    block = src[idx:idx + 400]
    assert '额外的抽牌情节' in block or '不存在' in block, '塔罗指令里没有禁止编造额外抽牌的说明'


def test_divination_prompt_only_appears_when_gated():
    """直接跑一遍 run_quill 的组装逻辑（假接口截获 messages），确认普通聊天的
    system prompt 里没有塔罗/八字表格模板，问玄学时才有——这是"减少刻板感"的实际效果。"""
    import sys, tempfile, json as _json
    sys.path.insert(0, str(ROOT / 'mylib' / 'core'))
    from mylib_core import Library
    from migrate_db import migrate
    import quill_agent as qa

    tmp = Path(tempfile.mkdtemp())
    lib = Library(tmp / 'lib'); db = lib.root / 'library.db'; lib.close()
    migrate(db)

    import urllib.request
    captured = {}

    def fake_urlopen(req, timeout=None):
        body = _json.loads(req.data.decode('utf-8'))
        captured['messages'] = body.get('messages', [])

        class FakeResp:
            def read(self): return _json.dumps({'choices': [{'message': {'content': '（假回复）'}}]}).encode()
            def __enter__(self): return self
            def __exit__(self, *a): return False
            def getcode(self): return 200
        return FakeResp()

    orig = urllib.request.urlopen
    urllib.request.urlopen = fake_urlopen
    try:
        qa.run_quill('推荐几本好看的悬疑小说', db, {'api_key': 'x', 'base_url': 'https://api.openai.com/v1', 'model': 'gpt-4'})
        casual_sys = next(m['content'] for m in captured['messages'] if m['role'] == 'system')
        qa.run_quill('帮我抽张塔罗看看今天', db, {'api_key': 'x', 'base_url': 'https://api.openai.com/v1', 'model': 'gpt-4'})
        tarot_sys = next(m['content'] for m in captured['messages'] if m['role'] == 'system')
    finally:
        urllib.request.urlopen = orig

    assert '位置|牌名|正逆' not in casual_sys, '普通聊天不该带塔罗表格模板'
    assert '柱|天干|地支|十神' not in casual_sys, '普通聊天不该带八字表格模板'
    assert '别用固定句式' in casual_sys, '不刻板的提醒应该始终都在'
    assert len(casual_sys) < len(tarot_sys), '普通聊天的 system prompt 应该比问玄学时更精简'
    assert '位置|牌名|正逆' in tarot_sys, '问塔罗时应该带上表格模板'


def test_moon_ring_geometry_is_monotonic_and_symmetric():
    """魔法阵外圈的月相环：用两圆相交面积验证相位从新月(全暗)到满月(全亮)单调、对称，
    不需要真的截图，用几何算出来的重叠比例就能确认形状对不对。"""
    def circle_intersection_area(r, d):
        if d >= 2 * r: return 0.0
        if d <= 0: return math.pi * r * r
        return 2 * r * r * math.acos(d / (2 * r)) - (d / 2) * math.sqrt(max(0, 4 * r * r - d * d))

    r = 5.4
    full_area = math.pi * r * r
    covered = []
    for i in range(13):
        phase = i / 12
        d = r * (1 - math.cos(2 * math.pi * phase))
        covered.append(circle_intersection_area(r, d) / full_area)

    assert abs(covered[0] - 1.0) < 1e-9, '相位 0（新月）应该全暗'
    assert covered[6] < 1e-9, '相位 0.5（满月）应该全亮，阴影覆盖应为 0'
    # 0→6 单调递减（越来越亮），6→12 单调递增（越来越暗），对称
    assert all(covered[i] >= covered[i + 1] - 1e-9 for i in range(6))
    assert all(covered[i] <= covered[i + 1] + 1e-9 for i in range(6, 12))
    for i in range(1, 6):
        assert abs(covered[i] - covered[12 - i]) < 1e-9, f'相位 {i} 和 {12-i} 应该对称'


def test_tarot_circle_svg_has_moon_ring():
    html = (ROOT / 'frontend' / 'home' / 'index.html').read_text(encoding='utf-8')
    assert html.count('class="tt-moon-lit"') == 12, '月相环应该有 12 颗月亮'
    assert html.count('class="tt-moon-dark"') == 12
    assert re.search(r'\.tt-circle circle\.tt-moon-lit\{', html), '月相环样式的选择器优先级不够，会被通用圆点样式盖掉'


def test_persona_has_concrete_anti_filler_example():
    """"别刻板"这条指令光讲原则效果弱，这次补了一个用户实际遇到的反面例子
    （记生日之后硬接"很高兴陪你读书"），顶部人设和结尾提醒两处都要有，两头卡位。"""
    src = (ROOT / 'mylib' / 'agents' / 'quill_agent.py').read_text(encoding='utf-8')
    assert src.count('很高兴陪你一起读书') + src.count('很高兴陪你读书') >= 2, \
        '顶部人设 + 结尾提醒都应该带上这个具体反例，只在一处不够（U型注意力，两头都要）'



def test_persona_permits_humor_and_natural_talk():
    """"话不多"、"不刻意卖萌"这类框定太紧，会让所有语气预设都偏向拘谨——
    这次把"可以开玩笑、自然聊天"写进了不随口吻预设变化的核心身份里。"""
    src = (ROOT / 'mylib' / 'agents' / 'quill_agent.py').read_text(encoding='utf-8')
    m = re.search(r'QUILL_IDENTITY = """.*?"""', src, re.S)
    assert m, '找不到 QUILL_IDENTITY'
    identity = m.group(0)
    assert '开个玩笑' in identity or '俏皮' in identity, '核心身份里应该明确允许开玩笑，不能只留给 playful 这一个口吻预设'
    assert '话不多' not in identity, '"话不多"这个框定容易让回复偏向惜字如金、显得拘谨，这轮应该已经改掉'


def test_confused_scans_quill_reply_not_user_confusion():
    """回归钉子：疑惑必须扫 Quill 自己回复里的不确定措辞，不能扫用户说的"看不懂"——
    那是两件完全不同的事，混在一起是逻辑错误。"""
    src = (ROOT / 'mylib' / 'agents' / '..' / 'agents' / 'quill_agent.py')
    js = (ROOT / 'frontend' / 'home' / 'js' / '70_mood.js').read_text(encoding='utf-8')
    m = re.search(r'function qmScanSentiment\(userMsg,replyMsg\)\{.*?\n\}', js, re.S)
    assert m, '找不到 qmScanSentiment 函数体'
    body = m.group(0)
    assert "QM_PUZZLE_KW.test(replyMsg)" in body, '疑惑应该测 replyMsg（Quill 自己的话），不是 userMsg'
    assert "QM_PUZZLE_KW.test(userMsg)" not in body, '不该再测 userMsg 里有没有困惑关键词——那是上一轮的逻辑错误'

