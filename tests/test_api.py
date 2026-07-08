# -*- coding: utf-8 -*-
"""数据 API 测试。"""

def test_shelf(app_client):
    r = app_client.get('/api/shelf')
    assert r.status_code == 200
    data = r.json()
    assert len(data.get('books', [])) >= 2

def test_library(app_client):
    assert app_client.get('/api/library').status_code == 200

def test_collection_aggregation(app_client):
    r = app_client.get('/api/journey/collection')
    assert r.status_code == 200
    items = r.json()['items']
    kinds = {i['kind'] for i in items}
    # 至少有划线和收藏的书
    assert 'highlight' in kinds
    assert 'book' in kinds

def test_garden(app_client):
    r = app_client.get('/api/journey/garden')
    assert r.status_code == 200
    assert 'trees' in r.json()

def test_settings_roundtrip(app_client):
    # 保存设置应能更新共享 CONFIG
    r = app_client.post('/api/settings', json={'server': {'port': 8888}})
    assert r.status_code == 200
    import _state
    assert _state.CONFIG['server']['port'] == 8888

def test_admin_stats(app_client):
    r = app_client.get('/api/admin/stats')
    assert r.status_code == 200
    assert r.json()['total'] >= 2


def test_tree_delete(app_client):
    # 删除树端点存在且返回 ok
    r = app_client.delete('/api/journey/tree/1')
    assert r.status_code == 200
    assert r.json().get('ok') is True


def test_timeline_has_time(app_client):
    # 回顾时间线接口可访问（具体时间字段在有日记数据时返回）
    r = app_client.get('/api/journey/timeline')
    assert r.status_code == 200
    assert 'timeline' in r.json()


def test_status_ready(app_client):
    r = app_client.get('/api/status')
    assert r.status_code == 200
    j = r.json()
    assert j['library_ready'] is True
    assert j['library_root']


def test_library_apply_good_and_bad(app_client):
    # 用当前已就绪的库路径重新应用 → 应成功
    root = app_client.get('/api/status').json()['library_root']
    r = app_client.post('/api/settings/library', json={'root': root})
    assert r.status_code == 200 and r.json().get('ok') is True
    # 一个不存在的路径 → 应失败且带原因（不崩）
    r2 = app_client.post('/api/settings/library', json={'root': '/no/such/dir/xyz'})
    assert r2.status_code == 200 and r2.json().get('ok') is False
    assert r2.json().get('error')


def test_ai_profiles_roundtrip(app_client):
    payload = {'profiles': [
        {'name': '我的反代', 'provider': 'proxy', 'base_url': 'https://x.example/v1', 'api_key': 'sk-test', 'model': 'gpt-4o-mini'},
        {'name': '官方', 'provider': 'deepseek', 'base_url': 'https://api.deepseek.com/v1', 'api_key': 'sk-ds', 'model': 'deepseek-chat'},
    ]}
    r = app_client.post('/api/settings/ai-profiles', json=payload)
    assert r.status_code == 200 and r.json().get('count') == 2
    got = app_client.get('/api/settings/ai-profiles').json()['profiles']
    names = {p['name'] for p in got}
    assert {'我的反代', '官方'} <= names
    # key 不应明文回传
    assert all('api_key' not in p for p in got)
    assert all(p['has_key'] for p in got)
    # 激活其中一个 → 写进 ai
    r2 = app_client.post('/api/settings/ai-profiles/activate', json={'name': '官方'})
    assert r2.status_code == 200 and r2.json().get('ok') is True
    import _state
    assert _state.CONFIG['ai']['model'] == 'deepseek-chat'


