# MyLibrary —— 私人书房服务
# 构建:  docker build -t mylibrary .
# 运行:  docker run -d --name mylibrary -p 8765:8765 -v /你的书库目录:/data mylibrary
# 之后局域网内任何设备浏览器访问 http://主机IP:8765
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# /data 挂载你的书库（library.db 和书文件所在目录）
VOLUME ["/data"]
EXPOSE 8765

CMD ["python", "main.py", "/data", "--no-browser", "--host", "0.0.0.0", "--port", "8765"]


