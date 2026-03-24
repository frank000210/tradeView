import { Bell, RefreshCw, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: '總覽儀表板', subtitle: 'Kinetic Pulse OS · 台股 AI 交易代理系統' },
  market: { title: 'K 線行情', subtitle: '即時行情與技術指標' },
  signals: { title: 'AI 交易信號', subtitle: 'Alpha Agent 決策輸出' },
  risk: { title: '風控監控', subtitle: '多層次斷路器狀態' },
  'data-agent': { title: '資料爬蟲代理', subtitle: '盤後籌碼與新聞情緒' },
  'trade-approval': { title: '人工交易核准 (HITL)', subtitle: '待核准交易建議列表' },
};

interface HeaderProps {
  currentPage: string;
  onRefresh?: () => void;
  loading?: boolean;
}

export function Header({ currentPage, onRefresh, loading = false }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const info = PAGE_TITLES[currentPage] || PAGE_TITLES['dashboard'];
  const isMarketOpen = () => {
    const h = time.getHours();
    const m = time.getMinutes();
    const total = h * 60 + m;
    const day = time.getDay();
    // 台股 09:00 ~ 13:30 (週一至週五)
    return day >= 1 && day <= 5 && total >= 540 && total <= 810;
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-[#0d1117] border-b border-[#1f2937]">
      <div>
        <h1 className="text-lg font-bold text-white">{info.title}</h1>
        <p className="text-xs text-[#6b7280] mt-0.5">{info.subtitle}</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Market Status */}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              isMarketOpen() ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
            }`}
          />
          <span className={isMarketOpen() ? 'text-green-400' : 'text-[#6b7280]'}>
            {isMarketOpen() ? '盤中' : '收盤'}
          </span>
        </div>

        {/* Clock */}
        <div className="flex items-center gap-1.5 text-xs text-[#6b7280]">
          <Clock size={12} />
          <span className="font-mono">
            {time.toLocaleTimeString('zh-TW', { hour12: false })}
          </span>
        </div>

        {/* Refresh */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#6b7280] hover:text-white hover:bg-[#1a2235] rounded-md transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>重新整理</span>
          </button>
        )}

        {/* Notification Bell */}
        <button className="relative p-2 text-[#6b7280] hover:text-white hover:bg-[#1a2235] rounded-lg transition-colors">
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />
        </button>
      </div>
    </header>
  );
}
