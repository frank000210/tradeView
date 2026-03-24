import {
  LayoutDashboard,
  CandlestickChart,
  BrainCircuit,
  ShieldAlert,
  Newspaper,
  CheckSquare,
  Activity,
  ChevronRight,
} from 'lucide-react';
import type { PageType } from '../types/api';
import { clsx } from 'clsx';

interface NavItem {
  id: PageType;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: '總覽儀表板', icon: <LayoutDashboard size={18} /> },
  { id: 'market', label: 'K 線行情', icon: <CandlestickChart size={18} /> },
  { id: 'signals', label: 'AI 交易信號', icon: <BrainCircuit size={18} />, badge: 3 },
  { id: 'risk', label: '風控監控', icon: <ShieldAlert size={18} /> },
  { id: 'data-agent', label: '資料爬蟲', icon: <Newspaper size={18} /> },
  { id: 'trade-approval', label: '交易核准', icon: <CheckSquare size={18} />, badge: 2 },
];

interface SidebarProps {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  collapsed?: boolean;
}

export function Sidebar({ currentPage, onNavigate, collapsed = false }: SidebarProps) {
  return (
    <aside
      className={clsx(
        'flex flex-col h-full bg-[#0d1117] border-r border-[#1f2937] transition-all duration-300',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-[#1f2937]">
        <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
          <Activity size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <div className="text-sm font-bold text-white leading-tight">Kinetic Pulse</div>
            <div className="text-[10px] text-[#4b5563] uppercase tracking-widest">台股 AI 系統</div>
          </div>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 relative group',
                isActive
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  : 'text-[#6b7280] hover:text-white hover:bg-[#1a2235]'
              )}
            >
              <span className={clsx('flex-shrink-0', isActive ? 'text-blue-400' : '')}>
                {item.icon}
              </span>
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="bg-blue-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <ChevronRight size={12} className="text-blue-400" />
                  )}
                </>
              )}
              {/* Tooltip for collapsed */}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-[#1f2937] text-white text-xs rounded hidden group-hover:block whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom status indicator */}
      <div className="p-4 border-t border-[#1f2937]">
        {!collapsed ? (
          <div className="flex items-center gap-2 text-xs text-[#4b5563]">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span>系統運行中</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          </div>
        )}
      </div>
    </aside>
  );
}
