import { Router, Request, Response } from 'express';
import { crawledData } from '../store/index';

const router = Router();

router.get('/crawled-text', (req: Request, res: Response) => {
  const sourceFilter = req.query.source as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  let data = [...crawledData].sort((a, b) => b.timestamp - a.timestamp);
  if (sourceFilter) data = data.filter((d) => d.source === sourceFilter);
  return res.json(data.slice(0, limit));
});

export default router;