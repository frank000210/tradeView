import { useEffect, useState } from 'react';
import { ExternalLink, Search, TrendingUp, TrendingDown, Minus, Database } from 'lucide-react';
import { fetchCrawledData } from '../api/client';
import type { CrawledInfo } from '../types/api';
import { clsx } from 'clsx';

const SOURCE_COLORS: Record<string, string> = {
  '證交所 (TWSE)': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  '公開資訊觀測站 (MOPS)': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'PTT Stock 版': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  '股市爆料同學會': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

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
      {/* Center mark */}
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

export function DataAgent() {
  const [data, setData] = useState<CrawledInfo[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetchCrawledData().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

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

  return (
    <div className="space-y-4 fade-in">
      {/* Summary */}
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
          <div className="text-xs text-[#6b7280] mt-1">情緒 &gt; 0.3</div>
        </div>
        <div className="bg-[#111827] border border-red-500/20 rounded-xl p-4">
          <div className="text-xs text-[#6b7280] mb-2">看空訊號</div>
          <div className="text-2xl font-bold text-red-400">{bearish}</div>
          <div className="text-xs text-[#6b7280] mt-1">情緒 &lt; -0.3 · 中性 {neutral}</div>
        </div>
      </div>

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
                filter === s
                  ? 'bg-blue-500 text-white'
                  : 'bg-[#1f2937] text-[#9ca3af] hover:text-white'
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
          <div className="text-center py-12 text-[#6b7280] text-sm">
            沒有符合條件的資料
          </div>
        ) : (
          filtered.map((item, i) => {
            const srcColor = SOURCE_COLORS[item.source] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
            const isExpanded = expanded === i;

            return (
              <div
                key={i}
                className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 hover:bg-[#1a2235] transition-all cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : i)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <SentimentIcon score={item.sentiment_score} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border', srcColor)}>
                          {item.source}
                        </span>
                      </div>
                      {item.timestamp && (
                        <span className="text-[10px] text-[#4b5563] flex-shrink-0">
                          {timeAgo(item.timestamp)}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-medium text-white leading-snug mb-2">{item.title}</h3>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#6b7280]">情緒</span>
                        <SentimentBar score={item.sentiment_score} />
                        <span className={clsx('text-xs font-medium', {
                          'text-green-400': item.sentiment_score > 0.3,
                          'text-red-400': item.sentiment_score < -0.3,
                          'text-yellow-400': Math.abs(item.sentiment_score) <= 0.3,
                        })}>
                          {item.sentiment_score > 0 ? '+' : ''}{item.sentiment_score.toFixed(2)}
                        </span>
                      </div>

                      <a
                        href={item.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-[10px] text-[#4b5563] hover:text-blue-400 transition-colors ml-auto"
                      >
                        <ExternalLink size={10} />
                        原始連結
                      </a>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div
                        className="mt-3 p-3 bg-[#0d1117] rounded-lg text-xs text-[#9ca3af] leading-relaxed border border-[#1f2937]"
                        dangerouslySetInnerHTML={{ __html: item.highlighted_content }}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Data Sources Info */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
        <h2 className="text-xs font-semibold text-white mb-3">資料來源說明</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-[#6b7280]">
          {[
            { name: '證交所 (TWSE)', desc: '三大法人買賣超、融資融券異動資料', freq: '每日收盤後' },
            { name: '公開資訊觀測站 (MOPS)', desc: '重大訊息公告、財報 PDF 解析', freq: '即時更新' },
            { name: '社群媒體', desc: 'PTT Stock 版、股市爆料同學會情緒標註', freq: '每 30 分鐘' },
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
