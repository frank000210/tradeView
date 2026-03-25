import { Router, Request, Response } from 'express';
import {
  riskState,
  checkDailyReset,
  generateEquityCurve,
} from '../store/index';

const router = Router();

/**
 * GET /api/risk/status
 * 取得目前風控狀態
 * 對應頁面：
 *   Dashboard  — 帳戶總淨值 KPI、斷路器 KPI、今日 N/15·MDD%、風控概況區
 *   RiskMonitor — 頂部橫幅、MDD 半圓儀表、交易次數儀表、帳戶淨值卡片、風控規則表
 */
router.get('/status', (_req: Request, res: Response) => {
  checkDailyReset();

  // 根據 MDD 自動計算斷路器狀態
  const mddPct = riskState.mdd * 100;
  if (mddPct >= 3) {
    riskState.circuit_breaker = 'PAUSED';
  } else if (mddPct >= 2) {
    riskState.circuit_breaker = 'WARNING';
  } else {
    riskState.circuit_breaker = 'ACTIVE';
  }

  return res.json({ ...riskState });
});

/**
 * GET /api/risk/equity-curve
 * 取得帳戶淨值曲線（近 N 小時）
 * 對應頁面：RiskMonitor — 近 30 小時折線圖，紅色虛線 MDD 3% 停損線
 * Query: hours (default 30, max 168)
 */
router.get('/equity-curve', (req: Request, res: Response) => {
  const hours = Math.min(parseInt(req.query.hours as string) || 30, 168);
  const curve = generateEquityCurve(hours);
  return res.json(curve);
});

/**
 * POST /api/risk/circuit-breaker/reset
 * 重置斷路器（WARNING/PAUSED → ACTIVE）
 * 對應頁面：RiskMonitor — 頂部橫幅右側「重置斷路器」按鈕
 */
router.post('/circuit-breaker/reset', (req: Request, res: Response) => {
  if (riskState.circuit_breaker === 'ACTIVE') {
    return res.status(400).json({
      error: 'ALREADY_ACTIVE',
      message: '斷路器目前已是 ACTIVE 狀態，無需重置',
    });
  }

  const prevState = riskState.circuit_breaker;
  riskState.circuit_breaker = 'ACTIVE';
  // 重置時輕微修正 MDD（模擬人工確認後的重置）
  if (riskState.mdd >= 0.02) {
    riskState.mdd = 0.018;
  }

  const reason = req.body?.reason || '操作員手動重置';
  console.log(`[risk] 斷路器重置：${prevState} → ACTIVE，原因：${reason}`);

  return res.json({
    success: true,
    message: `斷路器已由 ${prevState} 重置為 ACTIVE 狀態`,
  });
});

export default router;
