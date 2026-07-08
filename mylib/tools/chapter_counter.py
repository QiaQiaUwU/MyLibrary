#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
chapter_counter.py — 章节/番外真实计数
========================================
不看最大章节编号，而是真实统计文件里出现了多少个章节标记、多少个番外标记。
用于去重时直观对比哪个版本最全。

核心原则：
  - 数"实际出现的章节标题行数"，不是数最大编号
  - 番外单独计数
  - 识别多种章节格式（第X章/第X节/第X回/Chapter X/卷X 等）
"""

import re
from pathlib import Path


# ── 章节标题的各种正则模式 ──────────────────────────────────────────────────
# 正章：第X章、第X节、第X回、第X话、Chapter X、X. 标题
CHAPTER_PATTERNS = [
    re.compile(r'^\s*第\s*[零一二三四五六七八九十百千万0-9]+\s*[章节回话集卷篇](?:\s|[:：]|$)'),
    re.compile(r'^\s*Chapter\s+\d+', re.I),
    re.compile(r'^\s*CHAPTER\s+[IVXLC]+', re.I),
    re.compile(r'^\s*[（(]\s*\d+\s*[)）]\s*\S'),       # (1) 标题
    re.compile(r'^\s*\d{1,4}\s*[、.．]\s*\S'),          # 1. 标题 / 1、标题
]

# 番外：番外、特别篇、外传、SP、彩蛋、后记
EXTRA_PATTERNS = [
    re.compile(r'番\s*外'),
    re.compile(r'特\s*别\s*篇'),
    re.compile(r'外\s*传'),
    re.compile(r'^\s*SP\b', re.I),
    re.compile(r'彩\s*蛋'),
    re.compile(r'^\s*后\s*记'),
    re.compile(r'^\s*尾\s*声'),
]

# 卷/部（更大的分卷单位）
VOLUME_PATTERNS = [
    re.compile(r'^\s*第\s*[零一二三四五六七八九十百0-9]+\s*[卷部](?:\s|[:：]|$)'),
    re.compile(r'^\s*卷\s*[零一二三四五六七八九十百0-9]+'),
]

# 完结标志词（出现在文末或书名里 → 完结）
FINISHED_KEYWORDS = [
    '全文完', '正文完', '全书完', '全本完', '（完）', '(完)', '【完】',
    '完结撒花', '完结散花', '本文完', '故事完', '全文终', '完结。',
    'the end', 'THE END', '——完——', '—— 完 ——', '番外完',
]
# 书名里的完结标记
TITLE_FINISHED = re.compile(r'(完结|全本|完本|全文完|（完）|\(完\)|【完结】|已完结)')
# 连载中标记（书名里有这些 → 明确未完结）
TITLE_ONGOING = re.compile(r'(连载中|未完|更新中|待续|TBC)')


def detect_finished(text: str, title: str = '', extras: int = 0) -> dict:
    """
    判断作品是否完结。返回 {finished: bool, confidence: 'high'/'medium'/'low', reason: str}
    判定信号（按可靠性）：
      1. 书名明确标"连载中/未完" → 未完结（高置信）
      2. 书名标"完结/全本" → 完结（高置信）
      3. 文末出现"全文完/正文完/完结撒花"等 → 完结（高置信）
      4. 有番外（番外通常在正文完结后写） → 倾向完结（中置信）
      5. 都没有 → 未知，默认按未完结处理（低置信）
    """
    # 1. 书名明确连载中
    if title and TITLE_ONGOING.search(title):
        return {'finished': False, 'confidence': 'high', 'reason': '书名标注连载中'}
    # 2. 书名标完结
    if title and TITLE_FINISHED.search(title):
        return {'finished': True, 'confidence': 'high', 'reason': '书名标注完结'}
    # 3. 文末完结词（取最后 3000 字检查）
    tail = text[-3000:] if len(text) > 3000 else text
    tail_lower = tail.lower()
    for kw in FINISHED_KEYWORDS:
        if kw.lower() in tail_lower:
            return {'finished': True, 'confidence': 'high', 'reason': f'文末出现"{kw}"'}
    # 4. 有番外 → 倾向完结（番外一般正文完才写）
    if extras >= 1:
        return {'finished': True, 'confidence': 'medium', 'reason': f'含{extras}篇番外'}
    # 5. 未知
    return {'finished': False, 'confidence': 'low', 'reason': '无完结标志'}


def count_chapters(filepath: Path, max_scan_bytes: int = 5_000_000) -> dict:
    """
    统计文件的章节结构。
    返回 {chapters, extras, volumes, total_lines, has_structure}
    """
    text = _read_text(filepath, max_scan_bytes)
    if not text:
        return {'chapters': 0, 'extras': 0, 'volumes': 0,
                'total_lines': 0, 'has_structure': False,
                'finished': False, 'finish_confidence': 'low'}

    result = count_chapters_from_text(text, title=filepath.stem)

    # 大文件：前 5MB 可能没读到结尾，单独读文件尾部检测完结词
    try:
        fsize = filepath.stat().st_size
        if fsize > max_scan_bytes and result.get('finish_confidence') != 'high':
            with open(filepath, 'rb') as f:
                f.seek(max(0, fsize - 8000))
                tail_raw = f.read()
            for enc in ('utf-8', 'gbk', 'gb18030'):
                try:
                    tail = tail_raw.decode(enc, errors='ignore')
                    tail_low = tail.lower()
                    for kw in FINISHED_KEYWORDS:
                        if kw.lower() in tail_low:
                            result['finished'] = True
                            result['finish_confidence'] = 'high'
                            result['finish_reason'] = f'文末出现"{kw}"'
                            break
                    break
                except Exception:
                    continue
    except Exception:
        pass

    return result


def _cn_to_int(s: str):
    """中文数字转阿拉伯数字（支持到万）"""
    s = s.strip()
    if s.isdigit():
        return int(s)
    digits = {'零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9}
    units = {'十':10,'百':100,'千':1000,'万':10000}
    if not s:
        return None
    total = 0
    section = 0
    num = 0
    for ch in s:
        if ch in digits:
            num = digits[ch]
        elif ch in units:
            u = units[ch]
            if u == 10000:
                section = (section + num) * u
                total += section
                section = 0
            else:
                if num == 0:
                    num = 1
                section += num * u
            num = 0
        else:
            return None
    return total + section + num


def detect_missing_chapters(filepath, max_scan_bytes: int = 8_000_000) -> dict:
    """
    查缺章：提取所有正章编号，检测是否连续。
    返回缺失的章节号列表。
    """
    from pathlib import Path
    filepath = Path(filepath)
    try:
        text = _read_text(filepath, max_scan_bytes)
    except Exception as e:
        return {'ok': False, 'error': str(e)}
    return detect_missing_from_text(text)


def detect_missing_from_text(text: str) -> dict:
    """从文本提取章节编号，检测连续性"""
    num_re = re.compile(r'^\s*第\s*([零一二三四五六七八九十百千万0-9]+)\s*[章节回话]')
    nums = []
    for line in text.split('\n'):
        stripped = line.strip()
        if not stripped or len(stripped) > 50:
            continue
        m = num_re.match(stripped)
        if m:
            n = _cn_to_int(m.group(1))
            if n is not None and 0 < n < 100000:
                nums.append(n)
    if len(nums) < 3:
        return {'ok': True, 'detected': len(nums), 'missing': [], 'note': '章节编号太少，无法判断连续性'}
    # 去重排序
    uniq = sorted(set(nums))
    lo, hi = uniq[0], uniq[-1]
    present = set(uniq)
    missing = [n for n in range(lo, hi + 1) if n not in present]
    # 检测重复（可能有重复章节）
    from collections import Counter
    dup = [n for n, c in Counter(nums).items() if c > 1]
    return {
        'ok': True,
        'detected': len(uniq),
        'range': [lo, hi],
        'missing': missing[:50],
        'missing_count': len(missing),
        'duplicates': sorted(dup)[:20],
        'continuous': len(missing) == 0,
    }


def count_chapters_from_text(text: str, title: str = '') -> dict:
    """从文本统计章节结构"""
    lines = text.split('\n')

    chapters = 0
    extras = 0
    volumes = 0
    chapter_titles = []

    for line in lines:
        stripped = line.strip()
        if not stripped or len(stripped) > 50:
            # 太长的行不是标题
            continue

        # 先判断是否番外（番外优先，因为"番外第一章"算番外）
        is_extra = any(p.search(stripped) for p in EXTRA_PATTERNS)
        if is_extra:
            extras += 1
            continue

        # 卷/部
        is_volume = any(p.match(stripped) for p in VOLUME_PATTERNS)
        if is_volume:
            volumes += 1
            continue

        # 正章
        is_chapter = any(p.match(stripped) for p in CHAPTER_PATTERNS)
        if is_chapter:
            chapters += 1
            if len(chapter_titles) < 5:
                chapter_titles.append(stripped[:30])

    # 兜底：没数出正章，但正文是"纯数字一行"分章的（如《旧故新长》1 2 3…）
    if chapters == 0:
        num_re = re.compile(r'^\s*([0-9]{1,4})\s*[.．、]?\s*$')
        nums = []
        for line in lines:
            m = num_re.match(line.strip())
            if m:
                nums.append(int(m.group(1)))
            if len(nums) > 3000:
                break
        if len(nums) >= 3:
            inc = sum(1 for i in range(1, len(nums)) if nums[i] >= nums[i - 1])
            if inc >= (len(nums) - 1) * 0.7:
                chapters = len(nums)
                if not chapter_titles:
                    chapter_titles = ['第 %d 章' % n for n in nums[:5]]

    _fin = detect_finished(text, title=title, extras=extras)
    return {
        'chapters': chapters,
        'extras': extras,
        'volumes': volumes,
        'total_lines': len(lines),
        'has_structure': chapters > 0 or extras > 0,
        'sample_titles': chapter_titles,
        'finished': _fin['finished'],
        'finish_confidence': _fin['confidence'],
        'finish_reason': _fin['reason'],
    }


def _read_text(filepath: Path, max_bytes: int) -> str:
    """多编码读取（只读前 max_bytes 用于统计）"""
    try:
        with open(filepath, 'rb') as f:
            raw = f.read(max_bytes)
    except Exception:
        return ''
    for enc in ('utf-8', 'gbk', 'gb18030', 'big5', 'utf-16'):
        try:
            text = raw.decode(enc, errors='ignore')
            cn = sum(1 for c in text[:2000] if '\u4e00' <= c <= '\u9fff')
            if cn / max(len(text[:2000]), 1) > 0.05:
                return text
        except Exception:
            continue
    return raw.decode('utf-8', errors='ignore')


def compare_versions(files_info: list) -> dict:
    """
    对比同一本书的多个版本，判断哪个最全。
    files_info: [{'path':.., 'chapters':.., 'extras':.., 'word_count':.., 'file_size':..}, ...]
    返回 {'best_index': N, 'reason': '...', 'comparison': [...]}
    """
    if not files_info:
        return {'best_index': -1, 'reason': '无文件'}

    # 评分：章节数权重最高，番外其次，字数兜底
    def score(f):
        return (f.get('chapters', 0) * 1000 +
                f.get('extras', 0) * 100 +
                (f.get('word_count', 0) or 0) / 10000)

    scored = [(i, score(f), f) for i, f in enumerate(files_info)]
    scored.sort(key=lambda x: -x[1])

    best_i = scored[0][0]
    best = scored[0][2]

    # 给出对比理由
    reasons = []
    if best.get('chapters', 0) > 0:
        max_ch = max(f.get('chapters', 0) for f in files_info)
        if best.get('chapters', 0) == max_ch:
            reasons.append(f'章节最多({max_ch}章)')
    if best.get('extras', 0) > 0:
        max_ex = max(f.get('extras', 0) for f in files_info)
        if best.get('extras', 0) == max_ex and max_ex > 0:
            reasons.append(f'番外最全({max_ex}篇)')

    return {
        'best_index': best_i,
        'reason': ' · '.join(reasons) if reasons else '字数最多',
        'comparison': [{
            'path': f.get('path', ''),
            'chapters': f.get('chapters', 0),
            'extras': f.get('extras', 0),
            'word_count': f.get('word_count', 0),
            'file_size': f.get('file_size', 0),
            'is_best': i == best_i,
        } for i, f in enumerate(files_info)],
    }


def detect_hash_anomaly(books: list) -> bool:
    """
    检测 hash 组是否异常：内容相同但书名差异大 = 可能都是空壳/错误文件。
    books: [{'title':..}, ...]
    返回 True 表示可疑
    """
    if len(books) < 2:
        return False
    titles = [b.get('title', '') for b in books]
    # 规范化书名：去掉版本标记、作者、番外、标点、数字、空白
    norm_titles = set()
    for t in titles:
        nt = t
        # 去版本/状态标记词
        nt = re.sub(r'(精校|完结|全本|完整|修订|出书|番外全?|无删减|校对|VIP|TXT|全集|版|全)', '', nt, flags=re.I)
        # 去"作者XXX"
        nt = re.sub(r'作者\S*', '', nt)
        # 去标点、数字、空白、书名号
        nt = re.sub(r'[《》「」\[\]【】()（）\s_\-、，。·\d]', '', nt)
        nt = nt.strip()
        if nt:
            norm_titles.add(nt[:5])  # 取前5字比较
    # 规范化后还有 2+ 个完全不同的书名 → 内容相同但是不同的书 → 可疑
    return len(norm_titles) >= 2


if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print('用法: python chapter_counter.py <文件路径>')
        sys.exit(1)
    fp = Path(sys.argv[1])
    result = count_chapters(fp)
    print(f'文件: {fp.name}')
    print(f'  正章: {result["chapters"]} 章')
    print(f'  番外: {result["extras"]} 篇')
    print(f'  分卷: {result["volumes"]} 卷')
    if result.get('sample_titles'):
        print(f'  章节示例:')
        for t in result['sample_titles']:
            print(f'    {t}')

