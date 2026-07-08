# -*- coding: utf-8 -*-
"""v4.1/v4.2 · Quill 功能测试：习惯打卡全链路、热力图聚合、节气接口、连读、
表情批量导入（失败路径，离线可跑）、以及 home.js 模块拼接下发。"""


def test_habits_full_cycle(app_client):
    # 建（goal=1 → 一次打卡即达标授牌）
    r = app_client.post('/api/quill/habits', json={'name': '早起测试', 'remind_time': '07:30', 'goal': 1})
    assert r.status_code == 200 and r.json().get('ok')
    hid = next(h['id'] for h in app_client.get('/api/quill/habits').json()['habits'] if h['name'] == '早起测试')

    # 打卡 → reached_goal（首次触发奖牌）
    r = app_client.post(f'/api/quill/habits/{hid}/checkin').json()
    assert r['ok'] and r['reached_goal'] and r['streak'] == 1 and r['today']

    # 同日再打 → 幂等，不再重复报达标
    r2 = app_client.post(f'/api/quill/habits/{hid}/checkin').json()
    assert r2['ok'] and not r2['reached_goal'] and r2['total'] == 1

    # 列表里挂着奖牌
    h = next(x for x in app_client.get('/api/quill/habits').json()['habits'] if x['id'] == hid)
    assert h['medal'] and h['last14'][-1] == 1

    # 热力图：今天至少 1 次
    heat = app_client.get('/api/quill/habits/heat').json()
    assert heat['habits'] >= 1 and any(v >= 1 for v in heat['days'].values())

    # 调高目标 → 奖牌收回
    app_client.post(f'/api/quill/habits/{hid}', json={'goal': 21})
    h = next(x for x in app_client.get('/api/quill/habits').json()['habits'] if x['id'] == hid)
    assert h['goal'] == 21 and not h['medal']

    # 删除 → 消失
    app_client.delete(f'/api/quill/habits/{hid}')
    assert all(x['id'] != hid for x in app_client.get('/api/quill/habits').json()['habits'])


def test_season_fields(app_client):
    s = app_client.get('/api/quill/season').json()
    assert s.get('term') and s.get('motif')
    assert 'date' in s and 'is_term_day' in s   # v4.2：节气卡需要


def test_journey_streak_shape(app_client):
    s = app_client.get('/api/journey/streak').json()
    assert 'streak' in s and 'today' in s and isinstance(s['streak'], int)


def test_sticker_import_fail_path(app_client):
    # 打不通的地址 → 计入 fail，不抛 500、不中断
    r = app_client.post('/api/quill/sticker-import',
                        json={'items': [{'name': '坏链', 'url': 'http://127.0.0.1:9/x.png'}]}).json()
    assert r['ok_count'] == 0 and r['fail_count'] == 1 and r['fails']


def test_home_js_module_concat(app_client):
    """v4.2 工程重构：/static/home.js 由 frontend/home/js/ 多模块拼接下发。"""
    r = app_client.get('/static/home.js')
    assert r.status_code == 200
    js = r.text
    assert '按文件名顺序拼接' in js               # loader 加的 banner
    for mark in ('renderShelf', 'quillBlind', 'qhabitLoad', 'showTermCard', 'QTERM_ART'):
        assert mark in js, mark


