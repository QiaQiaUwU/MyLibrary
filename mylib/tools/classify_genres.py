#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
classify_genres.py
读取 F:\MyLibrary_by_mrpro 里每本书的开头内容，
调用 Claude API 判断真实体裁标签，更新 mrpro 文件。

用法:
    # 先获取 API Key：https://console.anthropic.com/
    set ANTHROPIC_API_KEY=sk-ant-xxxx

    # 干跑：只分类，不写mrpro（结果存 classify_result.json）
    python classify_genres.py F:\MyLibrary_by_mrpro F:\mylib\2026-06-06-final.mrpro

    # 确认结果后，写入新mrpro
    python classify_genres.py F:\MyLibrary_by_mrpro F:\mylib\2026-06-06-final.mrpro --apply

选项:
    --only-untagged   只处理没有体裁标签的书（默认）
    --all             重新分类所有书（包括已有标签的）
    --limit N         最多处理N本（测试用）
    --resume          从上次中断处继续（读取 classify_result.json）
"""

import sys, os, re, json, time, zipfile, sqlite3, tempfile, shutil
from pathlib import Path
from datetime import datetime

import urllib.request

# ─── 体裁标签规范表（多维度，参考晋江/起点/长佩等常见标签）──────────────────
# 一本小说的标签是复数的：性向 + 背景 + 设定 + 人设/情节/风格 往往同时存在。
TAG_GROUPS = {
    '性向/CP': ['耽美', '纯爱', '言情', '百合', '无CP', '强强', '年上', '年下', '1V1', 'NP', '双性', '生子'],
    '世界观/背景': ['现代', '都市', '古代', '古风', '民国', '年代', '校园', '职场', '娱乐圈', '电竞', '体育',
                  '豪门', '军旅', '宫廷', '朝堂', '江湖', '武侠', '仙侠', '修真', '玄幻', '奇幻', '西幻',
                  '科幻', '机甲', '星际', '末世', '虫族', '兽世', '异世大陆', '游戏', '无限流', '克苏鲁', '灵异', '民俗', '历史', '田园', '同人', '综漫'],
    '设定/套路': ['重生', '穿越', '穿书', '快穿', '系统', '种田', '基建', '异能', 'ABO', '哨向', '马甲',
                '替身', '养成', '直播', '科举', '升级流', '时空交互', '古穿今', '随身空间'],
    '人设': ['万人迷', '美强惨', '病娇', '偏执', '黑化', '钓系', '禁欲系', '高岭之花', '白切黑',
            '忠犬', '白月光', '绿茶', '白莲花', '团宠', '爹系', '竹马', '大佬', '影帝', '霸总',
            '病弱', '反派', '炮灰', '天之骄子', '美人'],
    '情节/关系': ['暗恋', '双向奔赴', '破镜重圆', '先婚后爱', '救赎', '双向救赎', '欢喜冤家', '情有独钟',
                '天作之合', '复仇', '联姻', '追妻火葬场', '青梅竹马', '日久生情', '占有欲', '强制', '半推半就',
                '强取豪夺', '死遁', '失忆', '替身', '互宠'],
    '风格/基调': ['甜文', '甜宠', '虐文', '苏爽', '甜虐交加', '微虐', '爽文', '逆袭', '轻松', '沙雕', '搞笑',
                '治愈', '正剧', '慢热', '细水长流', '狗血', '日常', '励志', '悬疑', '推理', '惊悚',
                '冒险', '热血', '美食', '群像'],
    'XP/玩法': ['调教', '主奴', 'Dom/Sub', '束缚', '捆绑', '道具', '项圈', '鞭打', '滴蜡', '制服诱惑',
             '角色扮演', '责打', '囚禁', '禁锢', '露出', '公共场合', '多人', '群P', '双龙', '骨科',
             '双性', '生子', '产乳', '产卵', '标记', '强制发情', '触手', '人外', '窒息', '寸止',
             '潮吹', '失禁', '言语羞辱', '对镜', '车震', '抹布', '共感'],
    '尺度': ['清水', '微H', '高H'],
    '结局': ['HE', 'BE', '开放结局'],
    '篇幅': ['短篇', '中篇', '长篇'],
}
VALID_GENRES = list(dict.fromkeys(t for grp in TAG_GROUPS.values() for t in grp))
GENRES_SET = {g.lower() for g in VALID_GENRES}

_TAG_MENU = '\n'.join('  · ' + k + '：' + '、'.join(v) for k, v in TAG_GROUPS.items())

CLASSIFY_PROMPT = (
    "你是严谨的中文小说标签分类专家。一本小说的标签是复数的——通常同时含「性向 + 背景 + 设定 + 人设/情节/风格」等多个维度。"
    "只标注开头内容里有明确证据的标签，没证据的绝不加。\n\n"
    "小说标题：{title}\n作者：{author}\n\n开头内容：\n{text}\n\n---\n\n"
    "可用标签（按维度，只能从下面选，不要自创）：\n" + _TAG_MENU + "\n\n"
    "打标签规则：\n"
    "- 必标性向：两个男主有感情线→耽美/纯爱；男女→言情；两个女主→百合；明确没感情线→无CP。\n"
    "- 必标主要背景：现代/都市、古代/古风、校园、星际、末世、虫族、兽世、仙侠、修真、玄幻、娱乐圈、电竞…挑最贴切的1-2个。\n"
    "- 能看出的设定都标：重生/穿越/穿书/快穿/系统/种田/异能/ABO/哨向/马甲…\n"
    "- 人设与风格：万人迷/美强惨/病娇/团宠/甜文/虐文/爽文/沙雕/治愈/悬疑…开头能体现就标。\n"
    "- XP/玩法、尺度：开头一般看不出，没有非常明确证据就别标（这类多靠读者手动加）。\n"
    "- 通常给出 3-6 个标签，跨维度；证据不足的维度可以不给。\n"
    "- 严格证据：abo 要有 Alpha/Omega/信息素；虫族要有虫/雄虫/母虫；末世要有丧尸/末日/病毒；星际要有星球/飞船；穿书要有穿进书里/原著/剧情；系统要有系统/任务/积分。\n"
    "- 不能因标题有某字就硬加；不能同时加耽美和言情。\n\n"
    "只输出 JSON，不要解释：\n"
    '{{"genres": ["标签1", "标签2", "标签3"]}}'
)

def read_book_text(filepath: Path, max_chars=3000) -> str:
    """读取书的开头文本，修复编码问题"""
    try:
        if filepath.suffix.lower() == '.epub':
            import zipfile as zf
            with zf.ZipFile(filepath, 'r') as z:
                html_files = sorted(
                    [n for n in z.namelist() if re.search(r'\.(html?|xhtml)$', n, re.I)]
                )
                for name in html_files:
                    raw = z.read(name)
                    text = re.sub(r'<[^>]+>', '', raw.decode('utf-8', errors='ignore'))
                    text = re.sub(r'\s+', ' ', text).strip()
                    if len(text) > 200:
                        return text[:max_chars]
            return ''
        else:
            raw = filepath.read_bytes()
            # 跳过BOM
            if raw[:3] == b'\xef\xbb\xbf':
                raw = raw[3:]
            sample = raw[:20000]
            for enc in ('utf-8', 'gbk', 'gb18030', 'big5', 'utf-16'):
                try:
                    text = sample.decode(enc, errors='ignore')
                    text = re.sub(r'\s+', ' ', text).strip()
                    # 中文占比检查
                    chinese = len(re.findall(r'[\u4e00-\u9fff]', text))
                    if len(text) > 100 and chinese / max(len(text), 1) > 0.08:
                        return text[:max_chars]
                except Exception:
                    continue
            # 兜底
            text = raw[:max_chars*3].decode('utf-8', errors='ignore')
            text = re.sub(r'\s+', ' ', text).strip()
            return text[:max_chars] if len(text) > 50 else ''
    except Exception:
        return ''

def classify_book(api_key, title: str, author: str, text: str) -> list:
    """调用DeepSeek API分类体裁"""
    if not text or len(text) < 50:
        return []
    
    prompt = CLASSIFY_PROMPT.format(
        title=title[:50], author=author[:30],
        text=text[:2500]
    )
    
    payload = json.dumps({
        "model": "deepseek-chat",
        "max_tokens": 200,
        "temperature": 0.1,
        "messages": [{"role": "user", "content": prompt}]
    }, ensure_ascii=False).encode('utf-8')
    
    req = urllib.request.Request(
        'https://api.deepseek.com/chat/completions',
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            result_text = data['choices'][0]['message']['content'].strip()
            m = re.search(r'\{[^}]+\}', result_text)
            if m:
                parsed = json.loads(m.group())
                genres = parsed.get('genres', [])
                return [g for g in genres if g.lower() in GENRES_SET]
        return []
    except Exception as e:
        print(f'    API错误: {e}')
        return []


def load_mrpro(mrpro_path: Path):
    with zipfile.ZipFile(mrpro_path, 'r') as z:
        db_data = z.read('com.flyersoft.moonreaderp/31.tag')
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tf:
        tf.write(db_data)
        return tf.name, db_data


def get_title(book_field: str) -> str:
    m = re.search(r'《([^》]+)》', book_field or '')
    if m: return m.group(1).strip()
    s = re.sub(r'^[\s\d\._\-\[【（(]+', '', book_field or '')
    s = re.sub(r'(?:作者|by)[:：].*$', '', s, flags=re.I)
    return s.strip()[:50]


def has_genre(category: str) -> bool:
    cats = [x.strip() for x in (category or '').split('\n') if x.strip() and x.strip() != '(TXT)']
    return any(t.lower() in GENRES_SET for t in cats)


def find_file(export_dir: Path, title: str, author: str):
    """在导出目录里找对应文件（宽松匹配）"""
    def norm(s):
        s = re.sub(r'[\s\._\-，,。.！!？?《》【】\[\]（）()]', '', s or '')
        s = re.sub(r'_\d+$', '', s)           # 去_1_2等后缀
        s = re.sub(r'(精校版|完结|番外|全本)', '', s)
        return s.lower()
    
    nt = norm(title)
    na = norm(author)
    
    # 候选文件：扫一遍收集
    candidates = []
    for root, dirs, files in os.walk(export_dir):
        dirs[:] = [d for d in dirs if not d.startswith('_')]
        for fn in files:
            if not re.search(r'\.(txt|epub|mobi)$', fn, re.I): continue
            candidates.append(Path(root) / fn)
    
    if not nt: return None
    
    # L1：书名完全包含
    for fp in candidates:
        fn = norm(fp.stem)
        if nt and nt in fn: return fp
    
    # L2：书名核心词（去掉括号/版本号后）出现
    nt_core = re.sub(r'[（\(][^）\)]{0,15}[）\)]', '', nt)
    if len(nt_core) >= 3:
        for fp in candidates:
            fn = norm(fp.stem)
            if nt_core in fn: return fp
    
    # L3：作者夹下找（作者名+文件名部分匹配）
    if na:
        for fp in candidates:
            parts = fp.relative_to(export_dir).parts
            fn_parts_norm = [norm(p) for p in parts]
            if na in fn_parts_norm:
                fn = norm(fp.stem)
                # 书名前4字匹配
                if len(nt) >= 4 and nt[:4] in fn:
                    return fp
    
    return None


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        print(__doc__); sys.exit(1)
    
    export_dir = Path(args[0])
    mrpro_path = Path(args[1])
    apply = '--apply' in args
    only_untagged = '--all' not in args
    resume = '--resume' in args
    limit = None
    if '--limit' in args:
        idx = args.index('--limit')
        limit = int(args[idx + 1])
    
    api_key = os.environ.get('DEEPSEEK_API_KEY', '')
    if not api_key:
        print('❌ 请先设置环境变量: set DEEPSEEK_API_KEY=sk-xxxx')
        sys.exit(1)
    
    print(f'📂 导出目录: {export_dir}')
    print(f'📦 mrpro: {mrpro_path}')
    print(f'模式: {"只处理无体裁标签" if only_untagged else "全部重新分类"}')
    
    # 加载mrpro
    tmp_db, _ = load_mrpro(mrpro_path)
    conn = sqlite3.connect(tmp_db)
    c = conn.cursor()
    c.execute('SELECT _id, book, author, category FROM books')
    all_books = c.fetchall()
    conn.close()
    
    # 决定要处理哪些书
    to_process = []
    for _id, book, author, category in all_books:
        if only_untagged and has_genre(category):
            continue
        title = get_title(book)
        to_process.append((_id, title, author or '', category or ''))
    
    if limit:
        to_process = to_process[:limit]
    
    print(f'需要分类: {len(to_process)} 本 / 共 {len(all_books)} 本')
    
    # 加载已有结果（resume模式）
    result_file = mrpro_path.parent / 'classify_result.json'
    results = {}
    if resume and result_file.exists():
        results = json.loads(result_file.read_text(encoding='utf-8'))
        print(f'已有结果: {len(results)} 本，继续处理剩余...')
    
    # 处理每本书
    ok = skip_no_file = skip_no_text = api_err = 0
    
    for i, (_id, title, author, category) in enumerate(to_process):
        key = str(_id)
        if key in results:
            ok += 1
            continue
        
        print(f'[{i+1}/{len(to_process)}] {author or "?"} 《{title[:30]}》', end=' ', flush=True)
        
        # 找文件
        fpath = find_file(export_dir, title, author)
        if not fpath:
            print('→ 找不到文件，跳过')
            skip_no_file += 1
            results[key] = {'title': title, 'author': author, 'genres': [], 'status': 'no_file'}
            continue
        
        # 读文本
        text = read_book_text(fpath)
        if not text:
            print('→ 读不到文本，跳过')
            skip_no_text += 1
            results[key] = {'title': title, 'author': author, 'genres': [], 'status': 'no_text'}
            continue
        
        # 调用API
        genres = classify_book(api_key, title, author, text)
        print(f'→ {genres}')
        
        results[key] = {
            'title': title, 'author': author,
            'genres': genres, 'status': 'ok',
            'file': str(fpath.relative_to(export_dir))
        }
        ok += 1
        
        # 每10本保存一次中间结果
        if (i + 1) % 10 == 0:
            result_file.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
        
        # 限速：避免API过快
        time.sleep(0.3)
    
    # 保存完整结果
    result_file.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    
    print(f'\n分类完成: 成功{ok}, 找不到文件{skip_no_file}, 读不到文本{skip_no_text}')
    print(f'结果已保存: {result_file}')
    
    if not apply:
        print('\n干跑完成。检查 classify_result.json 确认无误后，加 --apply 生成新mrpro。')
        return
    
    # 写入mrpro
    print('\n写入新mrpro...')
    tmp_db2, _ = load_mrpro(mrpro_path)
    conn2 = sqlite3.connect(tmp_db2)
    c2 = conn2.cursor()
    
    updated = 0
    for _id, book, author, category in all_books:
        key = str(_id)
        if key not in results: continue
        r = results[key]
        if r['status'] != 'ok' or not r['genres']: continue
        
        # 保留原category里的非体裁标签（作者名、特殊tag等）
        old_cats = [x.strip() for x in category.split('\n') if x.strip() and x.strip() != '(TXT)']
        old_non_genres = [t for t in old_cats if t.lower() not in GENRES_SET]
        new_cats = list(dict.fromkeys(r['genres'] + old_non_genres))
        new_cat = '\n'.join(new_cats) + '\n'
        
        c2.execute('UPDATE books SET category=? WHERE _id=?', (new_cat, _id))
        updated += 1
    
    conn2.commit()
    conn2.close()
    
    # 打包新mrpro
    out_path = mrpro_path.parent / f'{datetime.now():%Y-%m-%d}-classified.mrpro'
    with zipfile.ZipFile(mrpro_path, 'r') as orig:
        with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as nz:
            for item in orig.infolist():
                if item.filename == 'com.flyersoft.moonreaderp/31.tag':
                    with open(tmp_db2, 'rb') as f:
                        nz.writestr(item, f.read())
                else:
                    nz.writestr(item, orig.read(item.filename))
    
    os.unlink(tmp_db2)
    print(f'✅ 已更新 {updated} 本书的体裁标签')
    print(f'新mrpro: {out_path}')


if __name__ == '__main__':
    main()


