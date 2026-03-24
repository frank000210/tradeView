import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, BrainCircuit, Clock, Filter } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { fetchAgentSignals } from '../api/client';
import type { AgentSignal, SignalType } from '../types/api';
import { clsx } from 'clsx';

const SIGNAL_CONFIG = {
  BUY: {
    label: '買入', color: 'text-green-400', bg: 'bg-green-400/10',
    border: 'border-green-500/30', badge: 'bg-green-500',
    icon: <TrendingUp size={16} />,
  },
  SELL: {
    label: '賣出', color: 'text-red-400', bg: 'bg-red-400/10',
    border: 'border-red-500/30', badge: 'bg-red-500',
    icon: <TrendingDown size={16} />,
  },
  HOLD: {
    label: '持有', color: 'text-yellow-400', bg: 'bg-yellow-400/10',
    border: 'border-yellow-500/30', badge: 'bg-yellow-500',
    icon: <Minus size={16} />,
  },
};

function timeAgo(ts?: number) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '剛才';
  if (mins < 60) return `${mins} 分鐘前`;
  return `${Math.floor(mins / 60)} 小時前`;
}

export function AISignals() {
  const [signals, setSignals] = useState<AgentSignal[]>([]);
  const [filter, setFilter] = useState<SignalType | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgentSignals().then((d) => {
      setSignals(d);
      setLoading(false);
    });
  }, []);

  const filtered = filter === 'ALL' ? signals : signals.filter((s) => s.type === filter);
  const buys = signals.filter((s) => s.type === 'BUY');
  const sells = signals.filter((s) => s.type === 'SELL');
  const holds = signals.filter((s) => s.type === 'HOLD');

  const radarData = [
    { metric: '技術面', value: 82 },
    { metric: '法人籌碼', value: 74 },
    { metric: '情緒面', value: 68 },
    { metric: '基本面', value: 60 },
    { metric: '量能', value: 78 },
  ];

  return (
    <div className="space-y-4 fade-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {(
          [
            { type: 'BUY', list: buys },
            { type: 'SELL', list: sells },
            { type: 'HOLD', list: holds },
          ] as const
        ).map(({ type, list }) => {
          const cfg = SIGNAL_CONFIG[type];
          const avgConf = list.length
            ? list.reduce((a, b) => a + b.confidence, 0) / list.length
            : 0;
          return (
            <div key={type} className={clsx('bg-[#111827] border rounded-xl p-4', cfg.border)}>
              <div className="flex items-center justify-between mb-3">
                <div className={clsx('flex items-center gap-2', cfg.color)}>
                  {cfg.icon}
                  <span className="text-sm font-semibold">{cfg.label}</span>
                </div>
                <span className={clsx('text-2xl font-bold', cfg.color)}>{list.length}</span>
              </div>
              <div className="text-xs text-[#6b7280]">
                平均信心度 {list.length ? (avgConf * 100).toFixed(0) : 0}%
              </div>
              <div className="mt-2 h-1.5 bg-[#1f2937] rounded-full">
                <div
                  className={clsx('h-1.5 rounded-full transition-all', {
                    'bg-green-400': type === 'BUY',
                    'bg-red-400': type === 'SELL',
                    'bg-yellow-400': type === 'HOLD',
                  })}
                  style={{ width: `${list.length ? (avgConf * 100) : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Signal List */}
        <div className="xl:col-span-2 space-y-3">
          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter size={12} className="text-[#6b7280]" />
            <span className="text-xs text-[#6b7280]">篩選：</span>
            {(['ALL', 'BUY', 'SELL', 'HOLD'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'text-xs px-2.5 py-1 rounded-md transition-colors',
                  filter === f
                    ? 'bg-blue-500 text-white'
                    : 'bg-[#1f2937] text-[#9ca3af] hover:text-white'
                )}
              >
                {f === 'ALL' ? '全部' : SIGNAL_CONFIG[f].label}
                {f !== 'ALL' && (
                  <span className="ml-1 text-[10px] opacity-70">
                    ({f === 'BUY' ? buys.length : f === 'SELL' ? sells.length : holds.length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-28 bg-[#111827] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            filtered.map((s, i) => {
              const cfg = SIGNAL_CONFIG[s.type];
              return (
                <div
                  key={i}
                  className={clsx(
                    'bg-[#111827] border rounded-xl p-4 transition-all hover:bg-[#1a2235]',
                    cfg.border
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={clsx('p-2 rounded-lg border', cfg.bg, cfg.border)}>
                        <span className={cfg.color}>{cfg.icon}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{s.symbol}</span>
                          <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', cfg.bg, cfg.color)}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-[#6b7280]">
                          <Clock size={10} />
                          <span>{timeAgo(s.timestamp)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Confidence */}
                    <div className="text-right flex-shrink-0">
                      <div className={clsx('text-xl font-bold', cfg.color)}>
                        {(s.confidence * 100).toFixed(0)}%
                      </div>
                      <div className="text-[10px] text-[#6b7280]">信心度</div>
                    </div>
                  </div>

                  {/* Confidence Bar */}
                  <div className="mt-3 mb-3">
                    <div className="h-1.5 bg-[#1f2937] rounded-full">
                      <div
                        className={clsx('h-1.5 rounded-full transition-all', {
                          'bg-green-400': s.type === 'BUY',
                          'bg-red-400': s.type === 'SELL',
                          'bg-yellow-400': s.type === 'HOLD',
                        })}
                        style={{ width: `${s.confidence * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Reasoning */}
                  <div className="text-xs text-[#9ca3af] bg-[#0d1117] rounded-lg p-3 flex items-start gap-2">
                    <BrainCircuit size={12} className="text-purple-400 flex-shrink-0 mt-0.5" />
                    <span>{s.reasoning}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Radar Chart */}
        <div className="space-y-4">
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-1">Alpha Agent 評分雷達</h2>
            <p className="text-xs text-[#6b7280] mb-4">多維度市場分析</p>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1f2937" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                />
                <Radar
                  name="評分"
                  dataKey="value"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{ background: '#1a2235', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#9ca3af', fontSize: 11 }}
                  itemStyle={{ color: '#60a5fa', fontSize: 11 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* HITL Notice */}
          <div className="bg-[#111827] border border-yellow-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-yellow-400">HITL 模式提醒</span>
            </div>
            <p className="text-xs text-[#9ca3af]">
              信心度未達 95% 的交易建議將進入<br />
              人工核准佇列，需操作員手動放行。
            </p>
            <div className="mt-3 text-xs text-[#6b7280]">
              當前閾值：<span className="text-white">95%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
