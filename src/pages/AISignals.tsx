import { useCallback, useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, BrainCircuit, Clock, Filter, RefreshCw,
  ChevronDown, ChevronUp, Code2, Star,
} from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { fetchAgentSignals, fetchAlphaScores, fetchSignalRules } from '../api/client';
import type { AgentSignal, SignalType, AlphaScore, SignalRule, SignalCondition } from '../types/api';
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

// ── Conditions Panel ─────────────────────────────────────────────
function ConditionsPanel({ conditions }: { conditions: SignalCondition[] }) {
  const met = conditions.filter((c) => c.met);

  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[10px] text-[#6b7280] font-medium uppercase tracking-wider">觸發條件</p>
      <div className="grid grid-cols-2 gap-1.5">
        {conditions.map((c, i) => (
          <div
            key={i}
            className={clsx(
              'flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border',
              c.met
                ? 'bg-green-400/5 border-green-500/20 text-green-300'
                : 'bg-[#0d1117] border-[#1f2937] text-[#4b5563]'
            )}
          >
            <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', c.met ? 'bg-green-400' : 'bg-[#2d3748]')} />
            <span className="flex-1 truncate">{c.name}</span>
            <span className="text-[9px] opacity-60 flex-shrink-0 ml-auto">{c.value}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-[#4b5563]">
        {met.length} / {conditions.length} 條件觸發
      </p>
    </div>
  );
}

// ── Signal Card ──────────────────────────────────────────────────
function SignalCard({ signal }: { signal: AgentSignal }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SIGNAL_CONFIG[signal.type];
  const hasConditions = signal.conditions && signal.conditions.length > 0;

  return (
    <div className={clsx('bg-[#111827] border rounded-xl p-4 transition-all hover:bg-[#1a2235]', cfg.border)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={clsx('p-2 rounded-lg border', cfg.bg, cfg.border)}>
            <span className={cfg.color}>{cfg.icon}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{signal.symbol}</span>
              <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', cfg.bg, cfg.color)}>
                {cfg.label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center gap-1 text-xs text-[#6b7280]">
                <Clock size={10} />
                <span>{timeAgo(signal.timestamp)}</span>
              </div>
              {signal.ruleName && (
                <div className="flex items-center gap-1 text-[10px] text-[#4b5563]">
                  <Code2 size={9} />
                  <span className="truncate max-w-[100px]">{signal.ruleName}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Confidence + Expand */}
        <div className="flex items-start gap-2 flex-shrink-0">
          <div className="text-right">
            <div className={clsx('text-xl font-bold', cfg.color)}>
              {(signal.confidence * 100).toFixed(0)}%
            </div>
            <div className="text-[10px] text-[#6b7280]">信心度</div>
          </div>
          {hasConditions && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 p-1 rounded-md hover:bg-[#1f2937] text-[#6b7280] hover:text-white transition-colors"
              title={expanded ? '收起條件' : '展開條件'}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Confidence Bar */}
      <div className="mt-3 mb-3">
        <div className="h-1.5 bg-[#1f2937] rounded-full">
          <div
            className={clsx('h-1.5 rounded-full transition-all', {
              'bg-green-400': signal.type === 'BUY',
              'bg-red-400': signal.type === 'SELL',
              'bg-yellow-400': signal.type === 'HOLD',
            })}
            style={{ width: `${signal.confidence * 100}%` }}
          />
        </div>
      </div>

      {/* Reasoning */}
      <div className="text-xs text-[#9ca3af] bg-[#0d1117] rounded-lg p-3 flex items-start gap-2">
        <BrainCircuit size={12} className="text-purple-400 flex-shrink-0 mt-0.5" />
        <span>{signal.reasoning}</span>
      </div>

      {/* Conditions (expandable) */}
      {expanded && hasConditions && (
        <ConditionsPanel conditions={signal.conditions!} />
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────
export function AISignals() {
  const [signals, setSignals] = useState<AgentSignal[]>([]);
  const [radarData, setRadarData] = useState<AlphaScore[]>([]);
  const [filter, setFilter] = useState<SignalType | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rule selector
  const [rules, setRules] = useState<SignalRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [rulesLoading, setRulesLoading] = useState(true);

  // Load available rules once
  useEffect(() => {
    fetchSignalRules()
      .then((data) => {
        setRules(data.rules);
        if (data.activeRule) setSelectedRuleId(data.activeRule.id);
        else if (data.rules[0]) setSelectedRuleId(data.rules[0].id);
      })
      .catch(() => {})
      .finally(() => setRulesLoading(false));
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const ruleId = selectedRuleId && selectedRuleId !== 'default' ? selectedRuleId : undefined;
      const [sigs, alpha] = await Promise.all([
        fetchAgentSignals('ALL', ruleId),
        fetchAlphaScores(),
      ]);
      setSignals(sigs);
      setRadarData(alpha.scores);
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [selectedRuleId]);

  useEffect(() => { if (!rulesLoading) load(); }, [load, rulesLoading]);
  useEffect(() => {
    if (rulesLoading) return;
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load, rulesLoading]);

  const filtered = filter === 'ALL' ? signals : signals.filter((s) => s.type === filter);
  const buys = signals.filter((s) => s.type === 'BUY');
  const sells = signals.filter((s) => s.type === 'SELL');
  const holds = signals.filter((s) => s.type === 'HOLD');

  const activeRule = rules.find((r) => r.id === selectedRuleId);

  if (error && signals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-[#6b7280]">
        <span className="text-red-400 text-sm">{error}</span>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-[#1f2937] rounded-lg text-sm hover:bg-[#374151] transition-colors">
          <RefreshCw size={14} /> 重試
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-in">
      {/* Rule Selector Bar */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-[#6b7280]">
          <Code2 size={14} className="text-blue-400" />
          <span>使用規則：</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {rules.map((rule) => (
            <button
              key={rule.id}
              onClick={() => setSelectedRuleId(rule.id)}
              className={clsx(
                'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors',
                selectedRuleId === rule.id
                  ? 'bg-blue-500/15 text-blue-400 border-blue-500/40'
                  : 'bg-[#0d1117] text-[#6b7280] border-[#1f2937] hover:text-white hover:border-[#374151]'
              )}
            >
              {rule.isActive && <Star size={9} className="text-yellow-400 fill-yellow-400" />}
              {rule.name}
            </button>
          ))}
        </div>
        {activeRule && (
          <span className="ml-auto text-[10px] text-[#4b5563]">
            {activeRule.isDefault ? '內建規則' : `自訂規則`}
          </span>
        )}
      </div>

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
            <button onClick={load} className="ml-auto flex items-center gap-1 text-xs text-[#6b7280] hover:text-white transition-colors">
              <RefreshCw size={11} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-28 bg-[#111827] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-[#6b7280]">
              <BrainCircuit size={32} className="opacity-30" />
              <span className="text-sm">查無 AI 信號資料</span>
            </div>
          ) : (
            filtered.map((s, i) => <SignalCard key={`${s.symbol}-${i}`} signal={s} />)
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

          {/* Conditions Legend */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
            <h3 className="text-xs font-semibold text-white mb-2">條件展示說明</h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-[#9ca3af]">
                <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                已觸發條件（綠色高亮）
              </div>
              <div className="flex items-center gap-2 text-xs text-[#6b7280]">
                <span className="w-2 h-2 rounded-full bg-[#2d3748] flex-shrink-0" />
                未觸發條件（灰色顯示）
              </div>
            </div>
            <p className="text-[10px] text-[#4b5563] mt-2">點擊信號卡右上角 ⌄ 展開條件明細</p>
          </div>
        </div>
      </div>
    </div>
  );
}
