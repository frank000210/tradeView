import { Router, Request, Response } from 'express';
import yahooFinance from 'yahoo-finance2';

const router = Router();

const INTERVAL_MAP: Record<string, { interval: '1m' | '5m' | '1h' | '1d'; range: string }> = {
  '1m': { interval: '1m', range: '1d' },
  '5m': { interval: '5m', range: '5d' },
  '1h': { interval: '1h', range: '30d' },
  '1d': { interval: '1d', range: '1y' },
};

router.get('/kline', async (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string) || '2330.TW';
    const interval = (req.query.interval as string) || '1h';
    const limit = Math.min(parseInt(req.query.limit as string) || 60, 300);

    const config = INTERVAL_MAP[interval];
    if (!config) {
      return res.status(400).json({ error: 'INVALID_PARAMETER', message: 'interval must be 1m|5m|1h|1d' });
    }

    const result = await yahooFinance.chart(symbol, {
      interval: config.interval,
      range: config.range,
    });

    const quotes = result.quotes || [];
    const kline = quotes
      .filter((q) => q.open != null && q.close != null)
      .map((q) => ({
        t: Math.floor(new Date(q.date).getTime() / 1000),
        o: parseFloat((q.open ?? 0).toFixed(2)),
        h: parseFloat((q.high ?? 0).toFixed(2)),
        l: parseFloat((q.low ?? 0).toFixed(2)),
        c: parseFloat((q.close ?? 0).toFixed(2)),
        v: Math.round((q.volume ?? 0) / 1000),
      }))
      .slice(-limit);

    return res.json(kline);
  } catch (err) {
    console.error('[market/kline]', err);
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: '取得K線資料失敗' });
  }
});

export default router;