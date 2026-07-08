#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
build_search_index.py — 构建检索索引
======================================
两种索引：
  1. FTS5 全文检索（SQLite 内置，关键词匹配）
  2. 语义向量检索（DeepSeek embedding API，自然语言描述匹配）

用法:
  # 构建 FTS5 索引（必做，免费，约 10-30 分钟）
  python build_search_index.py F:\MyLibrary --fts

  # 构建语义索引（可选，需要 API key，约 1-2 小时）
  python build_search_index.py F:\MyLibrary --semantic

  # 只处理前 100 本测试
  python build_search_index.py F:\MyLibrary --fts --limit 100
"""

import json, os, re, sys, sqlite3, time
from pathlib import Path


def read_book_text(filepath: Path, max_chars: int = 50000) -> str:
    """读取书籍文本（多编码兼容）"""
    raw = filepath.read_bytes()
    for enc in ('utf-8', 'gbk', 'gb18030', 'big5', 'utf-16'):
        try:
            text = raw.decode(enc, errors='ignore')
            cn = sum(1 for c in text[:3000] if '\u4e00' <= c <= '\u9fff')
            if cn / max(len(text[:3000]), 1) > 0.05:
                return text[:max_chars]
        except Exception:
            continue
    return raw.decode('utf-8', errors='ignore')[:max_chars]


# ============================================================
# FTS5 全文检索索引
# ============================================================
def build_fts_index(root: Path, limit: int = 0):
    """构建 SQLite FTS5 全文检索索引"""
    db_path = root / 'library.db'
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    # 确保 FTS 表存在
    conn.execute('''CREATE VIRTUAL TABLE IF NOT EXISTS books_fts USING fts5(
        title, author, content, content='', tokenize='unicode61'
    )''')

    # 清空重建
    conn.execute('DELETE FROM books_fts')

    rows = conn.execute(
        'SELECT id, title, author, file_path, file_ext FROM books ORDER BY id'
    ).fetchall()
    total = min(len(rows), limit) if limit else len(rows)

    print(f'📚 构建 FTS5 索引: {total} 本')
    indexed = skipped = 0

    for i, r in enumerate(rows[:total]):
        if (i + 1) % 500 == 0:
            print(f'  进度: {i+1}/{total} ({(i+1)*100//total}%)')
            conn.commit()

        ext = (r['file_ext'] or '').lower().lstrip('.')
        if ext not in ('txt', 'text'):
            skipped += 1
            # 非 txt 只索引标题和作者
            conn.execute('INSERT INTO books_fts(rowid, title, author, content) VALUES (?, ?, ?, ?)',
                         (r['id'], r['title'] or '', r['author'] or '', ''))
            continue

        filepath = root / r['file_path']
        if not filepath.exists():
            skipped += 1
            conn.execute('INSERT INTO books_fts(rowid, title, author, content) VALUES (?, ?, ?, ?)',
                         (r['id'], r['title'] or '', r['author'] or '', ''))
            continue

        text = read_book_text(filepath, max_chars=50000)  # 前 5 万字
        conn.execute('INSERT INTO books_fts(rowid, title, author, content) VALUES (?, ?, ?, ?)',
                     (r['id'], r['title'] or '', r['author'] or '', text))
        indexed += 1

    conn.commit()
    conn.close()
    print(f'\n✅ FTS5 索引完成: {indexed} 本已索引, {skipped} 本跳过')


# ============================================================
# 语义向量检索索引
# ============================================================
def build_semantic_index(root: Path, limit: int = 0):
    """构建语义检索索引（DeepSeek embedding API）"""
    import urllib.request

    config_path = Path(__file__).parent / 'config.json'
    if not config_path.exists():
        print('❌ config.json 不存在，请先配置 API key')
        sys.exit(1)

    with open(config_path) as f:
        config = json.load(f)
    ai = config.get('ai', {})
    api_key = ai.get('api_key', '')
    base_url = ai.get('base_url', 'https://api.deepseek.com/v1').rstrip('/')

    if not api_key:
        print('❌ API key 未配置，请在 config.json 或 /settings 页面配置')
        sys.exit(1)

    db_path = root / 'library.db'
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    # 创建向量存储表
    conn.execute('''CREATE TABLE IF NOT EXISTS book_embeddings (
        id INTEGER PRIMARY KEY,
        book_id INTEGER REFERENCES books(id),
        chunk_index INTEGER,
        chunk_text TEXT,
        embedding BLOB,
        UNIQUE(book_id, chunk_index)
    )''')

    rows = conn.execute(
        'SELECT id, title, author, file_path, file_ext FROM books ORDER BY id'
    ).fetchall()
    total = min(len(rows), limit) if limit else len(rows)

    # 已索引的跳过
    done_ids = {r[0] for r in conn.execute('SELECT DISTINCT book_id FROM book_embeddings')}
    todo = [(r['id'], r) for r in rows[:total] if r['id'] not in done_ids]

    print(f'📚 构建语义索引: {len(todo)} 本待处理 (已有 {len(done_ids)} 本)')

    for idx, (book_id, r) in enumerate(todo):
        if (idx + 1) % 10 == 0:
            print(f'  进度: {idx+1}/{len(todo)}')
            conn.commit()

        ext = (r['file_ext'] or '').lower().lstrip('.')
        if ext not in ('txt', 'text'):
            continue

        filepath = root / r['file_path']
        if not filepath.exists():
            continue

        text = read_book_text(filepath, max_chars=30000)
        if len(text) < 100:
            continue

        # 切段（每段 500 字，步长 300）
        chunks = []
        for i in range(0, len(text), 300):
            chunk = text[i:i+500]
            if len(chunk) >= 100:
                chunks.append(chunk)
            if len(chunks) >= 50:  # 每本最多 50 段
                break

        # 调用 embedding API（批量）
        try:
            embs = _get_embeddings(chunks, api_key, base_url)
            if not embs:
                continue
            for ci, (chunk, emb) in enumerate(zip(chunks, embs)):
                # 存为 JSON 字符串（轻量方案，不依赖 numpy）
                conn.execute(
                    'INSERT OR REPLACE INTO book_embeddings (book_id, chunk_index, chunk_text, embedding) VALUES (?,?,?,?)',
                    (book_id, ci, chunk[:200], json.dumps(emb)))
        except Exception as e:
            print(f'  ⚠️ {r["title"]}: {e}')
            time.sleep(1)
            continue

        time.sleep(0.2)  # 限速

    conn.commit()
    total_chunks = conn.execute('SELECT COUNT(*) FROM book_embeddings').fetchone()[0]
    total_books = conn.execute('SELECT COUNT(DISTINCT book_id) FROM book_embeddings').fetchone()[0]
    conn.close()
    print(f'\n✅ 语义索引完成: {total_books} 本, {total_chunks} 段')


def _get_embeddings(texts: list, api_key: str, base_url: str) -> list:
    """调用 embedding API"""
    import urllib.request, urllib.error
    payload = json.dumps({"input": texts, "model": "text-embedding-ada-002"}, ensure_ascii=False).encode()
    req = urllib.request.Request(
        f'{base_url}/embeddings',
        data=payload,
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'},
        method='POST')
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())
    return [d['embedding'] for d in result.get('data', [])]


def semantic_search(query: str, db_path: Path, api_key: str, base_url: str, top_k: int = 10) -> list:
    """语义检索：query → embedding → 余弦相似度 → top-k"""
    # 获取 query 的 embedding
    embs = _get_embeddings([query], api_key, base_url)
    if not embs:
        return []
    q_emb = embs[0]

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    results = []
    for r in conn.execute('SELECT book_id, chunk_index, chunk_text, embedding FROM book_embeddings'):
        c_emb = json.loads(r['embedding'])
        sim = _cosine_sim(q_emb, c_emb)
        results.append({
            'book_id': r['book_id'],
            'chunk_text': r['chunk_text'],
            'similarity': sim,
        })

    results.sort(key=lambda x: x['similarity'], reverse=True)

    # 按 book_id 去重（每本只保留最佳匹配段）
    seen = set()
    deduped = []
    for r in results:
        if r['book_id'] not in seen:
            seen.add(r['book_id'])
            # 补充书名作者
            book = conn.execute('SELECT title, author FROM books WHERE id=?', (r['book_id'],)).fetchone()
            if book:
                r['title'] = book['title']
                r['author'] = book['author']
            deduped.append(r)
            if len(deduped) >= top_k:
                break

    conn.close()
    return deduped


def _cosine_sim(a, b):
    """余弦相似度（纯 Python，不依赖 numpy）"""
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(x * x for x in b) ** 0.5
    return dot / (na * nb) if na and nb else 0


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    root = Path(sys.argv[1])
    if not (root / 'library.db').exists():
        print(f'❌ 找不到 {root}/library.db')
        sys.exit(1)

    limit = 0
    for arg in sys.argv:
        if arg.startswith('--limit'):
            try:
                limit = int(sys.argv[sys.argv.index(arg) + 1])
            except (ValueError, IndexError):
                pass

    if '--fts' in sys.argv:
        build_fts_index(root, limit)
    elif '--semantic' in sys.argv:
        build_semantic_index(root, limit)
    else:
        print('请指定 --fts 或 --semantic')

