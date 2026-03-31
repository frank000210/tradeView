FROM python:3.11-slim

WORKDIR /app

# 安裝依賴
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製原始碼
COPY . .

ENV PORT=8001

EXPOSE 8001

CMD ["python", "server.py"]
