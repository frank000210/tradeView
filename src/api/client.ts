import type {
  KlineData,
  AgentSignal,
  AlphaScoreResponse,
  RiskStatus,
  EquityPoint,
  CrawledInfo,
  PendingTrade,
  TradeApproveRequest,
  TradeApproveResponse,
} from '../types/api';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

// 模擬網路延遲（僅 mock 模式）
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 統一 fetch 包裝，加入錯誤處理
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API [${path}] 錯誤 ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Market Data ────────────────────────────────────────────────
export async function fetchKlineData(
  symbol: string,
  interval: '1m' | '5m' | '1h' | '1d' = '1h',
  limit = 60
): Promise<KlineData[]> {
  if (USE_MOCK) {
    await delay(300);
    const { mockKlineData } = await import('./mockData');
    return mockKlineData;
  }
  return apiFetch<KlineData[]>(
    `/market/kline?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`
  );
}

// ── AI Signals ─────────────────────────────────────────────────
export async function fetchAgentSignals(
  type: 'BUY' | 'SELL' | 'HOLD' | 'ALL' = 'ALL'
): Promise<AgentSignal[]> {
  if (USE_MOCK) {
    await delay(200);
    const { mockAgentSignals } = await import('./mockData');
    return type === 'ALL'
      ? mockAgentSignals
      : mockAgentSignals.filter((s) => s.type === type);
  }
  const query = type !== 'ALL' ? `?type=${type}` : '';
  return apiFetch<AgentSignal[]>(`/agent/signals${query}`);
}

export async function fetchAlphaScores(): Promise<AlphaScoreResponse> {
  if (USE_MOCK) {
    await delay(150);
    const { mockAlphaScores } = await import('./mockData');
    return mockAlphaScores;
  }
  return apiFetch<AlphaScoreResponse>('/agent/alpha-scores');
}

// ── Risk Control ───────────────────────────────────────────────
export async function fetchRiskStatus(): Promise<RiskStatus> {
  if (USE_MOCK) {
    await delay(150);
    const { mockRiskStatus } = await import('./mockData');
    return mockRiskStatus;
  }
  return apiFetch<RiskStatus>('/risk/status');
}

export async function fetchEquityCurve(hours = 30): Promise<EquityPoint[]> {
  if (USE_MOCK) {
    await delay(200);
    const { mockEquityCurve } = await import('./mockData');
    return mockEquityCurve;
  }
  return apiFetch<EquityPoint[]>(`/risk/equity-curve?hours=${hours}`);
}

export async function resetCircuitBreaker(reason?: string): Promise<{ success: boolean; message: string }> {
  if (USE_MOCK) {
    await delay(300);
    return { success: true, message: '斷路器已重置為 ACTIVE 狀態' };
  }
  return apiFetch('/risk/circuit-breaker/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
}

// ── Trade Approval (HITL) ──────────────────────────────────────
export async function fetchPendingTrades(
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL' = 'ALL'
): Promise<PendingTrade[]> {
  if (USE_MOCK) {
    await delay(250);
    const { mockPendingTrades } = await import('./mockData');
    return status === 'ALL'
      ? mockPendingTrades
      : mockPendingTrades.filter((t) => t.status === status);
  }
  const query = status !== 'ALL' ? `?status=${status}` : '';
  return apiFetch<PendingTrade[]>(`/trade/pending${query}`);
}

export async function approveTrade(
  req: TradeApproveRequest
): Promise<TradeApproveResponse> {
  if (USE_MOCK) {
    await delay(500);
    return {
      success: true,
      message: `交易任務 ${req.task_id} 已${req.action === 'APPROVE' ? '核准' : '拒絕'}`,
    };
  }
  return apiFetch<TradeApproveResponse>('/trade/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
}

// ── Data Agent ─────────────────────────────────────────────────
export async function fetchCrawledData(source?: string, limit = 50): Promise<CrawledInfo[]> {
  if (USE_MOCK) {
    await delay(400);
    const { mockCrawledData } = await import('./mockData');
    return source
      ? mockCrawledData.filter((d) => d.source === source)
      : mockCrawledData.slice(0, limit);
  }
  const params = new URLSearchParams({ limit: String(limit) });
  if (source) params.set('source', source);
  return apiFetch<CrawledInfo[]>(`/data-agent/crawled-text?${params}`);
}
