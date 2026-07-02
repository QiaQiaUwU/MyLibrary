#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
author_from_content.py — 按正文找回/合并作者
=============================================
很多同一作者的书用了不同笔名入库，单看书名/作者名看不出是同一个人，
但正文开头往往带着作者的"身份标记"：微博@、lofter、by XX、作者：XX、首发平台 ID。
本工具扫每本书正文开头，抽取这些标记，把"标记相同但作者名不一致"的书聚成一类，
建议归一到同一个作者（最稳的"按正文判断同一作者再合并"）。

预览优先：只给建议，执行合并由调用方在备份后进行。
"""
import re
from pathlib import Path

# 正文开头里常见的作者身份标记（按可靠性从高到低）
HANDLE_PATTERNS = [
    re.compile(r'微博[：:\s]*[@＠]?\s*([\u4e00-\u9fa5A-Za-z0-9_]{2,16})'),
    re.compile(r'(?:lofter|LOFTER|Lofter|老福特)[：:\s@＠]*([\u4e00-\u9fa5A-Za-z0-9_]{2,16})'),
    re.compile(r'(?:作者|著者|文by|文By)[：:\s]+([\u4e00-\u9fa5A-Za-z0-9_]{2,12})'),
    re.compile(r'\bby[\s:：]+([\u4e00-\u9fa5A-Za-z0-9_]{2,16})', re.I),
    re.compile(r'[@＠]\s*([\u4e00-\u9fa5A-Za-z0-9_]{2,16})'),
]

# 这些不是作者标记，提取到一律丢弃
BAD = {'作者', '著者', '晋江', 'lofter', '微博', '老福特', '正文', '简介', '文案', '番外',
       '完结', '连载', 'cp', 'CP', '论坛', '首发', '次发', '废文', 'by', 'BY',
       '原创', '同人', '现代', '古代', '主页', '更新', '存稿', '专栏'}


def extract_handles(text, limit=4000):
    """从正文开头 limit 字里抽取作者身份标记，返回去重集合（保留原大小写）。"""
    head = (text or '')[:limit]
    found = set()
    for pat in HANDLE_PATTERNS:
        for m in pat.findall(head):
            h = m.strip().strip('_-—·')
            if 2 <= len(h) <= 16 and h not in BAD and h.lower() not in BAD:
                found.add(h)
    return found


def _read_head(filepath: Path, max_bytes=200_000):
    """多编码读取正文开头一段（只为找作者标记，读前 max_bytes 即可）。"""
    try:
        with open(filepath, 'rb') as f:
            raw = f.read(max_bytes)
    except Exception:
        return ''
    for enc in ('utf-8', 'gbk', 'gb18030', 'big5', 'utf-16'):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode('utf-8', errors='ignore')


_ANON = {'佚名', '匿名', '未知', '无名', '未知作者', '', None}


def find_clusters(conn, root, max_bytes=200_000, on_progress=None):
    """
    扫全库正文开头，按身份标记聚类。
    返回 [{handle, suggested, books:[{id,title,author}]}]，
    只保留"同一标记、但记录的作者名不止一种"的簇（＝疑似笨名分裂）。
    """
    from collections import Counter
    rows = conn.execute("SELECT id, title, author, file_path FROM books").fetchall()
    total = len(rows)
    handle_books = {}
    for i, r in enumerate(rows):
        if on_progress and (i % 200 == 0):
            on_progress(i, total)
        rel = r['file_path'] if not isinstance(r, tuple) else r[3]
        fp = Path(root) / rel
        if not fp.exists():
            continue
        text = _read_head(fp, max_bytes)
        if not text:
            continue
        author = (r['author'] or '佚名')
        for h in extract_handles(text):
            handle_books.setdefault(h.lower(), {'disp': h, 'books': []})['books'].append(
                {'id': r['id'], 'title': r['title'] or '', 'author': author})

    clusters = []
    for key, v in handle_books.items():
        books = v['books']
        if len(books) < 2:
            continue
        authors = {b['author'] for b in books}
        if len(authors) < 2:
            continue  # 作者名已经一致，不用动
        # 选归一名：①作者名里有正好等于这个标记的（标记常就是主笔名）→ 用它；
        #          ②否则用出现最多的非佚名作者名；③都没有就用标记本身
        match = next((b['author'] for b in books if b['author'].lower() == key), None)
        if match:
            suggested = match
        else:
            cnt = Counter(b['author'] for b in books if b['author'] not in _ANON)
            suggested = cnt.most_common(1)[0][0] if cnt else v['disp']
        clusters.append({'handle': v['disp'], 'suggested': suggested, 'books': books})
    # 簇大的排前面
    clusters.sort(key=lambda c: -len(c['books']))
    return clusters


def apply_clusters(conn, clusters):
    """把每个簇里的书的作者改成该簇的 suggested。返回改动条数。"""
    n = 0
    for c in clusters:
        target = c['suggested']
        for b in c['books']:
            if b['author'] != target:
                conn.execute('UPDATE books SET author=? WHERE id=?', (target, b['id']))
                n += 1
    conn.commit()
    return n


if __name__ == '__main__':
    import sys, sqlite3
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.')
    conn = sqlite3.connect(str(root / 'library.db'))
    conn.row_factory = sqlite3.Row
    cl = find_clusters(conn, root)
    print(f'发现 {len(cl)} 个疑似同一作者(不同笔名)的簇：')
    for c in cl[:20]:
        print(f"  [{c['handle']}] → {c['suggested']}：" +
              '、'.join(f"{b['author']}《{b['title'][:12]}》" for b in c['books'][:4]))
