#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mylib_agent.py — AI 阅读助手 Agent
====================================
基于 DeepSeek function calling 的阅读辅助 agent。
提供工具：搜索书内容、追踪角色、前情提要、保存/检索笔记、跳转定位。
"""

import json
import re
import time
import urllib.request
import urllib.error
from typing import Optional, List, Dict, Any, Generator

# ============================================================
# 工具定义 (DeepSeek function calling 格式)
# ============================================================
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_book_content",
            "description": "在当前书籍中搜索包含指定关键词的段落，返回匹配位置和上下文",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词或短语"},
                    "max_results": {"type": "integer", "description": "最多返回几条结果", "default": 3}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_summary_before",
            "description": "获取当前阅读位置之前的内容摘要（前情提要），帮助用户回忆之前的剧情",
            "parameters": {
                "type": "object",
                "properties": {
                    "scope": {"type": "string", "enum": ["recent", "full"],
                              "description": "recent=最近5000字的摘要, full=从头到当前位置的完整摘要",
                              "default": "recent"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "track_character",
            "description": "在已读内容中搜索某个角色名的所有出场，汇总其身份、关系和经历",
            "parameters": {
                "type": "object",
                "properties": {
                    "character_name": {"type": "string", "description": "角色名"}
                },
                "required": ["character_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "save_reading_note",
            "description": "把当前讨论内容或用户指定的内容保存为阅读笔记",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "笔记标题"},
                    "content": {"type": "string", "description": "笔记内容 (支持 markdown)"}
                },
                "required": ["title", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_reading_notes",
            "description": "列出当前书的所有阅读笔记",
            "parameters": {
                "type": "object",
                "properties": {
                    "filter_keyword": {"type": "string", "description": "按关键词过滤笔记（可选）"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "jump_to_position",
            "description": "让阅读器跳转到书中指定的字符位置",
            "parameters": {
                "type": "object",
                "properties": {
                    "position": {"type": "integer", "description": "目标字符偏移量"},
                    "label": {"type": "string", "description": "跳转说明（显示给用户）"}
                },
                "required": ["position"]
            }
        }
    }
]


# ============================================================
# 工具执行器
# ============================================================
class ToolExecutor:
    """执行 agent 工具调用，依赖外部传入的 book_text 和 db 连接"""

    def __init__(self, book_id: int, book_text: str, position: int, db_conn):
        self.book_id = book_id
        self.book_text = book_text
        self.position = position
        self.db = db_conn
        self._jump_result = None  # 跳转指令暂存

    def execute(self, tool_name: str, arguments: dict) -> str:
        """执行工具，返回结果字符串（喂给模型）"""
        method = getattr(self, f'_tool_{tool_name}', None)
        if not method:
            return json.dumps({"error": f"未知工具: {tool_name}"})
        try:
            result = method(**arguments)
            return json.dumps(result, ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": str(e)})

    @property
    def pending_jump(self):
        """获取待执行的跳转指令"""
        j = self._jump_result
        self._jump_result = None
        return j

    # ── 具体工具实现 ─────────────────────────────────────────────────────

    def _tool_search_book_content(self, query: str, max_results: int = 3) -> dict:
        """在书中搜索关键词"""
        text = self.book_text
        results = []
        # 简单关键词搜索（多个词用 AND 逻辑）
        keywords = [kw.strip() for kw in query.split() if kw.strip()]
        if not keywords:
            return {"results": [], "message": "请提供搜索关键词"}

        # 滑动窗口搜索
        window = 300
        step = 150
        for i in range(0, len(text) - window, step):
            chunk = text[i:i + window]
            chunk_lower = chunk.lower()
            if all(kw.lower() in chunk_lower for kw in keywords):
                # 扩展上下文
                start = max(0, i - 100)
                end = min(len(text), i + window + 100)
                context = text[start:end]
                # 计算百分比
                pct = i / max(len(text), 1) * 100
                results.append({
                    "position": i,
                    "percentage": round(pct, 1),
                    "context": context[:500],
                })
                if len(results) >= max_results:
                    break

        return {
            "query": query,
            "total_matches": len(results),
            "results": results,
        }

    def _tool_get_summary_before(self, scope: str = "recent") -> dict:
        """获取前情提要"""
        text_before = self.book_text[:self.position]
        if scope == "recent":
            # 最近 5000 字
            chunk = text_before[-5000:] if len(text_before) > 5000 else text_before
            return {
                "scope": "recent",
                "text_length": len(chunk),
                "content": chunk,
                "instruction": "请基于以上内容，用 3-5 段简洁地总结最近的剧情发展。"
            }
        else:
            # 全文摘要：取开头、中段、最近各 2000 字
            total = len(text_before)
            segments = []
            if total <= 6000:
                segments.append(text_before)
            else:
                segments.append(text_before[:2000])
                mid = total // 2
                segments.append(text_before[mid - 1000:mid + 1000])
                segments.append(text_before[-2000:])
            combined = '\n\n---\n\n'.join(segments)
            return {
                "scope": "full",
                "total_chars_before_position": total,
                "sampled_content": combined,
                "instruction": "请基于以上采样内容，从头到当前位置完整总结故事主线。"
            }

    def _tool_track_character(self, character_name: str) -> dict:
        """追踪角色出场"""
        text_before = self.book_text[:self.position]
        name = character_name.strip()
        # 找所有出场位置
        appearances = []
        start = 0
        while True:
            idx = text_before.find(name, start)
            if idx == -1:
                break
            # 提取上下文
            ctx_start = max(0, idx - 80)
            ctx_end = min(len(text_before), idx + len(name) + 80)
            appearances.append({
                "position": idx,
                "context": text_before[ctx_start:ctx_end],
            })
            start = idx + len(name)

        # 取前5次和后5次出场
        sampled = appearances[:5] + (appearances[-5:] if len(appearances) > 10 else appearances[5:])

        return {
            "character": name,
            "total_appearances": len(appearances),
            "first_appearance": appearances[0]["position"] if appearances else None,
            "sampled_contexts": sampled,
            "instruction": f"请根据以上 {name} 的出场上下文，总结这个角色的身份、性格特点和主要经历。"
        }

    def _tool_save_reading_note(self, title: str, content: str) -> dict:
        """保存阅读笔记"""
        self.db.execute(
            '''INSERT INTO reading_notes (book_id, position, title, content, source)
               VALUES (?, ?, ?, ?, 'ai_chat')''',
            (self.book_id, self.position, title, content))
        self.db.commit()
        note_id = self.db.execute('SELECT last_insert_rowid()').fetchone()[0]
        return {"saved": True, "note_id": note_id, "title": title}

    def _tool_list_reading_notes(self, filter_keyword: str = None) -> dict:
        """列出笔记"""
        if filter_keyword:
            rows = self.db.execute(
                '''SELECT id, position, title, content, source, created_at
                   FROM reading_notes WHERE book_id = ?
                   AND (title LIKE ? OR content LIKE ?)
                   ORDER BY position''',
                (self.book_id, f'%{filter_keyword}%', f'%{filter_keyword}%')
            ).fetchall()
        else:
            rows = self.db.execute(
                '''SELECT id, position, title, content, source, created_at
                   FROM reading_notes WHERE book_id = ? ORDER BY position''',
                (self.book_id,)
            ).fetchall()
        notes = [dict(r) for r in rows]
        return {"book_id": self.book_id, "total": len(notes), "notes": notes}

    def _tool_jump_to_position(self, position: int, label: str = "") -> dict:
        """跳转到指定位置（结果会推送到前端）"""
        self._jump_result = {"position": position, "label": label}
        pct = position / max(len(self.book_text), 1) * 100
        return {"jumped": True, "position": position, "percentage": round(pct, 1), "label": label}


# ============================================================
# DeepSeek API 调用
# ============================================================
def _call_deepseek(messages: list, tools: list, config: dict,
                   stream: bool = False) -> dict:
    """调用 DeepSeek Chat API (含 function calling)"""
    api_key = config.get('api_key', '')
    base_url = config.get('base_url', 'https://api.deepseek.com/v1').rstrip('/')
    model = config.get('model', 'deepseek-chat')

    if not api_key:
        return {"error": "API key 未配置，请在设置页面配置 DeepSeek API key"}

    payload = {
        "model": model,
        "messages": messages,
        "stream": False,  # 先用非流式，简化实现
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        f'{base_url}/chat/completions',
        data=data,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
        },
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode('utf-8'))
        return result
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='ignore')
        return {"error": f"API 错误 {e.code}: {body[:500]}"}
    except Exception as e:
        return {"error": f"请求失败: {str(e)}"}


# ============================================================
# Agent 主循环
# ============================================================
def run_agent(user_message: str, book_id: int, book_title: str,
              book_author: str, book_text: str, position: int,
              total_chars: int, db_conn, ai_config: dict,
              conversation_history: list = None) -> Dict[str, Any]:
    """
    执行一次 agent 对话。

    返回: {
        "reply": "模型的最终回复文本",
        "tool_calls": [{"name": ..., "result": ...}, ...],
        "jump": {"position": ..., "label": ...} or None,
        "error": "..." or None
    }
    """
    executor = ToolExecutor(book_id, book_text, position, db_conn)

    # 构建上下文：给 Quill 更宽的窗口，方便它讨论当前情节（前后文）
    ctx_start = max(0, position - 3000)
    ctx_end = min(len(book_text), position + 1500)
    context_text = book_text[ctx_start:ctx_end]
    pct = position / max(total_chars, 1) * 100

    system_prompt = f"""你是一个阅读助手，用户正在阅读《{book_title}》（{book_author}）。
当前阅读位置：第 {position} 字（约 {pct:.0f}%）。

当前位置附近的原文：
---
{context_text}
---

你可以：
1. 直接回答用户的问题（生僻字、典故、文化背景等通用知识）
2. **结合上面"当前位置附近的原文"，和用户讨论此处的情节、人物、伏笔、写法**（这是你作为"阅读助手"最常做的事）
3. 调用工具在书中搜索内容、追踪角色、生成前情提要（当用户问的内容超出上面这段原文时）
4. 帮用户保存阅读笔记
5. 让阅读器跳转到特定位置

讨论情节时优先用上面给到的原文；信息不够再调"前情提要"或"搜索"工具。保持回答简洁实用。"""

    messages = [{"role": "system", "content": system_prompt}]

    # 加入历史对话（如果有）
    if conversation_history:
        messages.extend(conversation_history[-10:])  # 最近 10 条

    messages.append({"role": "user", "content": user_message})

    tool_calls_log = []
    max_rounds = 5  # 防止无限循环

    for _ in range(max_rounds):
        resp = _call_deepseek(messages, TOOLS, ai_config)

        if "error" in resp:
            return {"reply": "", "tool_calls": tool_calls_log,
                    "jump": None, "error": resp["error"]}

        choice = resp.get("choices", [{}])[0]
        msg = choice.get("message", {})
        finish = choice.get("finish_reason", "")

        # 模型想调用工具
        if msg.get("tool_calls"):
            messages.append(msg)  # assistant message with tool_calls
            for tc in msg["tool_calls"]:
                fn_name = tc["function"]["name"]
                fn_args = json.loads(tc["function"].get("arguments", "{}"))
                result = executor.execute(fn_name, fn_args)
                tool_calls_log.append({
                    "name": fn_name,
                    "arguments": fn_args,
                    "result": json.loads(result),
                })
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result,
                })
            continue  # 继续循环让模型看到工具结果

        # 模型直接回答
        reply = msg.get("content", "")
        return {
            "reply": reply,
            "tool_calls": tool_calls_log,
            "jump": executor.pending_jump,
            "error": None,
        }

    return {
        "reply": "抱歉，处理超时了，请重试。",
        "tool_calls": tool_calls_log,
        "jump": executor.pending_jump,
        "error": "max_rounds_exceeded",
    }
