# 把 MyLibrary 传到 GitHub —— 手把手

> 先看一眼最重要的「不要上传什么」，再照步骤做。**最危险的是 config.json（里面有你的 AI key）和你的书库数据。**

---

## 0. 绝对不要上传的东西（先想清楚）
你的代码可以上传，但这些**千万别提交**：

| 不能传 | 为什么 |
|---|---|
| `config.json` | 里面有你的 **AI API Key**（会被人白嫖/盗用），还有你本机的库路径 |
| `*.db` / `library.db` | 你的**阅读记录、书单、收藏、笔记**全在里面 |
| `F:\MyLibrary` 里的书 | 13 万本小说本体，是你的私货，且体量巨大 |
| `static/_ambient/` 里的音频 | 可能有版权 |
| `__pycache__/`、`.venv/` | 没用的中间文件 |

下面第 3 步的 `.gitignore` 会自动帮你挡住这些。**但还是建议先把仓库设为 Private（私有），确认干净了再决定要不要公开。**

---

## 1. 一次性准备
1. 装 Git：https://git-scm.com/download/win → 一路下一步。装完打开「Git Bash」或在 PowerShell 里敲 `git --version` 能出版本号即可。
2. 注册 GitHub：https://github.com 。
3. 配一下身份（只需一次，换成你自己的）：
   ```bash
   git config --global user.name "你的名字"
   git config --global user.email "你的邮箱@example.com"
   ```

## 2. 在项目根目录打开终端
进到代码目录（**不是** F 盘的书库，是 D 盘放 main.py 的那个目录）。在该文件夹空白处右键 → 「Open Git Bash here」/「在终端中打开」。
确认位置对：`ls` 能看到 `main.py`、`mylib/`、`frontend/`。

## 3. 建 .gitignore（关键一步）
在项目根新建一个文件名就叫 `.gitignore`（前面有个点），内容粘进去：

```gitignore
# 隐私 / 密钥 —— 绝对不传
config.json
*.db
*.sqlite
*.sqlite3
.env

# 你的书库数据（如果在项目内的话）
/books/
/_quarantine/
/_recycle/
/_import/
/MyLibrary/

# 音频（可能有版权）
static/_ambient/*
!static/_ambient/.gitkeep

# Python / 系统杂物
__pycache__/
*.pyc
.venv/
venv/
.DS_Store
.pytest_cache/
*.log
```

> 你已经有一个 `config.example.json`（没有真 key 的模板）——这个**可以**传，留着给别人参考怎么配。

## 4. 写个 README（决定别人第一眼的印象，也是简历加分点）
项目根建 `README.md`，给个像样的开头（按你实际改）：

```markdown
# MyLibrary 书房

本地优先的个人藏书 + 阅读系统：FastAPI 后端 + 原生 HTML/JS 前端，打包成 PWA。
为管理 10 万+ 规模的中文电子书库而做。

## 特点
- 百万级文件去重（哈希 / 内容 / 模糊三层），压缩包流式解压不爆盘
- 多维标签体系、章节与完结识别、增量入库 / 文件夹监听
- 阅读器：滚动 / 翻页双模式、划线笔记、环境音、阅读历程（种树 + 手账本）
- AI 书库精灵 Quill（可接入任意 OpenAI 兼容接口）

## 截图
（放几张图）

## 运行
```bash
pip install -r requirements.txt
python main.py F:\你的书库路径
```
首次把 `config.example.json` 复制成 `config.json` 并填好库路径 / AI key。

## 技术栈
Python · FastAPI · SQLite · 原生前端 · PWA
```

加个开源协议也好（根目录建 `LICENSE`，GitHub 网页上能一键生成 MIT）。

## 5. 提交并推送
```bash
git init
git add .
git status        # 仔细看一眼：列表里【不该】出现 config.json / *.db / 书文件
git commit -m "init: MyLibrary 个人藏书阅读系统"
```
> 如果 `git status` 里出现了 config.json 或 .db，**停下**，检查 .gitignore 是不是放对了位置、文件名对不对，别 commit。

然后去 GitHub 网页：右上角 **＋ → New repository** → 填名字（如 `mylibrary`）→ **选 Private** → 不要勾任何初始化文件 → Create。
建好后页面会给你两行命令，照着它的（把 URL 换成你自己的）：
```bash
git remote add origin https://github.com/你的用户名/mylibrary.git
git branch -M main
git push -u origin main
```
第一次推会让你登录/授权（用浏览器或 token）。推完刷新仓库页面就能看到代码了。

## 6. 以后更新
```bash
git add .
git commit -m "说明你改了啥"
git push
```

---

## 如果将来想公开（Public）
1. 先确认没有任何 key / 数据进过历史（哪怕后来删了，历史里也会留）。要是真不小心提交过 key——**立刻去 AI 平台把那个 key 作废重置**，比删 commit 更要紧。
2. 想清楚**内容标签**那部分（`mylib/tools/classify_genres.py` 里的同人/XP 标签）要不要公开。挂在简历旁的公开仓库里，这些词不一定是你想让 HR 看到的。两个选择：仓库保持私有；或做一个"作品集版"，把标签换成中性的通用分类再公开。

---

## 关于「自己写的代码能不能传」
能。**整个 `mylib/`、`frontend/`、`main.py`、文档**都是你写的，传没问题。`.gitignore` 挡掉的只是密钥、数据、书本体、版权音频——这些本来也不属于"代码"。


