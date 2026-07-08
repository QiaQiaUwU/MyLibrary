#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
audit_author_coverage.py — 按作者补全核查
==========================================
对比母库 library.db 和平板 mrpro，逐作者列出差额，
找出哪些作者在母库里有很多书但平板没带全。

用法:
  python audit_author_coverage.py F:\MyLibrary F:\mylib\2026-06-07-classified.mrpro
"""

import sys, sqlite3, re
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent))


def audit(db_path: Path, mrpro_path: Path):
    from mrpro_utils import MrproFile

    # 读母库
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    lib_authors = defaultdict(list)
    for r in conn.execute('SELECT id, title, author FROM books WHERE author IS NOT NULL AND author != ""'):
        lib_authors[r['author']].append(r['title'])
    conn.close()

    # 读 mrpro
    with MrproFile(mrpro_path) as m:
        mrpro_books = m.get_books()

    mrpro_authors = defaultdict(list)
    for b in mrpro_books:
        author = (b.get('author') or '').strip()
        book = b.get('book') or ''
        # 从 category 里提取作者（category 格式: "体裁\n作者\n"）
        if not author:
            cat = b.get('category') or ''
            lines = [l.strip() for l in cat.split('\n') if l.strip()]
            if len(lines) >= 2:
                author = lines[-1]  # 最后一行通常是作者
        if author:
            mrpro_authors[author].append(book)

    # 对比
    print(f'📊 母库: {len(lib_authors)} 位作者, {sum(len(v) for v in lib_authors.values())} 本')
    print(f'📱 平板: {len(mrpro_authors)} 位作者, {len(mrpro_books)} 本\n')

    # 找差额大的作者
    diffs = []
    for author, lib_books in lib_authors.items():
        tablet_books = mrpro_authors.get(author, [])
        diff = len(lib_books) - len(tablet_books)
        if diff > 0 and len(lib_books) >= 5:  # 只看母库至少5本的作者
            diffs.append((author, len(lib_books), len(tablet_books), diff))

    diffs.sort(key=lambda x: -x[3])

    print(f'{"作者":<16} {"母库":>6} {"平板":>6} {"差额":>6}')
    print(f'{"-"*16} {"-"*6} {"-"*6} {"-"*6}')
    for author, lib_n, tab_n, diff in diffs[:50]:
        mark = ' ⚠️' if diff > 20 else ''
        print(f'{author:<16} {lib_n:>6} {tab_n:>6} {diff:>+6}{mark}')

    # 反向：平板比母库多的（可能是别名没归一）
    print(f'\n{"="*50}')
    print(f'平板比母库多的作者（可能是别名未归一）:')
    print(f'{"="*50}')
    for author, tab_books in mrpro_authors.items():
        lib_n = len(lib_authors.get(author, []))
        if len(tab_books) > lib_n + 5:
            print(f'  {author}: 平板 {len(tab_books)} > 母库 {lib_n}')

    # 输出详细差异（前10个作者）
    print(f'\n{"="*50}')
    print(f'差额最大的作者 — 母库有但平板没带的书:')
    print(f'{"="*50}')
    for author, lib_n, tab_n, diff in diffs[:10]:
        lib_titles = {_norm(t) for t in lib_authors[author]}
        tab_titles = {_norm(b) for b in mrpro_authors.get(author, [])}
        missing = lib_titles - tab_titles
        if missing:
            print(f'\n  {author} (缺 {len(missing)} 本):')
            for t in sorted(missing)[:15]:
                print(f'    · {t}')
            if len(missing) > 15:
                print(f'    ... 还有 {len(missing)-15} 本')


def _norm(t):
    """规范化书名用于比较"""
    t = re.sub(r'[《》\[\]【】()（）\s]', '', t or '')
    t = re.sub(r'[_]\d+$', '', t)
    t = re.sub(r'\d+[-~]\d+$', '', t)
    return t.strip().lower()


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    db = Path(sys.argv[1]) / 'library.db'
    mrpro = Path(sys.argv[2])
    if not db.exists():
        print(f'❌ {db} 不存在'); sys.exit(1)
    if not mrpro.exists():
        print(f'❌ {mrpro} 不存在'); sys.exit(1)
    audit(db, mrpro)
