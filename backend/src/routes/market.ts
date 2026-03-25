import { Router, Request, Response } from 'express';

const router = Router();

// Generate realistic mock OHLCV kline data
function generateMockKline(symbol: string, interval: string, limit: number) {
  const now = Math.floor(Date.now() / 1000);
  const intervalSeconds: Record<string, number> = {
    '1m': 60,
    '5m': 300,
    '1h': 3600,
    '1d': 86400,
  };

  const step = intervalSeconds[interval] || 3600;

  // Base price per symbol
  const basePrice =
    symbol.includes('TSLA') ? 200 :
    symbol.includes('AAPL') ? 170 :
    symbol.includes('2330') ? 750 :
    symbol.includes('0050') ? 140 :
    100;

  const kline = [];
  let price = basePrice;

  for (let i = limit; i >= 0; i--) {
    const t = now - i * step;
    const change = (Math.random() - 0.48) * basePrice * 0.02;
    const open = price;
    const close = Math.max(open + change, basePrice * 0.5);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const v = Math.floor(Math.random() * 5000 + 1000);

    kline.push({
      t,
      o: parseFloat(open.toFixed(2)),
      h: parseFloat(high.toFixed(2)),
      l: parseFloat(low.toFixed(2)),
      c: parseFloat(close.toFixed(2)),
      v,
    });

    price = close;
  }

  return kline;
}

/**
 * GET /api/market/kline
 * 取得 K 線資料（OHLCV）
 * Query: symbol (e.g. 2330.TW), interval (1m|5m|1h|1d), limit (default 60)
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
