#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mrpro_utils.py — mrpro 文件安全读写工具
========================================
MoonReader 的 .mrpro 是一个 ZIP 文件，内含 com.flyersoft.moonreaderp/31.tag（SQLite DB）。
本模块封装三个操作：load / patch / save，确保：
  - 只替换 31.tag，其余 entry 原样保留（不破坏 ZIP 结构）
  - 每个 entry 保持原始压缩方式（ZIP_STORED / ZIP_DEFLATED）
  - 保留 notes / statistics 等用户数据表
"""

import os
import re
import shutil
import sqlite3
import tempfile
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

# mrpro 内的 SQLite 路径（MoonReader 固定路径）
MRPRO_DB_ENTRY = 'com.flyersoft.moonreaderp/31.tag'

# mrpro books 表 schema（MoonReader 格式，不能改列名）
BOOKS_SCHEMA = '''CREATE TABLE IF NOT EXISTS books (
    _id INTEGER PRIMARY KEY AUTOINCREMENT,
    book TEXT, filename TEXT, lowerFilename TEXT,
    author TEXT, description TEXT, category TEXT,
    thumbFile TEXT, coverFile TEXT, addTime TEXT,
    favorite TEXT, downloadUrl TEXT, rate TEXT,
    bak1 TEXT, bak2 TEXT)'''

NOTES_SCHEMA = '''CREATE TABLE IF NOT EXISTS notes (
    _id INTEGER PRIMARY KEY AUTOINCREMENT,
    book TEXT, filename TEXT, lowerFilename TEXT,
    lastChapter NUMERIC, lastSplitIndex NUMERIC, lastPosition NUMERIC,
    highlightLength NUMERIC, highlightColor NUMERIC, time NUMERIC,
    bookmark TEXT, note TEXT, original TEXT,
    underline NUMERIC, strikethrough NUMERIC, bak TEXT)'''

STATISTICS_SCHEMA = '''CREATE TABLE IF NOT EXISTS statistics (
    _id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT, usedTime NUMERIC, readWords NUMERIC, dates TEXT)'''


class MrproFile:
    """mrpro 文件的安全封装"""

    def __init__(self, path: Path):
        self.path = Path(path)
        if not self.path.exists():
            raise FileNotFoundError(f'mrpro 文件不存在: {self.path}')
        self._tmp_db: Optional[str] = None
        self._conn: Optional[sqlite3.Connection] = None

    # ─── 读取 ───────────────────────────────────────────────────────────

    def load_db(self) -> sqlite3.Connection:
        """从 mrpro 中提取 31.tag 到临时文件，返回 SQLite 连接"""
        if self._conn:
            return self._conn

        with zipfile.ZipFile(self.path, 'r') as z:
            if MRPRO_DB_ENTRY not in z.namelist():
                raise ValueError(f'mrpro 中找不到 {MRPRO_DB_ENTRY}')
            db_data = z.read(MRPRO_DB_ENTRY)

        tf = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
        tf.write(db_data)
        tf.close()
        self._tmp_db = tf.name

        conn = sqlite3.connect(self._tmp_db)
        conn.row_factory = sqlite3.Row
        self._conn = conn
        return conn

    def get_books(self) -> List[Dict[str, Any]]:
        """读取所有书目记录"""
        conn = self.load_db()
        rows = conn.execute('SELECT * FROM books ORDER BY _id').fetchall()
        return [dict(r) for r in rows]

    def get_notes(self) -> List[Dict[str, Any]]:
        """读取所有笔记"""
        conn = self.load_db()
        try:
            rows = conn.execute('SELECT * FROM notes ORDER BY _id').fetchall()
            return [dict(r) for r in rows]
        except sqlite3.OperationalError:
            return []

    def get_statistics(self) -> List[Dict[str, Any]]:
        """读取阅读统计"""
        conn = self.load_db()
        try:
            rows = conn.execute('SELECT * FROM statistics ORDER BY _id').fetchall()
            return [dict(r) for r in rows]
        except sqlite3.OperationalError:
            return []

    # ─── 修改 ───────────────────────────────────────────────────────────

    def update_book(self, book_id: int, **fields):
        """更新单本书的字段（只允许安全字段）"""
        allowed = {'book', 'filename', 'lowerFilename', 'author', 'description',
                   'category', 'favorite', 'rate', 'addTime'}
        conn = self.load_db()
        sets, vals = [], []
        for k, v in fields.items():
            if k not in allowed:
                raise ValueError(f'不允许修改字段: {k}')
            sets.append(f'{k} = ?')
            vals.append(v)
        if not sets:
            return
        vals.append(book_id)
        conn.execute(f'UPDATE books SET {", ".join(sets)} WHERE _id = ?', vals)
        conn.commit()

    def add_book(self, book: str, author: str = '', category: str = '',
                 favorite: str = '', rate: str = '', filename: str = None,
                 **extra) -> int:
        """添加一本书，返回新 _id"""
        conn = self.load_db()
        cur = conn.execute(
            '''INSERT INTO books (book, filename, lowerFilename, author, description,
               category, thumbFile, coverFile, addTime, favorite, downloadUrl, rate, bak1, bak2)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            (book, filename, (filename or '').lower() if filename else None,
             author, '', category,
             None, None, None, favorite, '', rate, None, None))
        conn.commit()
        return cur.lastrowid

    def remove_book(self, book_id: int):
        """删除一条书目记录"""
        conn = self.load_db()
        conn.execute('DELETE FROM books WHERE _id = ?', (book_id,))
        conn.commit()

    def clear_books(self):
        """清空所有书目（保留 notes 和 statistics）"""
        conn = self.load_db()
        conn.execute('DELETE FROM books')
        conn.execute("DELETE FROM sqlite_sequence WHERE name='books'")
        conn.commit()

    def replace_all_books(self, books: List[Dict[str, Any]]):
        """用新列表替换所有书目，保留 notes/statistics"""
        self.clear_books()
        for i, b in enumerate(books, 1):
            self.add_book(
                book=b.get('book', b.get('book_field', '')),
                author=b.get('author', ''),
                category=b.get('category', ''),
                favorite=b.get('favorite', ''),
                rate=b.get('rate', ''),
                filename=b.get('filename', None),
            )

    # ─── 保存 ───────────────────────────────────────────────────────────

    def save(self, out_path: Path = None):
        """把修改后的 DB 写回 mrpro（默认覆盖原文件）

        关键：逐个 entry 复制，保持原始压缩方式，只替换 31.tag。
        """
        if not self._conn or not self._tmp_db:
            raise RuntimeError('没有打开的 DB 连接，请先 load_db()')

        self._conn.commit()
        out = Path(out_path) if out_path else self.path

        # 先写到临时文件，成功后再替换
        tmp_mrpro = out.with_suffix('.mrpro.tmp')

        try:
            with zipfile.ZipFile(self.path, 'r') as orig:
                with zipfile.ZipFile(tmp_mrpro, 'w') as new_z:
                    for info in orig.infolist():
                        if info.filename == MRPRO_DB_ENTRY:
                            # 替换 31.tag：读取修改后的临时 DB
                            with open(self._tmp_db, 'rb') as f:
                                db_bytes = f.read()
                            # 保持原始压缩方式
                            new_info = zipfile.ZipInfo(
                                filename=info.filename,
                                date_time=info.date_time,
                            )
                            new_info.compress_type = info.compress_type
                            new_info.external_attr = info.external_attr
                            new_z.writestr(new_info, db_bytes)
                        else:
                            # 其他 entry 原样复制（保持压缩方式和元数据）
                            data = orig.read(info.filename)
                            new_info = zipfile.ZipInfo(
                                filename=info.filename,
                                date_time=info.date_time,
                            )
                            new_info.compress_type = info.compress_type
                            new_info.external_attr = info.external_attr
                            # 复制额外属性
                            if hasattr(info, 'comment'):
                                new_info.comment = info.comment
                            new_z.writestr(new_info, data)

            # 成功写入临时文件后再替换目标
            if out.exists() and out != self.path:
                out.unlink()
            if out == self.path:
                # 覆盖原文件：先备份
                bak = self.path.with_suffix('.mrpro.bak')
                shutil.copy2(self.path, bak)
            shutil.move(str(tmp_mrpro), str(out))

        except Exception:
            # 清理临时文件
            if tmp_mrpro.exists():
                tmp_mrpro.unlink()
            raise

    def save_as(self, out_path: Path):
        """另存为新文件"""
        self.save(out_path)

    # ─── 清理 ───────────────────────────────────────────────────────────

    def close(self):
        """关闭连接，清理临时文件"""
        if self._conn:
            try:
                self._conn.close()
            except Exception:
                pass
            self._conn = None
        if self._tmp_db and os.path.exists(self._tmp_db):
            try:
                os.unlink(self._tmp_db)
            except Exception:
                pass
            self._tmp_db = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def __del__(self):
        self.close()


# ─── 便捷函数 ──────────────────────────────────────────────────────────────

def patch_mrpro_categories(mrpro_path: Path, updates: Dict[int, str],
                           out_path: Path = None):
    """批量更新 mrpro 中书目的 category 字段

    Args:
        mrpro_path: 源 .mrpro 文件
        updates: {_id: new_category, ...}
        out_path: 输出路径（默认覆盖原文件）
    """
    with MrproFile(mrpro_path) as m:
        m.load_db()
        for bid, cat in updates.items():
            m.update_book(bid, category=cat)
        m.save(out_path)


def mrpro_summary(mrpro_path: Path) -> Dict[str, Any]:
    """快速读取 mrpro 概要信息"""
    with MrproFile(mrpro_path) as m:
        books = m.get_books()
        notes = m.get_notes()
        stats = m.get_statistics()

        authors = set()
        genres = set()
        favs = []
        for b in books:
            if b.get('author'):
                authors.add(b['author'])
            cat = b.get('category', '') or ''
            for seg in cat.split('\n'):
                seg = seg.strip()
                if seg and seg != '(TXT)':
                    genres.add(seg)
            if b.get('favorite') and str(b['favorite']).strip():
                favs.append(b.get('book', ''))

        return {
            'total_books': len(books),
            'total_notes': len(notes),
            'total_statistics': len(stats),
            'unique_authors': len(authors),
            'unique_genres': len(genres),
            'favorites': favs,
            'favorite_count': len(favs),
        }


# ─── CLI ────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    import sys

    if len(sys.argv) < 2:
        print('用法:')
        print('  python mrpro_utils.py info <file.mrpro>    查看概要')
        print('  python mrpro_utils.py list <file.mrpro>    列出书目')
        sys.exit(1)

    cmd = sys.argv[1]
    path = Path(sys.argv[2]) if len(sys.argv) > 2 else None

    if cmd == 'info' and path:
        s = mrpro_summary(path)
        print(f'📦 {path.name}')
        print(f'   书目: {s["total_books"]} 本')
        print(f'   作者: {s["unique_authors"]} 位')
        print(f'   笔记: {s["total_notes"]} 条')
        print(f'   收藏: {s["favorite_count"]} 本')

    elif cmd == 'list' and path:
        with MrproFile(path) as m:
            for b in m.get_books():
                fav = '⭐' if b.get('favorite') and str(b['favorite']).strip() else '  '
                author = b.get('author', '')
                book = b.get('book', '')
                print(f'{fav} {book}  [{author}]')

    else:
        print(f'未知命令: {cmd}')
