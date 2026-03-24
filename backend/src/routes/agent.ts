import { Router, Request, Response } from 'express';
import { agentSignals, alphaScores, alphaUpdatedAt } from '../store/index';

const router = Router();

router.get('/signals', (_req: Request, res: Response) => {
  const sorted = [...agentSignals].sort((a, b) => b.confidence - a.confidence);
  return res.json(sorted);
});

router.get('/alpha-scores', (_req: Request, res: Response) => {
  return res.json({ scores: alphaScores, updated_at: alphaUpdatedAt });
});

export default router;