import { Router, Request, Response } from 'express';

const router = Router();

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

  const { default: yahooFinance } = await import('yahoo-finance2');
  const result = await yahooFinance.chart(symbol, {
    interval: YF_INTERVAL[interval],
    range: YF_RANGE[interval] as any,
  } as any);

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

/**
 * GET /api/market/kline
 * 使用 Yahoo Finance 取得真實 K 線。
 * 若取得失敗或無資料，回傳 503（不再 fallback 假資料）。
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

    if (data.length === 0) {
      const hint = (interval === '1m' || interval === '5m')
        ? '（1m/5m 資料僅在交易時間 09:00–13:30 可取得）'
        : '';
      console.warn(`[market/kline] Yahoo Finance 回傳空資料：${symbol} ${interval}${hint}`);
      return res.status(503).json({
        error: 'NO_DATA',
        message: `目前無 ${symbol} 的 ${interval} K 線資料${hint}`,
      });
    }

    return res.json(data);
  } catch (err) {
    const errMsg = (err as Error).message || 'Unknown error';
    console.warn(`[market/kline] Yahoo Finance 失敗（${symbol} ${interval}）：`, errMsg);
    return res.status(503).json({
      error: 'UPSTREAM_UNAVAILABLE',
      message: `無法取得 ${symbol} 的 K 線資料，請稍後再試`,
    });
  }
});

export { fetchRealKline };
export default router;
