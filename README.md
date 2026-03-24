# 台股 AI 交易代理系統 - Stock Dashboard

**Kinetic Pulse OS** — 台股 AI 交易代理系統前端儀表板

## 功能頁面

| 頁面 | 說明 |
|------|------|
| 總覽儀表板 | 帳戶淨值、AI 信號摘要、走勢圖 |
| K 線行情 | 多股票 / 多週期 OHLCV K 線圖 |
| AI 交易信號 | Alpha Agent 買賣建議與信心度 |
| 風控監控 | MDD 儀表、斷路器狀態、淨值曲線 |
| 資料爬蟲 | TWSE / MOPS / PTT 情緒分析 |
| 人工核准 (HITL) | 半自動模式交易核准介面 |

## 技術棧

- **前端**：React 19 + TypeScript + Vite + Tailwind CSS v4
- **圖表**：Recharts + 自製 SVG K 線元件
- **圖示**：Lucide React
- **後端**：Express.js (Node.js)
- **AI 整合**：Google Gemini API

## 本機開發

```bash
# 安裝依賴
npm install

# 啟動開發伺服器（使用 Mock 資料）
npm run dev

# 建置生產版本
npm run build
```

環境變數請複製 `.env.example` 為 `.env.local` 並填入實際值。

## API 端點

依據 `台股 AI 交易代理系統 API 規格書 (Swagger_OpenAPI).docx`：

| Method | Path | 說明 |
|--------|------|------|
| GET | /api/market/kline | K 線數據 |
| GET | /api/agent/signals | AI 買賣信號 |
| GET | /api/risk/status | 風控狀態 |
| GET | /api/data-agent/crawled-text | 爬蟲資料 |
| POST | /api/trade/approve | 人工核准 (HITL) |

## 部署

本專案部署至 **Zeabur**，設定見 `zbpack.json`。
