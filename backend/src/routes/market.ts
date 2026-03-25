import { Router, Request, Response } from 'express';
import yahooFinance from 'yahoo-finance2';

const router = Router();

// 各股票基準價格（fallback 用）
const BASE_PRICES: Record<string, number> = {
  '2330.TW': 855,
  '2454.TW': 1050,
  '2317.TW': 182,
  '2308.TW': 42,
  '6505.TW': 308,
  '2412.TW': 78,
};

// Yahoo Finance interval / range 對應
const YF_INTERVAL: Record<string, '1m' | '5m' | '1h' | '1d'> = {
  '1m': '1m', '5m': '5m', '1h': '1h', '1d': '1d',
};
const YF_RANGE: Record<string, string> = {
  '1m': '1d',
  '5m': '5d',
  '1h': '1mo',
  '1d': '1y',
};
const CACHE_TTL: Record<string, number> = {
  '1m':  60_000,
  '5m':  5  * 60_000,
  '1h':  30 * 60_000,
  '1d':  4  * 60 * 60_000,
};

interface KlinePoint {
  t: number; o: number; h: number; l: number; c: number; v: number;
}

const klineCache = new Map<string, { data: KlinePoint[]; expiresAt: number }>();

/** 用 yahoo-finance2 取得真實 K 線，並快取結果 */
async function fetchRealKline(symbol: string, interval: string, limit: number): Promise<KlinePoint[]> {
  const key = `${symbol}_${interval}`;
  const cached = klineCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data.slice(-limit);
  }

  const result = await yahooFinance.chart(symbol, {
    interval: YF_INTERVAL[interval],
    range: YF_RANGE[interval] as any,
    includePrePost: false,
  });

  const quotes = (result.quotes ?? []).filter(
    (q) => q.open !== null && q.close !== null
  );

  const data: KlinePoint[] = quotes.map((q) => ({
    t: Math.floor(new Date(q.date).getTime() / 1000),
    o: parseFloat((q.open  ?? 0).toFixed(2)),
    h: parseFloat((q.high  ?? 0).toFixed(2)),
    l: parseFloat((q.low   ?? 0).toFixed(2)),
    c: parseFloat((q.close ?? 0).toFixed(2)),
    v: q.volume ?? 0,
  }));

  klineCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL[interval] });
  console.log(`[market/kline] 真實資料 ${symbol} ${interval}: ${data.length} 筆`);
  return data.slice(-limit);
}

// -------- Fallback: Mock K 線 --------
const INTERVAL_SECONDS: Record<string, number> = {
  '1m': 60, '5m': 300, '1h': 3600, '1d': 86400,
};

function generateMockKline(symbol: string, interval: string, limit: number): KlinePoint[] {
  const now  = Math.floor(Date.now() / 1000);
  const step = INTERVAL_SECONDS[interval] || 3600;
  const base = BASE_PRICES[symbol] ?? 100;
  const kline: KlinePoint[] = [];
  let price = base * (0.96 + Math.random() * 0.02);

  for (let i = limit; i >= 0; i--) {
    const t = now - i * step;
    const hour     = new Date(t * 1000).getHours();
    const isMarket = hour >= 9 && hour <= 13;
    const vol  = isMarket ? 0.018 : 0.006;
    const chg  = (Math.random() - 0.48) * base * vol;
    const open  = price;
    const close = Math.max(open + chg, base * 0.5);
    kline.push({
      t,
      o: parseFloat(open.toFixed(2)),
      h: parseFloat((Math.max(open, close) * (1 + Math.random() * 0.008)).toFixed(2)),
      l: parseFloat((Math.min(open, close) * (1 - Math.random() * 0.008)).toFixed(2)),
      c: parseFloat(close.toFixed(2)),
      v: Math.floor((isMarket ? 2000 : 500) + Math.random() * 5000),
    });
    price = close;
  }
  return kline;
}

/**
 * GET /api/market/kline
 * 優先使用 Yahoo Finance 真實資料；失敗時回退 mock
 */
router.get('/kline', async (req: Request, res: Response) => {
  const symbol   = (req.query.symbol   as string) || '2330.TW';
  const interval = (req.query.interval as string) || '1h';
  const limit    = Math.min(parseInt(req.query.limit as string) || 60, 300);

  const validIntervals = ['1m', '5m', '1h', '1d'];
  if (!validIntervals.includes(interval)) {
    return res.status(400).json({
      error: 'INVALID_PARAMETER',
      message: `interval 必須為 1m | 5m | 1h | 1d，收到：${interval}`,
    });
  }

  try {
    const data = await fetchRealKline(symbol, interval, limit);
    return res.json(data);
  } catch (err) {
    console.warn(`[market/kline] Yahoo Finance 失敗（${symbol} ${interval}），使用 mock：`, (err as Error).message);
    return res.json(generateMockKline(symbol, interval, limit));
  }
});

export { fetchRealKline };
export default router;
