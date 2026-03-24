import { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Wallet,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { fetchAgentSignals, fetchRiskStatus, fetchKlineData } from '../api/client';
import type { AgentSignal, RiskStatus, KlineData } from '../types/api';
import { clsx } from 'clsx';

function formatPrice(n: number) {
  return n.toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}
function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}

const SIGNAL_CONFIG = {
  BUY: { label: '買入', color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-500/30', icon: <TrendingUp size={14} /> },
  SELL: { label: '賣出', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-500/30', icon: <TrendingDown size={14} /> },
  HOLD: { label: '持有', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-500/30', icon: <Minus size={14} /> },
};

const CB_CONFIG = {
  ACTIVE: { label: '正常', icon: <ShieldCheck size={16} />, color: 'text-green-400', bg: 'bg-green-400/10' },
  WARNING: { label: '警告', icon: <ShieldAlert size={16} />, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  PAUSED: { label: '暫停', icon: <ShieldOff size={16} />, color: 'text-red-400', bg: 'bg-red-400/10' },
};

export function Dashboard() {
  const [signals, setSignals] = useState<AgentSignal[]>([]);
  const [risk, setRisk] = useState<RiskStatus | null>(null);
  const [kline, setKline] = useState<KlineData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchAgentSignals(),
      fetchRiskStatus(),
      fetchKlineData('2330.TW', '1h'),
    ]).then(([s, r, k]) => {
      setSignals(s);
      setRisk(r);
      setKline(k);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSkeleton />;

  const latestPrice = kline.length > 0 ? kline[kline.length - 1].c : 0;
  const prevPrice = kline.length > 1 ? kline[kline.length - 2].c : latestPrice;
  const priceChange = latestPrice - prevPrice;
  const priceChangePct = (priceChange / prevPrice) * 100;

  const buys = signals.filter((s) => s.type === 'BUY').length;
  const sells = signals.filter((s) => s.type === 'SELL').length;
  const avgConf = signals.reduce((a, b) => a + b.confidence, 0) / signals.length;

  const chartData = kline.slice(-20).map((k) => ({
    time: formatTime(k.t),
    price: k.c,
  }));

  const cb = risk ? CB_CONFIG[risk.circuit_breaker] : CB_CONFIG.ACTIVE;

  return (
    <div className="space-y-6 fade-in">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Portfolio Value */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 card-glow-blue">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[#6b7280]">帳戶總淨值</span>
            <div className="p-1.5 bg-blue-500/10 rounded-lg">
              <Wallet size={14} className="text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            ₺{formatPrice(risk?.portfolio_value ?? 0)}
          </div>
          <div className="text-xs text-[#6b7280] mt-1">台幣 (TWD)</div>
        </div>

        {/* Price */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[#6b7280]">台積電 2330</span>
            <span className="text-xs text-[#6b7280]">最新</span>
          </div>
          <div className="text-2xl font-bold text-white">{formatPrice(latestPrice)}</div>
          <div className={clsx('flex items-center gap-1 text-xs mt-1', priceChange >= 0 ? 'text-green-400' : 'text-red-400')}>
            {priceChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{priceChange >= 0 ? '+' : ''}{priceChange.toFixed(1)} ({priceChangePct.toFixed(2)}%)</span>
          </div>
        </div>

        {/* Circuit Breaker */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[#6b7280]">斷路器狀態</span>
            <div className={clsx('p-1.5 rounded-lg', cb.bg)}>
              <span className={cb.color}>{cb.icon}</span>
            </div>
          </div>
          <div className={clsx('text-2xl font-bold', cb.color)}>{cb.label}</div>
          <div className="text-xs text-[#6b7280] mt-1">
            今日 {risk?.daily_trades ?? 0} / 15 筆 · MDD {((risk?.mdd ?? 0) * 100).toFixed(1)}%
          </div>
        </div>

        {/* AI Summary */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[#6b7280]">AI 信號摘要</span>
            <div className="p-1.5 bg-purple-500/10 rounded-lg">
              <Activity size={14} className="text-purple-400" />
            </div>
          </div>
          <div className="flex gap-2 text-sm font-semibold">
            <span className="text-green-400">{buys} 買</span>
            <span className="text-[#374151]">·</span>
            <span className="text-red-400">{sells} 賣</span>
          </div>
          <div className="text-xs text-[#6b7280] mt-1">
            平均信心度 {(avgConf * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Chart + Signals */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Price Chart */}
        <div className="xl:col-span-2 bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">台積電 (2330) 走勢</h2>
              <p className="text-xs text-[#6b7280]">近 20 小時收盤價</p>
            </div>
            <span className="text-xs text-[#4b5563] bg-[#1f2937] px-2 py-1 rounded">1H</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="time"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#1f2937' }}
                interval={4}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v.toFixed(0)}
                width={45}
              />
              <Tooltip
                contentStyle={{ background: '#1a2235', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#9ca3af', fontSize: 11 }}
                itemStyle={{ color: '#60a5fa', fontSize: 11 }}
                formatter={(v: number) => [`${v.toFixed(1)}`, '收盤價'] as [string, string]}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#3b82f6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Signals */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">最新 AI 信號</h2>
            <span className="text-xs text-blue-400 cursor-pointer hover:underline">查看全部</span>
          </div>
          <div className="space-y-2">
            {signals.slice(0, 4).map((s, i) => {
              const cfg = SIGNAL_CONFIG[s.type];
              return (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#0d1117]">
                  <div className={clsx('p-1.5 rounded-md border', cfg.bg, cfg.border)}>
                    <span className={cfg.color}>{cfg.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-white">{s.symbol}</span>
                      <span className={clsx('text-xs font-bold', cfg.color)}>{cfg.label}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="flex-1 h-1 bg-[#1f2937] rounded-full">
                        <div
                          className={clsx('h-1 rounded-full', s.type === 'BUY' ? 'bg-green-400' : s.type === 'SELL' ? 'bg-red-400' : 'bg-yellow-400')}
                          style={{ width: `${s.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[#6b7280]">{(s.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Risk Overview */}
      {risk && (
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">風控概況</h2>
            <div className={clsx('flex items-center gap-1.5 text-xs px-2 py-1 rounded-full', cb.bg, cb.color)}>
              {cb.icon}
              <span>斷路器：{cb.label}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <RiskMetric label="最大回撤 (MDD)" value={`${(risk.mdd * 100).toFixed(2)}%`} threshold={3} current={risk.mdd * 100} warn={2} danger={3} />
            <RiskMetric label="今日交易次數" value={`${risk.daily_trades} / 15`} threshold={15} current={risk.daily_trades} warn={10} danger={14} />
            <div className="p-3 bg-[#0d1117] rounded-lg">
              <div className="text-xs text-[#6b7280] mb-1">斷路器</div>
              <div className={clsx('text-sm font-bold', cb.color)}>{cb.label}</div>
            </div>
            <div className="p-3 bg-[#0d1117] rounded-lg">
              <div className="text-xs text-[#6b7280] mb-1">帳戶淨值</div>
              <div className="text-sm font-bold text-white">
                {(risk.portfolio_value / 10000).toFixed(1)} 萬
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-3">
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors">
          <ArrowUpRight size={14} />
          查看待核准交易
        </button>
      </div>
    </div>
  );
}

function RiskMetric({ label, value, current, warn, danger }: {
  label: string; value: string; threshold: number; current: number; warn: number; danger: number;
}) {
  const color = current >= danger ? 'text-red-400' : current >= warn ? 'text-yellow-400' : 'text-green-400';
  return (
    <div className="p-3 bg-[#0d1117] rounded-lg">
      <div className="text-xs text-[#6b7280] mb-1">{label}</div>
      <div className={clsx('text-sm font-bold', color)}>{value}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-[#111827] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 h-64 bg-[#111827] rounded-xl" />
        <div className="h-64 bg-[#111827] rounded-xl" />
      </div>
    </div>
  );
}
