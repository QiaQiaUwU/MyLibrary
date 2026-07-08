"""
MyLibrary — 个人小说图书馆核心库
================================
负责: 数据库 schema, 文件解析, 去重判定, 扫描入库
"""
import hashlib
import io
import json
import os
import re
import shutil
import sqlite3
import sys
import tempfile
import zipfile
import zlib
import atexit
import signal
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional


# ============================================================
# 配置
# ============================================================
NOVEL_EXTS = {'.txt', '.epub', '.mobi', '.azw3', '.azw', '.pdf', '.fb2', '.html', '.htm'}
ARCHIVE_EXTS = {'.zip', '.rar', '.7z'}

# 文件名中的"完整度"信号
QUALITY_BONUS = {
    '全本': 10, '完整': 10, '完结': 8, '番外': 6, '精校': 8, '修订': 5,
    '修正': 5, '校对': 5, '全集': 8, '合集': 4, '+番外': 8, '完': 5,
}
QUALITY_PENALTY = {
    '节选': -15, '试读': -20, '未完': -10, '残缺': -20, 'TS': -3,
    '章节缺失': -15, '部分': -8, '片段': -10,
}

# 体裁词典 (来自你的 mrpro 备份分析)
KNOWN_GENRES = {
    '耽美', '古代', '现代', '玄幻', '修真', '科幻', '奇幻', '武侠', '言情', '都市',
    '快穿', '无限流', '穿越', '重生', '系统', '游戏', '末世', '校园', '娱乐圈',
    '总裁', '高干', '军人', 'ABO', '强强', '甜文', '同人', 'NP', 'BL', 'BG',
    '公路文', '正剧', '大女主', '文学', '哈利波特', '飘渺之旅', '推理', '悬疑',
    '惊悚', '历史', '架空', '腹黑', '宠文', '虐文', '种田', '美食', '宫斗', '宅斗',
    '原创', '成人童话',
}
NON_CATEGORIES = {'(TXT)', 'TXT', ''}

# 明显不是小说的文件名 (整名或前缀匹配, 大小写不敏感)
# 如果 .txt 文件叫这些名字, 跳过. 即使在小说文件夹里出现也不应入库
_NON_NOVEL_BASENAMES = {
    'readme', 'license', 'licence', 'notice', 'changelog', 'changes',
    'copying', 'authors', 'contributors', 'install', 'todo',
    'requirements', 'package', 'package-lock', 'manifest',
    'tsconfig', 'jsconfig', '.gitignore', '.dockerignore',
    'composer', 'gemfile', 'pyproject',
}
_NON_NOVEL_PREFIXES = ('readme', 'license', 'licence', 'changelog',
                        'requirements', 'package', 'tsconfig')


def _is_obvious_non_novel(p) -> bool:
    """文件名/大小/路径明显不是小说? 用于扫描阶段的预过滤.

    多信号判定:
      A. 文件名/路径关键词黑名单 (工作 / 学习 / 计算机 / 英语 / 毕设)
      B. 文件名模式硬规则 (短英文名 / 纯数字 / Lab/hw 等)
      C. 大小: <10KB 或 >50MB 几乎不是单本小说
      D. **正面信号反救**: 文件名含 《》/[完结]/作者:/by XXX/番外 等强信号则不跳过

    阅读小说的人会有很多边缘 case (短篇合集, 单章, 笔记体小说...), 所以正面信号
    一旦命中就强制保留, 宁愿误入库一两本工作文档, 也别漏掉真小说.
    """
    stem = p.stem  # 保留大小写, 给英文判定用
    stem_lower = stem.lower()
    name_lower = p.name.lower()
    path_str = str(p).lower()

    # 老规则: 显式 basename / prefix 名单
    if stem_lower in _NON_NOVEL_BASENAMES:
        return True
    for pre in _NON_NOVEL_PREFIXES:
        if stem_lower == pre or stem_lower.startswith(pre + '.') or stem_lower.startswith(pre + '-'):
            return True

    # === 正面信号: 命中就保留 (优先级最高) ===
    POSITIVE_MARKERS = [
        '《', '》', '作者:', '作者：', 'by ', '【完结', '[完结', '完结】', '完结]',
        '番外', 'np', '1v1', '1v2', 'np文', 'he ', 'be ', '攻受', '攻受',
        '古言', '耽美', '穿越', '重生', '快穿', 'abo', '玄幻', '修真', '末世',
        '校园文', '娱乐圈', '无限流', '废文', '失忆', '双男主', '双女主',
        '废文', 'gl文', 'bl文', '同人', '原耽',
    ]
    for sig in POSITIVE_MARKERS:
        if sig in name_lower:
            return False  # 强信号: 是小说, 不跳过

    # === 大小过滤 (放正面信号之后) ===
    try:
        size = p.stat().st_size
        ext = p.suffix.lower()
        if ext == '.txt':
            if size < 10 * 1024:   # < 10KB 的 txt 极少是小说
                return True
            if size > 100 * 1024 * 1024:   # > 100MB 的"小说"基本是数据集/字幕/dump
                return True
    except OSError:
        pass

    # === 文件名硬规则: 不可能是小说的命名模式 ===
    import re as _re

    # 纯英文短名 (≤15 字符且无中文), 大概率是代码/作业/工具
    if len(stem) <= 15 and _re.match(r'^[\x00-\x7f]+$', stem):
        return True

    # 纯数字 / 纯日期
    if _re.match(r'^[\d\-_\.\s]+$', stem):
        return True

    # 路径里包含明显的"作业"标志 (一刀切, 整个目录都跳过)
    # 注意要够具体, 不要 'lab' 撞上 'labyrinth'
    PATH_SKIPS = [
        '\\作业\\', '/作业/', '\\fyp\\', '/fyp/',
        '\\lab1\\', '\\lab2\\', '\\lab3\\', '\\lab4\\', '\\lab5\\',
        '/lab1/', '/lab2/', '/lab3/', '/lab4/', '/lab5/',
        '\\毕设\\', '/毕设/',
        '\\课件\\', '/课件/', '\\讲义\\', '/讲义/',
        '\\习题\\', '/习题/', '\\试卷\\', '/试卷/',
        '\\复习\\', '/复习/', '\\备考\\', '/备考/',
    ]
    for pat in PATH_SKIPS:
        if pat in path_str:
            return True

    # === 关键词黑名单 (出现在文件名 stem 里就跳过) ===
    # 通用工作/学习
    NEGATIVE_GENERAL = [
        '报告', '报表', '汇总', '总结', '提纲', '大纲', 'syllabus',
        '调研', '综述', '论文', '文献', 'reference', 'bibliography',
        '简历', 'resume', 'cv', '推荐信', '个人陈述', 'ps',
        '课表', '讲义', 'lecture', 'lecturenote', '教材', 'textbook',
        '求职', '面试', 'interview',
        '周报', '月报', '日报',
        'okr', 'kpi', '待办', 'todo', 'checklist',
        '会议', 'meeting', 'minutes', '纪要',
        '协议', '合同', '邀请函',
        '作业', '习题', '试卷', '考试', '测验', '复习', '答案', '错题',
        '题目', '题库', '真题', '模拟卷',
        # '笔记' 太广 — '盗墓笔记' 等真小说会中招. 改成具体的"学习笔记/工作笔记":
        '读书笔记', '学习笔记', '课堂笔记', '听课笔记', '会议笔记',
        '工作笔记', '调研笔记', '阅读笔记', '上课笔记', '复习笔记',
        '清单', '列表', '流程', '规范',
        '说明', '需求', '方案', '设计文档', '原型', '附件',
        '模板', '表格',
    ]
    # 学校 / 行政通知
    NEGATIVE_SCHOOL = [
        '通知', '公告', '公示', 'announcement', 'notice',
        # 注意: "关于" 太宽 (会误杀"关于他的故事"这种小说标题), 不加
        '教务', '学籍', '选课', '退选', '转专业',
        # '申请' 太广 — '会诊申请'(医疗小说情节) 等真小说会中招. 改成具体的:
        '申请表', '申请书', '入党申请', '保研申请', '出国申请',
        '助学金申请', '奖学金申请', '签证申请', '签证材料', '复议申请',
        '报名表', '报名表格', '录取',
        '缴费', '学费', '奖学金', '助学金',
        '评优', '评定', '评先',
        '党课', '党支部', '团支部', '团委', '学生会', '班会',
        '活动方案', '培训通知', '讲座通知', 'workshop',
        '校园卡', '一卡通',
    ]
    # "新建" 自动文件名 / 空白模板 / 临时
    NEGATIVE_BLANK = [
        '新建文档', '新建 microsoft', '新建microsoft',
        '新建文本文档', '新建txt', '新建 txt',
        '未命名', 'untitled', 'no title',
        'new document', 'document1', 'document2', 'document3',
        '副本 of', '副本of', ' - 副本',
        'copy of', '- copy',
        # 注意: "(1)" "(2)" 不加 — 微信对重名文件会自动加序号,
        # 真小说也常被这样命名 (e.g. "营业悖论(1).txt"), hash 去重会处理
    ]
    # 截图 / 导出 / 工具产物 / AI 对话
    NEGATIVE_EXPORTS = [
        'screenshot', 'capture', '截图', '屏幕快照', '屏幕截图',
        'chatgpt', 'gpt 对话', 'gpt对话', 'gpt聊天',
        'claude', 'claude 对话', 'claude对话',
        '对话记录', '聊天记录', '转发', '摘录',
        '语音转文字', 'voice memo', '语音备忘',
    ]
    # 计算机专业
    NEGATIVE_CS = [
        'readme', 'rfc', 'api ', 'api.', 'spec', '配置文件', 'setup',
        '安装', 'install', 'changelog', '部署', 'deploy', 'schema',
        'migration', 'backup', 'dump', 'query', 'sql', 'json', 'xml',
        'yaml', 'csv', 'pytest', 'unittest', '调试', 'debug',
        '源码', '源代码', 'source ', '工程文件',
        '高级网络', '计算机视觉', '人工智能概论', '人机交互',
        '软件开发', '操作系统', '数据库', '数据工程', '编译原理',
        '数据结构', '算法', '机器学习', '深度学习', '神经网络',
    ]
    # 英语 / 中外合办
    NEGATIVE_ENGLISH = [
        'vocab', 'vocabulary', 'ielts', 'toefl', 'cet4', 'cet6', 'gre', 'gmat',
        '雅思', '托福', '四级', '六级',
        '听力', '阅读理解', '写作模板', '作文', 'spoken', '口语', 'grammar',
        'word list', 'phrasal', 'collocation',
        'opi', 'voa', 'ted', 'transcript',
    ]
    # 毕设 / FYP
    NEGATIVE_THESIS = [
        '毕设', 'fyp', 'capstone', 'thesis',
        'abstract', 'conclusion', 'methodology',
        '答辩', 'defense', '开题', '中期答辩', '终期答辩',
        'proposal', '任务书', '评审', '评阅',
    ]

    all_negative = (NEGATIVE_GENERAL + NEGATIVE_SCHOOL + NEGATIVE_BLANK
                    + NEGATIVE_EXPORTS + NEGATIVE_CS + NEGATIVE_ENGLISH
                    + NEGATIVE_THESIS)
    for kw in all_negative:
        if kw in name_lower:
            return True

    return False

# 题材的"近义词"映射 (用于从文件名/书名推断)
GENRE_HINTS = {
    '哈利波特': ['哈利波特', 'HP', '[HP]', '哈利·波特', '霍格沃茨'],
    '同人': ['同人', '[同人]', '[综]', '综'],
    '无限流': ['无限流', '无限恐怖', '[无限]'],
    '快穿': ['快穿', '[快穿]'],
    '末世': ['末世', '丧尸', '末日'],
    '科幻': ['科幻', '太空', '星际', '机甲'],
    '修真': ['修真', '修仙', '仙侠'],
    '玄幻': ['玄幻'],
    '游戏': ['网游', '[游戏]', '电竞'],
    '校园': ['校园'],
    '娱乐圈': ['娱乐圈', '影帝'],
    'ABO': ['ABO', 'abo', 'Alpha', 'Omega'],
    '穿越': ['穿越', '穿书'],
    '重生': ['重生'],
    '种田': ['种田'],
    '宫斗': ['宫斗'],
    '推理': ['推理'],
    '悬疑': ['悬疑'],
}

# ============================================================
# 数据库 Schema
# ============================================================
SCHEMA = """
-- 书的实体记录 (一本书 = 一行)
CREATE TABLE IF NOT EXISTS books (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,              -- 干净的书名
    author          TEXT NOT NULL DEFAULT '',
    raw_title       TEXT NOT NULL DEFAULT '',   -- 原始文件名
    file_path       TEXT NOT NULL UNIQUE,       -- 在 books/ 目录下的相对路径
    file_size       INTEGER NOT NULL,
    file_ext        TEXT NOT NULL,
    content_hash    TEXT NOT NULL,              -- 标准化后的内容 hash
    raw_hash        TEXT NOT NULL,              -- 原始文件 SHA-256
    encoding        TEXT,                       -- 检测到的编码
    word_count      INTEGER DEFAULT 0,
    quality_score   INTEGER DEFAULT 0,          -- 完整度评分
    is_read         INTEGER DEFAULT 0,
    is_favorite     INTEGER DEFAULT 0,
    rating          INTEGER DEFAULT 0,
    user_notes      TEXT DEFAULT '',            -- 你自己写的笔记
    source          TEXT DEFAULT '',            -- 来源: 阅读文件夹/微信/备份/...
    import_time     TEXT NOT NULL,
    last_open       TEXT,
    -- 来自 mrpro 备份的字段
    mrpro_favorite  TEXT DEFAULT '',
    mrpro_used_ms   INTEGER DEFAULT 0,
    mrpro_words     INTEGER DEFAULT 0,
    mrpro_days      INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_books_title    ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author   ON books(author);
CREATE INDEX IF NOT EXISTS idx_books_hash     ON books(content_hash);
CREATE INDEX IF NOT EXISTS idx_books_raw_hash ON books(raw_hash);

-- 标签 (体裁 / 自定义)
CREATE TABLE IF NOT EXISTS tags (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    name   TEXT NOT NULL UNIQUE,
    kind   TEXT NOT NULL DEFAULT 'tag',  -- 'genre' / 'shelf' / 'tag'
    color  TEXT DEFAULT ''
);

-- 书<->标签 多对多
CREATE TABLE IF NOT EXISTS book_tags (
    book_id  INTEGER NOT NULL,
    tag_id   INTEGER NOT NULL,
    PRIMARY KEY (book_id, tag_id),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id)  REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_book_tags_tag ON book_tags(tag_id);

-- 阅读笔记 (从 mrpro 抢救的 + 你新写的)
CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id    INTEGER NOT NULL,
    chapter    INTEGER DEFAULT 0,
    position   INTEGER DEFAULT 0,
    original   TEXT DEFAULT '',    -- 高亮的原文
    my_note    TEXT DEFAULT '',    -- 我的批注
    bookmark   TEXT DEFAULT '',
    note_time  TEXT,
    source     TEXT DEFAULT '',    -- 'mrpro' / 'manual'
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notes_book ON notes(book_id);

-- 重复关系 (淘汰下来的副本记录)
CREATE TABLE IF NOT EXISTS duplicates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    primary_book_id INTEGER NOT NULL,           -- 保留下来的主版本
    dup_path        TEXT NOT NULL,              -- 副本被隔离到的位置
    original_path   TEXT NOT NULL,              -- 副本原本的位置
    dup_size        INTEGER,
    dup_hash        TEXT,
    reason          TEXT,                       -- 'exact' / 'content' / 'similar'
    quarantine_time TEXT NOT NULL,
    FOREIGN KEY (primary_book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- 导入日志
CREATE TABLE IF NOT EXISTS import_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp   TEXT NOT NULL,
    source_path TEXT,
    action      TEXT,    -- 'imported' / 'skipped_dup' / 'quarantined' / 'failed'
    file_name   TEXT,
    detail      TEXT
);

-- Phase 2 hash 缓存: 让 hash 计算可以跨 import 重启复用.
-- key = src_path 的绝对路径. 命中条件: 同路径 + 同 size + 同 mtime.
-- 任何一次 import 在 phase 2 算完一个文件的 hash, 就 INSERT OR REPLACE 进来,
-- 每 100 个 commit 一次. 下次 import 重跑时同一个源文件直接读缓存, 不再读盘算 SHA-256.
-- 这是给"phase 2/3 跑到一半被中断"的工作量止损的关键.
CREATE TABLE IF NOT EXISTS hash_cache (
    src_path     TEXT PRIMARY KEY,
    size         INTEGER NOT NULL,
    mtime        INTEGER NOT NULL,
    raw_hash     TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    encoding     TEXT,
    word_count   INTEGER,
    cached_at    TEXT NOT NULL
);

-- 压缩包解压结果缓存. 让 phase 1 解 zip 也能断点续传.
-- (zip_path, zip_size, zip_mtime) 唯一标识一个 zip 的当前状态.
-- raw_hashes_json 是 JSON 列表, 记录这个 zip 解压出来的所有文件的 raw_hash.
-- 重跑 import 时, 如果一个 zip 没改变过 (size+mtime 一致), 且它解压出来的所有
-- 文件的 raw_hash 都已经在 books 表里, 就跳过这个 zip 的解压 (内容已入库).
CREATE TABLE IF NOT EXISTS archive_cache (
    zip_path        TEXT PRIMARY KEY,
    zip_size        INTEGER NOT NULL,
    zip_mtime       INTEGER NOT NULL,
    raw_hashes_json TEXT NOT NULL,
    cached_at       TEXT NOT NULL
);
"""


# ============================================================
# 解析 (与之前一致, 略加完善)
# ============================================================
AUTHOR_PATTERNS = [
    re.compile(r'作者[:：]\s*([^\s（()【】《》\[\]]+)'),
    re.compile(r'作家[:：]\s*([^\s（()【】《》\[\]]+)'),
    re.compile(r'(?:^|[\s》】\]])by\s*([^\s（()【】《》\[\]]+)', re.IGNORECASE),
    re.compile(r'》\s*by\s*([^\s（()【】《》\[\]]+)', re.IGNORECASE),
]
TITLE_PATTERN = re.compile(r'《([^》]+)》')

def extract_title(s):
    if not s: return ''
    m = TITLE_PATTERN.search(s)
    if m: return m.group(1).strip()
    s = re.split(r'\s*(?:作者|作家|by|BY)[:：\s]', s)[0]
    s = re.sub(r'^\[[^\]]*\]', '', s).strip()
    s = re.sub(r'^\d+[._]\s*', '', s).strip()
    s = re.sub(r'\s*\(全本.*?\)', '', s).strip()
    s = re.sub(r'\s*【.*?】', '', s).strip()
    s = re.sub(r'\s*\+.*?番外.*$', '', s).strip()
    return s

def extract_author_from_name(s):
    if not s: return ''
    for p in AUTHOR_PATTERNS:
        m = p.search(s)
        if m:
            author = m.group(1).strip()
            # 清理末尾的非作者字符: .修改 .新修改 .番外 等
            author = re.sub(r'[.。]\s*(新?修[改订正]|番外|全本|完结|精校).*$', '', author)
            # 剥掉文件扩展名 — 否则 "作者：音清纯.txt" 会把 author 抠成 "音清纯.txt"
            author = re.sub(r'\.(txt|epub|mobi|azw3?|pdf|fb2|html?|htm)$',
                            '', author, flags=re.IGNORECASE)
            author = author.strip('.。 ')
            return author
    return ''

def detect_genres_from_name(name, existing_genres=None):
    """从书名/文件名中识别可能的体裁标签"""
    found = set(existing_genres or [])
    s = name.lower() if name else ''
    for genre, hints in GENRE_HINTS.items():
        if genre in found: continue
        for h in hints:
            if h.lower() in s:
                found.add(genre)
                break
    return list(found)

def compute_quality_score(name, size):
    """评分: 文件名信号 + 大小 (KB)"""
    score = 0
    for kw, pts in QUALITY_BONUS.items():
        if kw in name: score += pts
    for kw, pts in QUALITY_PENALTY.items():
        if kw in name: score += pts
    # 大小信号: 100KB 起步, 每 100KB +1, 上限 +50
    score += min(50, max(0, (size // 102400)))
    return score

def safe_filename(s, fallback='_unknown_'):
    """文件名安全化"""
    if not s: return fallback
    s = re.sub(r'[\\/:*?"<>|\n\r\t]', '_', s).strip().strip('.')
    return s[:120] or fallback


# ============================================================
# 编码检测 + 内容标准化 hash
# ============================================================
def detect_encoding(data_head: bytes) -> str:
    """简单编码检测: BOM / UTF-8 / GBK"""
    if data_head.startswith(b'\xef\xbb\xbf'): return 'utf-8-sig'
    if data_head.startswith(b'\xff\xfe'): return 'utf-16-le'
    if data_head.startswith(b'\xfe\xff'): return 'utf-16-be'
    try:
        data_head.decode('utf-8'); return 'utf-8'
    except UnicodeDecodeError:
        pass
    try:
        data_head.decode('gbk'); return 'gbk'
    except UnicodeDecodeError:
        pass
    return 'unknown'

def content_fingerprint(path: Path, ext: str) -> tuple:
    """
    返回 (raw_hash, content_hash, encoding, word_count_approx)
    raw_hash: 原文件 SHA-256
    content_hash: 标准化后内容的 SHA-256 (txt) 或 raw_hash (其他格式)
    """
    raw_hash = hashlib.sha256()
    size = 0
    with open(path, 'rb') as f:
        while True:
            chunk = f.read(64 * 1024)
            if not chunk: break
            raw_hash.update(chunk)
            size += len(chunk)

    if ext != '.txt':
        # 非 txt 暂时不做内容归一化, 直接用原 hash
        return raw_hash.hexdigest(), raw_hash.hexdigest(), '', 0

    # 对 TXT 做内容标准化: 去 BOM, 统一换行, 去全部空白后 hash
    try:
        with open(path, 'rb') as f:
            head = f.read(8192)
        enc = detect_encoding(head)
        if enc == 'unknown':
            return raw_hash.hexdigest(), raw_hash.hexdigest(), 'unknown', 0

        norm_hash = hashlib.sha256()
        word_count = 0
        space_re = re.compile(r'\s+')
        with open(path, 'r', encoding=enc, errors='replace') as f:
            while True:
                chunk = f.read(64 * 1024)
                if not chunk: break
                normalized = space_re.sub('', chunk)
                norm_hash.update(normalized.encode('utf-8'))
                word_count += len(normalized)
        return raw_hash.hexdigest(), norm_hash.hexdigest(), enc, word_count
    except Exception:
        return raw_hash.hexdigest(), raw_hash.hexdigest(), 'error', 0


# ============================================================
# 数据库
# ============================================================
class Library:
    def __init__(self, root: Path):
        self.root = Path(root).expanduser().resolve()
        self.books_dir = self.root / 'books'
        self.quarantine = self.root / '_quarantine'
        self.logs_dir = self.root / '_logs'
        self.db_path = self.root / 'library.db'
        for d in (self.root, self.books_dir, self.quarantine,
                  self.quarantine / 'duplicates', self.quarantine / 'corrupted',
                  self.logs_dir):
            d.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        self.conn.execute('PRAGMA foreign_keys = ON')
        # WAL 模式: 写操作不会阻塞读, 而且断电/崩溃后能干净恢复.
        # synchronous=NORMAL 配 WAL 是性能与安全的常见平衡 (commit 时不强制 fsync,
        # 但 checkpoint 时会). 整个 import 任务里我们每 100 条 commit, 即使 OS 崩溃
        # 最差也只丢最近未 checkpoint 的几百条, 而所有显式 commit 过的事务都保得住.
        self.conn.execute('PRAGMA journal_mode = WAL')
        self.conn.execute('PRAGMA synchronous = NORMAL')
        # 维护任务在另一条连接里写库时，搜索等读操作偶尔会撞上锁；给 8 秒等待而不是直接报错失败。
        self.conn.execute('PRAGMA busy_timeout = 8000')
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    def close(self):
        self.conn.commit()
        self.conn.close()

    # ---- 标签 ----
    def get_or_create_tag(self, name, kind='tag'):
        name = name.strip()
        if not name: return None
        cur = self.conn.execute('SELECT id FROM tags WHERE name = ?', (name,))
        r = cur.fetchone()
        if r: return r['id']
        cur = self.conn.execute(
            'INSERT INTO tags (name, kind) VALUES (?, ?)', (name, kind))
        return cur.lastrowid

    def tag_book(self, book_id, tag_names, kind='tag'):
        for n in tag_names:
            tid = self.get_or_create_tag(n, kind)
            if tid:
                self.conn.execute(
                    'INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)',
                    (book_id, tid))

    # ---- 查询 ----
    def find_by_raw_hash(self, h):
        return self.conn.execute('SELECT * FROM books WHERE raw_hash = ?', (h,)).fetchone()

    def find_by_content_hash(self, h):
        return self.conn.execute('SELECT * FROM books WHERE content_hash = ?', (h,)).fetchall()

    def find_by_title_author(self, title, author):
        return self.conn.execute(
            'SELECT * FROM books WHERE title = ? AND author = ?',
            (title, author)).fetchall()

    def log(self, action, file_name, source_path='', detail=''):
        self.conn.execute(
            'INSERT INTO import_log (timestamp, source_path, action, file_name, detail) '
            'VALUES (?, ?, ?, ?, ?)',
            (datetime.now().isoformat(timespec='seconds'),
             source_path, action, file_name, detail))


# ============================================================
# Mrpro 备份读取
# ============================================================
def read_mrpro(mrpro_path):
    """从 .mrpro 备份提取 books/notes/statistics"""
    mrpro = Path(mrpro_path)
    if not mrpro.exists() or not zipfile.is_zipfile(mrpro):
        return {'books': [], 'notes': [], 'stats': []}
    with tempfile.TemporaryDirectory() as tmpd:
        with zipfile.ZipFile(mrpro) as z:
            z.extractall(tmpd)
        names = (Path(tmpd) / 'com.flyersoft.moonreaderp' / '_names.list').read_text(encoding='utf-8').splitlines()
        db_idx = next((i for i, n in enumerate(names, 1) if n.endswith('/mrbooks.db')), None)
        if db_idx is None: return {'books': [], 'notes': [], 'stats': []}
        db = sqlite3.connect(str(Path(tmpd) / 'com.flyersoft.moonreaderp' / f'{db_idx}.tag'))
        db.row_factory = sqlite3.Row
        books = []
        for idx, r in enumerate(db.execute('SELECT * FROM books')):
            cats = [c.strip() for c in (r['category'] or '').split('\n')
                    if c.strip() and c.strip() not in NON_CATEGORIES]
            genres = [c for c in cats if c in KNOWN_GENRES]
            author_tags = [c for c in cats if c not in KNOWN_GENRES]
            m = re.search(r'/作者/([^/]+)/', r['filename'] or '')
            author = (m.group(1) if m
                      else extract_author_from_name(r['book'])
                      or (author_tags[0] if author_tags else ''))
            books.append({
                '_idx': idx,
                'basename': Path(r['filename']).name if r['filename'] else '',
                'title': extract_title(r['book']),
                'raw_title': r['book'] or '',
                'author': author,
                'genres': genres,
                'tags': author_tags,
                'favorite': r['favorite'] or '',
                'filename': r['filename'] or '',
            })
        notes = [dict(r) for r in db.execute('SELECT * FROM notes')]
        stats = [dict(r) for r in db.execute('SELECT * FROM statistics')]
        db.close()
        return {'books': books, 'notes': notes, 'stats': stats}


# ============================================================
# 重复决策
# ============================================================
@dataclass
class FileCandidate:
    """待入库的候选文件"""
    src_path: Path
    name: str
    size: int
    ext: str
    title: str = ''
    author: str = ''
    genres: list = field(default_factory=list)
    tags: list = field(default_factory=list)
    raw_hash: str = ''
    content_hash: str = ''
    encoding: str = ''
    word_count: int = 0
    quality: int = 0
    source: str = ''
    favorite: str = ''
    mrpro_match: dict = None

    def fill_hash(self, lib: 'Library' = None) -> bool:
        """计算 hash. 如果传入 lib, 优先查 hash_cache; 算完后写回缓存.

        命中缓存的条件: 同 src_path + 同 size + 同 mtime. 这三者一起足以判定
        文件没改过 (rsync/zsync 标准做法), 比重新读几 MB 算 SHA-256 快几个量级.

        返回: True 表示缓存命中没读盘, False 表示真算了 (用于统计).
        """
        if lib is not None and self._try_fill_from_cache(lib):
            return True
        rh, ch, enc, wc = content_fingerprint(self.src_path, self.ext)
        self.raw_hash, self.content_hash, self.encoding, self.word_count = rh, ch, enc, wc
        if lib is not None:
            self._write_cache(lib)
        return False

    def _try_fill_from_cache(self, lib) -> bool:
        """缓存命中则填字段并返回 True; 未命中或文件不可读返回 False."""
        try:
            st = self.src_path.stat()
        except OSError:
            return False
        try:
            row = lib.conn.execute(
                'SELECT raw_hash, content_hash, encoding, word_count, mtime, size '
                'FROM hash_cache WHERE src_path = ?',
                (str(self.src_path),)
            ).fetchone()
        except sqlite3.Error:
            return False
        if not row:
            return False
        # 大小或 mtime 变了 → 文件被改过 → 缓存失效
        if row['size'] != st.st_size or row['mtime'] != int(st.st_mtime):
            return False
        self.raw_hash = row['raw_hash']
        self.content_hash = row['content_hash']
        self.encoding = row['encoding'] or ''
        self.word_count = row['word_count'] or 0
        return True

    def _write_cache(self, lib) -> None:
        """把刚算出来的 hash 写进缓存. 失败安静吞掉 — 缓存只是加速, 不影响正确性."""
        try:
            st = self.src_path.stat()
            lib.conn.execute(
                'INSERT OR REPLACE INTO hash_cache '
                '(src_path, size, mtime, raw_hash, content_hash, encoding, word_count, cached_at) '
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                (str(self.src_path), st.st_size, int(st.st_mtime),
                 self.raw_hash, self.content_hash, self.encoding, self.word_count,
                 datetime.now().isoformat(timespec='seconds'))
            )
        except (OSError, sqlite3.Error):
            pass

    def fill_quality(self):
        self.quality = compute_quality_score(self.name, self.size)


def decide_dup(lib: Library, cand: FileCandidate):
    """
    返回 (decision, primary_book_row)
    decision ∈ {'new', 'exact_dup', 'content_dup_keep_old', 'content_dup_replace',
                'similar_keep_old', 'similar_replace'}
    """
    # 1. 完全相同的文件 (raw_hash)
    same_raw = lib.find_by_raw_hash(cand.raw_hash)
    if same_raw:
        return 'exact_dup', same_raw

    # 2. 内容相同 (content_hash, TXT 标准化后)
    if cand.ext == '.txt' and cand.content_hash and cand.content_hash != cand.raw_hash:
        same_content = lib.find_by_content_hash(cand.content_hash)
        if same_content:
            # 比较质量: 优先文件更大的
            old = max(same_content, key=lambda r: (r['quality_score'], r['file_size']))
            if cand.quality > old['quality_score'] or cand.size > old['file_size'] * 1.02:
                return 'content_dup_replace', old
            return 'content_dup_keep_old', old

    # 3. 相似 (标题+作者一致, 大小接近)
    if cand.title:
        similar = lib.find_by_title_author(cand.title, cand.author)
        if similar:
            for old in similar:
                ratio = cand.size / max(old['file_size'], 1)
                if 0.95 <= ratio <= 1.05:
                    # 文件大小差 < 5% 算同一版本
                    if cand.quality > old['quality_score']:
                        return 'similar_replace', old
                    return 'similar_keep_old', old
                if ratio > 1.10:
                    # 新文件大不少, 可能含更完整内容
                    return 'similar_replace', old
            # 都不像, 当新书入库
    return 'new', None


# ============================================================
# 解压
# ============================================================
# 常见 zip 密码 (从资源站/合集类压缩包常用的密码总结)
# 按命中频率排序, 命中后该密码在当前 zip 内会被记住, 减少重复尝试
COMMON_ZIP_PASSWORDS = [
    b'1',
    b'123',
    b'1234',
    b'12345',
    b'123456',
    b'paopao',
    b'PAOPAO',
    b'pao',
    b'wenku',
    b'taoxiaoshuo',
    b'xiaoshuo',
    b'love',
    b'admin',
    b'a',
    b'0',
]


def extract_archive(archive_path: Path, dest: Path) -> list:
    """
    解压 zip 到 dest, 返回解压出的所有小说文件路径
    遇到加密文件时, 自动尝试一个常见密码字典 (1/123/1234/paopao 等).
    rar/7z 暂时跳过 (需要外部工具)
    """
    extracted = []
    ext = archive_path.suffix.lower()
    if ext != '.zip':
        return []  # 暂不支持 rar/7z
    # 记住本 zip 已经成功的密码, 避免每个文件都暴破一轮
    learned_pwd: Optional[bytes] = None
    try:
        with zipfile.ZipFile(archive_path) as z:
            for info in z.infolist():
                if info.is_dir(): continue
                # 修正中文文件名编码
                # ZIP 规范: flag bit 11 = 1 表示 UTF-8; 否则常见为 CP437(伪) 或 GBK
                name = info.filename
                if not (info.flag_bits & 0x800):
                    # 文件名其实是被错误地以 cp437 解码的字节序列
                    try:
                        raw = name.encode('cp437')
                        # 优先尝试 GBK (中文常见)
                        for enc in ('gbk', 'gb18030', 'utf-8', 'big5'):
                            try:
                                name = raw.decode(enc)
                                break
                            except UnicodeDecodeError:
                                continue
                    except (UnicodeEncodeError, UnicodeDecodeError):
                        pass
                inner_ext = Path(name).suffix.lower()
                if inner_ext in NOVEL_EXTS:
                    out_path = dest / safe_filename(Path(name).name)
                    # 防覆盖
                    counter = 1
                    base = out_path.stem
                    while out_path.exists():
                        out_path = dest / f"{base}_{counter}{out_path.suffix}"
                        counter += 1
                    # 是否加密
                    is_encrypted = bool(info.flag_bits & 0x1)
                    pwd_to_try: Optional[bytes] = learned_pwd if is_encrypted else None
                    extracted_ok = False
                    try:
                        with z.open(info, pwd=pwd_to_try) as src, open(out_path, 'wb') as dst:
                            shutil.copyfileobj(src, dst)
                        extracted.append(out_path)
                        extracted_ok = True
                    except (RuntimeError, NotImplementedError) as e:
                        emsg = str(e).lower()
                        # 不支持的压缩算法 (如 AES compress_type=99) - 跳过, 无法处理
                        if 'compression' in emsg or 'unsupported' in emsg:
                            print(f'    ⏭ 跳过 {Path(name).name} (不支持的压缩格式)')
                            try:
                                if out_path.exists(): out_path.unlink()
                            except OSError: pass
                            continue
                        # 加密 + 密码错/没密码 - 试字典
                        if 'encrypted' in emsg or 'bad password' in emsg or 'password' in emsg:
                            try:
                                if out_path.exists(): out_path.unlink()
                            except OSError: pass
                            # 试常见密码
                            for pwd in COMMON_ZIP_PASSWORDS:
                                if pwd == learned_pwd:
                                    continue  # 上面已经试过了
                                try:
                                    with z.open(info, pwd=pwd) as src, \
                                         open(out_path, 'wb') as dst:
                                        shutil.copyfileobj(src, dst)
                                    extracted.append(out_path)
                                    extracted_ok = True
                                    if learned_pwd != pwd:
                                        learned_pwd = pwd
                                        print(f'    🔑 用密码 {pwd.decode("utf-8", "replace")!r} '
                                              f'解开 {archive_path.name}')
                                    break
                                except (RuntimeError, zipfile.BadZipFile):
                                    try:
                                        if out_path.exists(): out_path.unlink()
                                    except OSError: pass
                                    continue
                                except Exception:
                                    try:
                                        if out_path.exists(): out_path.unlink()
                                    except OSError: pass
                                    break
                            if not extracted_ok:
                                print(f'    ⏭ 跳过 {Path(name).name} '
                                      f'(加密, 字典里没有正确密码)')
                            continue
                        # 其他 RuntimeError
                        print(f'    ⏭ 跳过 {Path(name).name} ({type(e).__name__})')
                        try:
                            if out_path.exists(): out_path.unlink()
                        except OSError: pass
                    except OSError as e:
                        # 写入失败 (磁盘满? 路径过长?) - 跳过但记录
                        print(f'    ⚠ 写入失败 {Path(name).name}: {e}')
                        try:
                            if out_path.exists(): out_path.unlink()
                        except OSError: pass
    except (zipfile.BadZipFile, OSError) as e:
        print(f'  ⚠️ 解压失败 {archive_path.name}: {e}')
    except Exception as e:
        # 兜底: 一个 zip 出意外不应该崩溃整个 import
        print(f'  ⚠️ 解压异常 {archive_path.name}: {type(e).__name__}: {e}')
    return extracted


# ============================================================
# 启动清理: 处理上次中断遗留的孤儿文件
# ============================================================
def _discover_old_orphan_dirs(lib: Library) -> list:
    """扫 lib.root.parent, 找之前 import 留下的 _mylib_orphans_<时间戳> 目录.

    场景: 上次 import 在 phase 3 中断 → 这次启动时 _cleanup_orphans_at_start 把
    新孤儿挪到了一个新的 _mylib_orphans_* 目录. 但 *更早* 的 _mylib_orphans_* 目录
    可能还在 (用户上一次中断时建的, 那次重跑又中断, 它就一直留着没人管).

    把它们当成源加进去, 这样下一轮 import 会顺手把它们全 hash 一遍, 已入库的会
    exact_dup 入账 (零成本), 没入库的真正补进库. 跑完后这些目录就能放心删了.
    """
    parent = lib.root.parent
    if not parent.exists():
        return []
    found = []
    for d in parent.iterdir():
        if not d.is_dir():
            continue
        if not d.name.startswith('_mylib_orphans_'):
            continue
        # 至少要有一个文件才有意义 (空目录跳过, 避免列表里全是壳)
        try:
            has_file = any(p.is_file() for p in d.rglob('*'))
        except OSError:
            continue
        if has_file:
            found.append(d)
    return found


def _cleanup_orphans_at_start(lib: Library, verbose: bool = True) -> Optional[Path]:
    """检测并隔离孤儿文件 — books/ 或 _quarantine/duplicates/ 里有但 DB 不认识的文件.

    这种文件唯一的来源是: 上次 import 跑到一半被中断 (Ctrl+C / 异常 / 断电),
    文件已经 shutil.copy2/move 到目标位置, 但 SQLite 事务还没 commit 就退出了 → 回滚后
    DB 不知道它们存在, 但文件实实在在留在了图书馆目录里.

    处理方式: 移到 lib.root.parent/_mylib_orphans_<timestamp>/, 保留 books/作者/某书.txt
    这样的相对结构方便审计. 然后 scan_and_import 把这个目录加进 source_paths,
    后续 phase 1-3 会把它们当成普通源处理 — hash 去重会自动把它们和原源里的副本合并.

    没有孤儿则返回 None, 主流程不受影响.
    """
    try:
        db_book_paths = {row['file_path'] for row in lib.conn.execute(
            'SELECT file_path FROM books')}
        db_dup_paths = {row['dup_path'] for row in lib.conn.execute(
            "SELECT dup_path FROM duplicates WHERE dup_path != ''")}
    except sqlite3.Error:
        return None

    orphans: list[Path] = []

    if lib.books_dir.exists():
        for p in lib.books_dir.rglob('*'):
            if not p.is_file():
                continue
            try:
                rel = str(p.relative_to(lib.root)).replace('\\', '/')
            except ValueError:
                continue
            if rel not in db_book_paths:
                orphans.append(p)

    quar_dups = lib.quarantine / 'duplicates'
    if quar_dups.exists():
        for p in quar_dups.rglob('*'):
            if not p.is_file():
                continue
            if str(p) not in db_dup_paths:
                orphans.append(p)

    if not orphans:
        return None

    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    recovery_root = lib.root.parent / f'_mylib_orphans_{ts}'

    if verbose:
        print(f'\n🧹 启动清理: 发现 {len(orphans)} 个孤儿文件')
        print(f'   (上次中断时已搬到 books/ 或 _quarantine/, 但 DB 没记账)')
        print(f'   先隔离到: {recovery_root}')
        print(f'   再作为源重新扫描入库, hash 去重负责合并 — 你不用动手')

    moved = 0
    failed = 0
    for p in orphans:
        try:
            rel = p.relative_to(lib.root)
            dest = recovery_root / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(p), str(dest))
            moved += 1
        except (OSError, ValueError) as e:
            failed += 1
            if verbose and failed <= 5:
                print(f'   ⚠️ 移走 {p.name} 失败: {e}')

    # 清空作者目录 / 副本目录里残留的空文件夹
    for base in (lib.books_dir, lib.quarantine / 'duplicates'):
        if not base.exists():
            continue
        subs = sorted((s for s in base.rglob('*') if s.is_dir()),
                      key=lambda x: -len(x.parts))
        for sub in subs:
            try:
                sub.rmdir()  # 只删空的
            except OSError:
                pass

    if verbose:
        if failed:
            print(f'   ✓ 完成: 隔离 {moved} 个, {failed} 个移动失败 (留原位, 不影响后续)')
        else:
            print(f'   ✓ 完成: {moved} 个孤儿已隔离')

    return recovery_root


# ============================================================
# 扫描入库主流程
# ============================================================
def scan_and_import(lib: Library, source_paths: list, mrpro_path: Optional[Path] = None,
                    move: bool = False, dry_run: bool = False,
                    skip_archives: bool = False,
                    cleanup_orphans: bool = True) -> dict:
    """
    主入口: 扫描多个源目录, 解压, 去重, 入库
    - skip_archives: 跳过所有压缩包 (不解压, 不导入). 适合磁盘空间紧张时.
                     压缩包留在原位, 以后可以单独跑 import 处理.
    - cleanup_orphans: 启动时自动检测并隔离上次中断遗留的孤儿文件 (默认开).
                       会移到 lib.root.parent/_mylib_orphans_<时间戳>/, 然后作为源
                       重新扫描, hash 去重负责合并回库. 想跳过传 False.
    返回统计结果
    """
    # === 阶段 0: 启动清理 ===
    # 检测并隔离上次中断遗留的孤儿文件 (books/ 或 _quarantine/duplicates/ 里
    # 有但 DB 不认的文件 — 一定是上次事务未 commit 时遗留的副本).
    # dry_run 模式不做实际移动.
    if cleanup_orphans and not dry_run:
        orphan_recovery_dir = _cleanup_orphans_at_start(lib)
        if orphan_recovery_dir is not None:
            source_paths = list(source_paths) + [str(orphan_recovery_dir)]
        # 顺手把 lib.root.parent 下所有遗留的 _mylib_orphans_* 都加进来 —
        # 不止这一次新发现的, 也包括之前几次中断累积下来的. 不加进来它们就成了
        # 永远的死库存. 加进来后, 跑完一轮 stats 看着没问题就能整个删掉.
        old_orphan_dirs = _discover_old_orphan_dirs(lib)
        # 排除刚才那个新建的, 避免重复加
        new_dir_resolved = orphan_recovery_dir.resolve() if orphan_recovery_dir else None
        for d in old_orphan_dirs:
            if new_dir_resolved is not None and d.resolve() == new_dir_resolved:
                continue
            source_paths = list(source_paths) + [str(d)]
            print(f'   📂 自动追加上次遗留的孤儿目录: {d.name}')

    # 加载 mrpro 备份用于元数据补全
    mrpro_data = read_mrpro(mrpro_path) if mrpro_path else {'books': [], 'notes': [], 'stats': []}

    # 建多重索引: basename, title, (title, author)
    mrpro_by_basename = {}
    mrpro_by_title = {}
    mrpro_by_title_author = {}
    for b in mrpro_data['books']:
        if b['basename']:
            mrpro_by_basename.setdefault(b['basename'].lower(), []).append(b)
        if b['title']:
            t = b['title'].lower().strip()
            mrpro_by_title.setdefault(t, []).append(b)
            if b['author']:
                mrpro_by_title_author[(t, b['author'].lower().strip())] = b

    print(f'\n📚 开始扫描 ({len(source_paths)} 个源)')
    if mrpro_data['books']:
        print(f'   已加载 mrpro 备份: {len(mrpro_data["books"])} 条元数据')

    # === 阶段 1: 收集所有候选文件 (含解压) ===
    print(f'\n[1/3] 收集文件...')
    temp_extract = lib.root / '_temp_extract'
    # 上次硬崩溃 / OOM 重启 / 强制关机时 atexit 是不跑的, _temp_extract 里会留下
    # 几十 GB 解压残骸 (一个 zip 多本书, 34000+ 压缩包 = 80+ GB 不夸张). 启动时
    # 主动清, 不指望进程"正常退出".
    if temp_extract.exists():
        try:
            sample = next(temp_extract.iterdir(), None)
        except OSError:
            sample = None
        if sample is not None:
            print(f'   🧹 清理上次 _temp_extract 残留 (可能要几分钟, 几十万小文件)...')
            shutil.rmtree(temp_extract, ignore_errors=True)
    temp_extract.mkdir(parents=True, exist_ok=True)
    # 仍然挂 atexit 作为"正常退出"路径的兜底
    atexit.register(lambda: shutil.rmtree(temp_extract, ignore_errors=True))
    # 用于防自循环: 扫描时跳过任何在 lib.root 子树里的文件
    lib_root_resolved = lib.root.resolve()

    # 预加载 books 表里的 raw_hash 集合 — 用于 archive_cache 命中判断
    # (zip 缓存说"这个 zip 解压出来的所有 hash 都在 books 里" → 跳过解压)
    # 130k 个 SHA-256 字符串 ≈ 10 MB 内存, 完全可控.
    print(f'   📚 加载 books raw_hash 索引 (用于 archive_cache 检查)...')
    books_hashes_known = set()
    for r in lib.conn.execute('SELECT raw_hash FROM books'):
        books_hashes_known.add(r['raw_hash'])
    print(f'   ✓ {len(books_hashes_known)} 个唯一 raw_hash')

    candidates = []
    archive_count = 0
    archive_cache_skipped = 0      # 多少个 zip 因 cache 命中跳过
    archive_cache_skipped_files = 0  # 这些 zip 一共多少本书 (没解, 没占临时空间)
    # 记录每个新解压的 zip 跟它产出的 candidate index — 阶段 2 算完 hash 后写缓存
    zip_to_cand_indices = {}
    for src_root in source_paths:
        src_root = Path(src_root).expanduser().resolve()
        if not src_root.exists():
            print(f'   ⚠️ 跳过 {src_root}: 不存在')
            continue
        # 源目录本身就是 lib.root 或在其下 → 整个跳过
        try:
            src_root.relative_to(lib_root_resolved)
            print(f'   ⚠️ 跳过 {src_root}: 在图书馆内部, 防止自循环')
            continue
        except ValueError:
            pass
        print(f'   扫描 {src_root}...')
        for p in src_root.rglob('*'):
            if not p.is_file(): continue
            # 防御性: 即使源在 lib.root 之外, rglob 可能跟入符号链接进到库里
            try:
                p.resolve().relative_to(lib_root_resolved)
                continue   # 这个文件在图书馆里, 跳过
            except (ValueError, OSError):
                pass
            ext = p.suffix.lower()
            if ext in NOVEL_EXTS:
                # 跳过明显不是书的文件 (license/readme/changelog 等)
                if _is_obvious_non_novel(p):
                    continue
                candidates.append(FileCandidate(
                    src_path=p, name=p.stem, size=p.stat().st_size, ext=ext,
                    source=src_root.name,
                ))
            elif ext == '.zip':
                if skip_archives:
                    continue

                # 查 archive_cache: 这个 zip 之前解过吗? 当时状态跟现在一样吗?
                # 如果一样, 而且它解出来的 hash 全在 books 里 → 跳过解压.
                try:
                    zip_stat = p.stat()
                    zip_path_str = str(p)
                    cache_row = lib.conn.execute(
                        'SELECT raw_hashes_json FROM archive_cache '
                        'WHERE zip_path=? AND zip_size=? AND zip_mtime=?',
                        (zip_path_str, zip_stat.st_size,
                         int(zip_stat.st_mtime))).fetchone()
                    if cache_row:
                        cached_hashes = json.loads(cache_row['raw_hashes_json'])
                        if cached_hashes and all(h in books_hashes_known
                                                  for h in cached_hashes):
                            archive_cache_skipped += 1
                            archive_cache_skipped_files += len(cached_hashes)
                            if archive_cache_skipped % 500 == 0:
                                print(f'   📦 跳过缓存命中 zip {archive_cache_skipped} 个 '
                                      f'(累计省解 {archive_cache_skipped_files} 本)')
                            continue
                except (OSError, sqlite3.Error, ValueError, KeyError):
                    pass  # 缓存查询失败不致命, 走常规路径

                archive_count += 1
                extract_dest = temp_extract / f'{archive_count}_{safe_filename(p.stem)}'
                extract_dest.mkdir(parents=True, exist_ok=True)
                extracted = extract_archive(p, extract_dest)
                print(f'   📦 {p.name} → 解压 {len(extracted)} 本')
                this_zip_indices = []
                for ep in extracted:
                    if _is_obvious_non_novel(ep):
                        continue
                    candidates.append(FileCandidate(
                        src_path=ep, name=ep.stem,
                        size=ep.stat().st_size, ext=ep.suffix.lower(),
                        source=f'{src_root.name}/{p.name}',
                    ))
                    this_zip_indices.append(len(candidates) - 1)
                if this_zip_indices:
                    zip_to_cand_indices[str(p)] = this_zip_indices

    print(f'   共发现 {len(candidates)} 本候选 (新解 {archive_count} 个 zip)')
    if archive_cache_skipped:
        print(f'   ⚡ archive_cache 命中 {archive_cache_skipped} 个 zip '
              f'(省解 {archive_cache_skipped_files} 本, 这些内容已在库里)')

    # === 阶段 2: 解析元数据 + 计算 hash ===
    print(f'\n[2/3] 解析元数据并计算指纹...')
    print(f'   (启用 hash_cache: 已算过的源文件直接读缓存, 中断重跑省事)')
    matched_count = 0
    matched_mrpro_idxs = set()  # 哪些 mrpro 备份里的书在电脑上找到了
    cache_hits = 0
    # 候选少于 2000 时每 50 条一行 (像以前一样); 多了减到每 1000 条, 不刷屏
    phase2_step = 50 if len(candidates) < 2000 else 1000
    for i, c in enumerate(candidates, 1):
        if i % phase2_step == 0:
            print(f'   进度 {i}/{len(candidates)} (缓存命中 {cache_hits})...')
        # 每 100 条 commit 一次缓存写入, 让 hash 工作持续落盘.
        # 任何时候硬中断, 已 commit 的部分下次重跑都能直接读, 不再读盘算 SHA-256.
        if i % 100 == 0:
            try:
                lib.conn.commit()
            except sqlite3.Error:
                pass

        # 基础解析
        c.title = extract_title(c.name) or c.name
        c.author = extract_author_from_name(c.name)

        # 路径推断作者 (类似 /作者/X/file.txt)
        path_str = str(c.src_path)
        if not c.author:
            m = re.search(r'[/\\]作者[/\\]([^/\\]+)[/\\]', path_str)
            if m:
                c.author = m.group(1).strip()

        # ===== mrpro 多层级匹配 =====
        mp_match = None
        # 层1: 完全文件名匹配
        mp_list = mrpro_by_basename.get(c.src_path.name.lower(), [])
        if mp_list:
            mp_match = mp_list[0]
        # 层2: title + author
        if not mp_match and c.title and c.author:
            mp_match = mrpro_by_title_author.get((c.title.lower().strip(),
                                                  c.author.lower().strip()))
        # 层3: title 唯一
        if not mp_match and c.title:
            cands = mrpro_by_title.get(c.title.lower().strip(), [])
            if len(cands) == 1:
                mp_match = cands[0]
            elif len(cands) > 1 and c.author:
                # 多个候选, 找作者最相近的
                for mp in cands:
                    if mp['author'] and c.author and c.author in mp['author']:
                        mp_match = mp; break
                if not mp_match: mp_match = cands[0]

        if mp_match:
            matched_count += 1
            matched_mrpro_idxs.add(mp_match['_idx'])
            c.mrpro_match = mp_match
            if not c.author: c.author = mp_match['author']
            c.genres = list(mp_match['genres'])
            c.tags = list(mp_match['tags'])
            c.favorite = mp_match['favorite']
            # 使用 mrpro 的干净标题
            if mp_match['title'] and mp_match['title'] != c.title:
                c.title = mp_match['title']

        # 再从文件名补一些体裁
        c.genres = detect_genres_from_name(c.name, c.genres)
        # hash + 质量评分 (hash 走缓存, 返回 True 表示命中没读盘)
        if c.fill_hash(lib):
            cache_hits += 1
        c.fill_quality()

    # phase 2 全部跑完, 把这一轮的缓存写入一次性 commit, 确保全部落盘.
    try:
        lib.conn.commit()
    except sqlite3.Error:
        pass

    if mrpro_data['books']:
        print(f'   mrpro 匹配: {matched_count}/{len(candidates)}')
    if cache_hits > 0:
        pct = cache_hits * 100 / len(candidates) if candidates else 0
        print(f'   hash_cache 命中: {cache_hits}/{len(candidates)} ({pct:.1f}%) — '
              f'省了这些文件的 SHA-256 重算')

    # 把这次新解的 zip 写进 archive_cache, 下次重跑时这些 zip 整体跳过.
    # 只有"hash 算出来了"的 candidate 才进缓存 (raw_hash 非空).
    archive_cache_written = 0
    for zip_path_str, cand_indices in zip_to_cand_indices.items():
        try:
            hashes = [candidates[i].raw_hash for i in cand_indices
                      if 0 <= i < len(candidates) and candidates[i].raw_hash]
            if not hashes:
                continue
            zip_stat = Path(zip_path_str).stat()
            lib.conn.execute(
                'INSERT OR REPLACE INTO archive_cache '
                '(zip_path, zip_size, zip_mtime, raw_hashes_json, cached_at) '
                'VALUES (?, ?, ?, ?, ?)',
                (zip_path_str, zip_stat.st_size, int(zip_stat.st_mtime),
                 json.dumps(hashes),
                 datetime.now().isoformat(timespec='seconds')))
            archive_cache_written += 1
        except (OSError, sqlite3.Error, ValueError):
            pass
    if archive_cache_written:
        lib.conn.commit()
        print(f'   📦 archive_cache 写入 {archive_cache_written} 个 zip 的解压清单 '
              f'(下次重跑这些 zip 自动跳过)')

    # mrpro 索引在 phase 3 不再用到, 提前释放; 候选数 22 万级时这部分能省几十 MB
    del mrpro_by_basename, mrpro_by_title, mrpro_by_title_author

    # === 阶段 3: 去重决策 + 入库 ===
    print(f'\n[3/3] 去重并入库...')
    print(f'   (Ctrl+C 会让本批次跑完再退出, 连按两次立即退出)')
    stats = Counter()
    quarantine_dups = lib.quarantine / 'duplicates'

    # 优雅中断: 第一次 SIGINT 标记后让循环跑完当前迭代再 break, 不丢未 commit 的活;
    # 第二次 SIGINT 真正 sys.exit. 退出时恢复原 handler, 避免污染调用方.
    interrupted = {'flag': False}
    def _handle_sigint(signum, frame):
        if interrupted['flag']:
            print('\n\n💀 二次中断, 立即退出 (本批次未 commit 的会丢失)')
            sys.exit(130)
        interrupted['flag'] = True
        print('\n\n⚠️ 收到中断信号, 跑完当前文件后会退出. 再按一次 Ctrl+C 立即退.')

    # v4.5.0：signal 只允许在主线程注册——网页管理页的「开始入库」跑在服务的工作线程里，
    # 直接注册会抛 ValueError 让整个任务炸掉。非主线程跳过注册（Ctrl+C 优雅中断本来就只属于命令行）。
    import threading as _threading
    _in_main = _threading.current_thread() is _threading.main_thread()
    _orig_handler = signal.signal(signal.SIGINT, _handle_sigint) if _in_main else None

    try:
        for i, c in enumerate(candidates, 1):
            if interrupted['flag']:
                print(f'\n   中断退出. 已处理 {i-1}/{len(candidates)}, '
                      f'commit 已保存 (新 {stats["new"]}, 重复 {stats["dup"]})')
                break
            if i % 100 == 0:
                print(f'   进度 {i}/{len(candidates)} (新 {stats["new"]}, 重复 {stats["dup"]})')
                # commit 频率从原来的每 500 改成每 100 — 配合 WAL 几乎零成本,
                # 但崩溃损失上限从 ~2 分钟降到 ~30 秒.
                try:
                    lib.conn.commit()
                except sqlite3.Error:
                    pass

            decision, old = decide_dup(lib, c)
            if dry_run:
                stats[decision] += 1
                continue

            try:
                if decision == 'new':
                    _insert_book(lib, c, move=move)
                    stats['new'] += 1
                elif decision == 'exact_dup':
                    # 字节完全相同 → books/ 里已有一份, 不需要再留隔离副本.
                    # move 模式: 直接删源; copy 模式: 源保留原位.
                    # 只在 duplicates 表里留一行案底, dup_path 留空表示"未保留实体".
                    if move and c.src_path.exists():
                        try:
                            c.src_path.unlink()
                        except OSError as e:
                            lib.log('failed_unlink', c.src_path.name, str(c.src_path), str(e))
                    lib.conn.execute('''
                        INSERT INTO duplicates (primary_book_id, dup_path, original_path,
                                                dup_size, dup_hash, reason, quarantine_time)
                        VALUES (?, '', ?, ?, ?, 'exact', ?)
                    ''', (old['id'], str(c.src_path), c.size, c.raw_hash,
                          datetime.now().isoformat(timespec='seconds')))
                    lib.log('skipped_dup', c.src_path.name, str(c.src_path),
                            f'exact dup of id={old["id"]}')
                    stats['exact_dup'] += 1; stats['dup'] += 1
                elif decision == 'content_dup_keep_old':
                    _record_dup(lib, c, old, quarantine_dups, 'content', move=move)
                    stats['content_dup'] += 1; stats['dup'] += 1
                elif decision == 'content_dup_replace':
                    _replace_book(lib, old, c, quarantine_dups, 'content', move=move)
                    stats['replaced'] += 1
                elif decision == 'similar_keep_old':
                    _record_dup(lib, c, old, quarantine_dups, 'similar', move=move)
                    stats['similar_dup'] += 1; stats['dup'] += 1
                elif decision == 'similar_replace':
                    _replace_book(lib, old, c, quarantine_dups, 'similar', move=move)
                    stats['replaced'] += 1
            except Exception as e:
                print(f'   ❌ {c.src_path.name}: {e}')
                lib.log('failed', c.src_path.name, str(c.src_path), str(e))
                stats['failed'] += 1

        lib.conn.commit()
    finally:
        # 恢复原 SIGINT handler, 不污染调用方（非主线程没注册过，跳过）
        if _in_main:
            signal.signal(signal.SIGINT, _orig_handler)

    # 中断了就不再做 phase 4 (笔记导入) 和 phase 5 (报告), 留给下一次重跑.
    if interrupted['flag']:
        print(f'\n⚠️ 本次 import 因中断未完整跑完, phase 4/5 跳过.')
        print(f'   重跑同一条命令, 孤儿清理 + hash_cache 会接着干, 不丢前面的工作.')
        result = dict(stats)
        result['_interrupted'] = 1   # 给调用方 (setup_wizard 等) 探测用
        return result

    # === 阶段 4: 导入笔记 ===
    if mrpro_data['notes'] and not dry_run:
        print(f'\n导入 mrpro 笔记和阅读统计...')
        nc, sc = import_notes(lib, mrpro_data['notes'], mrpro_data['stats'])
        print(f'   笔记: {nc} 条入库 / 阅读统计: {sc} 本书已更新')

    # 清理临时解压目录
    if temp_extract.exists():
        shutil.rmtree(temp_extract, ignore_errors=True)

    print(f'\n✅ 完成')
    print(f'   新入库:      {stats["new"]}')
    print(f'   完全重复:    {stats["exact_dup"]}')
    print(f'   内容重复:    {stats["content_dup"]}')
    print(f'   相似(保留旧): {stats["similar_dup"]}')
    print(f'   替换为更全版本: {stats["replaced"]}')
    print(f'   失败:        {stats["failed"]}')

    # === 阶段 5: 失而复得报告 ===
    # 拿你 .mrpro 备份对照本次扫描结果, 算出 "找回了 X / 仍缺 Y" 并出清单
    if mrpro_data['books'] and not dry_run:
        write_recovery_report(lib, mrpro_data['books'], matched_mrpro_idxs)

    return dict(stats)


def _insert_book(lib: Library, c: FileCandidate, move: bool):
    """实际把书放进 books/ 并入库"""
    author_dir = lib.books_dir / safe_filename(c.author or '_未知作者_')
    author_dir.mkdir(parents=True, exist_ok=True)
    dest = author_dir / safe_filename(c.src_path.name)
    counter = 1
    base = dest.stem
    while dest.exists():
        dest = author_dir / f'{base}_{counter}{dest.suffix}'
        counter += 1
    if move:
        shutil.move(str(c.src_path), str(dest))
    else:
        shutil.copy2(c.src_path, dest)
    rel_path = str(dest.relative_to(lib.root)).replace('\\', '/')

    mrpro = c.mrpro_match or {}
    cur = lib.conn.execute('''
        INSERT INTO books (title, author, raw_title, file_path, file_size, file_ext,
                           content_hash, raw_hash, encoding, word_count, quality_score,
                           import_time, source, mrpro_favorite, is_favorite)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        c.title, c.author, c.name, rel_path, c.size, c.ext,
        c.content_hash, c.raw_hash, c.encoding, c.word_count, c.quality,
        datetime.now().isoformat(timespec='seconds'), c.source,
        c.favorite, 1 if c.favorite else 0
    ))
    book_id = cur.lastrowid
    # 标签
    lib.tag_book(book_id, c.genres, kind='genre')
    lib.tag_book(book_id, c.tags, kind='tag')
    if c.favorite:
        lib.tag_book(book_id, [c.favorite], kind='shelf')
    lib.log('imported', c.src_path.name, str(c.src_path), f'as id={book_id}')


def _record_dup(lib: Library, c: FileCandidate, old_row, quarantine_dir: Path, reason: str, move: bool):
    """把副本挪到隔离区"""
    dup_dest = quarantine_dir / f'{old_row["id"]}_{safe_filename(c.src_path.name)}'
    counter = 1
    base = dup_dest.stem
    while dup_dest.exists():
        dup_dest = quarantine_dir / f'{base}_{counter}{dup_dest.suffix}'
        counter += 1
    original_src = str(c.src_path)
    if move:
        shutil.move(str(c.src_path), str(dup_dest))
    else:
        shutil.copy2(c.src_path, dup_dest)
    lib.conn.execute('''
        INSERT INTO duplicates (primary_book_id, dup_path, original_path,
                                dup_size, dup_hash, reason, quarantine_time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (old_row['id'], str(dup_dest), original_src,
          c.size, c.raw_hash, reason, datetime.now().isoformat(timespec='seconds')))
    lib.log('skipped_dup', c.src_path.name, original_src,
            f'dup of id={old_row["id"]} ({reason})')


def _replace_book(lib: Library, old_row, c: FileCandidate, quarantine_dir: Path, reason: str, move: bool):
    """新版本更全 → 把旧版本挪到隔离区, 新版本占据 books/ 位置"""
    old_full = lib.root / old_row['file_path']
    # 旧版本进隔离区, 防止文件名碰撞 (同 id 多次 replace, 或人为已有同名)
    dup_dest = quarantine_dir / f'{old_row["id"]}_OLD_{safe_filename(old_full.name)}'
    counter = 1
    base = dup_dest.stem
    while dup_dest.exists():
        dup_dest = quarantine_dir / f'{base}_{counter}{dup_dest.suffix}'
        counter += 1
    if old_full.exists():
        shutil.move(str(old_full), str(dup_dest))
    lib.conn.execute('''
        INSERT INTO duplicates (primary_book_id, dup_path, original_path,
                                dup_size, dup_hash, reason, quarantine_time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (old_row['id'], str(dup_dest), str(old_full),
          old_row['file_size'], old_row['raw_hash'],
          f'{reason}_replaced', datetime.now().isoformat(timespec='seconds')))
    # 新版本放进 books/
    author_dir = lib.books_dir / safe_filename(c.author or '_未知作者_')
    author_dir.mkdir(parents=True, exist_ok=True)
    dest = author_dir / safe_filename(c.src_path.name)
    counter = 1
    base = dest.stem
    while dest.exists():
        dest = author_dir / f'{base}_{counter}{dest.suffix}'
        counter += 1
    if move:
        shutil.move(str(c.src_path), str(dest))
    else:
        shutil.copy2(c.src_path, dest)
    rel_path = str(dest.relative_to(lib.root)).replace('\\', '/')
    lib.conn.execute('''
        UPDATE books SET file_path=?, file_size=?, raw_hash=?, content_hash=?,
                         quality_score=?, word_count=?, encoding=?
        WHERE id=?
    ''', (rel_path, c.size, c.raw_hash, c.content_hash, c.quality,
          c.word_count, c.encoding, old_row['id']))
    lib.log('replaced', c.src_path.name, str(c.src_path),
            f'replaced id={old_row["id"]} ({reason})')


def import_notes(lib: Library, mrpro_notes: list, mrpro_stats: list):
    """从 mrpro 数据导入笔记和阅读统计, 返回 (笔记数, 统计数).

    幂等: 先清掉之前从 mrpro 导入的笔记 (source='mrpro'), 再重新导入. 这样多次
    成功的 import 不会让 notes 表翻倍. 用户手写笔记 (source='manual') 不动.
    """
    # 清理上一轮 mrpro 笔记 (用户手写的不动)
    lib.conn.execute("DELETE FROM notes WHERE source = 'mrpro'")

    note_count = 0
    for n in mrpro_notes:
        if not (n.get('original') or n.get('bookmark') or n.get('note')):
            continue
        b_name = (n.get('book') or '').lower().strip()
        if not b_name: continue
        # 尝试多种匹配方式: 完整原标题、提取后的标题
        clean = extract_title(n.get('book') or '').lower().strip()
        row = lib.conn.execute('''
            SELECT id FROM books WHERE LOWER(raw_title) = ? OR LOWER(title) = ?
            OR LOWER(title) = ? OR LOWER(raw_title) = ?
            LIMIT 1
        ''', (b_name, b_name, clean, clean)).fetchone()
        if not row: continue
        try:
            t = datetime.fromtimestamp(int(n.get('time', 0)) / 1000).strftime('%Y-%m-%d %H:%M')
        except (ValueError, OSError, TypeError):
            t = ''
        lib.conn.execute('''
            INSERT INTO notes (book_id, chapter, position, original, my_note,
                               bookmark, note_time, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'mrpro')
        ''', (row['id'], n.get('lastChapter', 0), n.get('lastPosition', 0),
              n.get('original') or '', n.get('note') or '',
              n.get('bookmark') or '', t))
        note_count += 1

    stat_count = 0
    for s in mrpro_stats:
        b_name = Path(s['filename']).name.lower() if s['filename'] else ''
        if not b_name: continue
        clean = extract_title(b_name).lower()
        # LIKE 通配符转义: 防止 clean 里的 % / _ / \ 被当成模式字符
        if clean:
            clean_like = clean.replace('\\', r'\\').replace('%', r'\%').replace('_', r'\_')
            like_pattern = f'%{clean_like}%'
        else:
            like_pattern = b_name
        cur = lib.conn.execute('''
            UPDATE books SET mrpro_used_ms=?, mrpro_words=?, mrpro_days=?,
                             is_read = CASE WHEN ? > 0 THEN 1 ELSE is_read END
            WHERE LOWER(raw_title) LIKE ? ESCAPE '\\' OR LOWER(title) = ?
        ''', (s['usedTime'] or 0, s['readWords'] or 0,
              sum(1 for line in (s['dates'] or '').split('\n') if '|' in line),
              s['usedTime'] or 0,
              like_pattern, clean))
        stat_count += cur.rowcount

    lib.conn.commit()
    return note_count, stat_count


# ============================================================
# 失而复得报告
# ============================================================
def write_recovery_report(lib: Library, mrpro_books: list, matched_idxs: set) -> None:
    """
    对照 .mrpro 备份和本次扫描结果, 产出两份清单:
      - recovery_<date>.md   人类阅读 (找回 + 失踪)
      - missing_<date>.txt   纯文本失踪书单 (适合粘到搜索引擎/资源站)
    """
    total = len(mrpro_books)
    if total == 0:
        return
    recovered = [b for b in mrpro_books if b['_idx'] in matched_idxs]
    missing = [b for b in mrpro_books if b['_idx'] not in matched_idxs]

    print(f'\n📚 失而复得报告')
    print(f'   .mrpro 备份共: {total} 本')
    print(f'   电脑上找到了:  {len(recovered)} 本 ({len(recovered) * 100 / total:.1f}%)')
    print(f'   仍然失踪:      {len(missing)} 本')

    # === markdown 详细报告 ===
    date = datetime.now().strftime('%Y-%m-%d_%H%M')
    md_path = lib.logs_dir / f'recovery_{date}.md'
    lines = []
    lines.append(f'# 失而复得报告 — {date}\n')
    lines.append(f'对照 `.mrpro` 备份({total} 本)和本次扫描结果:\n')
    lines.append(f'- ✅ **找回**: {len(recovered)} 本 ({len(recovered) * 100 / total:.1f}%)')
    lines.append(f'- ❌ **失踪**: {len(missing)} 本\n')

    # ---- 找回的 (按收藏书架 + 体裁分组) ----
    lines.append(f'## ✅ 找回的 {len(recovered)} 本\n')
    if recovered:
        # 优先列出收藏的
        favs = [b for b in recovered if b['favorite']]
        non_favs = [b for b in recovered if not b['favorite']]
        if favs:
            lines.append(f'### ⭐ 收藏书架 ({len(favs)} 本)\n')
            for b in sorted(favs, key=lambda x: (x['author'], x['title'])):
                lines.append(_md_book_line(b))
            lines.append('')
        if non_favs:
            lines.append(f'### 其他 ({len(non_favs)} 本)\n')
            for b in sorted(non_favs, key=lambda x: (x['author'], x['title'])):
                lines.append(_md_book_line(b))
            lines.append('')
    else:
        lines.append('(本次扫描没匹配上任何备份里的书)\n')

    # ---- 失踪的 (按体裁分组, 收藏的单独突出) ----
    lines.append(f'## ❌ 仍然失踪的 {len(missing)} 本\n')
    lines.append('这是你的"购物清单" — 可以去 Z-Library / 知轩藏书 / 资源群按这个找回来,'
                 '丢进扫描目录,下次跑 import 会自动补全分类标签。\n')

    if missing:
        miss_favs = [b for b in missing if b['favorite']]
        if miss_favs:
            lines.append(f'### ⭐ 收藏书架失踪 ({len(miss_favs)} 本) — 优先找回\n')
            for b in sorted(miss_favs, key=lambda x: (x['favorite'], x['author'], x['title'])):
                lines.append(_md_book_line(b))
            lines.append('')

        # 其他按体裁
        by_genre = {}
        for b in missing:
            if b['favorite']: continue
            g = b['genres'][0] if b['genres'] else '_未分类'
            by_genre.setdefault(g, []).append(b)
        for genre in sorted(by_genre, key=lambda g: (-len(by_genre[g]), g)):
            blist = by_genre[genre]
            lines.append(f'### {genre} ({len(blist)} 本)\n')
            for b in sorted(blist, key=lambda x: (x['author'], x['title'])):
                lines.append(_md_book_line(b))
            lines.append('')

    md_path.write_text('\n'.join(lines), encoding='utf-8')
    print(f'   详细清单:      {md_path}')

    # === 纯文本失踪清单 (一行一本, 方便复制粘贴搜索) ===
    if missing:
        txt_path = lib.logs_dir / f'missing_{date}.txt'
        with txt_path.open('w', encoding='utf-8') as f:
            for b in sorted(missing, key=lambda x: (not x['favorite'], x['author'], x['title'])):
                fav_mark = '⭐ ' if b['favorite'] else ''
                line = f'{fav_mark}{b["title"]}'
                if b['author']:
                    line += f' — {b["author"]}'
                f.write(line + '\n')
        print(f'   失踪书单(纯文本): {txt_path}')


def _md_book_line(b: dict) -> str:
    """一本书的 markdown 一行表示."""
    title = b['title'] or b['raw_title'] or '(无标题)'
    parts = [f'- **{title}**']
    if b['author']:
        parts.append(f'— {b["author"]}')
    extras = []
    if b['genres']:
        extras.append('/'.join(b['genres']))
    if b['favorite']:
        extras.append(f'📌{b["favorite"]}')
    if extras:
        parts.append(f'`[{", ".join(extras)}]`')
    return ' '.join(parts)
