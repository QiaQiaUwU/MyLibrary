# 本轮更新（第 25 批）— 修复「创建桌面快捷方式.bat」

## 现象
运行后报：
- `%PYW%` 变成了 `"Active code page: 65001"`，导致快捷方式目标错误；
- `CScript ... failed (Insufficient system resources...)`。

## 原因
1. 你的 cmd 设了**自动运行 `chcp 65001`**（AutoRun）。脚本里用 `for /f ('where pythonw')` 抓 Python 路径时，子 cmd 启动会先打印一行 "Active code page: 65001"，这行被当成了 Python 路径。
2. 旧脚本靠"写一个临时 .vbs + cscript 运行"来建快捷方式，你的系统 Windows Script Host 报了资源/受限错误。

## 修复
- 找 Python 时**只接受真正的 .exe 路径**（按扩展名过滤），那行 "Active code page..." 自动被忽略。
- 改用 **PowerShell** 直接创建快捷方式（不再写临时 .vbs，绕开 WSH 报错）。
- 仍是纯 ASCII 内容（避免 .bat 在 GBK 代码页下乱码）。

## 用法
双击「创建桌面快捷方式.bat」即可。若仍失败，窗口会提示手动建：目标 `"<pythonw路径>" main.py`、起始位置 `项目文件夹`；或直接用同目录的 `MyLibrary.bat` 启动。

> 关于"日期参差不齐"：代码包是**全的**（每次打包整个项目）。日期不同只是因为**没改动的文件保留原修改时间**，改过的才是新日期——解压覆盖正常，不缺文件。
