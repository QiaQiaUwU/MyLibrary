# MyLibrary v3 · 书房

个人藏书阅读系统。本地优先、跨设备访问的 Web 应用：电脑上管理 13 万+ 本电子书母库，平板 / 手机在同一局域网里随时打开阅读。数据只在本机和你的库目录，不上传任何服务器。

## 快速开始

```bash
pip install -r requirements.txt
python main.py F:\MyLibrary       # 指定库路径，首次运行用
python main.py                    # 之后读 config.json 里的路径
```

默认监听 `0.0.0.0:8765`，浏览器打开 `http://127.0.0.1:8765`。
同一局域网的平板 / 手机用电脑的局域网 IP 访问（书房页右上角「连接手机」会显示二维码）。
Windows 可直接双击 `MyLibrary.bat` 或 `启动.bat`。

## 给别人用（exe，免装 Python）

在 Windows 上运行 `scripts\build_exe.bat`，会在 `dist\` 下打出单文件 `MyLibrary.exe`。把这**一个文件**发给别人，对方双击即用：首次运行自动在 exe 同目录建好空书库、浏览器自动打开书房，无需安装 Python、无需任何配置。首次运行 Windows 可能提示「未知发行者」，点「更多信息 → 仍要运行」即可。

> exe 是 **Windows 专用**，不能在安卓 / Mac / iOS 上直接运行。但本程序是局域网 Web 应用：在一台 Windows 上跑 exe，同一 WiFi 下用手机 / 平板浏览器打开这台电脑的局域网地址即可阅读（书房页右上角「连接手机」有二维码）。

## 安装到桌面（像独立 App）

书房页右上角「安装到桌面」。装成桌面 / 主屏图标后打开是独立窗口、无地址栏，体验接近原生软件——本质仍是本地网页，数据不出本机。图标跟随你在 Quill 设置里选的形象。

阅读器从书房点「阅读」是用独立小窗（popup）打开的，可单独缩放、移动，关掉即退出，不占主标签页。

## 项目结构

```
MyLibrary/
├── main.py                       启动入口（接管 pythonw 无控制台时的 stdout）
├── config.json / .example.json   配置（库路径 / 端口 / AI key）
├── requirements.txt / pyproject.toml
├── MyLibrary.bat / 启动.bat       Windows 启动
├── mylib/                        Python 包
│   ├── core/                     数据层
│   │   ├── config.py             配置读写
│   │   ├── database.py           数据库层入口（Library + 线程安全连接）
│   │   ├── mylib_core.py         Library 实现、表结构、导入 / 去重
│   │   └── migrate_db.py         数据库迁移
│   ├── server/                   Web 服务层（FastAPI + uvicorn）
│   │   ├── _state.py             共享状态（app / CONFIG / LIB / get_lib）
│   │   ├── frontend_loader.py    实时读取 frontend/ 下的页面与 JS
│   │   ├── mylib_server_v2.py    装配入口 + main()
│   │   ├── routes/               路由按功能分文件
│   │   │   ├── pages / books / reader / collect / journey
│   │   │   └── quill / admin / theme / media / settings
│   │   └── mylib_admin.py        后台任务管理器
│   ├── agents/                   Quill 书库精灵、阅读 AI 助手
│   ├── tools/                    去重 / 打标签 / 作者归一 / 章节识别 / 入库监听
│   └── utils/                    mrpro 读写、书单导出
├── frontend/                     前端（已从 Python 剥离为独立文件，改完即生效、禁缓存）
│   ├── home/index.html, home.js
│   ├── reader/index.html, reader.js
│   ├── admin/index.html
│   ├── settings/index.html
│   ├── shared/inject.html
│   └── vendor/                   放 page-flip.browser.js 即启用本地卷曲翻页库（离线可用）
├── static/                       _ambient 白噪音 / _sfx 翻页音 / themes 主题素材
├── scripts/                      install.py / launcher.py / build_exe.bat
├── tests/                        pytest 测试
└── .github/workflows/ci.yml      持续集成
```

## 功能

- **书房主页**：作者书架、题材分类、收藏、下载篮；莫兰迪主题随时间变化，可上传背景图；编辑模式下长按拖书批量归类 / 打标签 / 收藏。
- **在线阅读器**
  - 真实卷纸翻页（StPageFlip）：**单页竖排、跟手卷曲、前后都能翻**，随窗口大小与字号自适应重排；联网时从 CDN 加载库，离线或未联网时自动退回内置 CSS 3D 翻页，两条路都是单列、前后可翻。
  - 滚动模式：长文连续滚动，进度按可视块字符偏移精确记录。
  - 皮肤（羊皮纸 / 米白 / 豆沙绿 / 怀旧棕 / 夜间 / 深蓝 / 纯黑）、字体、字号、行距、纸张纹理；书签、划线（多色）、笔记，可跨页连续选取；白噪音与翻书音效，进度条可拖动定位。
- **Quill 书库精灵**：聊天式问书库、推荐、做书单；可养成形象（含实时月相），双击切换模型。
- **管理后台**：去重（三层：内容哈希 / 同作者书名相似 / 空壳残章）、AI 打标签、作者归一、找回作者、完结识别与分章节——全部后台运行、不阻塞前台读书，进度全局可见；删旧版本前自动把简评 / 评分 / 收藏 / 已读 / 划线 / 书签 / 笔记 / 进度搬到保留版本，且只移文件到隔离区、不物理删除。
- **阅读历程**
  - 花园：每本书一棵树（6 种针叶 / 阔叶剪影），按阅读进度生长。
  - 时间线：列表视图 / 翻页手账本。
  - 收藏翻阅：把书 / 划线 / 笔记 / 书签 / 与 Quill 的讨论汇成一本可翻阅的册子，**柔和翻页**，双击任意条目跳回原文那一句。
- **分享书单**：选书生成可导出的书单卡片（多主题、可加背景）。
- **PWA**：可安装到桌面 / 主屏，离线骨架可用。

## 本轮修复（卷曲翻页适配）

- **小窗只能往后、翻不回去** → 修。根因是卷曲翻页库 `flip()` 的"落点是否在书角"判断在竖排单页下会把"向前翻"的合成落点判为不在书角而直接忽略；关掉该判断（不影响点击行为，因为库本就没监听鼠标 / 触摸），前后两个方向都能翻。已确认正常。
- **小窗最大化后整页文字消失** → 修（真正的根因在卷曲翻页库）。库的 `setHandlers()` 总会注册一个 `window resize → onResize` 监听，但它的 `destroy()` 只有在 `useMouseEvents` 为真时才会调用 `removeHandlers()` 去移除它；本项目用 `useMouseEvents:false`，于是那个 resize 监听永不被移除、一路累积。窗口最大化时，旧实例的 `onResize` 仍会按"放大后的容器尺寸 vs 建实例时的固定页尺寸"重算，把页面挪出可视区域 → 整页空白、页码冻住。改法：销毁翻页前临时把 `useMouseEvents` 置真，逼库执行 `removeHandlers()` 摘掉它注册的 resize 监听；并在我们自己的 resize 监听里（注册早于库的 `onResize`，故同一次事件里先执行）先销毁翻页——库的 `onResize` 还没轮到就被移除，最大化不再挪位空白，随后按新尺寸重建。
- **收藏翻阅的翻页生硬** → 改成贴着书脊轻抬、向外滑出再让新页柔和滑入的过渡，替换原先 90° 立起对折的硬翻。

## 开发与测试

```bash
pip install -r requirements.txt pytest
python -m pytest tests/ -q          # 跑测试
```

前端改 `frontend/` 下的文件即时生效（页面禁缓存、JS 带启动版本号破缓存）；阅读器改完需把阅读器小窗关掉重开。
打包成 exe：`scripts/build_exe.bat`（PyInstaller）。

## 配置（config.json）

```jsonc
{
  "server":  { "host": "0.0.0.0", "port": 8765, "open_browser": true },
  "library": { "root": "F:\\MyLibrary", "inbox": "", "export_dir": "", "mrpro_path": "" },
  "ai":      { "provider": "deepseek", "api_key": "", "base_url": "https://api.deepseek.com/v1", "model": "deepseek-chat" }
}
```

Quill 与阅读 AI 助手需要在 `ai` 段填 `api_key`（默认接 DeepSeek，可改 `base_url` / `model` 接其他兼容 OpenAI 协议的服务）。

## 数据安全

去重 / 合并不删物理文件（移到隔离区）；每次维护自动备份数据库；所有数据只在本机与库目录，不上传任何服务器。

## 许可与素材

- 源代码按 **MIT** 许可（见 `LICENSE`）。
- 翻页音 `static/_sfx/pageturn.wav` 裁剪自 Pixabay 的一段音频（Pixabay Content License，免署名，可随作品分发），来源登记见 `static/_sfx/CREDITS.md`。
- 白噪音等附带音频各自适用其来源的许可：放入 `static/_ambient/` 的文件请按 `static/_ambient/CREDITS.md` 登记来源、作者与许可；来源不明或不可公开重分发的素材不要随仓库公开。
- 卷曲翻页用的 page-flip（StPageFlip，MIT）从 CDN 加载，未随仓库打包；后端依赖见 `requirements.txt`。

## 版本

当前 v3.64.x。v3.0.0 起：分层包结构、后端按路由拆分、前端从 Python 剥离、Remix Icon 图标、可安装 PWA、翻页与树木重做、收藏翻阅模式、pytest + CI。逐版改动见 `docs/更新日志.md`。
