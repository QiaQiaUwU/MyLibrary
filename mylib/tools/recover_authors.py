#!/usr/bin/env python3
"""
recover_authors.py — 从书名找回作者

很多书从不同来源入库时丢了作者信息，被标成"佚名/未知"，
但书名里往往带着作者名（如"书名_诗无茶""书名 作者诗无茶""书名by诗无茶"）。
这个脚本扫描佚名书的书名，把作者名提取出来归并。

用法：
  python recover_authors.py F:\\MyLibrary --scan      # 预览能找回多少
  python recover_authors.py F:\\MyLibrary --apply     # 实际写回
"""
import sqlite3
import re
import sys
from pathlib import Path
from collections import defaultdict

ANON = {'佚名', '匿名', '未知', '无名', '未知作者', '', None}

# 这些不是作者名：题材/标签、文件格式、纯标记、垃圾词。提取到这些一律不当作者（np 是题材不是作者）。
NOT_AUTHOR = {
    'np','nph','abo','omegaverse','bg','bl','gb','gl','sm','bdsm','sp','dom','sub',
    'he','be','oe','sc','vip','end','txt','doc','docx','pdf','epub','mobi','azw3','azw','html','zip','rar',
    '正文','全文','番外','完结','全本','合集','文包','无删减','删减','未删','原版','选集','类型','题材',
    '佚名','匿名','未知','无名','未知作者','作者','著','无','全','上','中','下','卷',
}
def _is_bad_author(s: str) -> bool:
    if not s:
        return True
    t = s.strip().strip('_').strip()
    if not t:
        return True
    low = t.lower()
    if low in NOT_AUTHOR or t in NOT_AUTHOR:
        return True
    if re.fullmatch(r'[\d._\-\s]+', t):           # 纯数字/符号
        return True
    if re.fullmatch(r'[A-Za-z]', t):              # 单个英文字母
        return True
    if re.fullmatch(r'\d{1,2}[pP]', t):           # 3p / 4p 这类题材
        return True
    return False

# 显式作者标记
AUTHOR_MARK = re.compile(r'(?:作者|著者|by|BY|By|bY|@|＠|—|by\s)\s*([\u4e00-\u9fa5A-Za-z0-9_]{2,12})')


def clean_candidate(s: str) -> str:
    """清理提取出的候选作者名"""
    s = s.strip().strip('_').strip()
    # 去掉尾部版本号/日期（_1, 24.7.19, 完结番 等）
    s = re.sub(r'[_\s]*\d[\d.\s]*$', '', s)
    s = re.sub(r'(完结|番外|全本|未删|原版|版|完)$', '', s)
    return s.strip('_').strip()


def get_known_authors(conn) -> set:
    """库里所有非佚名的作者名（用于书名匹配）"""
    authors = set()
    for r in conn.execute('SELECT DISTINCT author FROM books WHERE author IS NOT NULL'):
        a = r['author']
        if a and a not in ANON and 2 <= len(a) <= 12:
            authors.add(a)
    return authors


def extract_author(title: str, known_authors: set):
    """从书名提取作者。返回 (作者名, 方式) 或 (None, None)"""
    if not title:
        return None, None
    # 1. 显式标记 作者XX / byXX
    m = AUTHOR_MARK.search(title)
    if m:
        cand = clean_candidate(m.group(1))
        if cand and 2 <= len(cand) <= 12 and not _is_bad_author(cand):
            return cand, 'explicit'
    # 2. 已知作者名出现在书名里：要求它在"结尾"、或"前后紧挨分隔符"，
    #    避免把书名开头/中间恰好出现的普通词误判成作者（这是"认错作者"的主要来源）。
    SEP = set('_ \u3000、，,·-—@＠（()[]【】「」/|')
    for a in sorted(known_authors, key=len, reverse=True):
        idx = title.rfind(a)
        if idx < 0:
            continue
        end_pos = idx + len(a)
        before = title[idx-1] if idx > 0 else ''
        after = title[end_pos] if end_pos < len(title) else ''
        at_end = end_pos >= len(title) - 2          # 在书名结尾附近
        pre_sep = idx > 0 and (before in SEP)        # 前面紧挨分隔符（书名_作者）
        post_sep = after in SEP                      # 后面紧挨分隔符（作者_书名/作者_完结）
        if at_end or pre_sep or post_sep:
            ca = clean_candidate(a)   # 命中的若是带后缀的碎片名（诗无茶_1/诗无茶完结）也清成核心名
            if _is_bad_author(ca or a):
                continue
            return (ca or a), 'match'
    return None, None


def _split_segs(title):
    # 按常见分隔符把书名切成段
    parts = re.split(r'[_\s\u3000、，,·\-—@＠（）()\[\]【】「」/|~～]+', title or '')
    return [p for p in parts if p]


def infer_authors_by_frequency(titles, base_known=None, min_count=4):
    """从一批书名里推断作者：同一个作者写过多本书，其名字会作为首段或尾段，
    反复出现在多个【不同书名】里（如 书名A_诗无茶 / 书名B_诗无茶 / 诗无茶_书名C）。
    只有当某个段，是至少 min_count 本【不同书】的首段或尾段时，才认作疑似作者——
    这条"多本不同书共用"的约束能挡掉番外/完结/合集这类反复出现但其实不是作者的词，
    以及偶然撞车的普通词。最终仍走预览，由你过目后再决定是否应用。"""
    from collections import defaultdict
    base_known = set(base_known or set())
    tail_rest = defaultdict(set)   # 尾段 -> 去掉它之后的"剩余书名"集合（衡量是否多本不同书）
    head_rest = defaultdict(set)
    for t in titles:
        segs = _split_segs(t)
        if len(segs) < 2:
            continue
        head, tail = segs[0], segs[-1]
        if 2 <= len(tail) <= 12 and not _is_bad_author(tail):
            tail_rest[tail].add(''.join(segs[:-1]))
        if 2 <= len(head) <= 12 and not _is_bad_author(head):
            head_rest[head].add(''.join(segs[1:]))
    inferred = set()
    for seg, rests in list(tail_rest.items()) + list(head_rest.items()):
        if len(rests) >= min_count and seg not in base_known:
            c = clean_candidate(seg) or seg
            if c and 2 <= len(c) <= 12 and not _is_bad_author(c):
                inferred.add(c)
    return inferred


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    root = Path(sys.argv[1])
    apply = '--apply' in sys.argv
    db = root / 'library.db'
    if not db.exists():
        print(f'找不到数据库：{db}')
        return

    conn = sqlite3.connect(str(db))
    conn.row_factory = sqlite3.Row

    known = get_known_authors(conn)
    print(f'库里已知作者：{len(known)} 个\n')

    # 找出所有佚名书
    placeholders = ','.join('?' * len([a for a in ANON if a]))
    anon_list = [a for a in ANON if a]
    rows = conn.execute(
        f'SELECT id, title, author FROM books WHERE author IS NULL OR author IN ({placeholders})',
        anon_list).fetchall()
    print(f'佚名/无作者的书：{len(rows)} 本\n')

    recovered = defaultdict(list)
    updates = []
    for r in rows:
        author, how = extract_author(r['title'] or '', known)
        if author:
            recovered[author].append(r['title'])
            updates.append((author, r['id']))

    if not recovered:
        print('没有找到可恢复的作者')
        conn.close()
        return

    print(f'能找回作者的书：{len(updates)} 本，归入 {len(recovered)} 个作者：\n')
    for author, titles in sorted(recovered.items(), key=lambda x: -len(x[1])):
        print(f'  【{author}】 {len(titles)} 本')
        for t in titles[:3]:
            print(f'      {t[:40]}')
        if len(titles) > 3:
            print(f'      … 还有 {len(titles)-3} 本')

    if apply:
        conn.executemany('UPDATE books SET author=? WHERE id=?', updates)
        conn.commit()
        print(f'\n已写回 {len(updates)} 本书的作者')
    else:
        print(f'\n这是预览。确认无误后加 --apply 实际写回')
    conn.close()


if __name__ == '__main__':
    main()


