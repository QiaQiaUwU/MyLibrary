#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
watch_inbox.py — 多源自动入库监听
=========================================
监控多个来源文件夹（投递口 + 微信/QQ/浏览器下载等），
自动识别其中的小说文件并入库。带智能过滤，避开聊天记录、文档、图片等非小说文件。

用法:
  pip install watchdog
  python watch_inbox.py F:\MyLibrary                    # 只监听默认投递口
  python watch_inbox.py F:\MyLibrary --wechat           # 额外监听微信文件夹
  python watch_inbox.py F:\MyLibrary --all              # 监听所有常见来源
  python watch_inbox.py F:\MyLibrary --watch "D:\下载"  # 自定义额外目录

来源由 config.json 的 library.watch_sources 配置，或命令行指定。
"""

import json, os, re, subprocess, sys, time
from pathlib import Path

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
except ImportError:
    print('❌ 需要安装: pip install watchdog')
    sys.exit(1)


# ============================================================
# 常见来源目录自动探测
# ============================================================
def find_common_sources() -> dict:
    """探测常见的文件来源目录，返回 {名称: 路径}"""
    home = Path(os.path.expanduser('~'))
    sources = {}

    # 微信文件（新旧版路径都试）
    for base in [
        home / 'Documents' / 'WeChat Files',
        home / 'Documents' / 'xwechat_files',          # 新版微信
        Path('C:/Users/Public/Documents/WeChat Files'),
    ]:
        if base.exists():
            # 微信文件在 .../<wxid>/FileStorage/File/<月份>/
            for wxid in base.glob('*/FileStorage/File'):
                sources.setdefault('微信', str(wxid))
                break
            else:
                # 没找到标准结构就监听整个目录
                sources.setdefault('微信', str(base))
            break

    # QQ 文件
    for base in [
        home / 'Documents' / 'Tencent Files',
        Path('C:/Users/Public/Documents/Tencent Files'),
    ]:
        if base.exists():
            sources.setdefault('QQ', str(base))
            break

    # 浏览器/系统下载
    dl = home / 'Downloads'
    if dl.exists():
        sources.setdefault('下载', str(dl))

    return sources


# ============================================================
# 智能过滤：判断一个文件是不是值得入库的小说
# ============================================================
BOOK_EXTS = {'.txt', '.epub', '.mobi', '.azw3', '.azw', '.pdf'}
ARCHIVE_EXTS = {'.zip', '.rar', '.7z'}

# 文件名里出现这些词，多半不是小说，跳过
SKIP_NAME_PATTERNS = [
    r'聊天记录', r'chat', r'会话', r'记录导出',
    r'发票', r'invoice', r'账单', r'报销',
    r'简历', r'resume', r'cv',
    r'合同', r'协议', r'contract',
    r'报告', r'report', r'方案', r'计划书',
    r'课件', r'PPT', r'课程', r'作业',
    r'安装', r'setup', r'install', r'安裝',
    r'^IMG_', r'^DSC', r'^微信图片', r'^mmexport',  # 图片
    r'截图', r'screenshot', r'snapshot',
    r'\.exe$', r'\.dmg$', r'\.apk$',
]

def looks_like_novel(filepath: Path) -> tuple:
    """
    判断文件是否像小说。返回 (是否入库, 原因)
    """
    name = filepath.name
    ext = filepath.suffix.lower()

    # 1. 扩展名过滤
    if ext not in BOOK_EXTS and ext not in ARCHIVE_EXTS:
        return False, f'非电子书格式({ext})'

    # 2. 文件名黑名单
    for pat in SKIP_NAME_PATTERNS:
        if re.search(pat, name, re.I):
            return False, f'文件名疑似非小说'

    # 3. 压缩包：直接交给入库流水线处理（它会解压判断）
    if ext in ARCHIVE_EXTS:
        return True, '压缩包，交给入库流水线'

    # 4. epub/mobi/azw3：电子书格式，基本就是书
    if ext in ('.epub', '.mobi', '.azw3', '.azw'):
        return True, '电子书格式'

    # 5. pdf：可能是书也可能是文档，看大小（太小的 pdf 多半是单据）
    if ext == '.pdf':
        try:
            size = filepath.stat().st_size
            if size < 50 * 1024:  # 小于 50KB 的 pdf 多半不是书
                return False, 'pdf 太小，疑似单据'
        except Exception:
            pass
        return True, 'pdf 文档'

    # 6. txt：最需要判断的——可能是小说，也可能是聊天记录/笔记/代码
    if ext == '.txt':
        try:
            size = filepath.stat().st_size
            if size < 10 * 1024:  # 小于 10KB 的 txt 多半不是小说（太短）
                return False, 'txt 太短，疑似笔记'
            # 读开头判断内容特征
            with open(filepath, 'rb') as f:
                raw = f.read(8000)
            text = _decode(raw)
            if not text:
                return False, '无法解码'
            # 聊天记录特征：大量"时间戳 + 冒号"行
            chat_lines = len(re.findall(r'\d{1,2}:\d{2}', text))
            if chat_lines > 15:
                return False, '疑似聊天记录(大量时间戳)'
            # 中文占比太低，可能是代码/日志/英文文档
            cn = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
            if cn / max(len(text), 1) < 0.15:
                return False, '中文占比低，疑似非中文小说'
            # 章节特征加分（有"第X章"基本是小说）
            if re.search(r'第\s*[一二三四五六七八九十百千万0-9]+\s*[章节回]', text):
                return True, '检测到章节结构'
            # 字数够长 + 中文为主，认为是小说
            return True, '长文本中文为主'
        except Exception as e:
            return False, f'读取失败'

    return True, ''


def _decode(raw: bytes) -> str:
    for enc in ('utf-8', 'gbk', 'gb18030', 'big5', 'utf-16'):
        try:
            text = raw.decode(enc, errors='ignore')
            cn = sum(1 for c in text[:1000] if '\u4e00' <= c <= '\u9fff')
            if cn / max(len(text[:1000]), 1) > 0.03:
                return text
        except Exception:
            continue
    return raw.decode('utf-8', errors='ignore')


# ============================================================
# 多源监听
# ============================================================
class MultiSourceHandler(FileSystemEventHandler):
    """监听多个来源，过滤后入库"""

    DEBOUNCE_SECONDS = 6  # 文件下载完成需要时间，等稳定

    def __init__(self, library_root: Path, inbox: Path, source_name: str = '投递'):
        self.library_root = library_root
        self.inbox = inbox
        self.source_name = source_name
        self._pending = {}
        self._processing = False

    def on_created(self, event):
        if event.is_directory:
            return
        self._consider(event.src_path)

    def on_moved(self, event):
        # 浏览器下载常用 .crdownload → 重命名为最终文件
        if not event.is_directory:
            self._consider(event.dest_path)

    def on_modified(self, event):
        if event.src_path in self._pending:
            self._pending[event.src_path] = time.time()

    def _consider(self, path_str):
        p = Path(path_str)
        ext = p.suffix.lower()
        if ext in BOOK_EXTS or ext in ARCHIVE_EXTS:
            self._pending[path_str] = time.time()

    def process_pending(self, importer):
        if self._processing or not self._pending:
            return
        now = time.time()
        ready = [p for p, t in self._pending.items() if now - t >= self.DEBOUNCE_SECONDS]
        if not ready:
            return
        self._processing = True
        try:
            to_import = []
            for p in ready:
                del self._pending[p]
                fp = Path(p)
                if not fp.exists():
                    continue
                ok, reason = looks_like_novel(fp)
                if ok:
                    print(f'  ✅ [{self.source_name}] {fp.name} — {reason}')
                    to_import.append(fp)
                else:
                    print(f'  ⊘ [{self.source_name}] {fp.name} — 跳过({reason})')
            if to_import:
                importer(to_import, self.source_name)
        finally:
            self._processing = False


def _find_cli() -> Path:
    """定位 mylib_cli.py（可能在同目录或 mylib/ 子目录）"""
    here = Path(__file__).parent
    for cand in [here / 'mylib_cli.py', here / 'mylib' / 'mylib_cli.py']:
        if cand.exists():
            return cand
    return here / 'mylib_cli.py'  # 兜底


MOVE_SOURCE = False  # True=连源文件一起删（如微信原文件），False=只复制不动源

def _do_import(library_root: Path, inbox: Path, files: list, source_name: str):
    """把识别出的小说复制（或移动）到投递口，再调入库流水线"""
    import shutil
    inbox.mkdir(parents=True, exist_ok=True)
    copied = []
    for fp in files:
        dst = inbox / fp.name
        if dst.exists():
            dst = inbox / f'{fp.stem}_{int(time.time())}{fp.suffix}'
        try:
            if MOVE_SOURCE:
                shutil.move(str(fp), str(dst))   # 删源文件
            else:
                shutil.copy2(str(fp), str(dst))  # 保留源文件
            copied.append(dst)
        except Exception as e:
            print(f'  ⚠️ 处理失败 {fp.name}: {e}')
    if not copied:
        return
    print(f'\n🔄 [{source_name}] 入库 {len(copied)} 个文件...')
    try:
        cli_path = _find_cli()
        if not cli_path.exists():
            print(f'  ⚠️ 找不到 mylib_cli.py（已复制到投递口 {inbox}，可手动入库）')
            return
        # 正确语法: import <root> --src <dir> --move --yes
        cmd = [sys.executable, str(cli_path), 'import', str(library_root),
               '--src', str(inbox), '--move', '--yes']
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode == 0:
            print(f'✅ 入库完成')
            for line in (result.stdout or '').split('\n'):
                if any(k in line for k in ('新入库', '跳过', '完成', '重复', '入库')):
                    print(f'  {line.strip()}')
        else:
            print(f'⚠️ 入库出错: {(result.stderr or result.stdout or "")[:300]}')
    except subprocess.TimeoutExpired:
        print('⚠️ 入库超时（文件可能太大），文件已在投递口')
    except Exception as e:
        print(f'⚠️ 入库异常: {e}')


def watch(library_root: Path, inbox: Path, extra_sources: dict = None):
    """启动多源监听"""
    inbox.mkdir(parents=True, exist_ok=True)
    observer = Observer()
    handlers = []

    # 主投递口
    h = MultiSourceHandler(library_root, inbox, '投递')
    observer.schedule(h, str(inbox), recursive=False)
    handlers.append(h)
    print(f'👀 监听投递口: {inbox}')

    # 额外来源
    extra_sources = extra_sources or {}
    for name, path in extra_sources.items():
        p = Path(path)
        if p.exists():
            h2 = MultiSourceHandler(library_root, inbox, name)
            # 微信/下载目录递归监听（子目录按月分）
            recursive = name in ('微信', 'QQ')
            observer.schedule(h2, str(p), recursive=recursive)
            handlers.append(h2)
            print(f'👀 监听{name}: {p}')
        else:
            print(f'⚠️ {name} 目录不存在，跳过: {p}')

    print(f'\n   图书馆: {library_root}')
    print(f'   自动识别小说文件入库，聊天记录/图片/文档会被跳过')
    print(f'   原文件不动（复制入库），按 Ctrl+C 停止\n')

    observer.start()
    importer = lambda files, src: _do_import(library_root, inbox, files, src)
    try:
        while True:
            for h in handlers:
                h.process_pending(importer)
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print('\n已停止监听')
    observer.join()


def start_background(library_root: Path, inbox: Path, extra_sources: dict = None):
    """后台线程启动（供 server 调用）"""
    import threading
    inbox.mkdir(parents=True, exist_ok=True)
    observer = Observer()
    handlers = []
    h = MultiSourceHandler(library_root, inbox, '投递')
    observer.schedule(h, str(inbox), recursive=False)
    handlers.append(h)
    for name, path in (extra_sources or {}).items():
        p = Path(path)
        if p.exists():
            h2 = MultiSourceHandler(library_root, inbox, name)
            observer.schedule(h2, str(p), recursive=(name in ('微信', 'QQ')))
            handlers.append(h2)
    observer.daemon = True
    observer.start()
    importer = lambda files, src: _do_import(library_root, inbox, files, src)
    def _loop():
        while True:
            for h in handlers:
                h.process_pending(importer)
            time.sleep(1)
    threading.Thread(target=_loop, daemon=True).start()
    print(f'  👀 多源投递监听已启动')
    return observer


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    root = Path(sys.argv[1])
    if not (root / 'library.db').exists():
        print(f'❌ {root}/library.db 不存在')
        sys.exit(1)

    # 投递口
    inbox = None
    cfg = {}
    config_path = Path(__file__).parent / 'config.json'
    if config_path.exists():
        try:
            cfg = json.load(open(config_path, encoding='utf-8'))
        except Exception:
            pass
    inbox_str = cfg.get('library', {}).get('inbox', '')
    inbox = Path(inbox_str) if inbox_str else root.parent / '新书_待入库'

    # 额外来源
    extra = {}
    common = find_common_sources()
    if '--all' in sys.argv:
        extra = common
    else:
        if '--wechat' in sys.argv and '微信' in common:
            extra['微信'] = common['微信']
        if '--qq' in sys.argv and 'QQ' in common:
            extra['QQ'] = common['QQ']
        if '--downloads' in sys.argv and '下载' in common:
            extra['下载'] = common['下载']
    # 自定义目录
    if '--watch' in sys.argv:
        idx = sys.argv.index('--watch')
        if idx + 1 < len(sys.argv):
            extra['自定义'] = sys.argv[idx + 1]
    # 配置文件里的 watch_sources
    for name, path in cfg.get('library', {}).get('watch_sources', {}).items():
        extra[name] = path

    if common:
        print(f'💡 检测到的来源: {", ".join(common.keys())}')
        print(f'   用 --wechat / --qq / --downloads / --all 启用\n')

    # 删原文件开关
    if '--move-source' in sys.argv:
        MOVE_SOURCE = True
        print('⚠️ --move-source 已开启：入库后会删除源文件（含微信/QQ原文件）\n')

    watch(root, inbox, extra)
