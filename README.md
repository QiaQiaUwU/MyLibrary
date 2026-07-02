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
│   ├── agents/                   Quill 书库精灵、阅读 AI 助手、学习 agent
│   ├── tools/                    去重 / 打标签 / 作者归一 / 章节识别 / 入库监听
│   └── utils/                    mrpro 读写、书单导出
├── frontend/                     前端（已从 Python 剥离为独立文件，改完即生效、禁缓存）
│   ├── home/index.html, home.js
│   ├── reader/index.html, reader.js
│   ├── admin/index.html
│   ├── settings/index.html
│   ├── shared/inject.html
│   └── vendor/                   (旧卷曲翻页库位置，现已停用，翻页改为滚动容器交叉淡出)
├── static/                       _ambient 白噪音 / _sfx 翻页音 / themes 主题素材
├── scripts/                      install.py / launcher.py / build_exe.bat
├── tests/                        pytest 测试
└── .github/workflows/            CI（ci.yml）/ 自动打包 Release（build-windows-exe.yml）
```

## 功能

- **书房主页**：作者书架、题材分类、收藏、下载篮；莫兰迪主题随时间变化。可上传自定义背景，并调整**浓淡 / 整体模糊 / 边缘羽化 / 裁切位置 / 缩放**（自己框想显示的部分），也可一键清除背景恢复无背景；预设主题（纯净 / 宣纸 / 抹茶 / 水彩）。每本书封面可换可删。编辑模式下长按拖书批量归类 / 打标签 / 收藏，拖放后即时刷新。
- **导入书籍**：直接把 txt / epub / mobi / azw3 等电子书文件**拖进书房页**即可导入，文件会被**复制**一份到书库的 `books/_import/` 目录，原始文件保留在原位不会被移动或删除。
- **在线阅读器**
  - 翻页 / 滚动两种模式，共用同一套连续正文（DOM 完全一致 → 划线、定位在两种模式下行为一致）：翻页模式点左右换一整屏（交叉淡入淡出，禁手动滚），滚动模式长文连续滚动；两种切换不重渲染、不跳位。进度按字符偏移精确记录。
  - 皮肤（羊皮纸 / 米白 / 豆沙绿 / 怀旧棕 / 夜间 / 深蓝 / 纯黑）、字体、字号、行距、纸张纹理（纸纤维 / 亚麻 / 颗粒，真实无缝素材）。
  - 书签、划线（多色，起止两端可**自由拖动手柄**调范围）、笔记；**跳转精确到字符行**并有落点提示；手机上选字做笔记已适配（菜单底部停靠、避开系统原生菜单）。
  - 白噪音（可调**音量 + 快慢速率 + 远/近低通 + 空间混响**，多轨交叉混音，播放时展开三行细调）、翻书音效（Web Audio 预解码、**零延迟**）；进度条可拖动定位。
- **学习模式（融入阅读，非独立页面）**
  - Quill 面板里点「**学习模式**」打开选范围浮层，三种圈法：**按进度**（双滑块，实时预览落在正文哪段）、**按章节**（起止章下拉，分不出章节时自动提示换用进度/书签）、**按书签之间**（两个书签之间的内容）。
  - **上下文上限自适应**：按你配置的模型自动算（deepseek-chat ≈ 3.2 万字，8k 小模型更小），提示里显示实际可读字数，想聚焦某个知识点就把范围拖小。
  - 选好范围后可做三件事：**梳理知识点**（AI 提炼结构化要点，每点可跳回原文、可存为笔记）、**知识架构分析**（主干 → 关键论点 → 名词/关系的层级提纲）、**出题自测**（AI 出单选题，作答后判分 + 解析 + 跳原文出处；错题自动存入错题本）。
  - **错题本**：所有自测中答错的题自动收集，随时回顾、跳原文、移除。
  - **Quill 聊天收藏**：值得记的 AI 回复可收藏（长按或点按），收藏夹回看。
  - 以上 AI 能力需在设置里配 `ai.api_key`，目前对 txt 格式书籍生效。
- **Quill 书库精灵**：聊天式问书库、推荐、做书单；可养成形象（含实时月相），双击切换模型。
- **管理后台**：去重（三层：内容哈希 / 同作者书名相似 / 空壳残章）、AI 打标签、作者归一、找回作者、完结识别与分章节——全部后台运行、不阻塞前台读书，**互不冲突的任务可并发运行**（WAL + 大 busy_timeout，争锁自动等待而非报错），进度全局可见；删旧版本前自动把简评 / 评分 / 收藏 / 已读 / 划线 / 书签 / 笔记 / 进度搬到保留版本，且只移文件到隔离区、不物理删除。
- **阅读历程**
  - 花园：每本书一棵树（6 种针叶 / 阔叶剪影），按阅读进度生长。
  - 时间线：列表视图 / 翻页手账本。
  - 收藏翻阅：把书 / 划线 / 笔记 / 书签 / 与 Quill 的讨论汇成一本可翻阅的册子，**柔和翻页**，双击任意条目跳回原文那一句。
- **分享书单**：选书生成可导出的书单卡片（多主题、可加背景）。
- **PWA**：可安装到桌面 / 主屏，离线骨架可用。

## 近期更新（v3.65 – v3.69.1）

- **学习模式**（v3.69）：正式成型。三种选范围方式（按进度带实时预览 / 按章节 / 按书签之间）；上下文上限按配置模型自动算，不再写死；梳理知识点、知识架构分析、出题自测、错题本全部就地嵌入阅读流程。
- **音频细调升级**（v3.69）：白噪音新增 **「远/近」低通滤波**（削高频让声音更闷更远，下雪或隔墙那种"被捂住"的安静感）和 **「空间」混响**（卷积混响，空旷回响余韵）；细调重排为带标签三行（快慢 / 远近 / 空间），播放时才展开，界面清爽。
- **学习功能（就地融入阅读）**（v3.65–3.68）：知识点梳理（带跳原文、可存笔记）、自我检测（出题判分 + 跳原文）、错题本、Quill 聊天收藏。
- **阅读体验**：笔记/划线跳转精确到字符行 + 落点提示；划线范围改为自由拖动手柄；手机做笔记适配；翻页音效改 Web Audio 预解码（零延迟）+ 跳过前导静音；白噪音新增快慢速率。
- **外观/背景**：自定义背景支持浓淡/模糊/边缘羽化/裁切位置/缩放，可一键清除；换背景图立即生效（修缓存不刷新）；纸张纹理换成真实无缝素材；补齐宣纸/抹茶/水彩预设背景；封面可删除。
- **管理**：互不冲突的后台任务可并发运行（WAL + busy_timeout）。
- **工程**：采用语义化版本；清理旧 StPageFlip 卷曲翻页的遗留死代码。

> 逐版逐条改动见 `docs/更新日志.md`。

## 上传 GitHub 与发布 exe

代码正常 `git push` 即可（`config.json`、日志、数据库、`*.exe` 均已被 `.gitignore` 排除，不会误传敏感文件）。

**发布带 exe 的 Release（推荐方式）：**

```bash
git tag v3.69.1
git push origin v3.69.1
```

push tag 后，GitHub Actions（`.github/workflows/build-windows-exe.yml`）会自动在 GitHub 的 Windows 机器上打包，并在 Release 页面附上 `MyLibrary.exe`，无需本地有 Python 打包环境。你也可以在仓库 Actions 页面点「Run workflow」手动触发。

> Release 草稿会自动创建，确认信息无误后在 GitHub 网页发布即可。exe 只放在 Release 里，不进代码仓库。

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
- 阅读器已不再依赖 page-flip（StPageFlip）卷曲翻页库——翻页改为在滚动容器上做交叉淡出换屏（`vendor/` 与 CDN 的卷曲翻页脚本已停用）。后端依赖见 `requirements.txt`。

## 版本

当前 **v3.69.1**。采用语义化版本：新增功能升次版本（如 3.68→3.69），修 bug 升补丁号（如 3.69.0→3.69.1）；`mylib/__init__.py` 的 `__version__` 为唯一版本源。

v3.69 新增学习模式完整版（三种选范围 + 模型自适应上限）与音频三维细调（快慢/远近/空间混响）。v3.65–v3.68 主要新增学习功能（知识点梳理 / 自我检测 / 错题本 / 聊天收藏）、背景裁切与调节、真实纹理素材、白噪音快慢、划线拖动手柄、管理任务并发等。v3.0.0 起：分层包结构、后端按路由拆分、前端从 Python 剥离、Remix Icon 图标、可安装 PWA、树木重做、收藏翻阅模式、pytest + CI。逐版改动见 `docs/更新日志.md`。
