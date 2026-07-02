#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
merge_authors.py — 母库作者别名发现与合并
==========================================
扫描 library.db，发现疑似同一人的不同作者名，合并到统一名字。
同时移动磁盘上 books/ 下的文件夹。

用法:
  # 第1步：发现疑似别名（只看不动）
  python merge_authors.py F:\MyLibrary --discover

  # 第2步：确认别名表后执行合并
  python merge_authors.py F:\MyLibrary --apply
"""

import os, re, sys, shutil, sqlite3, json
from pathlib import Path
from collections import defaultdict, Counter

# ── 已确认的别名表 ──────────────────────────────────────────────────────────
# 格式：别名 → 统一名
AUTHOR_ALIAS = {
    '江洋大刀': '狄醉山',
    '烂风': '狄醉山',
    'w从菁': '送泥一条鱼',
    '泥鱼': '送泥一条鱼',
    'shinning': 'shilling',
    '黑猫白袜子_1': '黑猫白袜子',
    '白袜子': '黑猫白袜子',       # 共享11本，确认同人
    '缘何故-补番': '缘何故',      # -补番 后缀
}

# 自动合并所有 "xxx_1" → "xxx"（当 xxx 也存在时）的后缀变体。
# 还有 "-补番" "-补车" 这类后缀。设为 True 时 discover/apply 都会带上这些。
AUTO_MERGE_SUFFIX = True
SUFFIX_PATTERNS = [
    r'_\d+$',           # xxx_1, xxx_2
    r'-补[番车]$',       # xxx-补番, xxx-补车
    r'NP$',             # 关山越NP → 关山越（如确认）
]


def discover_aliases(db_path: Path):
    """扫描 library.db，发现疑似别名对"""
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    # 统计每个作者的书数和书名
    author_books = defaultdict(list)
    for r in conn.execute('SELECT author, title FROM books WHERE author IS NOT NULL AND author != ""'):
        author_books[r['author']].append(r['title'])

    print(f'📊 母库共 {len(author_books)} 个不同作者名\n')

    # 1. 检查已知别名表中还没合并的
    print('=== 已知别名（待合并）===')
    for alias, target in AUTHOR_ALIAS.items():
        if alias in author_books:
            print(f'  {alias} ({len(author_books[alias])}本) → {target} ({len(author_books.get(target, []))}本)')

    # 2. 发现新的疑似别名：共享书名的不同作者
    print('\n=== 疑似别名（共享书名）===')
    title_to_authors = defaultdict(set)
    for author, titles in author_books.items():
        for t in titles:
            # 规范化书名
            clean = re.sub(r'[《》\s_\d\-()（）\[\]【】]', '', t).lower()
            if len(clean) >= 2:
                title_to_authors[clean].add(author)

    # 两两配对统计共享书名数（避免 3+ 作者共享时元组解包失败）
    from itertools import combinations
    pair_shared = defaultdict(set)
    for title, authors in title_to_authors.items():
        if len(authors) >= 2:
            for a1, a2 in combinations(sorted(authors), 2):
                pair_shared[(a1, a2)].add(title)

    for (a1, a2), titles in sorted(pair_shared.items(), key=lambda x: -len(x[1])):
        if len(titles) >= 3:  # 至少共享 3 本书才报告
            n1, n2 = len(author_books[a1]), len(author_books[a2])
            print(f'  {a1} ({n1}本) ↔ {a2} ({n2}本): 共享 {len(titles)} 本')
            for t in list(titles)[:5]:
                print(f'    · {t}')

    # 3. 名字相似的作者（编辑距离）
    print('\n=== 疑似别名（名字相似）===')
    authors = list(author_books.keys())
    for i, a1 in enumerate(authors):
        for a2 in authors[i+1:]:
            if _similar_name(a1, a2):
                n1, n2 = len(author_books[a1]), len(author_books[a2])
                print(f'  {a1} ({n1}本) ↔ {a2} ({n2}本)')

    # 4. 带后缀的变体 (xxx_1, xxx_2)
    print('\n=== 疑似后缀变体 ===')
    suffix_variants = []
    for author in authors:
        for pat in SUFFIX_PATTERNS:
            base = re.sub(pat, '', author)
            if base != author and base in author_books:
                suffix_variants.append((author, base))
                print(f'  {author} ({len(author_books[author])}本) → {base} ({len(author_books[base])}本)')
                break

    conn.close()

    # 汇总：apply 时会自动处理的
    print(f'\n{"="*50}')
    if AUTO_MERGE_SUFFIX:
        print(f'💡 --apply 时会自动合并:')
        print(f'   · 手写别名表 {len(AUTHOR_ALIAS)} 条')
        print(f'   · 自动检测的后缀变体 {len(suffix_variants)} 条 (xxx_1 / xxx-补番 等)')
        print(f'   共约 {len(AUTHOR_ALIAS) + len(suffix_variants)} 条规则')
    print(f'   "共享书名"里非后缀的别名（如 江洋大刀→狄醉山）需要手动加到 AUTHOR_ALIAS 表')
    print(f'   确认后跑: python merge_authors.py <库路径> --apply')


def _similar_name(a, b):
    """名字编辑距离 <= 1 且长度 >= 2"""
    if len(a) < 2 or len(b) < 2:
        return False
    if abs(len(a) - len(b)) > 1:
        return False
    if a == b:
        return False
    # 简单编辑距离
    if len(a) == len(b):
        diff = sum(1 for x, y in zip(a, b) if x != y)
        return diff == 1
    # 长度差1：检查是否只多/少一个字
    short, long_ = (a, b) if len(a) < len(b) else (b, a)
    j = 0
    diffs = 0
    for i in range(len(long_)):
        if j < len(short) and long_[i] == short[j]:
            j += 1
        else:
            diffs += 1
    return diffs <= 1


def build_full_alias_map(conn) -> dict:
    """合并手写别名表 + 自动检测的变体，返回 {别名: 统一名}。
    之前只剥 _数字 / -补番，像「诗无茶古代」「诗无茶-番全」「: 诗无茶」「诗无茶--」这种
    一律没合并、作者被拆成一堆。现在按"核心名"归一：去掉首尾标点/符号、去掉结尾的
    装饰词（番外/番全/补番/古代/现代/完结/原版/出书…）和编号，核心名相同的归到书最多的那个。"""
    alias_map = dict(AUTHOR_ALIAS)
    if not AUTO_MERGE_SUFFIX:
        return alias_map

    # 作者 -> 书数
    counts = {}
    for r in conn.execute('SELECT author, COUNT(*) c FROM books '
                          'WHERE author IS NOT NULL AND author != "" GROUP BY author'):
        counts[r[0]] = r[1]

    # 结尾装饰词（前面可带分隔符），可叠着去
    JUNK = ['番外篇', '番外', '番全', '补番', '补车', '外番', '特别篇', '特典', '番剧',
            '完结篇', '完结', '连载中', '连载', '全本', '合集', '正文', '存稿',
            '现代', '古代', '现言', '古言', '重制版', '重制', '修订版', '修订', '修改版', '出书版', '出书', '原版']

    def canon_key(name):
        s = (name or '').strip()
        # 去首部标点/符号/空白（: ： - _ 等）
        s = re.sub(r'^[\s:：\-_.,，、·\|/()（）\[\]【】《》"\'’*~!！]+', '', s)
        # 反复剥结尾：编号、括注、装饰词
        changed = True
        while changed and s:
            changed = False
            s2 = re.sub(r'[\s\-_]*(?:[（(]\s*\d+\s*[)）]|\d+)$', '', s)            # _1 (1) （1） 末尾数字
            if s2 != s and len(s2) >= 1:
                s, changed = s2, True
            for tk in JUNK:
                s2 = re.sub(r'[\s\-_·]*' + re.escape(tk) + r'[\s\d]*$', '', s)
                if s2 != s and len(s2) >= 1:
                    s, changed = s2, True
                    break
        s = re.sub(r'[\s:：\-_.,，、·\|/()（）\[\]【】《》"\'’*~!！]+$', '', s)         # 去尾部标点
        key = re.sub(r'[\s:：\-_.,，、·\|/()（）\[\]【】《》"\'’*~!！\d]', '', s).lower()  # 归一键
        return key

    # 按核心名分组
    from collections import defaultdict
    groups = defaultdict(list)
    for author in counts:
        k = canon_key(author)
        if len(k) >= 2:                       # 核心名太短不归并，避免误合
            groups[k].append(author)

    for k, names in groups.items():
        if len(set(names)) < 2:
            continue
        # 选规范名：书最多 → 名字最短（更干净）→ 字典序
        canonical = sorted(names, key=lambda a: (-(counts.get(a, 0)), len(a), a))[0]
        for a in names:
            if a != canonical and a not in alias_map:
                alias_map[a] = canonical

    return alias_map


def apply_merge(root: Path):
    """执行作者合并：更新 DB + 移动文件夹"""
    db_path = root / 'library.db'
    books_dir = root / 'books'
    conn = sqlite3.connect(str(db_path))

    # 备份提醒
    bak = db_path.with_suffix('.db.bak_before_merge')
    if not bak.exists():
        shutil.copy2(db_path, bak)
        print(f'💾 已备份: {bak}')

    # 构建完整别名表（含自动后缀变体）
    alias_map = build_full_alias_map(conn)
    print(f'📋 共 {len(alias_map)} 条别名规则（含自动检测的后缀变体）\n')

    total_updated = 0
    total_moved = 0
    total_skipped = 0

    for alias, target in alias_map.items():
        if alias == target:
            continue
        n_books = conn.execute('SELECT COUNT(*) FROM books WHERE author=?', (alias,)).fetchone()[0]
        n_files = 0
        src_dir = books_dir / alias
        dst_dir = books_dir / target

        # ── 逐文件移动 + 精确更新对应 DB 记录的 file_path ──
        if src_dir.exists() and src_dir.is_dir():
            dst_dir.mkdir(parents=True, exist_ok=True)
            for f in list(src_dir.iterdir()):
                if not f.is_file():
                    continue
                old_rel = f'books/{alias}/{f.name}'
                dst_file = dst_dir / f.name
                new_name = f.name

                # 目标已存在同名文件：加后缀避免覆盖
                if dst_file.exists():
                    i = 1
                    while True:
                        cand = f'{f.stem}_{i}{f.suffix}'
                        if not (dst_dir / cand).exists():
                            new_name = cand
                            dst_file = dst_dir / cand
                            break
                        i += 1

                new_rel = f'books/{target}/{new_name}'

                # 移动文件
                try:
                    shutil.move(str(f), str(dst_file))
                except Exception as e:
                    print(f'    ⚠️ 移动失败 {f.name}: {e}')
                    continue

                # 更新这个文件对应的 DB 记录（用旧路径精确定位）
                # 先检查新路径是否已被占用（防唯一约束冲突）
                exists = conn.execute('SELECT id FROM books WHERE file_path=?', (new_rel,)).fetchone()
                if exists:
                    # 新路径已有记录（重复书），删掉旧记录
                    conn.execute('DELETE FROM books WHERE file_path=?', (old_rel,))
                    total_skipped += 1
                else:
                    conn.execute('UPDATE books SET file_path=?, author=? WHERE file_path=?',
                                 (new_rel, target, old_rel))
                n_files += 1

            # 删空文件夹
            try:
                src_dir.rmdir()
            except OSError:
                pass

        # ── DB 里还有 author=alias 但文件夹已不在的记录（孤儿），直接改作者名 ──
        # 但要防 file_path 撞车：先查有没有冲突
        orphans = conn.execute('SELECT id, file_path FROM books WHERE author=?', (alias,)).fetchall()
        for oid, ofp in orphans:
            # 尝试把路径里的 alias 换成 target
            if f'/{alias}/' in (ofp or ''):
                new_fp = ofp.replace(f'/{alias}/', f'/{target}/')
                clash = conn.execute('SELECT id FROM books WHERE file_path=? AND id!=?',
                                     (new_fp, oid)).fetchone()
                if clash:
                    conn.execute('DELETE FROM books WHERE id=?', (oid,))
                    total_skipped += 1
                else:
                    conn.execute('UPDATE books SET file_path=?, author=? WHERE id=?',
                                 (new_fp, target, oid))
            else:
                conn.execute('UPDATE books SET author=? WHERE id=?', (target, oid))

        if n_books or n_files:
            total_updated += n_books
            total_moved += n_files
            print(f'  ✅ {alias} → {target} (DB {n_books}本, 移动 {n_files}个文件)')

    conn.commit()
    conn.close()
    print(f'\n✅ 完成: {total_updated} 条记录归并, {total_moved} 个文件移动, {total_skipped} 个重复跳过')
    print(f'   重复的书（同名撞车）已从 DB 删除记录，物理文件保留在目标文件夹（带 _N 后缀）')
    print(f'   建议接着跑去重: python dedup_library.py <库路径> --scan')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    root = Path(sys.argv[1])
    db = root / 'library.db'
    if not db.exists():
        print(f'❌ 找不到 {db}')
        sys.exit(1)

    if '--discover' in sys.argv:
        discover_aliases(db)
    elif '--apply' in sys.argv:
        apply_merge(root)
    else:
        print('请指定 --discover（发现别名）或 --apply（执行合并）')
