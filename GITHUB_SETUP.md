# 上传到 GitHub / 以后怎么更新

之前那版指南绕了个弯（先 clone 旧版本再把新文件盖上去），你问得对，没必要——你现在这个文件夹（`MyLibrary_v3`，也就是刚解压的最新版）就是最新的，直接从这里推上去就行，不用先拉一份过时的下来。

## 第一次：让这个文件夹变成 git 仓库，直接推上去

在**你现在这个文件夹**（`MyLibrary_v3`）里打开命令行（文件夹空白处 Shift+右键 →"在此处打开 PowerShell 窗口"），依次执行：

```bash
git init
git add -A
git status --short
```

看一眼 `git status --short` 的输出，确认列表里**没有 `config.json`**（这是你的真实 API Key，不该被提交）。确认没问题后继续：

```bash
git commit -m "MyLibrary v4.6.17"
git branch -M master
git remote add origin https://github.com/QiaQiaUwU/MyLibrary.git
git push -u origin master --force
```

最后这条带了 `--force`——因为 GitHub 上现在还是很久以前的 v3.69.1，跟你本地完全不是一回事，这条命令的意思是"以本地这份为准，把远端覆盖掉"。推完刷新 GitHub 页面就能看到最新代码了。

如果你之前已经按上一版指南 `git clone` 出过一个单独的 `MyLibrary` 文件夹，那个可以直接删掉，不需要了。

## 以后每次更新：双击一个脚本就行

以后再拿到我给你的新 zip，解压覆盖到这个文件夹（`.git` 隐藏文件夹别删），然后**双击 `update_github.bat`**——它会自动 add + commit + push。之前那版脚本用的是中文+UTF-8编码，在你这台机器上被 cmd 解析错了（报了一堆"不是内部命令"），这次改成纯英文提示，跟项目里其他能正常跑的 `.bat` 文件（比如 `启动.bat`）用的是同一种写法，应该不会再有这个问题。

## 想正式发布一个新版本（带 exe）：双击另一个脚本

先用 `update_github.bat` 把代码传上去，再**双击 `release_github.bat`**，输入版本号（比如 `4.6.18`），自动打标签推上去，会触发云端自动编译 exe、自动建好 Release。

## 代理问题

如果推送半途报 "Failed to connect" 或者 "Connection was reset" 这类，是网络问题不是命令问题——看你上传时的具体报错，通常是本地代理没配给 git：

```bash
git config --global http.proxy http://127.0.0.1:你的代理端口
git config --global https.proxy http://127.0.0.1:你的代理端口
```

端口号看你代理软件（比如 NekoBox）主界面上 "Mixed" 那一行。传输中途老断的话，再加一条：

```bash
git config --global http.postBuffer 524288000
```
