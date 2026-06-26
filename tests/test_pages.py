# -*- coding: utf-8 -*-
"""页面与核心 API smoke 测试。"""

def test_home_page(app_client):
    r = app_client.get('/')
    assert r.status_code == 200
    assert '书房' in r.text

def test_reader_page(app_client):
    r = app_client.get('/reader')
    assert r.status_code == 200
    assert 'StPageFlip' in r.text

def test_admin_page(app_client):
    r = app_client.get('/admin')
    assert r.status_code == 200
    assert '/ 管理' in r.text  # 已改名为"管理"

def test_settings_page(app_client):
    assert app_client.get('/settings').status_code == 200

def test_frontend_assets(app_client):
    assert 'treeSVG' in app_client.get('/static/home.js').text
    assert 'flipPage' in app_client.get('/static/reader.js').text

def test_pwa(app_client):
    assert app_client.get('/manifest.webmanifest').status_code == 200
    assert app_client.get('/sw.js').status_code == 200
    assert app_client.get('/static/app-icon.svg').status_code == 200
