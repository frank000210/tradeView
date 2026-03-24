import { Router, Request, Response } from 'express';
import { riskState, checkDailyReset, generateEquityCurve } from '../store/index';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  checkDailyReset();
  const mddPct = riskState.mdd * 100;
  if (mddPct >= 3) riskState.circuit_breaker = 'PAUSED';
  else if (mddPct >= 2) riskState.circuit_breaker = 'WARNING';
  else riskState.circuit_breaker = 'ACTIVE';
  return res.json({ ...riskState });
});

router.get('/equity-curve', (req: Request, res: Response) => {
  const hours = Math.min(parseInt(req.query.hours as string) || 30, 168);
  return res.json(generateEquityCurve(hours));
});

router.post('/circuit-breaker/reset', (req: Request, res: Response) => {
  if (riskState.circuit_breaker === 'ACTIVE') {
    return res.status(400).json({ error: 'ALREADY_ACTIVE', message: '斷路器目前已是 ACTIVE 狀態，無需重置' });
  }
  const prevState = riskState.circuit_breaker;
  riskState.circuit_breaker = 'ACTIVE';
  if (riskState.mdd >= 0.02) riskState.mdd = 0.018;
  const reason = req.body?.reason || '操作員手動重置';
  console.log('[risk] 斷路器重置：' + prevState + ' → ACTIVE，原因：' + reason);
  return res.json({ success: true, message: '斷路器已由 ' + prevState + ' 重置為 ACTIVE 狀態' });
});

export default router;