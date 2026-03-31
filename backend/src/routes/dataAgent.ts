import { Router, Request, Response } from 'express';
import https from 'https';
import http from 'http';
import Parser from 'rss-parser';
import { crawledData } from '../store/index';

// 新聞可信度查核服務 URL（同 Zeabur 專案內部服務）
const NEWS_CHECKER_URL = process.env.NEWS_CHECKER_URL || 'http://localhost:8001';

const router = Router();
const rssParser = new Parser({ timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } });

// -------- RSS 來源清單 --------
const RSS_SOURCES = [
  { url: 'https://news.cnyes.com/rss/tw/twstock', source: '鉅亨網' },
  { url: 'https://tw.stock.yahoo.com/rss',        source: 'Yahoo 股市' },
  { url: 'https://www.twse.com.tw/rss/zh/news.xml', source: '證交所 (TWSE)' },
  { url: 'https://mops.twse.com.tw/mops/web/rss',  source: '公開資訊觀測站 (MOPS)' },
];

// -------- 情緒分析（關鍵字加權） --------
const POSITIVE_WORDS = [
  '上漲', '大漲', '買入', '增持', '利多', '突破', '強勢', '看漲',
  '買超', '外資買', '法人買', '創高', '漲停', '反彈', '黃金交叉',
  '獲利', '亮眼', '超預期', '擴產', '訂單暢旺', '業績成長',
];
const NEGATIVE_WORDS = [
  '下跌', '大跌', '賣出', '減持', '利空', '跌破', '弱勢', '看跌',
  '賣超', '外資賣', '法人賣', '創低', '跌停', '回調', '死亡交叉',
  '虧損', '不如預期', '縮產', '庫存去化', '警示', '財報疲弱',
];

function analyzeSentiment(text: string): number {
  let score = 0;
  POSITIVE_WORDS.forEach((w) => { if (text.includes(w)) score += 0.25; });
  NEGATIVE_WORDS.forEach((w) => { if (text.includes(w)) score -= 0.25; });
  return Math.max(-1, Math.min(1, parseFloat(score.toFixed(2))));
}

// -------- 快取 --------
interface NewsItem {
  title: string;
  source: string;
  url: string;
  summary: string;
  sentiment_score: number;
  timestamp: number;
}

let newsCache: NewsItem[] = [];
let newsCacheTime = 0;
const NEWS_CACHE_TTL = 5 * 60_000; // 5 分鐘快取

/** 爬取所有 RSS 來源並合併 */
async function fetchAllRSSNews(): Promise<NewsItem[]> {
  const results: NewsItem[] = [];

  await Promise.allSettled(
    RSS_SOURCES.map(async (src) => {
      try {
        const feed = await rssParser.parseURL(src.url);
        const items = (feed.items ?? []).slice(0, 15);
        for (const item of items) {
          const title   = item.title?.trim() ?? '';
          const snippet = (item.contentSnippet ?? item.summary ?? '').trim().slice(0, 250);
          results.push({
            title,
            source: src.source,
            url: item.link ?? '',
            summary: snippet,
            sentiment_score: analyzeSentiment(title + ' ' + snippet),
            timestamp: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
          });
        }
        console.log(`[dataAgent] ${src.source}: ${items.length} 筆`);
      } catch (err) {
        console.warn(`[dataAgent] RSS 失敗（${src.source}）:`, (err as Error).message);
      }
    })
  );

  return results.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * GET /api/data-agent/crawled-text
 * 優先回傳真實 RSS 新聞；若所有來源失敗則回退 mock
 * Query: source (選填), limit (default 20, max 100)
 */
router.get('/crawled-text', async (req: Request, res: Response) => {
  const sourceFilter = req.query.source as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  try {
    // 快取有效直接回傳
    if (Date.now() - newsCacheTime < NEWS_CACHE_TTL && newsCache.length > 0) {
      let data = newsCache;
      if (sourceFilter) data = data.filter((d) => d.source === sourceFilter);
      return res.json(data.slice(0, limit));
    }

    // 爬取新資料
    const fresh = await fetchAllRSSNews();
    if (fresh.length > 0) {
      newsCache = fresh;
      newsCacheTime = Date.now();
      console.log(`[dataAgent] 快取更新：共 ${fresh.length} 筆新聞`);
    }

    let data: NewsItem[] = newsCache.length > 0 ? newsCache : (crawledData as unknown as NewsItem[]);
    if (sourceFilter) data = data.filter((d) => d.source === sourceFilter);
    return res.json(data.slice(0, limit));

  } catch (err) {
    console.error('[dataAgent/crawled-text]', err);
    // Fallback to mock store
    let data = [...crawledData].sort((a, b) => b.timestamp - a.timestamp) as any[];
    if (sourceFilter) data = data.filter((d: any) => d.source === sourceFilter);
    return res.json(data.slice(0, limit));
  }
});

/**
 * 呼叫 Python news-checker 服務的輕量 HTTP 工具
 */
function proxyRequest(
  url: string,
  method: string,
  body?: object
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const payload = body ? JSON.stringify(body) : undefined;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const transport = isHttps ? https : http;
    const req = transport.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        try {
          const text = Buffer.concat(chunks).toString('utf-8');
          resolve({ status: res.statusCode ?? 500, data: JSON.parse(text) });
        } catch {
          reject(new Error('Invalid JSON from news-checker'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15_000, () => req.destroy(new Error('news-checker 請求逾時')));
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * POST /api/data-agent/check-credibility
 * 代理至 Python news-checker 服務，分析新聞可信度。
 * Body: { url?, title?, text?, published_at? }
 */
router.post('/check-credibility', async (req: Request, res: Response) => {
  const { url = '', title = '', text = '', published_at } = req.body ?? {};

  if (!url && !title && !text) {
    return res.status(400).json({ error: 'MISSING_PARAMS', message: '需提供 url、title 或 text 之一' });
  }

  try {
    const checkerUrl = `${NEWS_CHECKER_URL}/api/check`;
    const result = await proxyRequest(checkerUrl, 'POST', { url, title, text, published_at });

    if (result.status !== 200) {
      console.warn(`[dataAgent/check-credibility] news-checker 回傳 ${result.status}`);
      return res.status(502).json({ error: 'CHECKER_ERROR', message: '可信度服務暫時無法使用', detail: result.data });
    }

    return res.json(result.data);
  } catch (err) {
    const msg = (err as Error).message;
    console.error('[dataAgent/check-credibility]', msg);
    return res.status(503).json({ error: 'CHECKER_UNAVAILABLE', message: '可信度查核服務暫時無法連線', detail: msg });
  }
});

export default router;
