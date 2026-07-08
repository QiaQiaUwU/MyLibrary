#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
dedup_library.py — 母库去重
=============================
基于 library.db 已有的 content_hash 和元数据做三层去重，
不需要重新读文件内容。

用法:
  # 扫描报告（只看不动）
  python dedup_library.py F:\MyLibrary --scan

  # 执行去重（重复文件移到 _quarantine/）
  python dedup_library.py F:\MyLibrary --apply
"""

import os, re, sys, shutil, sqlite3
from pathlib import Path
from collections import defaultdict
from datetime import datetime


def scan_duplicates(root: Path, apply: bool = False):
    db_path = root / 'library.db'
    quarantine = root / '_quarantine' / f'dedup_{datetime.now():%Y%m%d}'
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    print(f'📊 扫描母库: {root}')
    total = conn.execute('SELECT COUNT(*) FROM books').fetchone()[0]
    print(f'   总书目: {total}\n')

    groups = {'hash': [], 'title': [], 'stub': []}

    # ── 第一层：content_hash 完全相同 ────────────────────────────────────
    print('🔍 第一层: content_hash 去重...')
    hash_groups = defaultdict(list)
    for r in conn.execute('''SELECT id, title, author, file_path, file_size, word_count,
                                    content_hash, quality_score, is_favorite, is_read
                             FROM books WHERE content_hash IS NOT NULL AND content_hash != ""'''):
        hash_groups[r['content_hash']].append(dict(r))

    for h, books in hash_groups.items():
        if len(books) < 2:
            continue
        # 按质量分+字数+收藏排序，留最好的
        books.sort(key=lambda b: (b['is_favorite'] or 0, b['quality_score'] or 0,
                                   b['word_count'] or 0), reverse=True)
        groups['hash'].append({'keep': books[0], 'remove': books[1:]})

    print(f'   发现 {len(groups["hash"])} 组 content_hash 重复')

    # ── 第二层：同作者 + 书名相似 + 字数接近 ────────────────────────────
    print('🔍 第二层: 同作者书名相似去重...')
    author_books = defaultdict(list)
    for r in conn.execute('''SELECT id, title, author, file_path, file_size, word_count,
                                    quality_score, is_favorite, is_read
                             FROM books WHERE author IS NOT NULL AND author != ""'''):
        author_books[r['author']].append(dict(r))

    # 已经被第一层处理的 id 跳过
    removed_ids = set()
    for g in groups['hash']:
        for b in g['remove']:
            removed_ids.add(b['id'])

    for author, books in author_books.items():
        books = [b for b in books if b['id'] not in removed_ids]
        if len(books) < 2:
            continue
        # 按书名分组
        clusters = _cluster_by_title(books)
        for cluster in clusters:
            if len(cluster) < 2:
                continue
            cluster.sort(key=lambda b: (b['is_favorite'] or 0, b['quality_score'] or 0,
                                         b['word_count'] or 0), reverse=True)
            # 字数差不超过 20% 才算重复
            best = cluster[0]
            dups = []
            for b in cluster[1:]:
                wc1 = best['word_count'] or 1
                wc2 = b['word_count'] or 1
                if abs(wc1 - wc2) / max(wc1, wc2) < 0.20:
                    dups.append(b)
                    removed_ids.add(b['id'])
            if dups:
                groups['title'].append({'keep': best, 'remove': dups})

    print(f'   发现 {len(groups["title"])} 组书名相似重复')

    # ── 第三层：空壳/残章（字数不到同作者同书最大版本的 5%）────────────
    print('🔍 第三层: 空壳/残章清理...')
    for author, books in author_books.items():
        books = [b for b in books if b['id'] not in removed_ids]
        clusters = _cluster_by_title(books)
        for cluster in clusters:
            if len(cluster) < 2:
                continue
            max_wc = max(b['word_count'] or 0 for b in cluster)
            if max_wc < 1000:
                continue
            best = max(cluster, key=lambda b: (b['word_count'] or 0))
            stubs = [b for b in cluster if b['id'] != best['id']
                     and (b['word_count'] or 0) < max_wc * 0.05
                     and b['id'] not in removed_ids]
            if stubs:
                groups['stub'].append({'keep': best, 'remove': stubs})
                for b in stubs:
                    removed_ids.add(b['id'])

    print(f'   发现 {len(groups["stub"])} 组空壳/残章\n')

    # ── 汇总 ─────────────────────────────────────────────────────────────
    total_remove = sum(len(g['remove']) for gs in groups.values() for g in gs)
    print(f'{"="*50}')
    print(f'去重汇总:')
    print(f'  content_hash 相同: {sum(len(g["remove"]) for g in groups["hash"])} 本')
    print(f'  书名相似 (同作者): {sum(len(g["remove"]) for g in groups["title"])} 本')
    print(f'  空壳/残章:         {sum(len(g["remove"]) for g in groups["stub"])} 本')
    print(f'  总计可清理:        {total_remove} 本')
    print(f'  清理后剩余:        {total - total_remove} 本')
    print(f'{"="*50}\n')

    if not apply:
        # 输出报告
        report_path = root / '_logs' / f'dedup_report_{datetime.now():%Y%m%d_%H%M%S}.md'
        report_path.parent.mkdir(exist_ok=True)
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(f'# 母库去重报告\n\n生成时间: {datetime.now()}\n\n')
            f.write(f'总书目: {total} → 去重后: {total - total_remove}\n\n')
            for layer, label in [('hash', 'content_hash 相同'), ('title', '书名相似'), ('stub', '空壳/残章')]:
                gs = groups[layer]
                f.write(f'\n## {label} ({sum(len(g["remove"]) for g in gs)} 本)\n\n')
                for g in gs[:100]:
                    keep = g['keep']
                    f.write(f'**保留**: {keep["title"]} [{keep["author"]}] {keep["word_count"] or 0}字\n')
                    for b in g['remove']:
                        f.write(f'  ❌ {b["title"]} [{b["author"]}] {b["word_count"] or 0}字 `{b["file_path"]}`\n')
                    f.write('\n')
        print(f'📋 报告: {report_path}')
        print(f'确认没问题后加 --apply 执行')
        return

    # ── 执行 ─────────────────────────────────────────────────────────────
    print('🚀 执行去重...')

    # 备份 DB
    bak = db_path.with_suffix('.db.bak_before_dedup')
    if not bak.exists():
        shutil.copy2(db_path, bak)
        print(f'💾 已备份: {bak}')

    quarantine.mkdir(parents=True, exist_ok=True)
    moved = 0
    for layer in ('hash', 'title', 'stub'):
        for g in groups[layer]:
            for b in g['remove']:
                src = root / b['file_path']
                if src.exists():
                    dst = quarantine / src.name
                    # 防重名
                    if dst.exists():
                        dst = quarantine / f'{src.stem}_{b["id"]}{src.suffix}'
                    shutil.move(str(src), str(dst))
                    moved += 1
                # 记录到 duplicates 表
                try:
                    conn.execute('''INSERT INTO duplicates (reason, dup_path, original_path, quarantine_time, primary_book_id)
                                   VALUES (?, ?, ?, datetime('now'), ?)''',
                                (f'dedup_{layer}', b['file_path'], g['keep']['file_path'], g['keep']['id']))
                except Exception:
                    pass

    conn.commit()
    conn.close()
    print(f'✅ 完成: {moved} 个文件移到 {quarantine}')


def _cluster_by_title(books):
    """把同作者的书按书名相似度聚类"""
    if not books:
        return []
    clusters = []
    used = set()
    for i, b1 in enumerate(books):
        if i in used:
            continue
        cluster = [b1]
        used.add(i)
        t1 = _norm_title(b1['title'])
        for j, b2 in enumerate(books[i+1:], i+1):
            if j in used:
                continue
            t2 = _norm_title(b2['title'])
            if t1 == t2 or (len(t1) >= 2 and len(t2) >= 2 and (t1 in t2 or t2 in t1)):
                cluster.append(b2)
                used.add(j)
        if len(cluster) >= 2:
            clusters.append(cluster)
    return clusters


def _norm_title(t):
    """规范化书名用于比较"""
    t = re.sub(r'[《》「」\[\]【】()（）\s]', '', t or '')
    t = re.sub(r'[_\-]\d+$', '', t)  # 去 _1 _2 后缀
    t = re.sub(r'\d+[-~]\d+$', '', t)  # 去 1-67 章节范围
    t = re.sub(r'(完结|全本|精校|修订|番外|完整版?|VIP|txt).*$', '', t, flags=re.I)
    return t.strip().lower()


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    root = Path(sys.argv[1])
    if not (root / 'library.db').exists():
        print(f'❌ 找不到 {root}/library.db')
        sys.exit(1)
    if '--apply' in sys.argv:
        scan_duplicates(root, apply=True)
    else:
        scan_duplicates(root, apply=False)

