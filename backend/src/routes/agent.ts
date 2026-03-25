import { Router, Request, Response } from 'express';
import { agentSignals, alphaScores, alphaUpdatedAt } from '../store/index';

const router = Router();

/**
 * GET /api/agent/signals
 * 取得 AI 交易信號列表
 * 對應頁面：Dashboard（前4筆）、AISignals（完整列表 + BUY/SELL/HOLD 篩選）
 * Query: type (BUY | SELL | HOLD | ALL，default ALL)
 */
router.get('/signals', (req: Request, res: Response) => {
  const typeFilter = (req.query.type as string || 'ALL').toUpperCase();

  // 依信心度排序
  let signals = [...agentSignals].sort((a, b) => b.confidence - a.confidence);

  // 依 type 篩選
  if (typeFilter !== 'ALL' && ['BUY', 'SELL', 'HOLD'].includes(typeFilter)) {
    signals = signals.filter((s) => s.type === typeFilter);
  }

  return res.json(signals);
});

/**
 * GET /api/agent/alpha-scores
 * 取得 Alpha Agent 多維度評分（雷達圖）
 * 對應頁面：AISignals 頁面右側雷達圖
 */
router.get('/alpha-scores', (_req: Request, res: Response) => {
  // 加入微幅隨機偏移，讓雷達圖每次呼叫有細微變化
  const scores = alphaScores.map((s) => ({
    metric: s.metric,
    value: Math.min(100, Math.max(0, Math.round(s.value + (Math.random() - 0.5) * 4))),
  }));

  return res.json({
    scores,
    updated_at: alphaUpdatedAt,
  });
});

export default router;
