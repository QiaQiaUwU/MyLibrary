#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
fix_chapter_match.py — 修复章节范围命名匹配
=============================================
给 build_mrpro_from_export.py 的匹配算法打补丁，
处理 "祸水 1-67.txt" / "xxx 完结+番外.txt" 这类章节范围命名，
找回之前报告为"失踪"的约 120 本书。

用法:
  # 干跑：看能找回多少本
  python fix_chapter_match.py F:\MyLibrary_by_mrpro F:\mylib\2026-06-07-classified.mrpro

  # 生成修复后的 mrpro
  python fix_chapter_match.py F:\MyLibrary_by_mrpro F:\mylib\2026-06-07-classified.mrpro --apply
"""

import os, re, sys
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent))


def normalize_enhanced(name: str) -> str:
    """增强版书名规范化：处理章节范围、完结标记等"""
    s = name
    # 去扩展名
    s = re.sub(r'\.(txt|epub|mobi|azw3?|pdf)$', '', s, flags=re.I)
    # 去章节范围：xxx 1-67 / xxx 1~149
    s = re.sub(r'\s*\d+\s*[-–~]\s*\d+\s*$', '', s)
    # 去"完结+N番外"
    s = re.sub(r'\s*完结[+＋]?\d*番外?\s*$', '', s)
    # 去"全文/全本/完整版/VIP/精校"
    s = re.sub(r'\s*(全文|全本|完整版|VIP|精校|修订|校对版?)$', '', s)
    # 去 _1 _2 后缀
    s = re.sub(r'[_]\d+$', '', s)
    # 去书名号
    s = re.sub(r'[《》「」\[\]【】()（）]', '', s)
    # 去作者部分
    s = re.sub(r'(作者[:：]?\s*\S+|by\s+\S+)$', '', s, flags=re.I)
    return s.strip().lower()


def scan_and_match(export_dir: Path, mrpro_path: Path, apply: bool = False):
    from mrpro_utils import MrproFile

    # 读 mrpro 现有书目
    with MrproFile(mrpro_path) as m:
        mrpro_books = m.get_books()

    mrpro_titles = set()
    for b in mrpro_books:
        book = b.get('book') or ''
        mrpro_titles.add(normalize_enhanced(book))

    # 扫描导出目录
    disk_files = []
    skip_dirs = {'_重复隔离', '_quarantine', '_logs'}
    for root, dirs, files in os.walk(export_dir):
        dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith('_')]
        for fname in files:
            if re.search(r'\.(txt|epub|mobi|azw3?)$', fname, re.I):
                disk_files.append(Path(root) / fname)

    # 找"磁盘上有但 mrpro 里没有"的
    missing = []
    found = 0
    for fp in disk_files:
        norm = normalize_enhanced(fp.stem)
        if norm in mrpro_titles:
            found += 1
        else:
            missing.append(fp)

    # 用增强匹配再试一次
    recovered = []
    still_missing = []
    for fp in missing:
        norm = normalize_enhanced(fp.stem)
        # 尝试更激进的匹配：去掉所有数字后缀
        aggressive = re.sub(r'\s*\d+\s*$', '', norm).strip()
        if aggressive and aggressive in mrpro_titles:
            recovered.append(fp)
        else:
            still_missing.append(fp)

    print(f'📊 扫描结果:')
    print(f'  磁盘文件:    {len(disk_files)}')
    print(f'  mrpro 已有:  {found}')
    print(f'  增强匹配找回: {len(recovered)}')
    print(f'  仍然缺失:    {len(still_missing)}')

    if recovered:
        print(f'\n📋 找回的 {len(recovered)} 本:')
        for fp in recovered[:30]:
            print(f'  ✅ {fp.stem}')
        if len(recovered) > 30:
            print(f'  ... 还有 {len(recovered)-30} 本')

    if still_missing:
        print(f'\n⚠️ 仍然缺失的 {len(still_missing)} 本（需要手动确认）:')
        for fp in still_missing[:20]:
            print(f'  ❓ {fp.stem}')

    if apply and recovered:
        print(f'\n🔧 把找回的 {len(recovered)} 本加入 mrpro...')
        with MrproFile(mrpro_path) as m:
            m.load_db()
            added = 0
            for fp in recovered:
                title = re.sub(r'\.(txt|epub|mobi|azw3?)$', '', fp.name, flags=re.I)
                # 提取作者
                author = ''
                match = re.search(r'[》]?\s*([^\s《》\[\]]{2,10})\s*$', title)
                if match:
                    author = match.group(1)
                m.add_book(book=title, author=author, category='')
                added += 1
            out = mrpro_path.with_stem(mrpro_path.stem + '-patched')
            m.save_as(out)
            print(f'✅ 已添加 {added} 本，保存到: {out}')
    elif apply:
        print('\n没有需要找回的书。')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    export_dir = Path(sys.argv[1])
    mrpro_path = Path(sys.argv[2])
    apply = '--apply' in sys.argv
    scan_and_match(export_dir, mrpro_path, apply)

