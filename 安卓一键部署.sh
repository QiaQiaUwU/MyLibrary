#!/data/data/com.termux/files/usr/bin/bash
# MyLibrary 安卓一键启动（Termux）
# 用法：把整个项目文件夹拷进手机，在 Termux 里 cd 到这个目录，然后：
#   bash 安卓一键部署.sh
# 首次运行会自动装 Python、装依赖、建好书库目录；以后每次运行直接启动。
set -e
cd "$(dirname "$0")"

LIB="$HOME/library"

# ① Python（装过会自动跳过）
if ! command -v python >/dev/null 2>&1; then
  echo "· 安装 Python …"
  pkg install -y python
fi

# ② 依赖（装过几秒内完成）
echo "· 检查依赖 …"
pip install -q -r requirements.txt

# ③ 书库目录：没有就建一个空库（把 txt/epub 拷进 ~/library，再到 管理 页整理入库）
mkdir -p "$LIB"
if [ ! -f "$LIB/library.db" ]; then
  python -c "import sqlite3;sqlite3.connect('$LIB/library.db').close()"
  echo "· 已在 $LIB 建好空书库"
fi

# ④ 保活：拿唤醒锁，防止息屏后服务被安卓杀掉（没装 Termux:API 也不影响启动）
command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock || true

echo ""
echo "════════════════════════════════════════"
echo "  书库目录：$LIB"
echo "  本机访问：http://127.0.0.1:8765"
echo "  其他设备：浏览器打开下面启动信息里的局域网地址"
echo "  提示：到系统设置里给 Termux 关掉电池优化，服务才能一直在"
echo "════════════════════════════════════════"
echo ""
exec python main.py "$LIB" --no-browser
