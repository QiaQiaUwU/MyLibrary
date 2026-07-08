# -*- coding: utf-8 -*-
"""v4.6.14 功能测试：工具调用消息清洗（防第三方供应商额外字段搞崩轮次顺序）、
调用失败时的完整堆栈日志、书脊色卡保存不再静默失败。"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_tool_call_history_is_sanitized():
    import sys, tempfile, json
    sys.path.insert(0, str(ROOT / 'mylib' / 'core'))
    from mylib_core import Library
    from migrate_db import migrate
    import quill_agent as qa

    tmp = Path(tempfile.mkdtemp())
    lib = Library(tmp / 'lib'); db = lib.root / 'library.db'; lib.close()
    migrate(db)

    import urllib.request
    call_log = []

    class FakeResp:
        def __init__(self, body): self._body = body
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def getcode(self): return 200
        def read(self): return self._body

    def fake_urlopen(req, timeout=None):
        body = json.loads(req.data.decode('utf-8'))
        call_log.append(body['messages'])
        if len(call_log) == 1:
            payload = {'choices': [{'message': {
                'role': 'assistant', 'content': None,
                'tool_calls': [{'id': 'call_abc', 'type': 'function',
                                'function': {'name': 'draw_tarot', 'arguments': '{"count":1}'}}],
                # 模拟第三方供应商（比如报错截图里那个 Gemini 中转）在响应里塞的私有字段
                'refusal': None, 'annotations': [], 'provider_specific_id': 'xyz999',
            }}]}
        else:
            payload = {'choices': [{'message': {'role': 'assistant', 'content': '（最终解读）'}}]}
        return FakeResp(json.dumps(payload).encode())

    orig = urllib.request.urlopen
    urllib.request.urlopen = fake_urlopen
    try:
        r = qa.run_quill('抽张塔罗看看今天', db, {'api_key': 'x', 'base_url': 'https://api.openai.com/v1', 'model': 'gpt-4'})
    finally:
        urllib.request.urlopen = orig

    assert r['reply'] == '（最终解读）'
    assert len(call_log) == 2, '应该走两轮：先要工具，再给最终回复'

    second_round = call_log[1]
    tc_msg = next(m for m in second_round if m.get('role') == 'assistant' and m.get('tool_calls'))
    extra = set(tc_msg.keys()) - {'role', 'content', 'tool_calls'}
    assert not extra, f'供应商私有字段没清干净，多了: {extra}'

    idx = second_round.index(tc_msg)
    assert second_round[idx + 1]['role'] == 'tool' and second_round[idx + 1]['tool_call_id'] == 'call_abc', \
        'function 响应必须紧跟在 function call 后面（这就是报错里 Gemini 那条硬性要求）'

    first_round = call_log[0]
    for m in first_round:
        if m['role'] != 'system':
            extra2 = set(m.keys()) - {'role', 'content'}
            assert not extra2, f'历史消息不该带 id/starred/created_at 这些数据库字段: {extra2}'


def test_chat_route_logs_full_traceback_on_crash():
    src = (ROOT / 'mylib' / 'server' / 'routes' / 'quill.py').read_text(encoding='utf-8')
    m = re.search(r'except Exception as _e:.*', src, re.S)
    assert m, '找不到 chat 接口的异常处理'
    block = m.group(0)[:300]
    assert 'traceback.print_exc()' in block, \
        '之前崩溃时只把异常类型+消息带回前端，服务端控制台没留痕迹，出问题根本没法定位到具体哪一行'


def test_save_book_palettes_no_longer_silent():
    js = (ROOT / 'frontend' / 'home' / 'js' / '10_shelf.js').read_text(encoding='utf-8')
    m = re.search(r'async function saveBookPalettes\(\)\{.*?\n\}', js, re.S)
    assert m, '找不到 saveBookPalettes 函数体（改成 async 了，找普通 function 声明会找不到）'
    body = m.group(0)
    assert '.catch(()=>{})' not in body, 'saveBookPalettes 还在静默吞保存失败——这是取色配色"应用不了、刷新也没用"的头号嫌疑'
    assert 'console.warn' in body, '保存失败至少要留个 console.warn，方便排查'

