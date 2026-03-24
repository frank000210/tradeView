import { Router, Request, Response } from 'express';
import { pendingTrades, riskState } from '../store/index';

const router = Router();

router.get('/pending', (req: Request, res: Response) => {
  const statusFilter = (req.query.status as string) || 'ALL';
  let trades = [...pendingTrades].sort((a, b) => b.created_at - a.created_at);
  if (statusFilter !== 'ALL') trades = trades.filter((t) => t.status === statusFilter);
  return res.json(trades);
});

router.post('/approve', (req: Request, res: Response) => {
  const { task_id, action } = req.body as { task_id: string; action: string };

  if (!task_id || !action) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: '請提供 task_id 與 action 欄位' });
  }
  if (!['APPROVE', 'REJECT'].includes(action)) {
    return res.status(400).json({ error: 'INVALID_ACTION', message: 'action 必須為 APPROVE 或 REJECT' });
  }

  const trade = pendingTrades.find((t) => t.task_id === task_id);
  if (!trade) {
    return res.status(400).json({ error: 'INVALID_TASK_ID', message: '找不到交易任務 ' + task_id });
  }
  if (trade.status !== 'PENDING') {
    return res.status(400).json({ error: 'ALREADY_PROCESSED', message: '交易 ' + task_id + ' 已處理過（狀態：' + trade.status + '）' });
  }

  trade.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

  if (action === 'APPROVE') {
    riskState.daily_trades += 1;
    const tradeValue = trade.quantity * trade.estimated_price * 1000;
    riskState.portfolio_value += (trade.type === 'SELL' ? 1 : -1) * tradeValue * 0.001;
    console.log('[trade] 核准 ' + task_id + ': ' + trade.type + ' ' + trade.symbol + ' ' + trade.quantity + ' 張');
  } else {
    console.log('[trade] 拒絕 ' + task_id);
  }

  const label = action === 'APPROVE' ? '核准' : '拒絕';
  return res.json({
    success: true,
    message: '交易 ' + task_id + ' 已' + label + '，' + (action === 'APPROVE' ? '委託單已送出' : '已記錄拒絕原因'),
  });
});

export default router;