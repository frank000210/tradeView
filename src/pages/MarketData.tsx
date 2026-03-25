import { useCallback, useEffect, useState } from 'react';
import { BarChart2, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchKlineData } from '../api/client';
import { CandlestickChart } from '../components/CandlestickChart';
import type { KlineData } from '../types/api';
import { clsx } from 'clsx';

const SYMBOLS = ['2330.TW', '2454.TW', '2317.TW', '2308.TW', '6505.TW', '2412.TW'];
const INTERVALS = [
  { value: '1m', label: '1 分鐘' },
  { value: '5m', label: '5 分鐘' },
  { value: '1h', label: '1 小時' },
  { value: '1d', label: '日線' },
] as const;

function formatTime(ts: number, interval: string) {
  if (interval === '1d') {
    return new Date(ts * 1000).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
  }
  return new Date(ts * 1000).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function MarketData() {
  const [symbol, setSymbol] = useState('2330.TW');
  const [interval, setInterval] = useState<'1m' | '5m' | '1h' | '1d'>('1h');
  const [data, setData] = useState<KlineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    setData([]);
    fetchKlineData(symbol, interval)
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e instanceof Error ? e.message : '查無資料'); setLoading(false); });
  }, [symbol, interval]);

  useEffect(() => { loadData(); }, [loadData]);

  const latest = data[data.length - 1];
  const prev = data[data.length - 2];
  const change = latest && prev ? latest.c - prev.c : 0;
  const changePct = prev ? (change / prev.c) * 100 : 0;
  const isUp = change >= 0;

  const volumeData = data.slice(-20).map((d) => ({
    time: formatTime(d.t, interval),
    vol: d.v,
    isUp: d.c >= d.o,
  }));

  return (
    <div className="space-y-4 fade-in">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#111827] border border-[#1f2937] rounded-xl p-4">
        {/* Symbol Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6b7280]">股票代碼</span>
          <div className="flex gap-1">
            {SYMBOLS.map((s) => (
              <button
                key={s}
                onClick={() => setSymbol(s)}
                className={clsx(
                  'text-xs px-2.5 py-1.5 rounded-md transition-colors',
                  symbol === s
                    ? 'bg-blue-500 text-white'
                    : 'bg-[#1f2937] text-[#9ca3af] hover:text-white hover:bg-[#374151]'
                )}
              >
                {s.replace('.TW', '')}
              </button>
            ))}
          </div>
        </div>

        {/* Interval Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#6b7280]">時間週期</span>
          <div className="flex gap-1">
            {INTERVALS.map((i) => (
              <button
                key={i.value}
                onClick={() => setInterval(i.value)}
                className={clsx(
                  'text-xs px-2.5 py-1.5 rounded-md transition-colors',
                  interval === i.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-[#1f2937] text-[#9ca3af] hover:text-white hover:bg-[#374151]'
                )}
              >
                {i.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Price Summary */}
      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: '最新價', value: latest.c.toFixed(1), color: isUp ? 'text-green-400' : 'text-red-400' },
            { label: '開盤', value: latest.o.toFixed(1), color: 'text-white' },
            { label: '最高', value: latest.h.toFixed(1), color: 'text-green-400' },
            { label: '最低', value: latest.l.toFixed(1), color: 'text-red-400' },
            { label: '漲跌幅', value: `${isUp ? '+' : ''}${changePct.toFixed(2)}%`, color: isUp ? 'text-green-400' : 'text-red-400' },
          ].map((item) => (
            <div key={item.label} className="bg-[#111827] border border-[#1f2937] rounded-lg p-3">
              <div className="text-[10px] text-[#6b7280] mb-1">{item.label}</div>
              <div className={clsx('text-base font-bold', item.color)}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Candlestick Chart */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">{symbol} K 線圖</h2>
            <p className="text-xs text-[#6b7280]">
              {data.length > 0 ? `${data.length} 根 K 線 · 滑鼠懸停查看 OHLCV` : '尚無資料'}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#6b7280]">
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-green-400 inline-block rounded" /> 上漲</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1 bg-red-400 inline-block rounded" /> 下跌</span>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-80 text-[#6b7280] text-sm">
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="animate-pulse" />
              載入中...
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-80 gap-3 text-[#6b7280]">
            <BarChart2 size={32} className="opacity-30" />
            <span className="text-red-400 text-sm">{error}</span>
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 bg-[#1f2937] rounded-lg text-sm hover:bg-[#374151] transition-colors text-white"
            >
              <RefreshCw size={14} /> 重試
            </button>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-80 gap-2 text-[#6b7280]">
            <BarChart2 size={32} className="opacity-30" />
            <span className="text-sm">查無 {symbol} 的 K 線資料</span>
          </div>
        ) : (
          <CandlestickChart data={data} height={360} />
        )}
      </div>

      {/* Volume Chart */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">成交量</h2>
          <span className="text-xs text-[#6b7280]">近 20 筆</span>
        </div>
        {(!loading && (error || data.length === 0)) ? (
          <div className="flex items-center justify-center h-28 text-[#4b5563] text-sm">
            查無成交量資料
          </div>
        ) : (
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={volumeData} barSize={10}>
            <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: '#1a2235', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#9ca3af', fontSize: 11 }}
              itemStyle={{ fontSize: 11 }}
              formatter={(v) => [Number(v).toLocaleString(), '成交量'] as [string, string]}
            />
            <Bar
              dataKey="vol"
              fill="#3b82f6"
              radius={[2, 2, 0, 0]}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              shape={(props: any) => {
                const { x, y, width, height, payload } = props;
                return (
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill={payload.isUp ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)'}
                    rx={2}
                  />
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
