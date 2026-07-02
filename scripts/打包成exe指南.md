# 把 MyLibrary 打包成「双击即用」的 exe（给不装 Python 的朋友）

> 目标：你在自己的 **Windows** 电脑上打一次包，得到一个 `MyLibrary.exe`，
> 发给朋友双击就能用——她**不用装 Python、不用装任何依赖**。

## 为什么要在 Windows 上打
exe 只能在对应系统上生成。Windows 的 exe 必须在 **Windows** 上用 PyInstaller 打。
（在 Mac / Linux 上打出来的是那俩系统的程序，Windows 用不了。）

---

## 一、准备（只需一次）
1. 装 **Python 3.10 或更新版**：https://www.python.org/downloads/
   安装时**务必勾选** “Add Python to PATH”。
2. 把整个项目文件夹放到本机，比如 `D:\MyLibrary`。

## 二、打包（一条龙）
在项目根目录（有 `main.py`、`MyLibrary.spec` 的那层）：

- **最省事**：双击 `scripts\build_exe.bat`，按提示等它跑完即可。
- 或手动在该目录打开命令行（PowerShell / CMD）依次执行：
  ```bat
  python -m pip install pyinstaller -r requirements.txt
  pyinstaller --clean --noconfirm MyLibrary.spec
  ```

跑完后，成品在：**`dist\MyLibrary.exe`**（单个文件）。

## 三、发给朋友怎么用
1. 把 `dist\MyLibrary.exe` 这**一个文件**发给她（微信/U盘都行）。
2. 她双击运行：
   - 会先弹一个**小黑窗**（这是正常的，里面显示运行状态和网址）；
   - 接着弹窗让她**选一个“书库目录”**——
     - 如果她是**全新用户**：随便选/新建一个空文件夹即可，程序会**自动建一个空书库**；
     - 如果你把**你的书库文件夹**（含 `library.db` 和书）也一起拷给了她：让她选那个文件夹。
   - 然后**浏览器会自动打开** MyLibrary，把书拖进去就能读。
3. 关掉那个小黑窗 = 退出程序。下次双击 exe 即可继续（会记住上次的书库目录）。

> 想连手机看？小黑窗里有「📱 局域网」那行网址，手机连同一个 Wi-Fi、浏览器输那个地址即可。

---

## 常见问题
- **Windows Defender / 杀毒报“未知发布者/有风险”**：
  PyInstaller 单文件 exe 很常见这种**误报**。点「更多信息 → 仍要运行」；
  或在 Defender「病毒和威胁防护 → 排除项」里把这个 exe 加进去。
  （想彻底避免误报需要代码签名证书，个人用一般不必。）
- **双击没反应 / 一闪而过**：用命令行 `cd` 到 exe 所在目录，直接敲 `MyLibrary.exe` 运行，
  就能在窗口里看到报错；或看 exe 同目录生成的 `startup_error.log` / `mylib_log.txt`。
- **AI 助手(Quill)不可用**：在网页「设置」里填 DeepSeek 等的 API key 即可（不填也能正常看书）。
- **想要无黑窗版本**：把 `MyLibrary.spec` 里的 `console=True` 改成 `False` 重打。
  （注意：无黑窗时若出错就看不到提示了，建议先用有黑窗版确认一切正常再换。）
- **exe 太大 / 启动稍慢**：单文件 exe 每次启动会临时解压，属正常。
  想更快可改“文件夹版”（把 spec 改成 onedir），但那样要把整个文件夹打包发给朋友。

---

## 打包配置在哪
- 入口：`scripts/launcher.py`（打包态会把配置写在 exe 同目录、能记住书库）。
- 配置：`MyLibrary.spec`（已处理好前端/素材打包、uvicorn 与 routes 的隐藏导入）。
