#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
mylib_admin.py — 母库管理后台任务
===================================
封装长时间运行的维护任务（去重 / AI打标签 / 作者合并 / 补全核查），
带进度追踪，供 Web 管理面板调用。

所有任务都通过 TaskManager 异步运行，前端用 SSE 拉进度。
"""

import json, os, re, sqlite3, threading, time, queue
from pathlib import Path
from datetime import datetime
from collections import defaultdict


# ============================================================
# 任务管理器：跟踪后台任务状态 + 进度
# ============================================================
class Task:
    def __init__(self, task_id: str, kind: str):
        self.id = task_id
        self.kind = kind                # dedup_scan / dedup_apply / classify / merge / audit
        self.status = 'pending'         # pending / running / done / error / cancelled
        self.progress = 0               # 0-100
        self.message = ''
        self.detail = {}                # 任务特定的结果数据
        self.logs = []                  # 日志行
        self.started_at = None
        self.finished_at = None
        self.error = None
        self._cancel = threading.Event()

    def log(self, msg: str):
        line = f'[{datetime.now():%H:%M:%S}] {msg}'
        self.logs.append(line)
        if len(self.logs) > 500:
            self.logs = self.logs[-500:]
        self.message = msg

    def set_progress(self, pct: int, msg: str = None):
        self.progress = max(0, min(100, int(pct)))
        if msg:
            self.log(msg)

    def cancel(self):
        self._cancel.set()

    def is_cancelled(self):
        return self._cancel.is_set()

    def to_dict(self):
        return {
            'id': self.id, 'kind': self.kind, 'status': self.status,
            'progress': self.progress, 'message': self.message,
            'detail': self.detail, 'logs': self.logs[-50:],
            'started_at': self.started_at, 'finished_at': self.finished_at,
            'error': self.error,
        }


class TaskManager:
    def __init__(self):
        self.tasks = {}
        self._lock = threading.Lock()
        self._state_file = None  # 持久化文件路径，运行时设置

    def set_state_file(self, root):
        """设置任务状态持久化文件（母库目录下）"""
        from pathlib import Path
        self._state_file = Path(root) / '_task_state.json'
        self._load_state()

    def _load_state(self):
        """启动时读回上次的任务状态"""
        if not self._state_file or not self._state_file.exists():
            return
        try:
            import json
            data = json.loads(self._state_file.read_text(encoding='utf-8'))
            for tid, td in data.items():
                t = Task(tid, td.get('kind', ''))
                t.status = td.get('status', 'pending')
                # 上次还在 running 的，标记为"中断"
                if t.status == 'running':
                    t.status = 'interrupted'
                t.progress = td.get('progress', 0)
                t.message = td.get('message', '')
                t.detail = td.get('detail', {})
                t.started_at = td.get('started_at')
                t.finished_at = td.get('finished_at')
                self.tasks[tid] = t
        except Exception:
            pass

    def _save_state(self):
        """把任务状态写到磁盘"""
        if not self._state_file:
            return
        try:
            import json
            data = {}
            # 只保存最近 20 个任务，避免文件无限增长
            for tid, t in list(self.tasks.items())[-20:]:
                data[tid] = {
                    'kind': t.kind, 'status': t.status, 'progress': t.progress,
                    'message': t.message, 'detail': t.detail,
                    'started_at': t.started_at, 'finished_at': t.finished_at,
                }
            self._state_file.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
        except Exception:
            pass

    def create(self, kind: str) -> Task:
        tid = f'{kind}_{int(time.time()*1000)}'
        task = Task(tid, kind)
        with self._lock:
            self.tasks[tid] = task
        return task

    def get(self, task_id: str) -> Task:
        return self.tasks.get(task_id)

    def latest_of(self, kind: str):
        """找某类任务最近的一个（用于判断能否续跑）"""
        matches = [t for t in self.tasks.values() if t.kind == kind]
        return matches[-1] if matches else None

    def run_async(self, task: Task, fn, *args, **kwargs):
        def _wrap():
            task.status = 'running'
            task.started_at = datetime.now().isoformat()
            self._save_state()
            try:
                fn(task, *args, **kwargs)
                if not task.is_cancelled():
                    task.status = 'done'
                    task.progress = 100
            except Exception as e:
                task.status = 'error'
                task.error = str(e)
                task.log(f'出错: {e}')
                import traceback
                task.log(traceback.format_exc()[:1000])
            finally:
                task.finished_at = datetime.now().isoformat()
                self._save_state()
        t = threading.Thread(target=_wrap, daemon=True)
        t.start()
        return task


TASK_MANAGER = TaskManager()


# ============================================================
# 工具函数
# ============================================================
def read_book_text(filepath: Path, max_chars: int = 3000) -> str:
    """读取书籍开头（多编码兼容）"""
    try:
        raw = filepath.read_bytes()
    except Exception:
        return ''
    for enc in ('utf-8', 'gbk', 'gb18030', 'big5', 'utf-16'):
        try:
            text = raw.decode(enc, errors='ignore')
            cn = sum(1 for c in text[:1000] if '\u4e00' <= c <= '\u9fff')
            if cn / max(len(text[:1000]), 1) > 0.05:
                # 跳过开头的版权/网站声明，取正文
                return _skip_header(text)[:max_chars]
        except Exception:
            continue
    return raw.decode('utf-8', errors='ignore')[:max_chars]


def _skip_header(text: str) -> str:
    """跳过文件开头的下载站声明等噪音"""
    lines = text.split('\n')
    skip_keywords = ('本书由', '更多精彩', '下载', 'www.', 'http', '请勿用于商业',
                     '仅供', '版权', '声明', '【', '★', '☆')
    start = 0
    for i, line in enumerate(lines[:20]):
        if any(kw in line for kw in skip_keywords):
            start = i + 1
    return '\n'.join(lines[start:])


# ============================================================
# 任务 1: 去重扫描
# ============================================================
def task_dedup_scan(task: Task, root: Path):
    """扫描母库重复（不动文件，只生成报告）"""
    from dedup_library import _cluster_by_title, _norm_title

    db_path = root / 'library.db'
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    task.log('开始扫描母库...')
    total = conn.execute('SELECT COUNT(*) FROM books').fetchone()[0]
    task.detail['total_books'] = total

    groups = {'hash': [], 'title': [], 'stub': []}
    removed_ids = set()

    # 第一层：content_hash
    task.set_progress(10, '第一层：content_hash 去重...')
    hash_groups = defaultdict(list)
    for r in conn.execute('''SELECT id, title, author, file_path, file_size, word_count,
                                    content_hash, quality_score, is_favorite, is_read,
                                    chapter_count, extra_count
                             FROM books WHERE content_hash IS NOT NULL AND content_hash != ""'''):
        hash_groups[r['content_hash']].append(dict(r))
    for h, books in hash_groups.items():
        if len(books) < 2:
            continue
        books.sort(key=lambda b: (b['is_favorite'] or 0, b['quality_score'] or 0, b['word_count'] or 0), reverse=True)
        groups['hash'].append({'keep': books[0], 'remove': books[1:]})
        for b in books[1:]:
            removed_ids.add(b['id'])

    # 第二层：同作者书名相似
    task.set_progress(40, '第二层：同作者书名相似去重...')
    author_books = defaultdict(list)
    for r in conn.execute('''SELECT id, title, author, file_path, file_size, word_count,
                                    quality_score, is_favorite, is_read,
                                    chapter_count, extra_count
                             FROM books WHERE author IS NOT NULL AND author != ""'''):
        author_books[r['author']].append(dict(r))

    for author, books in author_books.items():
        books = [b for b in books if b['id'] not in removed_ids]
        if len(books) < 2:
            continue
        for cluster in _cluster_by_title(books):
            if len(cluster) < 2:
                continue
            cluster.sort(key=lambda b: (b['is_favorite'] or 0, b['quality_score'] or 0, b['word_count'] or 0), reverse=True)
            best = cluster[0]
            dups = []
            for b in cluster[1:]:
                wc1, wc2 = best['word_count'] or 1, b['word_count'] or 1
                if abs(wc1 - wc2) / max(wc1, wc2) < 0.20:
                    dups.append(b)
                    removed_ids.add(b['id'])
            if dups:
                groups['title'].append({'keep': best, 'remove': dups})

    # 第三层：空壳残章
    task.set_progress(70, '第三层：空壳/残章清理...')
    for author, books in author_books.items():
        books = [b for b in books if b['id'] not in removed_ids]
        for cluster in _cluster_by_title(books):
            if len(cluster) < 2:
                continue
            max_wc = max(b['word_count'] or 0 for b in cluster)
            if max_wc < 1000:
                continue
            best = max(cluster, key=lambda b: (b['word_count'] or 0))
            stubs = [b for b in cluster if b['id'] != best['id']
                     and (b['word_count'] or 0) < max_wc * 0.05 and b['id'] not in removed_ids]
            if stubs:
                groups['stub'].append({'keep': best, 'remove': stubs})
                for b in stubs:
                    removed_ids.add(b['id'])

    # 章节数据覆盖率：判断用户是否已经跑过『完结识别』（它会把 chapter_count 存进库）
    try:
        ch_have = conn.execute("SELECT COUNT(*) FROM books WHERE chapter_count IS NOT NULL").fetchone()[0]
    except Exception:
        ch_have = 0
    conn.close()
    n_hash = sum(len(g['remove']) for g in groups['hash'])
    n_title = sum(len(g['remove']) for g in groups['title'])
    n_stub = sum(len(g['remove']) for g in groups['stub'])
    total_remove = n_hash + n_title + n_stub

    task.set_progress(85, '数章节，挑最全的版本保留...')
    _refine_keep_by_chapters(groups, root)
    # 给每组一个稳定编号 gid（顺序与 _build_preview / apply 遍历一致），供前端手动指定保留项
    _gid = 0
    for _layer in ('hash', 'title', 'stub'):
        for _g in groups[_layer]:
            _g['gid'] = _gid; _gid += 1
    preview = _build_preview(groups, root=root)

    # 统计异常组数量
    anomaly_count = sum(1 for p in preview if p.get('anomaly'))

    task.detail.update({
        'total_books': total,
        'dup_hash': n_hash,
        'dup_title': n_title,
        'dup_stub': n_stub,
        'total_removable': total_remove,
        'after_dedup': total - total_remove,
        'anomaly_count': anomaly_count,
        'chapters_ready': ch_have,
        'preview': preview,
    })
    # 把完整去重组缓存到任务，供 apply 用
    task._dedup_groups = groups
    msg = f'扫描完成：可清理 {total_remove} 本，清理后剩 {total - total_remove} 本'
    if anomaly_count:
        msg += f'（⚠️ {anomaly_count} 组疑似异常，已标红，请检查）'
    if ch_have < total * 0.3:
        msg += '　提示：先跑一遍「完结识别」会统计章节，查重挑保留版本会更准。'
    task.set_progress(100, msg)


def _refine_keep_by_chapters(groups, root, limit_per=400):
    """在每个重复组里挑'最全'的那本保留。
    优先用『完结识别』已经算好并存进库的 chapter_count / extra_count（可靠、且不限组数）；
    没有存过的，才现场数一遍（仍限 limit_per，避免太慢）。这样'先补章节再查重'就生效了。"""
    from chapter_counter import count_chapters

    def _eff(b):
        # 取这本书的有效章节/番外（优先库里存的，其次现场数的）
        ch = b.get('chapter_count')
        ex = b.get('extra_count')
        if ch is None:
            ch = b.get('_ch')
        if ex is None:
            ex = b.get('_ex')
        ch = ch or 0
        ex = ex or 0
        # 防误数：番外>60、章节>3000 视为异常，按 0 处理
        return (0 if ch > 3000 else ch), (0 if ex > 60 else ex)

    for layer in ('hash', 'title', 'stub'):
        counted = 0
        for g in groups[layer]:
            allb = [g['keep']] + g['remove']
            # 谁的章节数据缺失，且还没超过现场计数预算，就数一下
            for b in allb:
                if b.get('chapter_count') is not None or '_ch' in b:
                    continue
                if counted >= limit_per:
                    b['_ch'] = b['_ex'] = 0
                    continue
                ch = ex = 0
                try:
                    if root:
                        fp = root / b['file_path']
                        if fp.exists():
                            r = count_chapters(fp)
                            ch = r.get('chapters') or 0
                            ex = r.get('extras') or 0
                            counted += 1
                except Exception:
                    pass
                b['_ch'], b['_ex'] = ch, ex
            # 排序挑最全：收藏 > 字数 > 章节 > 文件大小 > 番外
            # （字数和章节都是'完整度'信号，章节来自完结识别时很可靠）
            def _key(b):
                ch, ex = _eff(b)
                return (b.get('is_favorite') or 0,
                        b.get('word_count') or 0,
                        ch,
                        b.get('file_size') or 0,
                        ex)
            allb.sort(key=_key, reverse=True)
            g['keep'] = allb[0]
            g['remove'] = allb[1:]
            # 把有效章节回填，供预览展示
            for b in allb:
                ch, ex = _eff(b)
                b.setdefault('_ch', ch); b.setdefault('_ex', ex)


def _build_preview(groups, root=None, limit=200):
    """构建去重预览，含章节数对比和异常标记"""
    from chapter_counter import count_chapters, detect_hash_anomaly
    preview = []
    for layer, label in [('hash', 'hash相同'), ('title', '书名相似'), ('stub', '空壳残章')]:
        for g in groups[layer][:limit//3]:
            all_books = [g['keep']] + g['remove']

            # hash 层检测异常（内容相同但书名差异大）
            is_anomaly = False
            if layer == 'hash':
                is_anomaly = detect_hash_anomaly(all_books)

            # 对每本统计章节数（_refine 已数过就直接用，避免重复读文件）
            def book_info(b):
                info = {'title': b['title'], 'author': b['author'],
                        'wc': b['word_count'] or 0,
                        'size': b.get('file_size', 0) or 0,
                        'path': b['file_path'], 'id': b['id'],
                        'chapters': b.get('_ch'), 'extras': b.get('_ex')}
                if info['chapters'] is None and root and layer in ('hash', 'title'):
                    fp = root / b['file_path']
                    if fp.exists():
                        ch = count_chapters(fp)
                        info['chapters'] = ch['chapters']
                        info['extras'] = ch['extras']
                return info

            preview.append({
                'layer': label,
                'anomaly': is_anomaly,
                'gid': g.get('gid'),
                'keep': book_info(g['keep']),
                'remove': [book_info(b) for b in g['remove']],
            })
    return preview


# ============================================================
# 任务 2: 去重执行
# ============================================================
def _carry_user_data(conn, from_id, to_id):
    """去重删掉旧版本前，把用户在那本上留下的东西搬到"保留"的那本，
    避免简评/评分/收藏/已读/最近阅读/标签/划线/书签/笔记/进度丢失（即"版本更新沿用旧笔记"）。"""
    try:
        cols = "user_notes, rating, is_favorite, is_read, reading_status, last_open"
        a = conn.execute(f"SELECT {cols} FROM books WHERE id=?", (from_id,)).fetchone()
        k = conn.execute(f"SELECT {cols} FROM books WHERE id=?", (to_id,)).fetchone()
        if a and k:
            sets, vals = [], []
            # 简评：保留项没写过才用旧的
            if not (str(k[0] or '').strip()) and str(a[0] or '').strip():
                sets.append("user_notes=?"); vals.append(a[0])
            # 评分：取较大（非空）
            if (a[1] or 0) > (k[1] or 0):
                sets.append("rating=?"); vals.append(a[1])
            # 收藏 / 已读：或运算
            if (a[2] or 0) and not (k[2] or 0):
                sets.append("is_favorite=1")
            if (a[3] or 0) and not (k[3] or 0):
                sets.append("is_read=1")
            # 阅读状态：finished > reading > unread，取更靠后的
            rank = {'finished': 3, 'reading': 2, 'unread': 1, '': 0, None: 0}
            if rank.get(a[4], 0) > rank.get(k[4], 0):
                sets.append("reading_status=?"); vals.append(a[4])
            # 最近阅读时间：取更晚的
            if str(a[5] or '') > str(k[5] or ''):
                sets.append("last_open=?"); vals.append(a[5])
            if sets:
                vals.append(to_id)
                conn.execute(f"UPDATE books SET {','.join(sets)} WHERE id=?", vals)
    except Exception:
        pass
    # 标签并集：把旧书的标签关系搬给保留项
    try:
        conn.execute("INSERT OR IGNORE INTO book_tags(book_id, tag_id) "
                     "SELECT ?, tag_id FROM book_tags WHERE book_id=?", (to_id, from_id))
    except Exception:
        pass
    # 位置相关（划线/书签/笔记/进度/日记）：保留项一条都没有时，才把旧书的搬过去
    # （位置随版本不同会错位，所以只在保留项为空时整体迁移，最稳妥）
    for tbl in ('highlights', 'bookmarks', 'reading_notes', 'reading_progress', 'reading_diary'):
        try:
            kc = conn.execute(f"SELECT COUNT(*) FROM {tbl} WHERE book_id=?", (to_id,)).fetchone()[0]
            if kc == 0:
                conn.execute(f"UPDATE {tbl} SET book_id=? WHERE book_id=?", (to_id, from_id))
        except Exception:
            pass


def _copy_user_data(conn, from_id, to_id):
    """把 from_id 的用户数据【复制】给 to_id（两本都保留，区别于去重的搬移）。
    书级字段：目标空着才填；位置相关(划线/书签/笔记/进度/日记)：目标该表为空才整表复制，避免重复。"""
    try:
        cols = "user_notes, rating, is_favorite, is_read, reading_status, last_open"
        a = conn.execute(f"SELECT {cols} FROM books WHERE id=?", (from_id,)).fetchone()
        k = conn.execute(f"SELECT {cols} FROM books WHERE id=?", (to_id,)).fetchone()
        if a and k:
            sets, vals = [], []
            if not str(k[0] or '').strip() and str(a[0] or '').strip():
                sets.append("user_notes=?"); vals.append(a[0])
            if (a[1] or 0) > (k[1] or 0): sets.append("rating=?"); vals.append(a[1])
            if (a[2] or 0) and not (k[2] or 0): sets.append("is_favorite=1")
            if (a[3] or 0) and not (k[3] or 0): sets.append("is_read=1")
            rank = {'finished': 3, 'reading': 2, 'unread': 1, '': 0, None: 0}
            if rank.get(a[4], 0) > rank.get(k[4], 0): sets.append("reading_status=?"); vals.append(a[4])
            if str(a[5] or '') > str(k[5] or ''): sets.append("last_open=?"); vals.append(a[5])
            if sets:
                vals.append(to_id)
                conn.execute(f"UPDATE books SET {','.join(sets)} WHERE id=?", vals)
    except Exception:
        pass
    try:
        conn.execute("INSERT OR IGNORE INTO book_tags(book_id, tag_id) "
                     "SELECT ?, tag_id FROM book_tags WHERE book_id=?", (to_id, from_id))
    except Exception:
        pass
    for tbl in ('highlights', 'bookmarks', 'reading_notes', 'reading_progress', 'reading_diary'):
        try:
            kc = conn.execute(f"SELECT COUNT(*) FROM {tbl} WHERE book_id=?", (to_id,)).fetchone()[0]
            if kc:
                continue
            tcols = [r[1] for r in conn.execute(f"PRAGMA table_info({tbl})").fetchall() if r[1] != 'id']
            if 'book_id' not in tcols:
                continue
            sel = ', '.join((str(int(to_id)) if c == 'book_id' else c) for c in tcols)
            conn.execute(f"INSERT INTO {tbl} ({', '.join(tcols)}) SELECT {sel} FROM {tbl} WHERE book_id=?", (from_id,))
        except Exception:
            pass


def _book_richness(conn, bid):
    """这本书上用户数据有多少（用来在同名几本里挑‘最全’的那本当来源）"""
    n = 0
    for tbl in ('highlights', 'reading_notes', 'bookmarks'):
        try:
            n += conn.execute(f"SELECT COUNT(*) FROM {tbl} WHERE book_id=?", (bid,)).fetchone()[0]
        except Exception:
            pass
    try:
        r = conn.execute("SELECT user_notes, rating FROM books WHERE id=?", (bid,)).fetchone()
        if r and str(r[0] or '').strip():
            n += 2
        if r and (r[1] or 0):
            n += 1
    except Exception:
        pass
    return n


def task_sync_same_title(task: Task, root: Path, apply: bool = False):
    """同名书笔记互通：把同一本书的不同版本（含‘更全的版本’，书名带 精校/全本/番外 等也能认）里，
    已有的划线/笔记/书签/简评/评分/收藏/已读/进度，复制到同组里【还是空白】的那些版本上。
    非破坏：只往空版本里补，不动已有数据的版本；两本都保留。先预览，确认后执行。"""
    import re as _re
    from collections import defaultdict
    from dedup_library import _cluster_by_title
    db = root / 'library.db'
    conn = sqlite3.connect(str(db)); conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT id, title, author FROM books").fetchall()

    def norm_author(a):
        return _re.sub(r'\s', '', (a or '')).lower()

    by_author = defaultdict(list)
    for r in rows:
        by_author[norm_author(r['author'])].append({'id': r['id'], 'title': r['title'] or '', 'author': r['author'] or ''})

    plan = []   # (src_id, src_title, [target_ids...])
    for _au, books in by_author.items():
        if len(books) < 2:
            continue
        for cluster in _cluster_by_title(books):
            ids = [b['id'] for b in cluster]
            src = max(ids, key=lambda i: _book_richness(conn, i))
            if _book_richness(conn, src) == 0:
                continue
            targets = [i for i in ids if i != src and _book_richness(conn, i) == 0]
            if targets:
                title = next((b['title'] for b in cluster if b['id'] == src), '')
                plan.append((src, title, targets))

    n_targets = sum(len(t[2]) for t in plan)
    if not apply:
        preview = [{'title': p[1], 'from_id': p[0], 'to_count': len(p[2])} for p in plan[:60]]
        task.detail = {'groups': len(plan), 'targets': n_targets, 'preview': preview}
        task.message = (f'预览：{len(plan)} 组同名书里，有 {n_targets} 本空白版本可以接上已有的笔记/划线/简评/进度。确认后点「执行互通」写入。'
                        if plan else '没有可互通的：要么没有同名多版本，要么每组里要么都空、要么都已各自有数据。')
        conn.close()
        return

    # 执行前自动备份
    try:
        import shutil
        bak = str(db) + '.bak_before_sync'
        shutil.copy2(str(db), bak)
        task.log(f'已备份到 {bak}')
    except Exception as e:
        task.log(f'备份失败（继续执行）：{e}')

    done = 0
    for src, title, targets in plan:
        for tgt in targets:
            _copy_user_data(conn, src, tgt)
            done += 1
        task.progress = min(99, int(done / max(1, n_targets) * 100))
    conn.commit(); conn.close()
    task.detail = {'groups': len(plan), 'synced': done}
    task.message = f'完成：在 {len(plan)} 组同名书里，把已有的笔记/划线/简评/进度等接到了 {done} 本空白版本上。'


def task_dedup_apply(task: Task, root: Path, scan_task: Task, overrides=None):
    """执行去重：把重复文件移到隔离区。
    overrides: {gid: keep_book_id} —— 用户在预览里手动选定的"保留"项（章节数不准时人工纠正）。"""
    import shutil
    if not hasattr(scan_task, '_dedup_groups'):
        raise RuntimeError('请先运行扫描')

    groups = scan_task._dedup_groups
    # 先套用用户的手动指定：把某组的保留项换成用户点的那本
    if overrides:
        ov = {str(k): v for k, v in overrides.items()}
        swapped = 0
        for layer in ('hash', 'title', 'stub'):
            for g in groups[layer]:
                gid = str(g.get('gid'))
                if gid in ov:
                    want = ov[gid]
                    allb = [g['keep']] + g['remove']
                    chosen = next((b for b in allb if b['id'] == want), None)
                    if chosen and chosen is not g['keep']:
                        g['keep'] = chosen
                        g['remove'] = [b for b in allb if b['id'] != chosen['id']]
                        swapped += 1
        if swapped:
            task.log(f'已按你手动指定调整 {swapped} 组的保留项')
    db_path = root / 'library.db'
    quarantine = root / '_quarantine' / f'dedup_{datetime.now():%Y%m%d_%H%M%S}'

    # 备份
    bak = db_path.with_suffix('.db.bak_before_dedup')
    if not bak.exists():
        shutil.copy2(db_path, bak)
        task.log(f'已备份: {bak.name}')

    quarantine.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))

    all_removes = []
    skipped_anomaly = 0
    from chapter_counter import detect_hash_anomaly
    for layer in ('hash', 'title', 'stub'):
        for g in groups[layer]:
            # hash 层：内容相同但书名差异大的，跳过不删（可能是空壳/错误文件）
            if layer == 'hash':
                all_books = [g['keep']] + g['remove']
                if detect_hash_anomaly(all_books):
                    skipped_anomaly += len(g['remove'])
                    continue
            for b in g['remove']:
                all_removes.append((layer, b, g['keep']))

    total = len(all_removes)
    moved = 0
    if skipped_anomaly:
        task.log(f'⚠️ 跳过 {skipped_anomaly} 本疑似异常文件（内容相同但书名不同，需人工检查）')
    task.log(f'开始隔离 {total} 个重复文件...')

    for i, (layer, b, keep) in enumerate(all_removes):
        if task.is_cancelled():
            task.log('已取消')
            break
        if i % 50 == 0:
            task.set_progress(int(i / max(total, 1) * 100), f'进度 {i}/{total}')
            conn.commit()

        src = root / b['file_path']
        if src.exists():
            dst = quarantine / src.name
            if dst.exists():
                dst = quarantine / f'{src.stem}_{b["id"]}{src.suffix}'
            try:
                shutil.move(str(src), str(dst))
                moved += 1
            except Exception as e:
                task.log(f'移动失败 {src.name}: {e}')
                continue
        # 删除前先把这本上的简评/评分/标签/划线等搬到"保留"的那本，避免丢失
        _carry_user_data(conn, b['id'], keep['id'])
        # 从 books 表删记录 + 记到 duplicates
        try:
            conn.execute('''INSERT INTO duplicates (reason, dup_path, original_path, quarantine_time, primary_book_id)
                           VALUES (?, ?, ?, datetime('now'), ?)''',
                        (f'dedup_{layer}', b['file_path'], keep['file_path'], keep['id']))
        except Exception:
            pass
        conn.execute('DELETE FROM books WHERE id=?', (b['id'],))

    conn.commit()
    conn.close()
    task.detail = {'moved': moved, 'total': total, 'quarantine': str(quarantine)}
    task.set_progress(100, f'去重完成：{moved} 个文件移到隔离区')


# ============================================================
# 任务 3: AI 内容打标签
# ============================================================
def estimate_classify_cost(root: Path, scope: str, scope_value: str = None) -> dict:
    """预估打标签的范围和成本"""
    conn = sqlite3.connect(str(root / 'library.db'))
    conn.row_factory = sqlite3.Row

    where, params = _build_scope_where(scope, scope_value)
    sql = f'SELECT COUNT(*) FROM books WHERE {where}'
    n = conn.execute(sql, params).fetchone()[0]
    conn.close()

    # 粗略估算：每本约 1500 token 输入 + 100 输出
    # DeepSeek: 输入 ~1元/百万token, 输出 ~2元/百万token
    in_tokens = n * 1500
    out_tokens = n * 100
    cost_rmb = in_tokens / 1_000_000 * 1 + out_tokens / 1_000_000 * 2
    minutes = n * 1.5 / 60  # 每本约 1.5 秒（含限速）

    return {
        'count': n,
        'est_cost_rmb': round(cost_rmb, 2),
        'est_minutes': round(minutes, 1),
        'scope': scope,
        'scope_value': scope_value,
    }


def _build_scope_where(scope: str, scope_value: str = None):
    """根据范围构建 WHERE 子句"""
    if scope == 'all':
        return '1=1', []
    elif scope == 'untagged':
        # 没有体裁标签的书
        return '''id NOT IN (
            SELECT DISTINCT bt.book_id FROM book_tags bt
            JOIN tags t ON t.id=bt.tag_id WHERE t.kind='genre'
        )''', []
    elif scope == 'take':
        return 'take_to_tablet=1', []
    elif scope == 'author' and scope_value:
        return 'author=?', [scope_value]
    else:
        return '1=1', []


def task_import_folder(task: Task, root: Path, folder: str):
    """批量入库：扫描一个文件夹里的所有小说文件，解压/去重后入库。
    用线程内独立的 Library（自带独立 sqlite 连接），不动主连接。"""
    task.set_progress(3, f'开始扫描：{folder}')
    p = Path(folder).expanduser()
    if not p.exists():
        task.set_progress(100, '找不到这个文件夹：' + folder)
        task.detail = {'error': 'not_found'}
        return
    try:
        from mylib_core import Library, scan_and_import
        lib2 = Library(str(root))
        task.set_progress(10, '正在扫描、去重、入库（大文件夹会比较久）…')
        stats = scan_and_import(lib2, [str(p)], cleanup_orphans=False)
        try:
            lib2.conn.close()
        except Exception:
            pass
        new = stats.get('new', 0); dup = stats.get('dup', 0)
        task.detail = {'stats': stats}
        task.set_progress(100, f'完成：新增 {new} 本，重复跳过 {dup} 本')
    except Exception as e:
        import traceback
        task.log(traceback.format_exc()[:1000])
        task.set_progress(100, '入库出错：' + str(e))
        task.detail = {'error': str(e)}

def task_auto_collect(task: Task, root: Path, move: bool = False, dry_run: bool = True):
    """自动收拢散落的小说：扫微信/QQ 接收、下载、桌面等常见位置并入库。
    dry_run=True 只预览（不动任何文件）；move=True 时入库后把原文件移进书库（从原处移走）。"""
    from pathlib import Path as _P
    home = _P.home()
    docs = home / 'Documents'
    cand = []
    def add(p):
        try:
            if p and p.exists() and p.is_dir():
                cand.append(p)
        except Exception:
            pass
    # 微信（新版 xwechat_files / 旧版 WeChat Files），文件接收目录
    for base in (docs, home):
        try:
            for d in base.glob('WeChat Files/*/FileStorage/File'):
                add(d)
            for d in base.glob('xwechat_files/*/msg/file'):
                add(d)
        except Exception:
            pass
    # QQ / TIM 接收
    try:
        for d in docs.glob('Tencent Files/*/FileRecv'):
            add(d)
        for d in docs.glob('Tencent Files/*/nt_qq/*/file'):
            add(d)
    except Exception:
        pass
    # 下载 / 桌面
    add(home / 'Downloads')
    add(home / 'Desktop')
    # 路径去重
    seen, locs = set(), []
    for p in cand:
        s = str(p).lower()
        if s not in seen:
            seen.add(s); locs.append(str(p))
    task.detail['locations'] = locs
    if not locs:
        task.set_progress(100, '没找到常见的微信/QQ/下载/桌面目录。可用上面的「批量入库」手动指定文件夹。')
        return
    names = '、'.join(_P(x).name for x in locs)
    task.set_progress(8, ('预览（不动文件）：' if dry_run else '入库：') + '扫描 ' + names)
    try:
        from mylib_core import Library, scan_and_import
        lib2 = Library(str(root))
        stats = scan_and_import(lib2, locs, move=(move and not dry_run),
                                dry_run=dry_run, cleanup_orphans=False)
        try:
            lib2.conn.close()
        except Exception:
            pass
        new = stats.get('new', 0); dup = stats.get('dup', 0)
        task.detail['stats'] = stats
        if dry_run:
            task.set_progress(100, f'预览：约可新增 {new} 本（重复 {dup} 本会自动跳过）。确认无误后点「执行入库」，会把它们移进书库（原处移走）。')
        else:
            task.set_progress(100, f'完成：新增 {new} 本，重复跳过 {dup} 本。原文件已移入书库。')
    except Exception as e:
        import traceback
        task.log(traceback.format_exc()[:1000])
        task.set_progress(100, '出错：' + str(e))
        task.detail['error'] = str(e)

def task_classify(task: Task, root: Path, ai_config: dict, scope: str,
                  scope_value: str = None, apply: bool = True):
    """AI 读内容打标签"""
    import urllib.request, urllib.error

    api_key = ai_config.get('api_key', '')
    base_url = ai_config.get('base_url', 'https://api.deepseek.com/v1').rstrip('/')
    model = ai_config.get('model', 'deepseek-chat')
    if not api_key:
        raise RuntimeError('API key 未配置')

    db_path = root / 'library.db'
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    where, params = _build_scope_where(scope, scope_value)
    rows = conn.execute(
        f'SELECT id, title, author, file_path, file_ext FROM books WHERE {where} ORDER BY id',
        params).fetchall()

    total = len(rows)
    task.detail['total'] = total
    task.log(f'范围内 {total} 本书待打标签')

    # 断点续传：已打过标签的跳过（除非 scope=all 强制重打）
    done_ids = set()
    if scope != 'all':
        for r in conn.execute('''SELECT DISTINCT bt.book_id FROM book_tags bt
                                 JOIN tags t ON t.id=bt.tag_id WHERE t.kind='genre' '''):
            done_ids.add(r[0])

    from classify_genres import VALID_GENRES, GENRES_SET, CLASSIFY_PROMPT

    tagged = skipped = failed = 0
    for i, r in enumerate(rows):
        if task.is_cancelled():
            task.log('已取消')
            break

        task.set_progress(int(i / max(total, 1) * 100),
                          f'{i+1}/{total} · 已打标{tagged} 跳过{skipped} 失败{failed}')

        if r['id'] in done_ids:
            skipped += 1
            continue

        ext = (r['file_ext'] or '').lower().lstrip('.')
        if ext not in ('txt', 'text'):
            skipped += 1
            continue

        filepath = root / r['file_path']
        if not filepath.exists():
            skipped += 1
            continue

        text = read_book_text(filepath, max_chars=3000)
        if len(text) < 100:
            skipped += 1
            continue

        # 调 API
        prompt = CLASSIFY_PROMPT.format(title=r['title'] or '', author=r['author'] or '', text=text)
        try:
            genres = _classify_one(prompt, api_key, base_url, model)
        except Exception as e:
            failed += 1
            task.log(f'失败 {r["title"]}: {str(e)[:80]}')
            time.sleep(1)
            continue

        if genres and apply:
            for g in genres:
                # 找/建 genre 标签
                tid_row = conn.execute("SELECT id FROM tags WHERE name=? AND kind='genre'", (g,)).fetchone()
                if tid_row:
                    tid = tid_row[0]
                else:
                    cur = conn.execute("INSERT INTO tags (name, kind) VALUES (?, 'genre')", (g,))
                    tid = cur.lastrowid
                conn.execute('INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)', (r['id'], tid))
            tagged += 1

        if i % 20 == 0:
            conn.commit()
        time.sleep(0.15)

    conn.commit()
    conn.close()
    task.detail.update({'tagged': tagged, 'skipped': skipped, 'failed': failed})
    task.set_progress(100, f'完成：{tagged} 本已打标，{skipped} 跳过，{failed} 失败')


def _classify_one(prompt: str, api_key: str, base_url: str, model: str) -> list:
    """调用 API 分类单本书"""
    import urllib.request
    from classify_genres import GENRES_SET

    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1,
        "max_tokens": 150,
    }, ensure_ascii=False).encode('utf-8')

    req = urllib.request.Request(
        f'{base_url}/chat/completions', data=payload,
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'},
        method='POST')
    with urllib.request.urlopen(req, timeout=40) as resp:
        result = json.loads(resp.read())
    content = result['choices'][0]['message']['content']

    # 解析返回的标签
    genres = []
    for g in re.split(r'[,，、\s]+', content):
        g = g.strip().strip('。.').lower()
        if g in GENRES_SET:
            genres.append(g)
    return genres[:6]  # 最多6个


# ============================================================
# 任务 4: 作者合并
# ============================================================
def task_merge_authors(task: Task, root: Path, apply: bool = False):
    """作者别名发现/合并"""
    import merge_authors as ma
    conn = sqlite3.connect(str(root / 'library.db'))

    alias_map = ma.build_full_alias_map(conn)
    conn.close()

    task.detail['alias_count'] = len(alias_map)
    task.log(f'共 {len(alias_map)} 条别名规则')

    if not apply:
        # 只预览
        preview = [{'alias': a, 'target': t} for a, t in list(alias_map.items())[:100]]
        task.detail['preview'] = preview
        task.set_progress(100, f'发现 {len(alias_map)} 条别名规则（预览模式）')
        return

    task.set_progress(20, '执行合并...')
    ma.apply_merge(root)
    task.set_progress(100, '作者合并完成')


import re as _re_na
# 这些是"描述性词"，不是作者名的一部分——书名里常被错当成作者
_NA_DESC = ['完结番外三篇','补全番外强推','完结+番外','番外三篇','近代架空','全EO文','番外强推',
            '完结','番外','补车番','补车','补番','补全','肉章','架空','全本','未删','无删减','原版',
            '更新','强推','换攻','正文','全文','合集','文包','每日更','日更','EO文','大哥']
def _core_author(name):
    """把'淮上-补车番/淮上肉章/priest完结番外三篇/火风L番外全EO文…'这类清成核心作者名。"""
    if not name:
        return name
    s = str(name).strip()
    # byXX / XX著 → 取作者部分，再清一次
    m = _re_na.search(r'(?:by|著)\s*([\u4e00-\u9fa5A-Za-z0-9]{2,16})\s*$', s, _re_na.I)
    if m:
        inner = m.group(1)
        return _core_author(inner) if inner != s else inner
    # 去日期 / 括注 / ※及其后
    s = _re_na.sub(r'\d{2,4}[.\-/年]\d{1,2}[.\-/月]?\d{0,2}日?', '', s)
    s = _re_na.sub(r'[（(【「][^）)】」]*[）)】」]', '', s)
    s = _re_na.split(r'[※★☆]', s)[0]
    # 作者名几乎不含句读/空格——出现就在第一处切断（通用兜底，覆盖我没枚举到的描述）
    s = _re_na.split(r'[，。！？；,;！\s]', s, 1)[0] or s
    # 砍掉"第一个出现的描述词"及其后面的所有内容（描述词不在开头时才砍）
    cut = len(s)
    for tok in _NA_DESC:
        i = s.find(tok)
        if 0 < i < cut:
            cut = i
    s = s[:cut].strip(' _-—、，,。.·\t')
    return s or str(name).strip()

def task_normalize_authors(task: Task, root: Path, apply: bool = False):
    """整理作者名：把书名解析残留（-补车番 / 肉章 / 完结番外 / byXX / 整句描述）规范成核心作者，
    并把'核心作者 + 纯英文数字尾巴'（如 火风L → 火风）并到一起。预览先看，执行会自动备份数据库。"""
    db = root / 'library.db'
    conn = sqlite3.connect(str(db)); conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT id, author FROM books WHERE author IS NOT NULL AND author!=''").fetchall()
    # 第一遍：core_author
    new_of = {}
    for r in rows:
        ca = _core_author(r['author'])
        if ca:
            new_of[r['id']] = ca
    # 第二遍：前缀合并——若 A 是 B 的前缀(A≥2字)、且 B 去掉 A 后只剩英文/数字/符号（如 火风L→火风），把 B 并到 A
    cleaned = set(new_of.values())
    short_first = sorted(cleaned, key=len)
    remap = {}
    for b in cleaned:
        for a in short_first:
            if a != b and len(a) >= 2 and b.startswith(a) and _re_na.fullmatch(r'[A-Za-z0-9_\-]+', b[len(a):] or 'x'):
                remap[b] = a
                break
    if remap:
        for bid in list(new_of):
            new_of[bid] = remap.get(new_of[bid], new_of[bid])
    # 统计真正发生变化的
    changes = []
    for r in rows:
        old = r['author']; na = new_of.get(r['id'], old)
        if na and na != old:
            changes.append((r['id'], old, na))
    # 折叠了多少作者（变化前后不同名）
    affected_authors = sorted({c[1] for c in changes})
    examples = [{'from': c[1], 'to': c[2]} for c in changes[:40]]
    task.detail['changed'] = len(changes)
    task.detail['authors_affected'] = len(affected_authors)
    task.detail['examples'] = examples
    if not apply:
        conn.close()
        task.set_progress(100, f'预览：可规范 {len(changes)} 本、合并 {len(affected_authors)} 个杂作者名。确认后点「执行」写回（会先自动备份数据库）。')
        return
    import shutil, time
    try:
        shutil.copy(str(db), str(db) + '.bak_' + time.strftime('%Y%m%d_%H%M%S'))
    except Exception:
        pass
    task.set_progress(40, '写回作者名...')
    cur = conn.cursor()
    for bid, _old, na in changes:
        cur.execute("UPDATE books SET author=? WHERE id=?", (na, bid))
    conn.commit(); conn.close()
    task.set_progress(100, f'完成：规范了 {len(changes)} 本的作者名，合并了 {len(affected_authors)} 个杂名。回书房强刷即可看到。')

def task_author_by_content(task: Task, root: Path, apply: bool = False):
    """按正文找回/合并作者：扫正文开头的作者标记（微博@/lofter/by/作者：/首发平台），
    把"标记相同但作者名不一致"的书归一到同一作者（如 抗病毒口服液→送泥一条鱼）。
    预览先看；执行前自动备份数据库。"""
    import author_from_content as afc
    db = root / 'library.db'
    conn = sqlite3.connect(str(db)); conn.row_factory = sqlite3.Row
    task.set_progress(5, '扫描正文里的作者标记...')

    def prog(i, total):
        if total:
            task.set_progress(min(85, 5 + int(i / total * 80)), f'扫描正文 {i}/{total}...')

    clusters = afc.find_clusters(conn, root, on_progress=prog)
    examples, changed = [], 0
    for c in clusters:
        for b in c['books']:
            if b['author'] != c['suggested']:
                changed += 1
        examples.append({
            'handle': c['handle'], 'to': c['suggested'],
            'froms': sorted({b['author'] for b in c['books'] if b['author'] != c['suggested']}),
            'n': len(c['books']),
        })
    task.detail['clusters'] = len(clusters)
    task.detail['changed'] = changed
    task.detail['examples'] = examples[:40]
    if not apply:
        conn.close()
        task.set_progress(100, f'预览：按正文标记找到 {len(clusters)} 组同一作者的不同笔名，可归一 {changed} 本。确认后点「执行」（会先自动备份数据库）。')
        return
    import shutil, time
    try:
        shutil.copy(str(db), str(db) + '.bak_' + time.strftime('%Y%m%d_%H%M%S'))
    except Exception:
        pass
    task.set_progress(90, '写回作者名...')
    n = afc.apply_clusters(conn, clusters)
    conn.close()
    task.set_progress(100, f'完成：按正文合并了 {len(clusters)} 组笔名，规范 {n} 本的作者。回书房强刷即可看到。')

def task_list_all_reviews(task: Task, root: Path):
    """把能找到的所有总评/简评都列出来（当前库的所有副本 + 所有备份），全文，供你自己复制粘贴。
    只把"书名+简评全文 一字不差"的重复合并成一条、并标出它出现在哪些来源；
    只要简评内容有一点不同，就当作不同的两条分开列——绝不按作者或别的规则省略。"""
    import glob, os
    db = root / 'library.db'

    def src_name(p):
        if os.path.abspath(p) == os.path.abspath(str(db)):
            return '当前库'
        b = os.path.basename(p)
        # library.db.bak_auto_20260620_xxxx → 自动备份 06-20；其它 .bak_xxx 原样短名
        if 'bak_auto_' in b:
            tail = b.split('bak_auto_')[-1]
            return '自动备份 ' + (tail[:8] if len(tail) >= 8 else tail)
        if 'bak_before_dedup' in b:
            return '去重前备份'
        if 'bak_before_merge' in b:
            return '合并作者前备份'
        return b.replace('library.db.', '')

    by_review = {}     # (title, review) -> {'title','author','review','sources':set}
    order = []
    sources = [str(db)] + sorted(set(glob.glob(str(root / 'library.db.bak*')) + glob.glob(str(db) + '.bak*')))
    bak_count = 0
    for src in sources:
        try:
            cn = sqlite3.connect(src); cn.row_factory = sqlite3.Row
            rows = cn.execute("SELECT title, author, user_notes FROM books "
                              "WHERE user_notes IS NOT NULL AND TRIM(user_notes)<>''").fetchall()
            cn.close()
        except Exception:
            continue
        if src != str(db):
            bak_count += 1
        nm = src_name(src)
        for r in rows:
            review = (r['user_notes'] or '').strip()
            if not review:
                continue
            title = (r['title'] or '').strip() or '(无题)'
            key = (title, review)
            if key not in by_review:
                by_review[key] = {'title': title, 'author': (r['author'] or '').strip(),
                                  'review': review, 'sources': set()}
                order.append(key)
            by_review[key]['sources'].add(nm)
    out = [{'title': by_review[k]['title'], 'author': by_review[k]['author'],
            'review': by_review[k]['review'], 'sources': '、'.join(sorted(by_review[k]['sources']))}
           for k in order]
    out.sort(key=lambda x: x['title'])
    task.detail['reviews'] = out
    task.set_progress(100, f'扫了当前库和 {bak_count} 份备份，列出全部 {len(out)} 条不同的简评（只合并一字不差的重复，按作者不省略）。下面逐条都能复制。')


def task_recover_reviews(task: Task, root: Path, apply: bool = False):
    """从数据库备份里找回丢失的简评/总评：扫 library.db 的各份 .bak 备份，
    找出"备份里写过简评、但现在库里这本是空的"，列出来或写回。"""
    import glob
    db = root / 'library.db'
    conn = sqlite3.connect(str(db)); conn.row_factory = sqlite3.Row
    cur, cur_by_ta = {}, {}
    cur_by_title = {}
    try:
        for r in conn.execute("SELECT id, title, author, user_notes FROM books"):
            cur[r['id']] = r
            cur_by_ta[((r['title'] or '').strip(), (r['author'] or '').strip())] = r
            t = (r['title'] or '').strip()
            cur_by_title.setdefault(t, []).append(r)
    except Exception:
        pass
    baks = sorted(set(glob.glob(str(root / 'library.db.bak*')) + glob.glob(str(db) + '.bak*')))
    task.log(f'找到 {len(baks)} 份数据库备份')
    found = {}
    for bak in baks:
        try:
            b = sqlite3.connect(bak); b.row_factory = sqlite3.Row
            rows = b.execute("SELECT id, title, author, user_notes FROM books "
                             "WHERE user_notes IS NOT NULL AND TRIM(user_notes)<>''").fetchall()
        except Exception:
            continue
        for r in rows:
            review = (r['user_notes'] or '').strip()
            if not review:
                continue
            now = cur.get(r['id']) or cur_by_ta.get(((r['title'] or '').strip(), (r['author'] or '').strip()))
            if not now:
                # 作者可能被合并改过名 → 按书名兜底（只在该书名唯一时采用）
                same = cur_by_title.get((r['title'] or '').strip(), [])
                if len(same) == 1:
                    now = same[0]
            if now and not (now['user_notes'] or '').strip():
                key = now['id']
                # 同一本若多份备份都有，留最长的那条
                if key not in found or len(review) > len(found[key]['review']):
                    found[key] = {'id': now['id'], 'title': now['title'] or '', 'author': now['author'] or '', 'review': review}
        try:
            b.close()
        except Exception:
            pass
    # 库内同名找回：很多时候"总评"其实写在了这本书的另一个副本上（重复书还没去重）。
    # 把"有总评那一份"的总评，补给同名(同书名)但为空的那几本——不依赖任何备份。
    for title, rows in cur_by_title.items():
        if not title or len(rows) < 2:
            continue
        with_rv = [r for r in rows if (r['user_notes'] or '').strip()]
        empty = [r for r in rows if not (r['user_notes'] or '').strip()]
        if not with_rv or not empty:
            continue
        review = max((((r['user_notes'] or '').strip()) for r in with_rv), key=len)
        for r in empty:
            key = r['id']
            if key not in found or len(review) > len(found[key]['review']):
                found[key] = {'id': r['id'], 'title': r['title'] or '', 'author': r['author'] or '', 'review': review}
    task.detail['found'] = len(found)
    task.detail['examples'] = [{'title': v['title'], 'author': v['author'], 'review': v['review'][:80]}
                               for v in list(found.values())[:50]]
    if not apply:
        conn.close()
        msg = (f'从备份和同名副本里找到 {len(found)} 条现在库里缺失的简评，可恢复。确认后点「执行恢复」写回。'
               if found else '没找到可恢复的简评：备份里没有、同名的其它副本上也没有。可能这本确实没写过总评（评分≠总评），或写过的那份记录已被删除。')
        task.set_progress(100, msg)
        return
    conn.execute("PRAGMA busy_timeout=8000")
    n = 0
    restored = []
    for v in found.values():
        try:
            cur2 = conn.execute(
                "UPDATE books SET user_notes=? WHERE id=? AND (user_notes IS NULL OR TRIM(user_notes)='')",
                (v['review'], v['id']))
            if cur2.rowcount and cur2.rowcount > 0:
                n += 1
                restored.append(v['title'] or ('#' + str(v['id'])))
        except Exception as e:
            task.log(f'恢复 #{v["id"]} 失败: {e}')
    conn.commit(); conn.close()
    task.detail['restored'] = restored
    if n:
        more = '…' if len(restored) > 8 else ''
        task.set_progress(100, f'已恢复 {n} 条简评：' + '、'.join(restored[:8]) + more + '。回书房按 Ctrl+Shift+R 强刷查看。')
    else:
        task.set_progress(100, '没有写入：这些书现在库里要么已经有简评(不覆盖)、要么没匹配上。若你确定某本还空着，把书名发我单独查那一条。')


def task_recover_authors(task: Task, root: Path, apply: bool = False):
    """从书名找回佚名书的作者"""
    import recover_authors as ra
    conn = sqlite3.connect(str(root / 'library.db'))
    conn.row_factory = sqlite3.Row

    task.set_progress(10, '读取已知作者...')
    known = ra.get_known_authors(conn)
    task.log(f'库里已知作者 {len(known)} 个')

    anon_list = [a for a in ra.ANON if a]
    placeholders = ','.join('?' * len(anon_list))
    rows = conn.execute(
        f'SELECT id, title, raw_title, author FROM books WHERE author IS NULL OR author IN ({placeholders})',
        anon_list).fetchall()
    task.set_progress(40, f'扫描 {len(rows)} 本佚名书...')

    from collections import defaultdict
    recovered = defaultdict(list)
    updates = []
    for r in rows:
        # 先看清洗后的书名，没有再看原始文件名（作者常保留在原文件名里）
        author, how = ra.extract_author(r['title'] or '', known)
        if not author:
            try:
                author, how = ra.extract_author(r['raw_title'] or '', known)
            except Exception:
                author = None
        if author:
            recovered[author].append(r['title'])
            updates.append((author, r['id']))

    task.detail['recovered_count'] = len(updates)
    task.detail['author_count'] = len(recovered)
    task.detail['preview'] = [
        {'author': a, 'count': len(ts), 'samples': ts[:3]}
        for a, ts in sorted(recovered.items(), key=lambda x: -len(x[1]))[:50]
    ]
    task.log(f'能找回 {len(updates)} 本，归入 {len(recovered)} 个作者')

    if not apply:
        task.set_progress(100, f'可找回 {len(updates)} 本书的作者（预览模式）')
        conn.close()
        return

    task.set_progress(70, '写回作者...')
    conn.executemany('UPDATE books SET author=? WHERE id=?', updates)
    conn.commit()
    conn.close()
    task.set_progress(100, f'已找回 {len(updates)} 本书的作者')


# ============================================================
# 任务 5: 补全核查
# ============================================================
def task_audit_coverage(task: Task, root: Path, mrpro_path: Path):
    """母库 vs mrpro 逐作者补全核查"""
    from mrpro_utils import MrproFile
    from audit_author_coverage import _norm

    conn = sqlite3.connect(str(root / 'library.db'))
    conn.row_factory = sqlite3.Row
    lib_authors = defaultdict(list)
    for r in conn.execute('SELECT title, author FROM books WHERE author IS NOT NULL AND author != ""'):
        lib_authors[r['author']].append(r['title'])
    conn.close()

    task.set_progress(40, '读取 mrpro...')
    with MrproFile(mrpro_path) as m:
        mrpro_books = m.get_books()

    mrpro_authors = defaultdict(list)
    for b in mrpro_books:
        author = (b.get('author') or '').strip()
        if not author:
            cat = b.get('category') or ''
            lines = [l.strip() for l in cat.split('\n') if l.strip()]
            if len(lines) >= 2:
                author = lines[-1]
        if author:
            mrpro_authors[author].append(b.get('book') or '')

    task.set_progress(70, '对比差额...')
    diffs = []
    for author, lib_books in lib_authors.items():
        tablet = mrpro_authors.get(author, [])
        diff = len(lib_books) - len(tablet)
        if diff > 0 and len(lib_books) >= 5:
            diffs.append({'author': author, 'lib': len(lib_books),
                          'tablet': len(tablet), 'diff': diff})
    diffs.sort(key=lambda x: -x['diff'])

    task.detail = {
        'lib_authors': len(lib_authors),
        'tablet_authors': len(mrpro_authors),
        'lib_total': sum(len(v) for v in lib_authors.values()),
        'tablet_total': len(mrpro_books),
        'diffs': diffs[:50],
    }
    task.set_progress(100, f'核查完成：{len(diffs)} 位作者有缺额')


def task_detect_finished(task: Task, root: Path, resume: bool = True):
    """全库扫描章节，识别完结/连载状态（纯本地，不花 API）。
    用 proc_finish_at 作"扫过没"的标记（之前用 chapter_count，但导入时就填了它，
    于是续跑总说'全扫过了'、其实没真扫）。resume=True 跳过 proc_finish_at 已填的，可中断续跑。"""
    from chapter_counter import count_chapters
    from datetime import datetime as _dt

    conn = sqlite3.connect(str(root / 'library.db'))
    conn.row_factory = sqlite3.Row
    for col, ddl in [('is_finished', "ALTER TABLE books ADD COLUMN is_finished INTEGER DEFAULT NULL"),
                     ('chapter_count', "ALTER TABLE books ADD COLUMN chapter_count INTEGER DEFAULT NULL"),
                     ('extra_count', "ALTER TABLE books ADD COLUMN extra_count INTEGER DEFAULT NULL"),
                     ('proc_finish_at', "ALTER TABLE books ADD COLUMN proc_finish_at TEXT DEFAULT NULL")]:
        try:
            conn.execute(f'SELECT {col} FROM books LIMIT 1')
        except Exception:
            conn.execute(ddl)
            conn.commit()
    # 扫描记录表（进度备份/续跑）
    try:
        conn.execute('''CREATE TABLE IF NOT EXISTS processing_batch (
            id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, status TEXT DEFAULT 'running',
            total INTEGER DEFAULT 0, done INTEGER DEFAULT 0, last_book_id INTEGER DEFAULT 0,
            note TEXT DEFAULT '', started_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)''')
        conn.commit()
    except Exception:
        pass

    # 续跑：只扫 proc_finish_at 还没填的书
    if resume:
        rows = conn.execute('SELECT id, title, file_path FROM books WHERE proc_finish_at IS NULL').fetchall()
        already = conn.execute('SELECT COUNT(*) c FROM books WHERE proc_finish_at IS NOT NULL').fetchone()['c']
        if already > 0:
            task.log(f'续跑模式：已扫过 {already} 本，本次只扫剩下的 {len(rows)} 本')
    else:
        # 重新全扫：清掉所有标记，从头来
        conn.execute('UPDATE books SET proc_finish_at=NULL')
        conn.commit()
        rows = conn.execute('SELECT id, title, file_path FROM books').fetchall()
        already = 0
    total = len(rows)
    grand_total = total + already
    if total == 0:
        task.set_progress(100, '所有书都已扫描过（如想重扫，点"重新全扫"）')
        conn.close()
        return

    # 开一条扫描记录
    batch_id = None
    try:
        cur = conn.execute("INSERT INTO processing_batch(kind,status,total,done,note) VALUES('finish','running',?,0,?)",
                           (grand_total, f'续跑，剩 {total} 本' if resume else '全扫'))
        batch_id = cur.lastrowid
        conn.commit()
    except Exception:
        pass
    task.set_progress(5, f'开始扫描 {total} 本书的章节和完结状态...')

    now = lambda: _dt.now().strftime('%Y-%m-%d %H:%M:%S')
    finished_n = ongoing_n = unknown_n = done = 0
    last_id = 0
    batch = []

    def flush():
        if batch:
            conn.executemany('UPDATE books SET is_finished=?, chapter_count=?, extra_count=?, proc_finish_at=? WHERE id=?', batch)
            conn.commit()
            batch.clear()
        if batch_id:
            try:
                conn.execute("UPDATE processing_batch SET done=?, last_book_id=?, updated_at=? WHERE id=?",
                             (already + done, last_id, now(), batch_id)); conn.commit()
            except Exception:
                pass

    for r in rows:
        if task.is_cancelled():
            flush()
            if batch_id:
                try:
                    conn.execute("UPDATE processing_batch SET status='aborted', updated_at=? WHERE id=?", (now(), batch_id)); conn.commit()
                except Exception:
                    pass
            task.log(f'已暂停，本次扫了 {done} 本（已保存，下次可续跑）')
            conn.close()
            return
        fp = root / r['file_path']
        ts = now()
        is_fin = chap = extra = None
        if fp.exists():
            try:
                ch = count_chapters(fp)
                chap = ch.get('chapters') or 0
                extra = ch.get('extras') or 0
                conf = ch.get('finish_confidence', 'low')
                if conf in ('high', 'medium'):
                    is_fin = 1 if ch['finished'] else 0
                elif ch.get('finished'):
                    is_fin = 1
            except Exception:
                chap = 0
        else:
            chap = 0
        if is_fin == 1:
            finished_n += 1
        elif is_fin == 0:
            ongoing_n += 1
        else:
            unknown_n += 1
        batch.append((is_fin, chap, extra, ts, r['id']))
        last_id = r['id']
        done += 1
        if len(batch) >= 300:
            flush()
            task.detail = {'total': grand_total, 'scanned': already + done,
                           'finished': finished_n, 'ongoing': ongoing_n, 'unknown': unknown_n}
            task.set_progress(5 + int(done / total * 90),
                              f'已扫描 {already + done}/{grand_total}（完结 {finished_n}）')
    flush()
    if batch_id:
        try:
            conn.execute("UPDATE processing_batch SET status='done', updated_at=? WHERE id=?", (now(), batch_id)); conn.commit()
        except Exception:
            pass
    conn.close()

    task.detail = {'total': grand_total, 'scanned': already + done,
                   'finished': finished_n, 'ongoing': ongoing_n, 'unknown': unknown_n}
    task.set_progress(100,
        f'完结识别完成：本次扫 {done} 本，完结 {finished_n}，连载 {ongoing_n}，未知 {unknown_n}')
