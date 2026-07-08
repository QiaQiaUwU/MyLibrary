# -*- mode: python ; coding: utf-8 -*-
# =====================================================================
# MyLibrary —— PyInstaller 打包配置
# 在【项目根目录】下运行：
#     pyinstaller --clean --noconfirm MyLibrary.spec
# 产物：dist/MyLibrary.exe（单文件，双击即用；首次运行会让你选/新建书库目录）
# 说明：本项目历史上用“扁平导入”（如 from mylib_core import X），
#       且 uvicorn / routes 包是动态导入，PyInstaller 静态分析抓不全，
#       所以这里手动补足搜索路径(pathex)与隐藏导入(hiddenimports)。
# =====================================================================
import os, sys
from PyInstaller.utils.hooks import collect_submodules

ROOT = os.path.abspath(os.getcwd())
def _sub(*p):
    return os.path.join(ROOT, 'mylib', *p)

# 让打包器能找到各子包里的扁平模块
_paths = [ROOT, _sub('core'), _sub('server'), _sub('agents'),
          _sub('tools'), _sub('utils'), _sub('server', 'routes')]
for _p in _paths:
    if _p not in sys.path:
        sys.path.insert(0, _p)

# 原样打包前端与素材（含白噪音 / 翻页音 / 主题图）。运行时由 launcher 指向 _MEIPASS。
datas = [
    (os.path.join(ROOT, 'frontend'), 'frontend'),
    (os.path.join(ROOT, 'static'), 'static'),
]
for extra in ('config.example.json', 'README.md'):
    fp = os.path.join(ROOT, extra)
    if os.path.exists(fp):
        datas.append((fp, '.'))

# 隐藏导入：动态/扁平导入的模块需显式声明
hidden = []
for pkg in ('uvicorn', 'routes'):
    try:
        hidden += collect_submodules(pkg)
    except Exception:
        pass
hidden += [
    # mylib 各扁平模块
    'config', 'database', 'migrate_db', 'mylib_core',
    '_state', 'frontend_loader', 'mylib_admin', 'mylib_html', 'mylib_server_v2',
    'mylib_agent', 'quill_agent',
    # routes 包内各路由（保险起见再显式列一遍）
    'routes', 'routes.admin', 'routes.books', 'routes.collect', 'routes.journey',
    'routes.media', 'routes.pages', 'routes.quill', 'routes.reader',
    'routes.settings', 'routes.theme',
    # 第三方常见易漏项
    'anyio', 'sniffio', 'click', 'h11', 'multipart', 'starlette', 'fastapi', 'pydantic',
    'email.mime.text', 'email.mime.multipart',
]

a = Analysis(
    ['scripts/launcher.py'],
    pathex=_paths,
    binaries=[],
    datas=datas,
    hiddenimports=hidden,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # 关键：本应用不用 Qt；而这台机器同时装了 PyQt5 和 PyQt6 —— PyInstaller 不允许一个程序里
        # 打包两套 Qt，会直接中止（就是 build_log 里那条 "multiple Qt bindings" 报错）。全部排掉。
        'PyQt5', 'PyQt6', 'PySide2', 'PySide6', 'sip', 'PyQt5.sip', 'PyQt6.sip', 'shiboken2', 'shiboken6',
        # 科学计算 / 绘图 / 图像 / Jupyter：本应用一处都没 import（已逐个核过），纯属机器上别的项目装的，
        # 排掉以免被误打进 exe（这些动辄几百 MB，会让 exe 又大又慢，还可能引入更多冲突）。
        'matplotlib', 'numpy', 'scipy', 'pandas', 'sympy', 'sklearn',
        'IPython', 'ipykernel', 'jupyter', 'jupyter_client', 'jupyter_core', 'jupyterlab',
        'notebook', 'nbconvert', 'nbformat', 'jedi', 'parso', 'zmq', 'tornado',
        'PIL', 'pygame', 'cv2', 'torch', 'tensorflow', 'numba', 'llvmlite',
    ],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='MyLibrary',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,                 # 不用 UPX：压缩反而更容易被杀毒误报
    runtime_tmpdir=None,
    console=True,              # 保留小窗：显示运行状态与本机/局域网网址，出错时也能看到原因
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=(os.path.join(ROOT, 'static', 'app.ico') if os.path.exists(os.path.join(ROOT, 'static', 'app.ico'))
          else os.path.join(ROOT, 'app.ico') if os.path.exists(os.path.join(ROOT, 'app.ico'))
          else None),  # 换图标：把你的 .ico 覆盖到 static/app.ico（或根目录 app.ico）后重打即可
)
