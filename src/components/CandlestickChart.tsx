import { useMemo, useRef, useState } from 'react';
import type { KlineData } from '../types/api';

interface CandlestickChartProps {
  data: KlineData[];
  height?: number;
}

interface TooltipData {
  x: number;
  y: number;
  candle: KlineData;
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function CandlestickChart({ data, height = 320 }: CandlestickChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const PADDING = { top: 20, right: 60, bottom: 50, left: 10 };
  const VOLUME_HEIGHT = 60;

  const metrics = useMemo(() => {
    if (data.length === 0) return null;
    const allHigh = Math.max(...data.map((d) => d.h));
    const allLow = Math.min(...data.map((d) => d.l));
    const allVol = Math.max(...data.map((d) => d.v));
    const priceRange = allHigh - allLow;
    const paddedHigh = allHigh + priceRange * 0.05;
    const paddedLow = allLow - priceRange * 0.05;
    return { paddedHigh, paddedLow, allVol };
  }, [data]);

  if (!metrics || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[#6b7280] text-sm">
        載入中...
      </div>
    );
  }

  const chartWidth = 800; // viewBox width, scales automatically
  const innerW = chartWidth - PADDING.left - PADDING.right;
  const priceH = height - PADDING.top - PADDING.bottom - VOLUME_HEIGHT - 8;

  const xScale = (i: number) => PADDING.left + (i / (data.length - 1)) * innerW;
  const yScale = (v: number) =>
    PADDING.top + ((metrics.paddedHigh - v) / (metrics.paddedHigh - metrics.paddedLow)) * priceH;
  const volScale = (v: number) =>
    height - PADDING.bottom - (v / metrics.allVol) * VOLUME_HEIGHT;

  const candleW = Math.max(2, (innerW / data.length) * 0.65);

  // Price axis labels
  const priceSteps = 5;
  const priceLabels = Array.from({ length: priceSteps + 1 }, (_, i) => {
    const v =
      metrics.paddedLow +
      ((metrics.paddedHigh - metrics.paddedLow) * i) / priceSteps;
    return { v, y: yScale(v) };
  });

  // Time axis (sample ~6 labels)
  const timeStep = Math.max(1, Math.floor(data.length / 6));
  const timeLabels = data
    .filter((_, i) => i % timeStep === 0)
    .map((d, i) => ({ label: formatDate(d.t), x: xScale(i * timeStep) }));

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${chartWidth} ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        className="overflow-visible"
        onMouseLeave={() => { setTooltip(null); setHoverIndex(null); }}
      >
        {/* Grid lines */}
        {priceLabels.map((pl, i) => (
          <line
            key={i}
            x1={PADDING.left}
            x2={chartWidth - PADDING.right}
            y1={pl.y}
            y2={pl.y}
            stroke="#1f2937"
            strokeWidth={0.5}
            strokeDasharray="4 4"
          />
        ))}

        {/* Volume bars */}
        {data.map((d, i) => {
          const isUp = d.c >= d.o;
          const x = xScale(i) - candleW / 2;
          const barH = Math.max(1, height - PADDING.bottom - volScale(d.v));
          return (
            <rect
              key={`vol-${i}`}
              x={x}
              y={volScale(d.v)}
              width={candleW}
              height={barH}
              fill={isUp ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}
            />
          );
        })}

        {/* Candlesticks */}
        {data.map((d, i) => {
          const isUp = d.c >= d.o;
          const color = isUp ? '#10b981' : '#ef4444';
          const x = xScale(i);
          const openY = yScale(d.o);
          const closeY = yScale(d.c);
          const highY = yScale(d.h);
          const lowY = yScale(d.l);
          const bodyTop = Math.min(openY, closeY);
          const bodyH = Math.max(1, Math.abs(closeY - openY));

          return (
            <g
              key={`candle-${i}`}
              onMouseEnter={() => {
                setHoverIndex(i);
                setTooltip({ x, y: bodyTop, candle: d });
              }}
            >
              {/* Wick */}
              <line x1={x} x2={x} y1={highY} y2={lowY} stroke={color} strokeWidth={1} />
              {/* Body */}
              <rect
                x={x - candleW / 2}
                y={bodyTop}
                width={candleW}
                height={bodyH}
                fill={isUp ? color : color}
                opacity={hoverIndex === i ? 1 : 0.85}
                rx={0.5}
              />
            </g>
          );
        })}

        {/* Hover line */}
        {hoverIndex !== null && (
          <line
            x1={xScale(hoverIndex)}
            x2={xScale(hoverIndex)}
            y1={PADDING.top}
            y2={height - PADDING.bottom}
            stroke="#4b5563"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* Price Y-axis labels */}
        {priceLabels.map((pl, i) => (
          <text
            key={i}
            x={chartWidth - PADDING.right + 4}
            y={pl.y + 3}
            fill="#6b7280"
            fontSize={9}
            textAnchor="start"
          >
            {pl.v.toFixed(1)}
          </text>
        ))}

        {/* Time X-axis labels */}
        {timeLabels.map((tl, i) => (
          <text
            key={i}
            x={tl.x}
            y={height - PADDING.bottom + 14}
            fill="#6b7280"
            fontSize={8}
            textAnchor="middle"
          >
            {tl.label}
          </text>
        ))}

        {/* Divider line between price and volume */}
        <line
          x1={PADDING.left}
          x2={chartWidth - PADDING.right}
          y1={height - PADDING.bottom - VOLUME_HEIGHT}
          y2={height - PADDING.bottom - VOLUME_HEIGHT}
          stroke="#1f2937"
          strokeWidth={0.5}
        />
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-10 bg-[#1a2235] border border-[#374151] rounded-lg p-3 text-xs pointer-events-none shadow-xl"
          style={{
            left: Math.min(tooltip.x + 10, 600),
            top: Math.max(0, tooltip.y - 10),
            minWidth: 140,
          }}
        >
          <div className="text-[#9ca3af] mb-2">{formatDate(tooltip.candle.t)}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-[#6b7280]">開盤</span>
            <span className="text-white">{tooltip.candle.o.toFixed(1)}</span>
            <span className="text-[#6b7280]">最高</span>
            <span className="text-green-400">{tooltip.candle.h.toFixed(1)}</span>
            <span className="text-[#6b7280]">最低</span>
            <span className="text-red-400">{tooltip.candle.l.toFixed(1)}</span>
            <span className="text-[#6b7280]">收盤</span>
            <span className={tooltip.candle.c >= tooltip.candle.o ? 'text-green-400' : 'text-red-400'}>
              {tooltip.candle.c.toFixed(1)}
            </span>
            <span className="text-[#6b7280]">成交量</span>
            <span className="text-white">{tooltip.candle.v.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
