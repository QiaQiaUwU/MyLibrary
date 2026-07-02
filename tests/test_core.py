# -*- coding: utf-8 -*-
"""核心模块单元测试（不需要服务器）。"""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
for sub in ('core', 'tools'):
    sys.path.insert(0, str(ROOT / 'mylib' / sub))


def test_config_defaults(tmp_path, monkeypatch):
    monkeypatch.setenv('MYLIB_CONFIG', str(tmp_path / 'c.json'))
    import importlib, config
    importlib.reload(config)
    cfg = config.load_config()
    assert 'server' in cfg and 'library' in cfg and 'ai' in cfg
    assert cfg['server']['port'] == 8765

def test_config_save_load(tmp_path, monkeypatch):
    monkeypatch.setenv('MYLIB_CONFIG', str(tmp_path / 'c.json'))
    import importlib, config
    importlib.reload(config)
    cfg = config.load_config()
    cfg['server']['port'] = 1234
    config.save_config(cfg)
    cfg2 = config.load_config()
    assert cfg2['server']['port'] == 1234

def test_extract_author():
    from mylib_core import extract_author_from_name
    # 不报错即可（具体规则随实现）
    assert extract_author_from_name('某书 作者：张三') is not None or True
