import { Router, Request, Response } from 'express';
import https from 'https';

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

// 模擬瀏覽器的請求標頭，防止 Yahoo Finance 封鎖伺服器端請求
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/',
  'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
};

interface KlinePoint {
  t: number; o: number; h: number; l: number; c: number; v: number;
}

const klineCache = new Map<string, { data: KlinePoint[]; expiresAt: number }>();

/** 直接呼叫 Yahoo Finance v8 API（加入瀏覽器標頭） */
function fetchYahooFinanceDirect(symbol: string, interval: string, range: string): Promise<KlinePoint[]> {
  return new Promise((resolve, reject) => {
    const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
    const options = {
      hostname: 'query1.finance.yahoo.com',
      path,
      method: 'GET',
      headers: BROWSER_HEADERS,
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => { chunks.push(chunk); });
      res.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf-8');
          if (res.statusCode !== 200) {
            return reject(new Error(`Yahoo Finance HTTP ${res.statusCode}: ${body.substring(0, 200)}`));
          }
          const json = JSON.parse(body);
          if (json?.chart?.error) {
            return reject(new Error(`Yahoo Finance error: ${JSON.stringify(json.chart.error)}`));
          }
          const result = json?.chart?.result?.[0];
          if (!result) {
            return reject(new Error('Yahoo Finance: 回傳資料格式異常'));
          }
          const timestamps: number[] = result.timestamp ?? [];
          const quote = result.indicators?.quote?.[0] ?? {};

          const data: KlinePoint[] = [];
          for (let i = 0; i < timestamps.length; i++) {
            const o = quote.open?.[i];
            const h = quote.high?.[i];
            const l = quote.low?.[i];
            const c = quote.close?.[i];
            const v = quote.volume?.[i];
            if (o == null || c == null) continue;
            data.push({
              t: timestamps[i],
              o: parseFloat((o).toFixed(2)),
              h: parseFloat((h ?? o).toFixed(2)),
              l: parseFloat((l ?? o).toFixed(2)),
              c: parseFloat((c).toFixed(2)),
              v: v ?? 0,
            });
          }
          resolve(data);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15_000, () => {
      req.destroy(new Error('Yahoo Finance 請求逾時（15s）'));
    });
    req.end();
  });
}

/** 用 yahoo-finance2（加入 fetchOptions 模擬瀏覽器）取得 K 線資料 */
async function fetchViaYahooFinance2(symbol: string, interval: string, range: string): Promise<KlinePoint[]> {
  const { default: yahooFinance } = await import('yahoo-finance2');

  // 設定 yahoo-finance2 使用瀏覽器 User-Agent
  (yahooFinance as any).setGlobalConfig?.({
    fetchOptions: {
      headers: BROWSER_HEADERS,
    },
  });

  const result = await yahooFinance.chart(symbol, {
    interval: YF_INTERVAL[interval],
    range: range as any,
    fetchOptions: { headers: BROWSER_HEADERS } as any,
  } as any);

  const quotes = (result.quotes ?? []).filter(
    (q) => q.open !== null && q.close !== null
  );

  return quotes.map((q) => ({
    t: Math.floor(new Date(q.date).getTime() / 1000),
    o: parseFloat((q.open  ?? 0).toFixed(2)),
    h: parseFloat((q.high  ?? 0).toFixed(2)),
    l: parseFloat((q.low   ?? 0).toFixed(2)),
    c: parseFloat((q.close ?? 0).toFixed(2)),
    v: q.volume ?? 0,
  }));
}

/** 取得真實 K 線，先嘗試直接 API，失敗則用 yahoo-finance2，並快取結果 */
async function fetchRealKline(symbol: string, interval: string, limit: number): Promise<KlinePoint[]> {
  const key = `${symbol}_${interval}`;
  const cached = klineCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data.slice(-limit);
  }

  const range = YF_RANGE[interval];
  let data: KlinePoint[] = [];
  let lastError: Error | null = null;

  // 方法一：直接呼叫 Yahoo Finance v8 API（加入瀏覽器標頭）
  try {
    data = await fetchYahooFinanceDirect(symbol, YF_INTERVAL[interval], range);
    console.log(`[market/kline] 直接 API 成功 ${symbol} ${interval}: ${data.length} 筆`);
  } catch (err) {
    lastError = err as Error;
    console.warn(`[market/kline] 直接 API 失敗（${symbol} ${interval}），嘗試 yahoo-finance2: ${(err as Error).message}`);

    // 方法二：fallback 到 yahoo-finance2
    try {
      data = await fetchViaYahooFinance2(symbol, interval, range);
      console.log(`[market/kline] yahoo-finance2 成功 ${symbol} ${interval}: ${data.length} 筆`);
    } catch (err2) {
      lastError = err2 as Error;
      console.warn(`[market/kline] yahoo-finance2 也失敗（${symbol} ${interval}）: ${(err2 as Error).message}`);
    }
  }

  if (data.length > 0) {
    klineCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL[interval] });
  }

  if (data.length === 0 && lastError) {
    throw lastError;
  }

  return data.slice(-limit);
}

/**
 * GET /api/market/kline
 * 使用 Yahoo Finance 取得真實 K 線（加入瀏覽器標頭模擬，避免伺服器端被封鎖）。
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
