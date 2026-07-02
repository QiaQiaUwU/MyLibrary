# -*- coding: utf-8 -*-
"""学习助手：从选定的一段正文里抽取结构化「知识点」。
每个知识点带一句 verbatim 引文(quote)作为在原文里的定位锚，前端据此做「跳转」。
复用 mylib_agent 的 _call_deepseek 调 AI，只做结构化 JSON 输出、不走聊天/工具循环。
"""
import json
import re


# 不同模型上下文窗口不同（token），据此估算「单次可读的正文字数上限」。
# 保留约一半窗口给系统提示 + 输出 + 安全余量；中文约 1 token/字，故字数 ≈ 窗口token × 0.5。
_MODEL_CTX_TOKENS = {
    'deepseek-chat': 65536, 'deepseek-reasoner': 65536, 'deepseek-coder': 65536,
    'gpt-4o': 128000, 'gpt-4o-mini': 128000, 'gpt-4-turbo': 128000, 'gpt-4.1': 1000000,
    'gpt-4': 8192, 'gpt-3.5-turbo': 16385,
    'moonshot-v1-8k': 8000, 'moonshot-v1-32k': 32000, 'moonshot-v1-128k': 128000,
    'qwen-turbo': 128000, 'qwen-plus': 128000, 'qwen-max': 32000,
    'glm-4': 128000, 'glm-4-flash': 128000,
}

def context_char_cap(ai_config: dict) -> int:
    """按配置的模型返回单次可读正文字数上限；未知模型给一个保守默认。"""
    model = str((ai_config or {}).get('model', '') or '').lower().strip()
    tokens = None
    if model in _MODEL_CTX_TOKENS:
        tokens = _MODEL_CTX_TOKENS[model]
    else:
        # 模型名里带 128k / 32k / 8k 之类的，尽量识别
        m = re.search(r'(\d+)\s*k', model)
        if m:
            tokens = int(m.group(1)) * 1000
    if not tokens:
        tokens = 32000  # 未知：保守按 32k 窗口
    cap = int(tokens * 0.5)          # 一半留给提示+输出+余量
    return max(4000, min(cap, 60000))  # 兜底区间，避免过小/过大


_SYS = """你是阅读学习助手。请从下面这段文字中梳理出关键「知识点/要点」，帮助读者理解与记忆。

要求：
1. 提炼 3–8 个知识点，覆盖主要概念、论点、人物/术语、因果或逻辑关系；按在原文里出现的先后排列。
2. 每个知识点给三个字段：
   - title：简短标题（不超过 20 字）
   - detail：1–2 句话的说明，讲清这个点是什么 / 为什么重要
   - quote：从【原文】里一字不差摘取的一小段连续文字（6–20 字），作为该知识点在原文中的定位锚。
     * quote 必须是原文中真实存在、可直接搜索到的连续片段，不能改写、不能拼接、不能加省略号。
3. 只输出 JSON，不要任何解释、前言或 markdown 代码块。格式严格如下：
{"points":[{"title":"...","detail":"...","quote":"..."}]}
"""


def _extract_json(text: str):
    """从模型输出里稳妥地取出 JSON 对象。"""
    if not text:
        return None
    t = text.strip()
    # 去掉 ```json ... ``` 包裹
    t = re.sub(r'^```(?:json)?\s*', '', t)
    t = re.sub(r'\s*```$', '', t).strip()
    try:
        return json.loads(t)
    except Exception:
        pass
    m = re.search(r'\{.*\}', t, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return None
    return None


_SYS_STRUCT = """你是阅读学习助手。请分析下面这段文字的【知识架构 / 逻辑框架】，帮助读者把握它的整体结构、脉络和层次关系。

要求：
1. 输出 3–8 个条目，按框架的层次/顺序排列；每条代表框架里的一个环节（如：背景 → 问题 → 论点 → 论据 → 结论；或 人物 → 关系 → 冲突 → 转折）。
2. 每个条目给三个字段：
   - title：这一环节的名称（可用"1. …""2.1 …"这类层级编号体现结构）
   - detail：1–2 句话说明这一环节讲了什么、与前后如何衔接
   - quote：从【原文】里一字不差摘取的一小段连续文字（6–20 字）作为定位锚，必须真实存在、可直接搜索。
3. 只输出 JSON，不要任何解释或 markdown 代码块。格式严格如下：
{"points":[{"title":"...","detail":"...","quote":"..."}]}
"""


def make_outline(passage: str, ai_config: dict, mode: str = 'points') -> dict:
    """输入一段正文，返回 {"points":[{title,detail,quote}, ...]} 或 {"error":...}。
    mode='points' 抽知识点；mode='structure' 分析知识架构（同样的输出结构，换一套提示词）。"""
    from mylib_agent import _call_deepseek
    passage = (passage or '')[:context_char_cap(ai_config)]  # 上限按模型自适应
    messages = [
        {"role": "system", "content": _SYS_STRUCT if mode == 'structure' else _SYS},
        {"role": "user", "content": passage},
    ]
    resp = _call_deepseek(messages, None, ai_config)
    if isinstance(resp, dict) and resp.get("error"):
        return {"error": resp["error"]}
    try:
        content = resp["choices"][0]["message"]["content"]
    except Exception:
        return {"error": "AI 返回格式异常"}
    data = _extract_json(content)
    if not data or not isinstance(data, dict) or "points" not in data:
        return {"error": "知识点解析失败，可再试一次"}
    # 清洗
    pts = []
    for p in (data.get("points") or []):
        if not isinstance(p, dict):
            continue
        pts.append({
            "title": str(p.get("title", "")).strip()[:60],
            "detail": str(p.get("detail", "")).strip()[:300],
            "quote": str(p.get("quote", "")).strip()[:80],
        })
    return {"points": pts}


_SYS_QUIZ = """你是阅读学习助手。请根据下面这段文字，出若干道【单项选择题】来考查读者对内容的理解与记忆。

要求：
1. 出 {n} 道题（题目数量以传入为准），紧扣这段文字的内容，不要考文字里没有的信息。
2. 每题给：
   - question：题干
   - options：4 个选项（字符串数组，不要带 A/B/C/D 前缀）
   - answer：正确选项的下标（0–3 的整数）
   - explanation：简短解析，说明为什么这个答案对
   - quote：从【原文】里一字不差摘取的一小段连续文字（6–20 字），作为该题考点在原文中的定位锚，必须真实存在、可直接搜索。
3. 只输出 JSON，不要任何解释或 markdown 代码块。格式严格如下：
{"questions":[{"question":"...","options":["...","...","...","..."],"answer":0,"explanation":"...","quote":"..."}]}
"""


def make_quiz(passage: str, ai_config: dict, n: int = 4) -> dict:
    """输入一段正文，返回 {"questions":[{question,options,answer,explanation,quote}, ...]} 或 {"error":...}。"""
    from mylib_agent import _call_deepseek
    passage = (passage or '')[:context_char_cap(ai_config)]  # 上限按模型自适应
    n = max(1, min(10, int(n or 4)))
    messages = [
        {"role": "system", "content": _SYS_QUIZ.replace('{n}', str(n))},
        {"role": "user", "content": passage},
    ]
    resp = _call_deepseek(messages, None, ai_config)
    if isinstance(resp, dict) and resp.get("error"):
        return {"error": resp["error"]}
    try:
        content = resp["choices"][0]["message"]["content"]
    except Exception:
        return {"error": "AI 返回格式异常"}
    data = _extract_json(content)
    if not data or not isinstance(data, dict) or "questions" not in data:
        return {"error": "出题解析失败，可再试一次"}
    out = []
    for q in (data.get("questions") or []):
        if not isinstance(q, dict):
            continue
        opts = q.get("options") or []
        if not isinstance(opts, list) or len(opts) < 2:
            continue
        opts = [str(o).strip()[:200] for o in opts][:6]
        try:
            ans = int(q.get("answer", 0))
        except Exception:
            ans = 0
        ans = max(0, min(len(opts) - 1, ans))
        out.append({
            "question": str(q.get("question", "")).strip()[:300],
            "options": opts,
            "answer": ans,
            "explanation": str(q.get("explanation", "")).strip()[:300],
            "quote": str(q.get("quote", "")).strip()[:80],
        })
    return {"questions": out}
