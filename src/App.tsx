import { useState, useCallback } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { MarketData } from './pages/MarketData';
import { AISignals } from './pages/AISignals';
import { RiskMonitor } from './pages/RiskMonitor';
import { DataAgent } from './pages/DataAgent';
import { TradeApproval } from './pages/TradeApproval';
import { SignalRules } from './pages/SignalRules';
import type { PageType } from './types/api';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setLoading(false), 800);
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard key={refreshKey} />;
      case 'market':
        return <MarketData key={refreshKey} />;
      case 'signals':
        return <AISignals key={refreshKey} />;
      case 'risk':
        return <RiskMonitor key={refreshKey} />;
      case 'data-agent':
        return <DataAgent key={refreshKey} />;
      case 'trade-approval':
        return <TradeApproval key={refreshKey} />;
      case 'signal-rules':
        return <SignalRules key={refreshKey} />;
      default:
        return <Dashboard key={refreshKey} />;
    }
  };

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      onRefresh={handleRefresh}
      loading={loading}
    >
      {renderPage()}
    </Layout>
  );
}
