# -*- coding: utf-8 -*-
"""配置读写（core.config）。
集中管理 config.json 的加载、默认值合并、保存。
服务端与各工具统一从这里取配置，避免散落。
"""
import os
import json
from pathlib import Path

CONFIG_PATH = Path(os.environ.get('MYLIB_CONFIG') or (Path(__file__).parent.parent.parent / 'config.json'))

DEFAULTS = {
    'server': {'host': '0.0.0.0', 'port': 8765, 'open_browser': True},
    'library': {'root': '', 'inbox': '', 'export_dir': '', 'mrpro_path': ''},
    'ai': {'provider': 'deepseek', 'api_key': '', 'base_url': 'https://api.deepseek.com/v1',
           'model': 'deepseek-chat', 'embedding_model': ''},
    # 连接配置（参考 SillyTavern 的「连接配置档」）：可保存多套接口，一键切换
    'ai_profiles': [],
}


def load_config() -> dict:
    """读取 config.json，与默认值合并（缺的键补上）。"""
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
            for sec, defs in DEFAULTS.items():
                cfg.setdefault(sec, defs)
                if isinstance(defs, dict):
                    for k, v in defs.items():
                        cfg[sec].setdefault(k, v)
            return cfg
        except Exception:
            pass
    # 返回默认值的深拷贝
    return json.loads(json.dumps(DEFAULTS))


def save_config(cfg: dict):
    with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=4)


def static_dir() -> Path:
    """静态资源目录（白噪音/翻页音/主题素材）。"""
    env = os.environ.get('MYLIB_STATIC')
    if env:
        return Path(env)
    # 回退：项目根/static
    cand = Path(__file__).parent.parent.parent / 'static'
    return cand if cand.exists() else Path(__file__).parent

