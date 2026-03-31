import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExternalLink, Search, TrendingUp, TrendingDown, Minus,
  Database, RefreshCw, Shield, ShieldAlert, ShieldCheck, ShieldQuestion,
  ChevronDown, ChevronUp, Loader2, Link,
} from 'lucide-react';
import { fetchCrawledData, checkNewsCredibility } from '../api/client';
import type { CrawledInfo, CredibilityResult } from '../types/api';
import { clsx } from 'clsx';

// ─── 顏色 / 工具 ───────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  '證交所 (TWSE)': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  '公開資訊觀測站 (MOPS)': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  '鉅亨網': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  'Yahoo 股市': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
};

function verdictStyle(verdict?: string) {
  if (verdict === 'CREDIBLE')
    return { color: '#10b981', bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-400' };
  if (verdict === 'SUSPICIOUS')
    return { color: '#ef4444', bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400' };
  return { color: '#f59e0b', bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400' };
}

function VerdictIcon({ verdict, size = 14 }: { verdict?: string; size?: number }) {
  if (verdict === 'CREDIBLE') return <ShieldCheck size={size} className="text-green-400" />;
  if (verdict === 'SUSPICIOUS') return <ShieldAlert size={size} className="text-red-400" />;
  if (verdict === 'UNCERTAIN') return <ShieldQuestion size={size} className="text-amber-400" />;
  return <Shield size={size} className="text-[#4b5563]" />;
}

function CredibilityBadge({
  score, verdict, label,
}: { score: number; verdict: string; label: string }) {
  const style = verdictStyle(verdict);
  return (
    <span className={clsx('inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border', style.bg, style.text)}>
      <VerdictIcon verdict={verdict} size={10} />
      {score}分 · {label}
    </span>
  );
}

function ScoreRing({ score, color, size = 56 }: { score: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1f2937" strokeWidth="5" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fill={color} fontSize="13" fontWeight="bold">
        {score}
      </text>
    </svg>
  );
}

function SentimentIcon({ score }: { score: number }) {
  if (score > 0.3) return <TrendingUp size={14} className="text-green-400" />;
  if (score < -0.3) return <TrendingDown size={14} className="text-red-400" />;
  return <Minus size={14} className="text-yellow-400" />;
}

function SentimentBar({ score }: { score: number }) {
  const pct = ((score + 1) / 2) * 100;
  const color = score > 0.3 ? '#10b981' : score < -0.3 ? '#ef4444' : '#f59e0b';
  return (
    <div className="relative h-1.5 bg-[#1f2937] rounded-full w-24">
      <div className="absolute left-1/2 top-0 w-px h-1.5 bg-[#4b5563]" />
      <div
        className="absolute h-1.5 rounded-full transition-all"
        style={{
          left: score >= 0 ? '50%' : `${pct}%`,
          width: `${Math.abs(pct - 50)}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

function timeAgo(ts?: number) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} 分鐘前`;
  return `${Math.floor(mins / 60)} 小時前`;
}

// ─── 可信度展開面板 ────────────────────────────────────────────────────────────

function CredibilityPanel({ result }: { result: CredibilityResult }) {
  const style = verdictStyle(result.verdict);
  return (
    <div className={clsx('mt-3 p-3 rounded-lg border text-xs space-y-3', style.bg)}>
      <div className="flex items-center gap-3">
        <ScoreRing score={result.overall_score} color={style.color} />
        <div>
          <div className={clsx('font-semibold text-sm', style.text)}>{result.verdict_label}</div>
          <div className="text-[#9ca3af] leading-relaxed mt-0.5">{result.summary}</div>
          {result.cofacts_found && result.cofacts_verdict && (
            <div className="mt-1 text-amber-400 flex items-center gap-1">
              <ShieldAlert size={11} />
              <span>{result.cofacts_verdict}</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {result.layers.map((layer) => {
          const barColor =
            layer.score >= 70 ? '#10b981' : layer.score >= 45 ? '#f59e0b' : '#ef4444';
          return (
            <div key={layer.name} className="flex items-center gap-2">
              <span className="w-16 text-[#6b7280] flex-shrink-0 text-[10px]">{layer.label}</span>
              <div className="flex-1 h-1.5 bg-[#1f2937] rounded-full overflow-hidden">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: `${layer.score}%`, backgroundColor: barColor }}
                />
              </div>
              <span className="w-7 text-right text-[10px]" style={{ color: barColor }}>
                {layer.score}
              </span>
              <span className="text-[#6b7280] flex-1 min-w-0 truncate text-[10px]">{layer.detail}</span>
            </div>
          );
        })}
      </div>

      <div className="text-[#4b5563] text-right text-[10px]">分析耗時 {result.processing_ms}ms</div>
    </div>
  );
}

// ─── URL 手動查核 ─────────────────────────────────────────────────────────────

function UrlChecker() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CredibilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await checkNewsCredibility({ url: url.trim() });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : '查核失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 space-y-3">
      <h2 className="text-xs font-semibold text-white flex items-center gap-2">
        <Shield size={13} className="text-blue-400" />
        新聞可信度查核
      </h2>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4b5563]" />
          <input
            type="url"
            placeholder="貼入新聞 URL 進行可信度查核..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
            className="w-full bg-[#0d1117] border border-[#1f2937] rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-[#4b5563] outline-none focus:border-blue-500/50"
          />
        </div>
        <button
          onClick={handleCheck}
          disabled={loading || !url.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-colors flex-shrink-0"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
          查核
        </button>
      </div>
      {error && <div className="text-red-400 text-xs">{error}</div>}
      {result && <CredibilityPanel result={result} />}
    </div>
  );
}

// ─── 主元件 ───────────────────────────────────────────────────────────────────

export function DataAgent() {
  const [data, setData] = useState<CrawledInfo[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const [credMap, setCredMap] = useState<Record<number, CredibilityResult>>({});
  const [credLoading, setCredLoading] = useState<Record<number, boolean>>({});
  const credRef = useRef(credMap);
  credRef.current = credMap;

  const load = useCallback(async () => {
    try {
      setError(null);
      const d = await fetchCrawledData();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const handleCheckItem = async (idx: number, item: CrawledInfo) => {
    if (credRef.current[idx] || credLoading[idx]) return;
    setCredLoading((p) => ({ ...p, [idx]: true }));
    try {
      const r = await checkNewsCredibility({
        url: (item as any).url || (item as any).original_url || '',
        title: item.title,
        text: (item as any).summary || '',
        published_at: item.timestamp ? item.timestamp / 1000 : undefined,
      });
      setCredMap((p) => ({ ...p, [idx]: r }));
    } catch {
      // silent fail – keep button available for retry
    } finally {
      setCredLoading((p) => ({ ...p, [idx]: false }));
    }
  };

  if (error && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Database size={32} className="text-[#374151]" />
        <span className="text-red-400 text-sm">{error}</span>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-[#1f2937] rounded-lg text-sm hover:bg-[#374151] transition-colors text-white"
        >
          <RefreshCw size={14} /> 重試
        </button>
      </div>
    );
  }

  const sources = ['ALL', ...Array.from(new Set(data.map((d) => d.source)))];
  const filtered = data
    .filter((d) => filter === 'ALL' || d.source === filter)
    .filter((d) =>
      search === '' ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.source.toLowerCase().includes(search.toLowerCase())
    );

  const avgSentiment = data.length
    ? data.reduce((a, b) => a + b.sentiment_score, 0) / data.length
    : 0;

  const bullish = data.filter((d) => d.sentiment_score > 0.3).length;
  const bearish = data.filter((d) => d.sentiment_score < -0.3).length;
  const neutral = data.length - bullish - bearish;

  const checkedCount = Object.keys(credMap).length;
  const credibleCount = Object.values(credMap).filter((r) => r.verdict === 'CREDIBLE').length;

  return (
    <div className="space-y-4 fade-in">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="text-xs text-[#6b7280] mb-2 flex items-center gap-1">
            <Database size={11} /> 資料筆數
          </div>
          <div className="text-2xl font-bold text-white">{data.length}</div>
          <div className="text-xs text-[#6b7280] mt-1">{sources.length - 1} 個來源</div>
        </div>
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
          <div className="text-xs text-[#6b7280] mb-2">整體情緒</div>
          <div className={clsx('text-2xl font-bold', avgSentiment > 0.1 ? 'text-green-400' : avgSentiment < -0.1 ? 'text-red-400' : 'text-yellow-400')}>
            {avgSentiment > 0.1 ? '偏多' : avgSentiment < -0.1 ? '偏空' : '中性'}
          </div>
          <div className="text-xs text-[#6b7280] mt-1">{(avgSentiment * 100).toFixed(0)}% 情緒值</div>
        </div>
        <div className="bg-[#111827] border border-green-500/20 rounded-xl p-4">
          <div className="text-xs text-[#6b7280] mb-2">看多訊號</div>
          <div className="text-2xl font-bold text-green-400">{bullish}</div>
          <div className="text-xs text-[#6b7280] mt-1">情緒 &gt; 0.3 · 中性 {neutral} · 看空 {bearish}</div>
        </div>
        <div className="bg-[#111827] border border-blue-500/20 rounded-xl p-4">
          <div className="text-xs text-[#6b7280] mb-2 flex items-center gap-1">
            <ShieldCheck size={11} className="text-blue-400" /> 可信度查核
          </div>
          <div className="text-2xl font-bold text-blue-400">
            {checkedCount > 0 ? `${credibleCount}/${checkedCount}` : '—'}
          </div>
          <div className="text-xs text-[#6b7280] mt-1">點「查核」查看詳情</div>
        </div>
      </div>

      {/* URL Checker */}
      <UrlChecker />

      {/* Filters + Search */}
      <div className="flex flex-wrap items-center gap-3 bg-[#111827] border border-[#1f2937] rounded-xl p-3">
        <div className="relative flex-1 min-w-48">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4b5563]" />
          <input
            type="text"
            placeholder="搜尋標題或來源..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0d1117] border border-[#1f2937] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#4b5563] outline-none focus:border-blue-500/50"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {sources.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={clsx(
                'text-xs px-2.5 py-1.5 rounded-md transition-colors',
                filter === s ? 'bg-blue-500 text-white' : 'bg-[#1f2937] text-[#9ca3af] hover:text-white'
              )}
            >
              {s === 'ALL' ? '全部' : s}
            </button>
          ))}
        </div>
      </div>

      {/* News List */}
      <div className="space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-[#111827] rounded-xl animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[#6b7280] text-sm">沒有符合條件的資料</div>
        ) : (
          filtered.map((item, i) => {
            const srcColor =
              SOURCE_COLORS[item.source] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
            const isExpanded = expanded === i;
            const cred = credMap[i];
            const isChecking = credLoading[i];

            return (
              <div
                key={i}
                className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 hover:bg-[#1a2235] transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
                    <SentimentIcon score={item.sentiment_score} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border', srcColor)}>
                          {item.source}
                        </span>
                        {cred && (
                          <CredibilityBadge
                            score={cred.overall_score}
                            verdict={cred.verdict}
                            label={cred.verdict_label}
                          />
                        )}
                      </div>
                      {item.timestamp && (
                        <span className="text-[10px] text-[#4b5563] flex-shrink-0">
                          {timeAgo(item.timestamp)}
                        </span>
                      )}
                    </div>

                    <h3
                      className="text-sm font-medium text-white leading-snug mb-2 cursor-pointer hover:text-blue-300 transition-colors"
                      onClick={() => cred && setExpanded(isExpanded ? null : i)}
                    >
                      {item.title}
                    </h3>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#6b7280]">情緒</span>
                        <SentimentBar score={item.sentiment_score} />
                        <span
                          className={clsx('text-xs font-medium', {
                            'text-green-400': item.sentiment_score > 0.3,
                            'text-red-400': item.sentiment_score < -0.3,
                            'text-yellow-400': Math.abs(item.sentiment_score) <= 0.3,
                          })}
                        >
                          {item.sentiment_score > 0 ? '+' : ''}
                          {item.sentiment_score.toFixed(2)}
                        </span>
                      </div>

                      {!cred && (
                        <button
                          onClick={() => handleCheckItem(i, item)}
                          disabled={isChecking}
                          className="flex items-center gap-1 text-[10px] text-[#4b5563] hover:text-blue-400 transition-colors disabled:opacity-50"
                        >
                          {isChecking ? (
                            <><Loader2 size={10} className="animate-spin" /> 查核中</>
                          ) : (
                            <><Shield size={10} /> 查核可信度</>
                          )}
                        </button>
                      )}

                      {cred && (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : i)}
                          className={clsx(
                            'flex items-center gap-1 text-[10px] transition-colors',
                            verdictStyle(cred.verdict).text
                          )}
                        >
                          <VerdictIcon verdict={cred.verdict} size={10} />
                          可信度詳情
                          {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>
                      )}

                      <a
                        href={(item as any).original_url || (item as any).url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-[10px] text-[#4b5563] hover:text-blue-400 transition-colors ml-auto"
                      >
                        <ExternalLink size={10} />
                        原始連結
                      </a>
                    </div>

                    {/* Expanded */}
                    {isExpanded && (
                      <div>
                        {(item as any).summary && (
                          <div className="mt-3 p-3 bg-[#0d1117] rounded-lg text-xs text-[#9ca3af] leading-relaxed border border-[#1f2937]">
                            {(item as any).summary}
                          </div>
                        )}
                        {cred && <CredibilityPanel result={cred} />}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Info Footer */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
        <h2 className="text-xs font-semibold text-white mb-3">資料來源 &amp; 查核說明</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-[#6b7280]">
          {[
            { name: '證交所 (TWSE)', desc: '三大法人買賣超、融資融券異動資料', freq: '每日收盤後' },
            { name: '公開資訊觀測站 (MOPS)', desc: '重大訊息公告、財報 PDF 解析', freq: '即時更新' },
            {
              name: '可信度查核引擎',
              desc: '媒體評分 + Cofacts + 內容分析 + 交叉驗證 + 時效性',
              freq: '點擊即時分析',
            },
          ].map((src) => (
            <div key={src.name} className="bg-[#0d1117] rounded-lg p-3">
              <div className="font-medium text-white mb-1">{src.name}</div>
              <div className="mb-1">{src.desc}</div>
              <div className="text-[#4b5563]">更新頻率：{src.freq}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
