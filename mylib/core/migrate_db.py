#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
migrate_db.py — 数据库迁移
============================
给 library.db 添加新表和字段，支持：
  - 阅读笔记 (reading_notes)
  - 阅读进度 (reading_progress)
  - 带走清单 (books.take_to_tablet / books.reading_status)
  - FTS5 全文检索索引 (books_fts)

安全：所有操作都是 IF NOT EXISTS，可以重复跑。
用法：python migrate_db.py F:/MyLibrary
"""

import sqlite3
import sys
from pathlib import Path


def migrate(db_path: Path):
    conn = sqlite3.connect(str(db_path))
    c = conn.cursor()

    print(f'📦 迁移数据库: {db_path}')

    # ── 1. books 表加新列 ────────────────────────────────────────────────
    existing_cols = {r[1] for r in c.execute('PRAGMA table_info(books)')}

    if 'reading_status' not in existing_cols:
        c.execute("ALTER TABLE books ADD COLUMN reading_status TEXT DEFAULT NULL")
        print('  ✅ books.reading_status 已添加')
    else:
        print('  ⏭️  books.reading_status 已存在')

    if 'take_to_tablet' not in existing_cols:
        c.execute("ALTER TABLE books ADD COLUMN take_to_tablet INTEGER DEFAULT 0")
        print('  ✅ books.take_to_tablet 已添加')
    else:
        print('  ⏭️  books.take_to_tablet 已存在')

    if 'cover_path' not in existing_cols:
        c.execute("ALTER TABLE books ADD COLUMN cover_path TEXT DEFAULT NULL")
        print('  ✅ books.cover_path 已添加')
    else:
        print('  ⏭️  books.cover_path 已存在')

    if 'is_finished' not in existing_cols:
        c.execute("ALTER TABLE books ADD COLUMN is_finished INTEGER DEFAULT NULL")
        print('  ✅ books.is_finished 已添加 (NULL=未知/0=连载/1=完结)')
    else:
        print('  ⏭️  books.is_finished 已存在')

    if 'chapter_count' not in existing_cols:
        c.execute("ALTER TABLE books ADD COLUMN chapter_count INTEGER DEFAULT NULL")
        print('  ✅ books.chapter_count 已添加')
    else:
        print('  ⏭️  books.chapter_count 已存在')

    if 'extra_count' not in existing_cols:
        c.execute("ALTER TABLE books ADD COLUMN extra_count INTEGER DEFAULT NULL")
        print('  books.extra_count 已添加')
    else:
        print('  books.extra_count 已存在')

    if 'tree_skin' not in existing_cols:
        c.execute("ALTER TABLE books ADD COLUMN tree_skin TEXT DEFAULT NULL")
        print('  books.tree_skin 已添加')
    conn.commit()   # v4.6.1：以下每段都单独 commit——之前整个函数只在最后 commit 一次，
                     # 任何一段中途出错（哪怕是无关紧要的可选数据）都会把前面全部回滚掉，包括这里已经加完的列。

    # ── 2. reading_notes 表 ──────────────────────────────────────────────
    c.execute('''CREATE TABLE IF NOT EXISTS reading_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
        position INTEGER DEFAULT 0,
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        source TEXT DEFAULT 'manual',
        conversation_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_rnotes_book ON reading_notes(book_id, position)')
    # 笔记配图（手账化）：可重复跑
    try:
        cols = [r[1] for r in c.execute("PRAGMA table_info(reading_notes)").fetchall()]
        if 'image_path' not in cols:
            c.execute("ALTER TABLE reading_notes ADD COLUMN image_path TEXT DEFAULT ''")
    except Exception:
        pass
    print('  reading_notes 表就绪')

    # ── 3. reading_progress 表 ───────────────────────────────────────────
    c.execute('''CREATE TABLE IF NOT EXISTS reading_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
        device_id TEXT DEFAULT 'web',
        position INTEGER DEFAULT 0,
        percentage REAL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(book_id, device_id)
    )''')
    print('  ✅ reading_progress 表就绪')

    # ── 3b. 高亮/划句收藏表 ──────────────────────────────────────────────
    c.execute('''CREATE TABLE IF NOT EXISTS highlights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
        position INTEGER DEFAULT 0,
        text TEXT NOT NULL,
        color TEXT DEFAULT 'yellow',
        note TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_hl_book ON highlights(book_id, position)')
    print('  ✅ highlights 表就绪')

    # ── 3c. 书签表 ───────────────────────────────────────────────────────
    c.execute('''CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
        position INTEGER DEFAULT 0,
        percentage REAL DEFAULT 0,
        label TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    print('  ✅ bookmarks 表就绪')

    # ── 3d. 阅读日记（每天读了什么）─────────────────────────────────────
    c.execute('''CREATE TABLE IF NOT EXISTS reading_diary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
        book_title TEXT,
        book_author TEXT,
        chars_read INTEGER DEFAULT 0,
        minutes_read INTEGER DEFAULT 0,
        start_pct REAL DEFAULT 0,
        end_pct REAL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, book_id)
    )''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_diary_date ON reading_diary(date)')
    print('  ✅ reading_diary 表就绪')

    # ── 3e. 阅读偏好（皮肤/字体设置，全局）──────────────────────────────
    c.execute('''CREATE TABLE IF NOT EXISTS reading_prefs (
        key TEXT PRIMARY KEY,
        value TEXT
    )''')
    print('  ✅ reading_prefs 表就绪')
    conn.commit()

    # ── 4. FTS5 全文检索虚拟表 ───────────────────────────────────────────
    # 检查是否已存在
    fts_exists = c.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='books_fts'"
    ).fetchone()
    if not fts_exists:
        c.execute('''CREATE VIRTUAL TABLE books_fts USING fts5(
            title, author, content,
            content='',
            tokenize='unicode61'
        )''')
        print('  ✅ books_fts FTS5 表已创建')
        print('     ⚠️  FTS 索引为空，需要运行 build_fts_index 来填充')
    else:
        print('  ⏭️  books_fts 已存在')

    # ── Quill 书库精灵：会话 / 消息 / 全局记忆 ───────────────────────────
    c.execute('''CREATE TABLE IF NOT EXISTS quill_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER,              -- 关联的书（NULL=独立会话）
        book_title TEXT DEFAULT '',
        title TEXT DEFAULT '',        -- 会话标题
        created_at TEXT,
        updated_at TEXT
    )''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_qsession_book ON quill_sessions(book_id)')
    print('  ✅ quill_sessions 表就绪')

    c.execute('''CREATE TABLE IF NOT EXISTS quill_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        role TEXT,                    -- user / assistant
        content TEXT,
        starred INTEGER DEFAULT 0,    -- 用户收藏这条（值得记下的话）
        created_at TEXT
    )''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_qmsg_session ON quill_messages(session_id)')
    print('  ✅ quill_messages 表就绪')

    # 全局记忆：跨所有会话共通（用户画像、喜好、Quill 养成的性情）
    c.execute('''CREATE TABLE IF NOT EXISTS quill_memory (
        key TEXT PRIMARY KEY,         -- 记忆条目的键
        value TEXT,                   -- 内容
        updated_at TEXT
    )''')
    print('  ✅ quill_memory 表就绪（全局记忆，跨会话共通）')
    conn.commit()   # 这几张表最要紧——先落盘，后面任何一段出错都不会连累它们

    # ── 5. 初始化 take_to_tablet ─────────────────────────────────────────
    # 把已有的 mrpro 收藏标记为 take_to_tablet=1（触碰的是可选的历史数据，单独兜底，
    # 就算这张表在某些老库上字段对不上，也不该拖累上面已经就绪的新表）
    try:
        mrpro_fav_count = c.execute(
            "SELECT COUNT(*) FROM books WHERE mrpro_favorite=1 AND take_to_tablet=0"
        ).fetchone()[0]
        if mrpro_fav_count > 0:
            c.execute("UPDATE books SET take_to_tablet=1 WHERE mrpro_favorite=1")
            print(f'  ✅ {mrpro_fav_count} 本 mrpro 收藏已标记为 take_to_tablet')
        conn.commit()
    except Exception as e:
        conn.rollback()
        print('  ⚠️ mrpro 收藏标记跳过（不影响其余迁移）：', e)

    # ── 6. 性能索引：书架/花园在 13 万行上每次都要按这些列筛选/排序，
    #        没索引就是全表扫描（首屏慢、反复加载）。可重复跑。──
    for sql in [
        "CREATE INDEX IF NOT EXISTS idx_books_reading_status ON books(reading_status)",
        "CREATE INDEX IF NOT EXISTS idx_books_is_read       ON books(is_read)",
        "CREATE INDEX IF NOT EXISTS idx_books_is_favorite   ON books(is_favorite)",
        "CREATE INDEX IF NOT EXISTS idx_books_is_finished   ON books(is_finished)",
        "CREATE INDEX IF NOT EXISTS idx_books_last_open      ON books(last_open)",
        "CREATE INDEX IF NOT EXISTS idx_books_word_count     ON books(word_count)",
    ]:
        try:
            c.execute(sql)
        except Exception as e:
            print('  ⚠️ 建索引跳过:', e)
    print('  ✅ 书架/花园查询索引就绪')
    conn.commit()

    # ── 7. 处理标记列：让"集中处理"的任务知道哪些书处理过、不再重复处理。
    #        值存"最后处理时间"字符串，NULL=没处理过。可重复跑。──
    cols2 = {r[1] for r in c.execute('PRAGMA table_info(books)')}
    for col in ('proc_dedup_at', 'proc_classify_at', 'proc_meta_at', 'proc_finish_at'):
        if col not in cols2:
            try:
                c.execute(f"ALTER TABLE books ADD COLUMN {col} TEXT DEFAULT NULL")
            except Exception:
                pass
    print('  ✅ 处理标记列就绪（proc_dedup_at / proc_classify_at / proc_meta_at / proc_finish_at）')
    conn.commit()

    # ── 8. 处理批次表：每次集中处理留一条记录，做"进度备份"，中断也能续。──
    c.execute('''CREATE TABLE IF NOT EXISTS processing_batch (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        kind        TEXT NOT NULL,                 -- dedup / classify / meta / finish ...
        status      TEXT NOT NULL DEFAULT 'running', -- running / done / aborted
        total       INTEGER DEFAULT 0,
        done        INTEGER DEFAULT 0,
        last_book_id INTEGER DEFAULT 0,            -- 续跑用：上次处理到哪本
        note        TEXT DEFAULT '',
        started_at  TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
    )''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_pbatch_kind ON processing_batch(kind, status)')
    print('  ✅ processing_batch 表就绪（处理进度备份/续跑）')

    conn.commit()
    conn.close()
    print('✅ 迁移完成\n')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('用法: python migrate_db.py F:\\MyLibrary')
        sys.exit(1)
    root = Path(sys.argv[1])
    db = root / 'library.db'
    if not db.exists():
        print(f'❌ 找不到 {db}')
        sys.exit(1)
    migrate(db)
