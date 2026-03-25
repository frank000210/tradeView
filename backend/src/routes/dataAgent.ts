import { Router, Request, Response } from 'express';
import Parser from 'rss-parser';
import { crawledData } from '../store/index';

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

export default router;
