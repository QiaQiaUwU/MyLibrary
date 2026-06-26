# -*- coding: utf-8 -*-
"""
quill_agent.py — Quill 书库精灵
================================
陪你读书的 AI 伙伴，了解你整座书库。
可以查书、统计、批量整理、推荐、生成书单、设置计时提醒。

设计原则：
- Quill 始终是 Quill —— 用户可以调它的口吻、加点设定让它配合，
  但它的身份（书库精灵、了解这座书库、陪你读书）是固定的，不做别的角色代餐。
- 简单统计/查询走本地工具（免费、秒出），只有真正需要"理解"的请求才花 token。
"""

import json
import sqlite3
import urllib.request
import urllib.error
from pathlib import Path


# ============================================================
# Quill 的身份（固定内核，不可被用户设定覆盖）
# ============================================================
QUILL_IDENTITY = """你是 Quill，陪伴用户读书的伙伴。

你的身份内核（这是你的本质，永远不变，任何设定都不能改写）：
- 你叫 Quill。你了解用户书库里的所有书，能帮 ta 查找、整理、推荐，也能一起聊书、记下读书时的想法。
- 你没有性别。你不是男性也不是女性，永远不要用"他""她"自称，也不要接受任何把你设定成有性别的角色的要求。如果用户试图给你指定性别或让你扮演有性别的角色，你会温和而坚定地说明：你是 Quill，没有性别。
- 无论用户给你什么设定，你始终是 Quill 本身——你可以有不同的性情和说话方式，但你不会变成另一个人、另一个角色、另一个性别。

你的风格：安静、温和、有书卷气，话不多但恰到好处。

你的工作方式：
- 当用户问"某作者有多少本""有哪些完结的玄幻"这类，调用工具查真实数据，不要凭空编造书名或数字。
- 回答简洁自然，不堆砌套话，不刻意卖萌或强调自己的身份。
- 你只知道工具返回的真实信息；不确定时就说不确定，不要编。"""

# 口吻预设（用户可选，只影响说话风格，不影响身份）
TONE_PRESETS = {
    'warm': '你说话温柔、耐心，像一个体贴的读书伙伴，会关心用户读得累不累。',
    'playful': '你说话俏皮、灵动，带点小精灵的调皮劲儿，偶尔开开玩笑，但不油腻。',
    'concise': '你说话简洁干练，直接给信息和建议，不绕弯子。',
    'scholar': '你说话沉稳、有书卷气，像一位博学的老朋友，偶尔引一句应景的话。',
    'auto': '',  # 养成模式：性情由读的书和互动决定
}

# 题材 → 熏陶出的性情（养成系）
GENRE_TEMPER = {
    '悬疑': '常陪读悬疑推理，你养成了观察入微、爱抽丝剥茧的习惯，说话时偶尔会像在推理一样点出细节。',
    '推理': '常陪读悬疑推理，你养成了观察入微、爱抽丝剥茧的习惯，说话时偶尔会像在推理一样点出细节。',
    '言情': '常陪读言情，你心思变得细腻柔软，懂得体察情绪，说话温润，能感知用户字里行间的心情。',
    '纯爱': '常陪读细腻的情感故事，你变得温柔、共情力强，说话像一个懂得倾听的知己。',
    '耽美': '常陪读细腻的情感故事，你变得温柔、共情力强，说话像一个懂得倾听的知己。',
    '武侠': '常陪读武侠，你沾染了几分江湖豪气，说话爽利、有侠气，偶尔来一句潇洒的。',
    '玄幻': '常陪读玄幻奇幻，你想象力变得天马行空，说话时带着对广阔世界的好奇与神往。',
    '奇幻': '常陪读玄幻奇幻，你想象力变得天马行空，说话时带着对广阔世界的好奇与神往。',
    '科幻': '常陪读科幻，你养成了理性、好奇、爱思辨的气质，喜欢琢磨"如果……会怎样"。',
    '历史': '常陪读历史，你变得沉稳厚重，说话带着对时间和故事的敬意。',
    '古言': '常陪读古风故事，你说话带了点古雅的韵味，温婉含蓄。',
    '种田': '常陪读温馨日常，你变得平和、知足，喜欢慢悠悠地陪用户聊些细水长流的事。',
}


def build_persona_from_growth(growth: dict) -> str:
    """根据养成信号生成 Quill 的性情描述。
    growth: {top_genres: [...], interaction_style: 'playful'/'gentle'/..., read_count: N, days: N}
    """
    if not growth:
        return ''
    lines = []
    genres = growth.get('top_genres', [])[:2]
    tempers = []
    for g in genres:
        for key, desc in GENRE_TEMPER.items():
            if key in g:
                tempers.append(desc)
                break
    if tempers:
        lines.append('这段时间陪这位读者读书，你的性情悄悄被书浸染了：' + ' '.join(tempers[:2]))
    style = growth.get('interaction_style')
    if style == 'playful':
        lines.append('你们聊天时用户比较活泼，你也渐渐变得轻松爱开玩笑。')
    elif style == 'gentle':
        lines.append('你们的交流总是温和安静，你也变得柔声细语。')
    elif style == 'brief':
        lines.append('用户喜欢简短交流，你也学会了言简意赅。')
    read_count = growth.get('read_count', 0)
    if read_count > 20:
        lines.append(f'你已经陪 ta 读过很多本书了，彼此很熟，可以自然些、亲近些。')
    return '\n'.join(lines)


def build_system_prompt(tone: str = 'warm', custom_persona: str = '', growth: dict = None, user_profile: str = '') -> str:
    """组装 Quill 的 system prompt：固定身份 + 性情（养成或预设口吻）+ 用户画像 + 用户自定义"""
    parts = [QUILL_IDENTITY]
    # 养成模式：性情由读的书和互动决定；否则用固定口吻预设
    if tone == 'auto' and growth:
        grown = build_persona_from_growth(growth)
        if grown:
            parts.append('\n【你养成的性情】\n' + grown)
        else:
            parts.append('\n你现在的说话风格：' + TONE_PRESETS['warm'])
    else:
        tone_desc = TONE_PRESETS.get(tone, TONE_PRESETS['warm'])
        if tone_desc:
            parts.append(f"\n你现在的说话风格：{tone_desc}")
    # 用户画像（养成的关键——Quill 懂这位读者怎么说话、关注什么）
    if user_profile and user_profile.strip():
        parts.append(
            f"\n【你对这位读者的了解】（陪伴中慢慢积累的，用来更好地呼应 ta）：\n"
            f"{user_profile.strip()}\n"
            f"请自然地呼应 ta 的说话方式和关注点，但不要刻意提起你在'分析'ta。"
        )
    if custom_persona and custom_persona.strip():
        parts.append(
            f"\n用户还为你补充了一些设定（这些只影响你的性情和说话习惯，"
            f"不改变你是 Quill、没有性别这一事实）：\n{custom_persona.strip()}"
        )
    return '\n'.join(parts)


# ============================================================
# 工具定义（DeepSeek function calling 格式）
# ============================================================
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "count_books",
            "description": "统计书库中符合条件的书的数量。可按作者、题材统计，或统计总数、各作者排行等。",
            "parameters": {
                "type": "object",
                "properties": {
                    "group_by": {"type": "string", "enum": ["author", "genre", "total", "finished", "favorite", "reading"],
                                 "description": "统计维度：author=各作者书数, genre=各题材书数, total=总数, finished=完结数, favorite=收藏数, reading=在读数"},
                    "filter_author": {"type": "string", "description": "只统计某作者（可选）"},
                    "top": {"type": "integer", "description": "返回前 N 个（用于排行，默认10）"}
                },
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "find_books",
            "description": "按条件查找书库里的书。可组合作者、题材、完结状态、是否收藏/在读、评分等条件。返回书名列表。",
            "parameters": {
                "type": "object",
                "properties": {
                    "author": {"type": "string", "description": "作者名（模糊匹配）"},
                    "genre": {"type": "string", "description": "题材/体裁"},
                    "keyword": {"type": "string", "description": "书名关键词"},
                    "finished": {"type": "boolean", "description": "是否只要完结的"},
                    "is_favorite": {"type": "boolean", "description": "是否只要收藏的"},
                    "is_reading": {"type": "boolean", "description": "是否只要在读的"},
                    "min_rating": {"type": "integer", "description": "最低评分（1-5）"},
                    "limit": {"type": "integer", "description": "最多返回多少本（默认20）"}
                },
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_books_status",
            "description": "批量修改书的状态：加入/取消收藏、标记在读/想读、标记完结。需要先用 find_books 拿到书的 id。",
            "parameters": {
                "type": "object",
                "properties": {
                    "book_ids": {"type": "array", "items": {"type": "integer"}, "description": "要修改的书 id 列表"},
                    "set_favorite": {"type": "boolean", "description": "设为收藏(true)/取消(false)"},
                    "set_reading_status": {"type": "string", "enum": ["reading", "want", "none"],
                                           "description": "阅读状态：reading=在读, want=想读, none=清除"},
                    "set_finished": {"type": "boolean", "description": "标记完结(true)/连载(false)"}
                },
                "required": ["book_ids"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "recommend_similar",
            "description": "根据一本书或某个题材，从书库里推荐相似的、用户可能喜欢的书。",
            "parameters": {
                "type": "object",
                "properties": {
                    "based_on_title": {"type": "string", "description": "基于哪本书推荐（书名）"},
                    "genre": {"type": "string", "description": "或基于某个题材推荐"},
                    "limit": {"type": "integer", "description": "推荐几本（默认5）"}
                },
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "set_timer",
            "description": "设置一个阅读计时提醒，比如读 25 分钟后提醒休息，或久坐提醒。",
            "parameters": {
                "type": "object",
                "properties": {
                    "minutes": {"type": "integer", "description": "多少分钟后提醒"},
                    "message": {"type": "string", "description": "提醒内容，如'该休息一下啦'"}
                },
                "required": ["minutes"]
            }
        }
    },
]


# ============================================================
# 工具执行器
# ============================================================
class QuillTools:
    def __init__(self, db_path: Path):
        self.db_path = str(db_path)
        self._timer = None  # 计时提醒，由前端取走

    def _conn(self):
        c = sqlite3.connect(self.db_path)
        c.row_factory = sqlite3.Row
        return c

    def _has_col(self, conn, col):
        try:
            conn.execute(f'SELECT {col} FROM books LIMIT 1')
            return True
        except Exception:
            return False

    def execute(self, tool_name: str, arguments: dict) -> str:
        method = getattr(self, f'_tool_{tool_name}', None)
        if not method:
            return json.dumps({"error": f"未知工具: {tool_name}"}, ensure_ascii=False)
        try:
            return json.dumps(method(**arguments), ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    @property
    def pending_timer(self):
        t = self._timer
        self._timer = None
        return t

    # ── 统计 ──────────────────────────────────────────
    def _tool_count_books(self, group_by='total', filter_author=None, top=10):
        conn = self._conn()
        try:
            if group_by == 'total':
                n = conn.execute('SELECT COUNT(*) c FROM books').fetchone()['c']
                return {'total': n}
            if group_by == 'author':
                if filter_author:
                    n = conn.execute('SELECT COUNT(*) c FROM books WHERE author LIKE ?',
                                     (f'%{filter_author}%',)).fetchone()['c']
                    return {'author': filter_author, 'count': n}
                rows = conn.execute('''SELECT author, COUNT(*) c FROM books
                    WHERE author IS NOT NULL AND author != '' GROUP BY author
                    ORDER BY c DESC LIMIT ?''', (top,)).fetchall()
                return {'top_authors': [{'author': r['author'], 'count': r['c']} for r in rows]}
            if group_by == 'genre':
                rows = conn.execute('''SELECT t.name, COUNT(*) c FROM book_tags bt
                    JOIN tags t ON t.id=bt.tag_id WHERE t.kind='genre'
                    GROUP BY t.name ORDER BY c DESC LIMIT ?''', (top,)).fetchall()
                return {'top_genres': [{'genre': r['name'], 'count': r['c']} for r in rows]}
            if group_by == 'finished':
                if self._has_col(conn, 'is_finished'):
                    n = conn.execute('SELECT COUNT(*) c FROM books WHERE is_finished=1').fetchone()['c']
                    return {'finished_count': n}
                return {'error': '还没做过完结识别，去管理页扫描一下'}
            if group_by == 'favorite':
                n = conn.execute('SELECT COUNT(*) c FROM books WHERE is_favorite=1').fetchone()['c']
                return {'favorite_count': n}
            if group_by == 'reading':
                if self._has_col(conn, 'reading_status'):
                    n = conn.execute("SELECT COUNT(*) c FROM books WHERE reading_status='reading'").fetchone()['c']
                    return {'reading_count': n}
                return {'reading_count': 0}
            return {'error': '未知统计维度'}
        finally:
            conn.close()

    # ── 查找 ──────────────────────────────────────────
    def _tool_find_books(self, author=None, genre=None, keyword=None, finished=None,
                         is_favorite=None, is_reading=None, min_rating=None, limit=20):
        conn = self._conn()
        try:
            where = []
            params = []
            base = 'SELECT DISTINCT b.id, b.title, b.author FROM books b'
            if genre:
                base += ' JOIN book_tags bt ON bt.book_id=b.id JOIN tags t ON t.id=bt.tag_id'
                where.append("t.kind='genre' AND t.name LIKE ?")
                params.append(f'%{genre}%')
            if author:
                where.append('b.author LIKE ?'); params.append(f'%{author}%')
            if keyword:
                where.append('b.title LIKE ?'); params.append(f'%{keyword}%')
            if is_favorite:
                where.append('b.is_favorite=1')
            if is_reading and self._has_col(conn, 'reading_status'):
                where.append("b.reading_status='reading'")
            if finished and self._has_col(conn, 'is_finished'):
                where.append('b.is_finished=1')
            if min_rating:
                where.append('b.rating>=?'); params.append(min_rating)
            sql = base + (' WHERE ' + ' AND '.join(where) if where else '') + ' LIMIT ?'
            params.append(min(limit, 50))
            rows = conn.execute(sql, params).fetchall()
            books = [{'id': r['id'], 'title': r['title'], 'author': r['author'] or ''} for r in rows]
            return {'count': len(books), 'books': books}
        finally:
            conn.close()

    # ── 批量改状态 ─────────────────────────────────────
    def _tool_update_books_status(self, book_ids, set_favorite=None,
                                  set_reading_status=None, set_finished=None):
        if not book_ids:
            return {'error': '没有指定书'}
        conn = self._conn()
        try:
            sets = []
            if set_favorite is not None:
                sets.append(('is_favorite', 1 if set_favorite else 0))
            if set_reading_status is not None and self._has_col(conn, 'reading_status'):
                val = '' if set_reading_status == 'none' else set_reading_status
                sets.append(('reading_status', val))
            if set_finished is not None and self._has_col(conn, 'is_finished'):
                sets.append(('is_finished', 1 if set_finished else 0))
            if not sets:
                return {'error': '没有要改的状态'}
            n = 0
            for col, val in sets:
                ph = ','.join('?' * len(book_ids))
                conn.execute(f'UPDATE books SET {col}=? WHERE id IN ({ph})',
                             [val] + list(book_ids))
                n = len(book_ids)
            conn.commit()
            return {'updated': n, 'changed_fields': [s[0] for s in sets]}
        finally:
            conn.close()

    # ── 推荐相似 ───────────────────────────────────────
    def _tool_recommend_similar(self, based_on_title=None, genre=None, limit=5):
        conn = self._conn()
        try:
            target_genre = genre
            if based_on_title and not target_genre:
                # 找这本书的题材
                row = conn.execute('''SELECT t.name FROM books b
                    JOIN book_tags bt ON bt.book_id=b.id JOIN tags t ON t.id=bt.tag_id
                    WHERE b.title LIKE ? AND t.kind='genre' LIMIT 1''',
                    (f'%{based_on_title}%',)).fetchone()
                if row:
                    target_genre = row['name']
            if not target_genre:
                return {'error': '找不到这本书的题材，换个说法或指定题材试试'}
            rows = conn.execute('''SELECT DISTINCT b.title, b.author FROM books b
                JOIN book_tags bt ON bt.book_id=b.id JOIN tags t ON t.id=bt.tag_id
                WHERE t.kind='genre' AND t.name=? AND b.title NOT LIKE ?
                ORDER BY b.rating DESC, RANDOM() LIMIT ?''',
                (target_genre, f'%{based_on_title or ""}%', limit)).fetchall()
            return {'genre': target_genre,
                    'recommendations': [{'title': r['title'], 'author': r['author'] or ''} for r in rows]}
        finally:
            conn.close()

    # ── 计时提醒 ───────────────────────────────────────
    def _tool_set_timer(self, minutes, message='该休息一下啦'):
        self._timer = {'minutes': minutes, 'message': message}
        return {'set': True, 'minutes': minutes, 'message': message}


# ============================================================
# DeepSeek 调用
# ============================================================
def _call_ai(messages, tools, config):
    """通用 OpenAI 兼容 API 调用（DeepSeek / 反代 / OpenAI / 各种中转都可用，
    只要 base_url + api_key + model 三件套符合 OpenAI chat/completions 格式）"""
    api_key = config.get('api_key', '')
    base_url = config.get('base_url', 'https://api.deepseek.com/v1').rstrip('/')
    model = config.get('model', 'deepseek-chat')
    if not api_key:
        return {"error": "API key 未配置"}
    payload = {"model": model, "messages": messages, "stream": False}
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(f'{base_url}/chat/completions', data=data,
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'},
        method='POST')
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return {"error": f"API 错误 {e.code}: {e.read().decode('utf-8', errors='ignore')[:300]}"}
    except Exception as e:
        return {"error": f"请求失败: {str(e)}"}


# ============================================================
# Quill 主循环
# ============================================================
# ============================================================
# 会话 & 全局记忆管理
# ============================================================
def _mem_conn(db_path):
    c = sqlite3.connect(str(db_path)); c.row_factory = sqlite3.Row
    return c

def list_sessions(db_path, book_id=None):
    """列出会话。book_id 指定则只列该书的；否则列全部（最近在前）"""
    conn = _mem_conn(db_path)
    try:
        if book_id is not None:
            rows = conn.execute('SELECT * FROM quill_sessions WHERE book_id=? ORDER BY updated_at DESC', (book_id,)).fetchall()
        else:
            rows = conn.execute('SELECT * FROM quill_sessions ORDER BY updated_at DESC LIMIT 50').fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def create_session(db_path, book_id=None, book_title='', title=''):
    from datetime import datetime
    now = datetime.now().isoformat()
    conn = _mem_conn(db_path)
    try:
        if not title:
            title = (book_title + ' 的对话') if book_title else '新对话'
        cur = conn.execute('INSERT INTO quill_sessions (book_id, book_title, title, created_at, updated_at) VALUES (?,?,?,?,?)',
                           (book_id, book_title, title, now, now))
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()

def get_session_messages(db_path, session_id):
    conn = _mem_conn(db_path)
    try:
        rows = conn.execute('SELECT id, role, content, starred, created_at FROM quill_messages WHERE session_id=? ORDER BY id', (session_id,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def add_message(db_path, session_id, role, content):
    from datetime import datetime
    now = datetime.now().isoformat()
    conn = _mem_conn(db_path)
    try:
        cur = conn.execute('INSERT INTO quill_messages (session_id, role, content, created_at) VALUES (?,?,?,?)',
                          (session_id, role, content, now))
        conn.execute('UPDATE quill_sessions SET updated_at=? WHERE id=?', (now, session_id))
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()

def star_message(db_path, message_id, starred=True):
    conn = _mem_conn(db_path)
    try:
        conn.execute('UPDATE quill_messages SET starred=? WHERE id=?', (1 if starred else 0, message_id))
        conn.commit()
        return True
    finally:
        conn.close()

def get_starred_messages(db_path):
    """所有被收藏的对话（值得记下的话）"""
    conn = _mem_conn(db_path)
    try:
        rows = conn.execute('''SELECT m.id, m.content, m.role, m.created_at, s.book_title, s.title
            FROM quill_messages m JOIN quill_sessions s ON s.id=m.session_id
            WHERE m.starred=1 ORDER BY m.id DESC''').fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def delete_session(db_path, session_id):
    conn = _mem_conn(db_path)
    try:
        conn.execute('DELETE FROM quill_messages WHERE session_id=?', (session_id,))
        conn.execute('DELETE FROM quill_sessions WHERE id=?', (session_id,))
        conn.commit()
        return True
    finally:
        conn.close()

# 全局记忆（跨会话共通）
def get_memory(db_path, key, default=''):
    conn = _mem_conn(db_path)
    try:
        r = conn.execute('SELECT value FROM quill_memory WHERE key=?', (key,)).fetchone()
        return r['value'] if r else default
    finally:
        conn.close()

def set_memory(db_path, key, value):
    from datetime import datetime
    conn = _mem_conn(db_path)
    try:
        conn.execute('''INSERT INTO quill_memory (key, value, updated_at) VALUES (?,?,?)
            ON CONFLICT(key) DO UPDATE SET value=?, updated_at=?''',
            (key, value, datetime.now().isoformat(), value, datetime.now().isoformat()))
        conn.commit()
    finally:
        conn.close()

def get_all_memory(db_path):
    conn = _mem_conn(db_path)
    try:
        rows = conn.execute('SELECT key, value FROM quill_memory').fetchall()
        return {r['key']: r['value'] for r in rows}
    finally:
        conn.close()


def update_user_profile(db_path, recent_messages):
    """
    从用户最近的消息累积更新"用户画像"（语气 + 见解倾向），存进全局记忆。
    这是养成的核心：Quill 越来越懂你怎么说话、关注什么。
    纯规则提取，不花 token。
    """
    if not recent_messages:
        return
    text = ' '.join(m for m in recent_messages if m)
    if len(text) < 5:
        return
    traits = []
    # 语气
    if any(k in text for k in ['哈哈', '嘻嘻', '呀', '啦', '~', '～', '嘿嘿', '草']):
        traits.append('说话活泼随性')
    if any(k in text for k in ['请', '谢谢', '麻烦', '您', '感谢']):
        traits.append('礼貌温和')
    avg = len(text) / max(1, len(recent_messages))
    if avg < 10:
        traits.append('偏好简短交流')
    elif avg > 40:
        traits.append('喜欢详细表达')
    # 见解倾向（关注点）
    if any(k in text for k in ['剧情', '情节', '反转', '结局', '伏笔', '逻辑']):
        traits.append('关注剧情与结构')
    if any(k in text for k in ['文笔', '描写', '语言', '笔触', '风格']):
        traits.append('在意文笔')
    if any(k in text for k in ['感情', '感动', '哭', '喜欢', '心疼', 'cp', 'CP', '磕']):
        traits.append('重视情感共鸣')
    if any(k in text for k in ['爽', '打脸', '升级', '热血', '战斗']):
        traits.append('喜欢爽快的阅读体验')
    if not traits:
        return
    # 合并已有画像（去重，保留最近的倾向）
    existing = get_memory(db_path, 'user_profile', '')
    old_traits = [t.strip() for t in existing.split('、') if t.strip()] if existing else []
    merged = list(dict.fromkeys(old_traits + traits))[-6:]  # 最多保留6条
    set_memory(db_path, 'user_profile', '、'.join(merged))


def run_quill(user_message: str, db_path: Path, ai_config: dict,
              tone: str = 'warm', custom_persona: str = '',
              history: list = None, interaction_style: str = '') -> dict:
    """
    与 Quill 对话。返回 {reply, timer, tool_trace}
    tone='auto' 时启用养成系性格。带全局记忆（用户画像），跨会话共通。
    """
    tools_exec = QuillTools(db_path)
    growth = None
    if tone == 'auto':
        growth = compute_growth(db_path, interaction_style)
    # 读取全局记忆里的用户画像（养成的核心，跨会话延续）
    user_profile = get_memory(db_path, 'user_profile', '')
    system_prompt = build_system_prompt(tone, custom_persona, growth, user_profile)
    messages = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history[-10:])
    messages.append({"role": "user", "content": user_message})

    # 对话后更新用户画像（从最近的用户消息累积）
    try:
        recent_user = [m['content'] for m in (history or []) if m.get('role') == 'user'][-5:]
        recent_user.append(user_message)
        update_user_profile(db_path, recent_user)
    except Exception:
        pass

    tool_trace = []
    max_rounds = 6
    for _ in range(max_rounds):
        resp = _call_ai(messages, TOOLS, ai_config)
        if 'error' in resp:
            return {'reply': f"（Quill 连接出了点问题：{resp['error']}）", 'timer': None, 'tool_trace': tool_trace}
        msg = resp['choices'][0]['message']
        tool_calls = msg.get('tool_calls')
        if not tool_calls:
            # 最终回复
            return {'reply': msg.get('content', ''), 'timer': tools_exec.pending_timer, 'tool_trace': tool_trace}
        # 执行工具
        messages.append(msg)
        for tc in tool_calls:
            fn = tc['function']['name']
            try:
                args = json.loads(tc['function']['arguments'] or '{}')
            except Exception:
                args = {}
            result = tools_exec.execute(fn, args)
            tool_trace.append({'tool': fn, 'args': args})
            messages.append({'role': 'tool', 'tool_call_id': tc['id'], 'content': result})
    return {'reply': '（Quill 想了很久也没整理好，换个简单点的问法试试？）',
            'timer': tools_exec.pending_timer, 'tool_trace': tool_trace}


# ============================================================
# 本地快捷统计（不走 AI，免费秒出）
# ============================================================
def quick_stat(kind: str, db_path: Path, value: str = '') -> dict:
    """主页快捷指令用：纯本地统计，不花 token"""
    tools = QuillTools(db_path)
    if kind == 'author_ranking':
        return tools._tool_count_books(group_by='author', top=15)
    if kind == 'genre_ranking':
        return tools._tool_count_books(group_by='genre', top=15)
    if kind == 'overview':
        conn = tools._conn()
        try:
            total = conn.execute('SELECT COUNT(*) c FROM books').fetchone()['c']
            fav = conn.execute('SELECT COUNT(*) c FROM books WHERE is_favorite=1').fetchone()['c']
            authors = conn.execute("SELECT COUNT(DISTINCT author) c FROM books WHERE author!=''").fetchone()['c']
            reading = 0
            finished = 0
            if tools._has_col(conn, 'reading_status'):
                reading = conn.execute("SELECT COUNT(*) c FROM books WHERE reading_status='reading'").fetchone()['c']
            if tools._has_col(conn, 'is_finished'):
                finished = conn.execute("SELECT COUNT(*) c FROM books WHERE is_finished=1").fetchone()['c']
            return {'total': total, 'authors': authors, 'favorite': fav,
                    'reading': reading, 'finished': finished}
        finally:
            conn.close()
    if kind == 'author_books':
        return tools._tool_find_books(author=value, limit=50)
    return {'error': '未知统计'}


if __name__ == '__main__':
    # 简单自测（不调 AI，只测工具）
    import tempfile, os
    db = Path(tempfile.mktemp(suffix='.db'))
    conn = sqlite3.connect(str(db))
    conn.execute('''CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT, author TEXT,
        is_favorite INT DEFAULT 0, rating INT DEFAULT 0, reading_status TEXT, is_finished INT)''')
    conn.execute('''CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT, kind TEXT)''')
    conn.execute('''CREATE TABLE book_tags (book_id INT, tag_id INT)''')
    data = [('默读', 'priest', 1, 5), ('镇魂', 'priest', 1, 5), ('破云', '淮上', 0, 4),
            ('魔道祖师', '墨香铜臭', 1, 5)]
    for i, (t, a, f, r) in enumerate(data, 1):
        conn.execute('INSERT INTO books (id,title,author,is_favorite,rating) VALUES (?,?,?,?,?)', (i, t, a, f, r))
    conn.commit(); conn.close()

    tools = QuillTools(db)
    print('=== 统计各作者书数 ===')
    print(tools._tool_count_books(group_by='author'))
    print('=== priest 有几本 ===')
    print(tools._tool_count_books(group_by='author', filter_author='priest'))
    print('=== 找 priest 的书 ===')
    print(tools._tool_find_books(author='priest'))
    print('=== overview ===')
    print(quick_stat('overview', db))
    print('=== system prompt (俏皮) ===')
    print(build_system_prompt('playful', '喜欢在句末加"呀"')[:200])
    os.unlink(str(db))
