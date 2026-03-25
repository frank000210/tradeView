import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldOff, AlertTriangle, TrendingDown, Activity, Zap, RefreshCw } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { fetchRiskStatus, fetchEquityCurve } from '../api/client';
import type { RiskStatus, EquityPoint } from '../types/api';
import { clsx } from 'clsx';

const CB_CONFIG = {
  ACTIVE: {
    label: '正常運行', icon: <ShieldCheck size={20} />,
    color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-500/30',
    desc: '所有風控指標正常，系統可自動執行交易。',
  },
  WARNING: {
    label: '警告狀態', icon: <ShieldAlert size={20} />,
    color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-500/30',
    desc: '回撤接近警戒線，系統已限制交易頻率，請注意風險。',
  },
  PAUSED: {
    label: '系統暫停', icon: <ShieldOff size={20} />,
    color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-500/30',
    desc: '最大回撤已達 3%，系統已自動暫停交易，需人工介入。',
  },
};


function GaugeArc({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(value / max, 1);
  const angle = pct * 180;
  const r = 60;
  const cx = 80;
  const cy = 80;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const startX = cx - r * Math.cos(toRad(0));
  const startY = cy - r * Math.sin(toRad(0));
  const endX = cx + r * Math.cos(toRad(180 - angle));
  const endY = cy - r * Math.sin(toRad(180 - angle));

  // Background arc (full 180°)
  const bgEndX = cx + r;
  const bgEndY = cy; // used in path below

  return (
    <svg viewBox="0 0 160 90" className="w-full">
      {/* Background arc */}
      <path
        d={`M ${cx - r} ${bgEndY} A ${r} ${r} 0 0 1 ${bgEndX} ${bgEndY}`}
        fill="none"
        stroke="#1f2937"
        strokeWidth={12}
        strokeLinecap="round"
      />
      {/* Value arc */}
      {pct > 0 && (
        <path
          d={`M ${startX} ${startY} A ${r} ${r} 0 ${angle > 90 ? 1 : 0} 1 ${endX} ${endY}`}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
        />
      )}
      {/* Marker lines */}
      {[0, 33, 66, 100].map((pct2) => {
        const a = (pct2 / 100) * 180;
        const x1 = cx - (r - 8) * Math.cos(toRad(a));
        const y1 = cy - (r - 8) * Math.sin(toRad(a));
        const x2 = cx - (r + 4) * Math.cos(toRad(a));
        const y2 = cy - (r + 4) * Math.sin(toRad(a));
        return <line key={pct2} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#374151" strokeWidth={1} />;
      })}
      {/* Center text */}
      <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize={18} fontWeight="bold">
        {(value * (value < 1 ? 100 : 1)).toFixed(value < 1 ? 2 : 0)}
        {value < 1 ? '%' : ''}
      </text>
    </svg>
  );
}

export function RiskMonitor() {
  const [risk, setRisk] = useState<RiskStatus | null>(null);
  const [equityCurve, setEquityCurve] = useState<{ time: string; equity: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [r, eq] = await Promise.all([
        fetchRiskStatus(),
        fetchEquityCurve(30),
      ]);
      setRisk(r);
      setEquityCurve(
        eq.map((p: EquityPoint) => ({
          time: new Date(p.timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }),
          equity: p.equity,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading || !risk) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-32 bg-[#111827] rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-[#111827] rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-[#6b7280]">
        <span className="text-red-400 text-sm">{error}</span>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-[#1f2937] rounded-lg text-sm hover:bg-[#374151] transition-colors">
          <RefreshCw size={14} /> 重試
        </button>
      </div>
    );
  }

  const cb = CB_CONFIG[risk.circuit_breaker];
  const mddPct = risk.mdd * 100;
  const tradeUsagePct = (risk.daily_trades / 15) * 100;

  return (
    <div className="space-y-4 fade-in">
      {/* Circuit Breaker Status Banner */}
      <div className={clsx('border rounded-xl p-5 flex items-center gap-4', cb.bg, cb.border)}>
        <div className={clsx('p-3 rounded-xl', cb.bg, cb.color)}>
          {cb.icon}
        </div>
        <div>
          <div className={clsx('text-base font-bold', cb.color)}>斷路器狀態：{cb.label}</div>
          <div className="text-sm text-[#9ca3af] mt-0.5">{cb.desc}</div>
        </div>
        {risk.circuit_breaker !== 'ACTIVE' && (
          <div className="ml-auto">
            <button className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-black text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors">
              <Zap size={14} />
              重置斷路器
            </button>
          </div>
        )}
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* MDD Gauge */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={14} className="text-red-400" />
            <h3 className="text-sm font-semibold text-white">最大回撤 (MDD)</h3>
          </div>
          <GaugeArc
            value={risk.mdd}
            max={0.05}
            color={mddPct >= 3 ? '#ef4444' : mddPct >= 2 ? '#f59e0b' : '#10b981'}
          />
          <div className="flex justify-between text-[10px] text-[#6b7280] -mt-2 px-1">
            <span>0%</span>
            <span className="text-yellow-400">2% ⚠</span>
            <span className="text-red-400">3% 🔴</span>
          </div>
          <div className="mt-3 text-center">
            <span className={clsx('text-xs', mddPct >= 3 ? 'text-red-400' : mddPct >= 2 ? 'text-yellow-400' : 'text-green-400')}>
              {mddPct >= 3 ? '⚠ 已觸發暫停' : mddPct >= 2 ? '⚠ 接近警戒線' : '✓ 正常範圍'}
            </span>
          </div>
        </div>

        {/* Daily Trades */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-white">今日交易次數</h3>
          </div>
          <div className="flex items-end justify-center gap-1 my-6">
            <span className={clsx('text-5xl font-bold', tradeUsagePct >= 90 ? 'text-red-400' : tradeUsagePct >= 70 ? 'text-yellow-400' : 'text-white')}>
              {risk.daily_trades}
            </span>
            <span className="text-xl text-[#6b7280] mb-1">/ 15</span>
          </div>
          <div className="h-2 bg-[#1f2937] rounded-full mb-3">
            <div
              className={clsx('h-2 rounded-full transition-all', {
                'bg-green-400': tradeUsagePct < 70,
                'bg-yellow-400': tradeUsagePct >= 70 && tradeUsagePct < 90,
                'bg-red-400': tradeUsagePct >= 90,
              })}
              style={{ width: `${tradeUsagePct}%` }}
            />
          </div>
          <div className="text-center text-xs text-[#6b7280]">
            剩餘 {15 - risk.daily_trades} 次配額
          </div>
        </div>

        {/* Portfolio Value */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-purple-400" />
            <h3 className="text-sm font-semibold text-white">帳戶總淨值</h3>
          </div>
          <div className="flex items-center justify-center my-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">
                {(risk.portfolio_value / 10000).toFixed(1)}
              </div>
              <div className="text-lg text-[#6b7280]">萬元 (TWD)</div>
            </div>
          </div>
          <div className="bg-[#0d1117] rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-[#6b7280]">初始資金</span>
              <span className="text-white">
                {((risk.portfolio_value / (1 - risk.mdd)) / 10000).toFixed(1)} 萬
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6b7280]">回撤金額</span>
              <span className="text-red-400">
                -{(risk.portfolio_value * risk.mdd / 10000).toFixed(1)} 萬
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Equity Curve */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">帳戶淨值曲線</h2>
            <p className="text-xs text-[#6b7280]">近 30 小時</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-[#6b7280]">
              <span className="w-6 h-0.5 bg-red-500/50 inline-block" style={{ borderTop: '1px dashed #ef4444' }} /> 停損線 (MDD 3%)
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={equityCurve}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#1f2937' }} interval={5} />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fill: '#6b7280', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 10000).toFixed(0)}萬`}
              width={45}
            />
            <Tooltip
              contentStyle={{ background: '#1a2235', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#9ca3af', fontSize: 11 }}
              itemStyle={{ color: '#60a5fa', fontSize: 11 }}
              formatter={(v) => [`${(Number(v) / 10000).toFixed(2)} 萬`, '淨值'] as [string, string]}
            />
            <ReferenceLine
              y={risk.portfolio_value * (1 - 0.03)}
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: 'MDD 3%', fill: '#ef4444', fontSize: 9 }}
            />
            <Line
              type="monotone"
              dataKey="equity"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#3b82f6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Rules Table */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white mb-4">風控規則</h2>
        <div className="space-y-2">
          {[
            { rule: '最大回撤 (MDD) 觸發', threshold: '3%', current: `${mddPct.toFixed(2)}%`, status: mddPct >= 3 ? 'triggered' : mddPct >= 2 ? 'warning' : 'normal' },
            { rule: '每日交易次數上限', threshold: '15 次', current: `${risk.daily_trades} 次`, status: risk.daily_trades >= 15 ? 'triggered' : risk.daily_trades >= 10 ? 'warning' : 'normal' },
            { rule: 'AI 信心度閾值 (HITL)', threshold: '95%', current: '已設定', status: 'normal' },
            { rule: '斷路器自動暫停', threshold: 'MDD ≥ 3%', current: risk.circuit_breaker, status: risk.circuit_breaker === 'ACTIVE' ? 'normal' : risk.circuit_breaker === 'WARNING' ? 'warning' : 'triggered' },
          ].map((r, i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-[#0d1117] rounded-lg text-xs">
              <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', {
                'bg-green-400': r.status === 'normal',
                'bg-yellow-400 animate-pulse': r.status === 'warning',
                'bg-red-400 animate-pulse': r.status === 'triggered',
              })} />
              <span className="flex-1 text-[#9ca3af]">{r.rule}</span>
              <span className="text-[#6b7280]">閾值：{r.threshold}</span>
              <span className={clsx('font-medium', {
                'text-green-400': r.status === 'normal',
                'text-yellow-400': r.status === 'warning',
                'text-red-400': r.status === 'triggered',
              })}>
                {r.current}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
