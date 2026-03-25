import { Router, Request, Response } from 'express';
import { crawledData } from '../store/index';

const router = Router();

/**
 * GET /api/data-agent/crawled-text
 * 取得爬蟲資料與情緒分析結果
 * 對應頁面：DataAgent — 摘要卡片、資料列表、篩選器、搜尋框
 * Query: source (選填，依來源篩選), limit (default 20, max 100)
 */
router.get('/crawled-text', (req: Request, res: Response) => {
  const sourceFilter = req.query.source as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  let data = [...crawledData].sort((a, b) => b.timestamp - a.timestamp);

  if (sourceFilter) {
    data = data.filter((d) => d.source === sourceFilter);
  }

  return res.json(data.slice(0, limit));
});

export default router;
