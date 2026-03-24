import { useState } from 'react';
import { CheckCircle, XCircle, Clock, TrendingUp, TrendingDown, AlertCircle, User } from 'lucide-react';
import { approveTrade } from '../api/client';
import { mockPendingTrades } from '../api/mockData';
import type { PendingTrade } from '../types/api';
import { clsx } from 'clsx';

const SIGNAL_CONFIG = {
  BUY: { label: '買入', color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-500/30', icon: <TrendingUp size={14} /> },
  SELL: { label: '賣出', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-500/30', icon: <TrendingDown size={14} /> },
  HOLD: { label: '持有', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-500/30', icon: null },
};

function timeAgo(ts: number) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return '剛才';
  if (mins < 60) return `${mins} 分鐘前`;
  return `${Math.floor(mins / 60)} 小時前`;
}

export function TradeApproval() {
  const [trades, setTrades] = useState<PendingTrade[]>(mockPendingTrades);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = async (taskId: string, action: 'APPROVE' | 'REJECT') => {
    setProcessing(taskId);
    try {
      const res = await approveTrade({ task_id: taskId, action });
      if (res.success) {
        setTrades((prev) =>
          prev.map((t) =>
            t.task_id === taskId
              ? { ...t, status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED' }
              : t
          )
        );
        showToast(res.message, 'success');
      }
    } catch {
      showToast('操作失敗，請重試', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const pending = trades.filter((t) => t.status === 'PENDING');
  const approved = trades.filter((t) => t.status === 'APPROVED');
  const rejected = trades.filter((t) => t.status === 'REJECTED');

  return (
    <div className="space-y-4 fade-in">
      {/* Toast */}
      {toast && (
        <div
          className={clsx(
            'fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-sm',
            toast.type === 'success'
              ? 'bg-green-500/20 border border-green-500/30 text-green-400'
              : 'bg-red-500/20 border border-red-500/30 text-red-400'
          )}
        >
          {toast.type === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#111827] border border-yellow-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-yellow-400" />
            <span className="text-xs text-[#6b7280]">待核准</span>
          </div>
          <div className="text-2xl font-bold text-yellow-400">{pending.length}</div>
        </div>
        <div className="bg-[#111827] border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={14} className="text-green-400" />
            <span className="text-xs text-[#6b7280]">已核准</span>
          </div>
          <div className="text-2xl font-bold text-green-400">{approved.length}</div>
        </div>
        <div className="bg-[#111827] border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={14} className="text-red-400" />
            <span className="text-xs text-[#6b7280]">已拒絕</span>
          </div>
          <div className="text-2xl font-bold text-red-400">{rejected.length}</div>
        </div>
      </div>

      {/* HITL Info Banner */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
        <User size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-[#9ca3af]">
          <span className="text-blue-400 font-medium">人工在環 (HITL) 模式</span>：
          當 AI 系統處於半自動模式，或交易信心度未達 95% 時，所有交易建議需透過此介面進行人工核准後方可執行。
          核准後系統將立即送出委託單。
        </div>
      </div>

      {/* Pending Trades */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            待核准交易
          </h2>
          <div className="space-y-3">
            {pending.map((trade) => {
              const cfg = SIGNAL_CONFIG[trade.type];
              const isProcessing = processing === trade.task_id;
              const totalValue = trade.quantity * trade.estimated_price;

              return (
                <div
                  key={trade.task_id}
                  className={clsx('bg-[#111827] border rounded-xl p-4', cfg.border)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={clsx('p-2 rounded-lg border', cfg.bg, cfg.border)}>
                        <span className={cfg.color}>{cfg.icon}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{trade.symbol}</span>
                          <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', cfg.bg, cfg.color)}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#6b7280] mt-0.5">
                          {trade.task_id} · {timeAgo(trade.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={clsx('text-lg font-bold', cfg.color)}>
                        {(trade.confidence * 100).toFixed(0)}%
                      </div>
                      <div className="text-[10px] text-[#6b7280]">信心度</div>
                    </div>
                  </div>

                  {/* Trade Details */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-[#0d1117] rounded-lg p-2.5 text-xs">
                      <div className="text-[#6b7280] mb-1">股數</div>
                      <div className="font-bold text-white">{trade.quantity} 張</div>
                    </div>
                    <div className="bg-[#0d1117] rounded-lg p-2.5 text-xs">
                      <div className="text-[#6b7280] mb-1">預估價格</div>
                      <div className="font-bold text-white">{trade.estimated_price.toFixed(1)}</div>
                    </div>
                    <div className="bg-[#0d1117] rounded-lg p-2.5 text-xs">
                      <div className="text-[#6b7280] mb-1">預估金額</div>
                      <div className="font-bold text-white">
                        {(totalValue / 10000).toFixed(1)} 萬
                      </div>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-[#6b7280] mb-1">
                      <span>AI 信心度</span>
                      <span>{(trade.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-[#1f2937] rounded-full">
                      <div
                        className={clsx('h-1.5 rounded-full', cfg.color.replace('text-', 'bg-'))}
                        style={{ width: `${trade.confidence * 100}%` }}
                      />
                    </div>
                    {trade.confidence < 0.95 && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-yellow-400">
                        <AlertCircle size={10} />
                        信心度未達 95%，需人工核准
                      </div>
                    )}
                  </div>

                  {/* Reasoning */}
                  <div className="bg-[#0d1117] rounded-lg p-3 text-xs text-[#9ca3af] mb-4">
                    <span className="text-[#6b7280]">AI 決策依據：</span>
                    {trade.reasoning}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(trade.task_id, 'APPROVE')}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      <CheckCircle size={14} />
                      {isProcessing ? '處理中...' : '核准'}
                    </button>
                    <button
                      onClick={() => handleAction(trade.task_id, 'REJECT')}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 border border-red-500/30 text-red-400 text-sm font-semibold rounded-lg transition-colors"
                    >
                      <XCircle size={14} />
                      {isProcessing ? '處理中...' : '拒絕'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Trades History */}
      {(approved.length > 0 || rejected.length > 0) && (
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">已處理交易</h2>
          <div className="space-y-2">
            {[...approved, ...rejected].map((trade) => {
              const cfg = SIGNAL_CONFIG[trade.type];
              const isApproved = trade.status === 'APPROVED';
              return (
                <div key={trade.task_id} className="bg-[#111827] border border-[#1f2937] rounded-xl p-3 opacity-70">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isApproved
                        ? <CheckCircle size={14} className="text-green-400" />
                        : <XCircle size={14} className="text-red-400" />}
                      <span className="text-sm font-medium text-white">{trade.symbol}</span>
                      <span className={clsx('text-xs', cfg.color)}>{cfg.label}</span>
                      <span className="text-xs text-[#4b5563]">{trade.task_id}</span>
                    </div>
                    <span className={clsx('text-xs font-semibold', isApproved ? 'text-green-400' : 'text-red-400')}>
                      {isApproved ? '已核准' : '已拒絕'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {pending.length === 0 && approved.length === 0 && rejected.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[#6b7280]">
          <CheckCircle size={40} className="mb-3 opacity-30" />
          <div className="text-sm">目前沒有待核准的交易</div>
          <div className="text-xs mt-1 opacity-60">所有 AI 交易建議均已處理</div>
        </div>
      )}
    </div>
  );
}
