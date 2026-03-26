import { Router, Request, Response } from 'express';
import https from 'https';
import zlib from 'zlib';

const router = Router();

const YF_INTERVAL: Record<string, string> = {
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

// 模擬瀏覽器請求標頭（含 gzip，由程式自行解壓）
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/',
};

interface KlinePoint {
  t: number; o: number; h: number; l: number; c: number; v: number;
}

const klineCache = new Map<string, { data: KlinePoint[]; expiresAt: number }>();

/** 直接呼叫 Yahoo Finance v8 API，支援 gzip 自動解壓 */
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
      const encoding = (res.headers['content-encoding'] || '').toLowerCase();
      let stream: NodeJS.ReadableStream = res;

      if (encoding === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      } else if (encoding === 'br') {
        stream = res.pipe(zlib.createBrotliDecompress());
      }

      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf-8');
          if (res.statusCode !== 200) {
            return reject(new Error(`Yahoo Finance HTTP ${res.statusCode}: ${body.substring(0, 300)}`));
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
              o: parseFloat((o as number).toFixed(2)),
              h: parseFloat(((h ?? o) as number).toFixed(2)),
              l: parseFloat(((l ?? o) as number).toFixed(2)),
              c: parseFloat((c as number).toFixed(2)),
              v: (v as number) ?? 0,
            });
          }
          resolve(data);
        } catch (e) {
          reject(e);
        }
      });
      stream.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(15_000, () => {
      req.destroy(new Error('Yahoo Finance 請求逾時（15s）'));
    });
    req.end();
  });
}

/** 取得真實 K 線並快取 */
async function fetchRealKline(symbol: string, interval: string, limit: number): Promise<KlinePoint[]> {
  const key = `${symbol}_${interval}`;
  const cached = klineCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    console.log(`[market/kline] 快取命中 ${symbol} ${interval}`);
    return cached.data.slice(-limit);
  }

  const data = await fetchYahooFinanceDirect(symbol, YF_INTERVAL[interval], YF_RANGE[interval]);
  console.log(`[market/kline] 成功取得 ${symbol} ${interval}: ${data.length} 筆`);

  if (data.length > 0) {
    klineCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL[interval] });
  }

  return data.slice(-limit);
}

/**
 * GET /api/market/kline
 * 使用 Yahoo Finance v8 API 取得真實 K 線（含 gzip 解壓縮）。
 * 失敗時回傳 HTTP 503，不 fallback 假資料。
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
        ? '（1m/5m 資料僅在交易時間 09:00–13:30 可取得）' : '';
      console.warn(`[market/kline] 空資料：${symbol} ${interval}${hint}`);
      return res.status(503).json({
        error: 'NO_DATA',
        message: `目前無 ${symbol} 的 ${interval} K 線資料${hint}`,
      });
    }

    return res.json(data);
  } catch (err) {
    const errMsg = (err as Error).message || 'Unknown error';
    console.warn(`[market/kline] 失敗（${symbol} ${interval}）：`, errMsg);
    return res.status(503).json({
      error: 'UPSTREAM_UNAVAILABLE',
      message: `無法取得 ${symbol} 的 K 線資料，請稍後再試`,
    });
  }
});

export { fetchRealKline };
export default router;
