import { Router, Request, Response } from 'express';
import { pendingTrades, riskState } from '../store/index';

const router = Router();

/**
 * GET /api/trade/pending
 * 取得待核准交易列表
 * 對應頁面：TradeApproval — 統計卡片、待核准卡片、已處理列表
 * Query: status (PENDING | APPROVED | REJECTED | ALL, default ALL)
 */
router.get('/pending', (req: Request, res: Response) => {
  const statusFilter = (req.query.status as string) || 'ALL';

  let trades = [...pendingTrades].sort((a, b) => b.created_at - a.created_at);

  if (statusFilter !== 'ALL') {
    trades = trades.filter((t) => t.status === statusFilter);
  }

  return res.json(trades);
});

/**
 * POST /api/trade/approve
 * 核准或拒絕交易
 * 對應頁面：TradeApproval — 「核准」/「拒絕」按鈕
 * Body: { task_id: string, action: 'APPROVE' | 'REJECT' }
 */
router.post('/approve', (req: Request, res: Response) => {
  const { task_id, action } = req.body as { task_id: string; action: string };

  if (!task_id || !action) {
    return res.status(400).json({
      error: 'MISSING_FIELDS',
      message: '請提供 task_id 與 action 欄位',
    });
  }

  if (!['APPROVE', 'REJECT'].includes(action)) {
    return res.status(400).json({
      error: 'INVALID_ACTION',
      message: 'action 必須為 APPROVE 或 REJECT',
    });
  }

  const trade = pendingTrades.find((t) => t.task_id === task_id);

  if (!trade) {
    return res.status(400).json({
      error: 'INVALID_TASK_ID',
      message: `找不到交易任務 ${task_id}`,
    });
  }

  if (trade.status !== 'PENDING') {
    return res.status(400).json({
      error: 'ALREADY_PROCESSED',
      message: `交易 ${task_id} 已經處理過（狀態：${trade.status}）`,
    });
  }

  trade.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

  // 核准時更新風控計數與淨值（模擬下單效果）
  if (action === 'APPROVE') {
    riskState.daily_trades += 1;

    // 模擬交易對淨值的輕微影響
    const tradeValue = trade.quantity * trade.estimated_price * 1000;
    if (trade.type === 'BUY') {
      // 買入：略微降低現金部位（實際上需要更複雜的倉位管理）
      riskState.portfolio_value -= tradeValue * 0.001; // 手續費約 0.1%
    } else {
      // 賣出：增加現金部位
      riskState.portfolio_value += tradeValue * 0.001;
    }

    console.log(
      `[trade] 核准交易 ${task_id}：${trade.type} ${trade.symbol} ${trade.quantity} 張 @ ${trade.estimated_price}`
    );
  } else {
    console.log(`[trade] 拒絕交易 ${task_id}：${trade.type} ${trade.symbol}`);
  }

  const actionLabel = action === 'APPROVE' ? '核准' : '拒絕';
  return res.json({
    success: true,
    message: `交易 ${task_id} 已${actionLabel}，${action === 'APPROVE' ? '委託單已送出' : '已記錄拒絕原因'}`,
  });
});

export default router;
