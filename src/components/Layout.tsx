import { useState } from 'react';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import type { PageType } from '../types/api';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  onRefresh?: () => void;
  loading?: boolean;
}

export function Layout({ children, currentPage, onNavigate, onRefresh, loading }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-[#0a0e1a] overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        collapsed={collapsed}
      />

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-stretch">
          {/* Collapse Toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="px-3 bg-[#0d1117] border-b border-r border-[#1f2937] text-[#6b7280] hover:text-white transition-colors"
          >
            {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
          <div className="flex-1">
            <Header
              currentPage={currentPage}
              onRefresh={onRefresh}
              loading={loading}
            />
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
