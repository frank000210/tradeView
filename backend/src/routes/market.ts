import { Router, Request, Response } from 'express';

const router = Router();

// 各股票基準價格（對應現實價格區間）
const BASE_PRICES: Record<string, number> = {
  '2330.TW': 855,   // 台積電
  '2454.TW': 1050,  // 聯發科
  '2317.TW': 182,   // 鴻海
  '2308.TW': 42,    // 台達電
  '6505.TW': 308,   // 台塑化
  '2412.TW': 78,    // 中華電信
};

// 時間週期對應秒數
const INTERVAL_SECONDS: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '1h': 3600,
  '1d': 86400,
};

/**
 * 產生模擬 K 線資料
 * 以基準價格為起點，模擬合理的隨機漲跌幅
 */
function generateMockKline(symbol: string, interval: string, limit: number) {
  const now = Math.floor(Date.now() / 1000);
  const step = INTERVAL_SECONDS[interval] || 3600;
  const basePrice = BASE_PRICES[symbol] ?? 100;

  const kline = [];
  let price = basePrice * (0.96 + Math.random() * 0.02); // 起始價格略低於基準

  for (let i = limit; i >= 0; i--) {
    const t = now - i * step;

    // 模擬時段：台股盤中波動較大
    const hour = new Date(t * 1000).getHours();
    const isMarketHour = hour >= 9 && hour <= 13;
    const volatility = isMarketHour ? 0.018 : 0.006;

    const change = (Math.random() - 0.48) * basePrice * volatility;
    const open = price;
    const close = Math.max(open + change, basePrice * 0.5);
    const high = Math.max(open, close) * (1 + Math.random() * 0.008);
    const low = Math.min(open, close) * (1 - Math.random() * 0.008);
    const volume = Math.floor(
      (isMarketHour ? 2000 : 500) + Math.random() * 5000
    );

    kline.push({
      t,
      o: parseFloat(open.toFixed(2)),
      h: parseFloat(high.toFixed(2)),
      l: parseFloat(low.toFixed(2)),
      c: parseFloat(close.toFixed(2)),
      v: volume,
    });
    price = close;
  }
  return kline;
}

/**
 * GET /api/market/kline
 * 取得 K 線資料（OHLCV）
 * Query: symbol (e.g. 2330.TW), interval (1m|5m|1h|1d), limit (default 60, max 300)
 */
router.get('/kline', (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string) || '2330.TW';
    const interval = (req.query.interval as string) || '1h';
    const limit = Math.min(parseInt(req.query.limit as string) || 60, 300);

    const validIntervals = ['1m', '5m', '1h', '1d'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({
        error: 'INVALID_PARAMETER',
        message: `interval 必須為 1m | 5m | 1h | 1d，收到：${interval}`,
      });
    }

    const kline = generateMockKline(symbol, interval, limit);
    return res.json(kline);
  } catch (err) {
    console.error('[market/kline]', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: '取得 K 線資料失敗，請稍後再試',
    });
  }
});

export default router;
