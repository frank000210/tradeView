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
  CredibilityResult,
} from '../types/api';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// 統一 fetch 包裝，加入錯誤處理
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, options);
  } catch (err) {
    throw new Error(`無法連線至伺服器，請確認後端服務是否正常運作`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`查無資料（API ${res.status}）${text ? ': ' + text : ''}`);
  }
  const json = await res.json().catch(() => {
    throw new Error('回應格式錯誤，無法解析資料');
  });
  return json;
}

// ── Market Data ────────────────────────────────────────────────
export async function fetchKlineData(
  symbol: string,
  interval: '1m' | '5m' | '1h' | '1d' = '1h',
  limit = 60
): Promise<KlineData[]> {
  return apiFetch<KlineData[]>(
    `/market/kline?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`
  );
}

// ── AI Signals ─────────────────────────────────────────────────
export async function fetchAgentSignals(
  type: 'BUY' | 'SELL' | 'HOLD' | 'ALL' = 'ALL'
): Promise<AgentSignal[]> {
  const query = type !== 'ALL' ? `?type=${type}` : '';
  return apiFetch<AgentSignal[]>(`/agent/signals${query}`);
}

export async function fetchAlphaScores(): Promise<AlphaScoreResponse> {
  return apiFetch<AlphaScoreResponse>('/agent/alpha-scores');
}

// ── Risk Control ───────────────────────────────────────────────
export async function fetchRiskStatus(): Promise<RiskStatus> {
  return apiFetch<RiskStatus>('/risk/status');
}

export async function fetchEquityCurve(hours = 30): Promise<EquityPoint[]> {
  return apiFetch<EquityPoint[]>(`/risk/equity-curve?hours=${hours}`);
}

export async function resetCircuitBreaker(reason?: string): Promise<{ success: boolean; message: string }> {
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
  const query = status !== 'ALL' ? `?status=${status}` : '';
  return apiFetch<PendingTrade[]>(`/trade/pending${query}`);
}

export async function approveTrade(
  req: TradeApproveRequest
): Promise<TradeApproveResponse> {
  return apiFetch<TradeApproveResponse>('/trade/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
}

// ── Data Agent ─────────────────────────────────────────────────
export async function fetchCrawledData(source?: string, limit = 50): Promise<CrawledInfo[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (source) params.set('source', source);
  return apiFetch<CrawledInfo[]>(`/data-agent/crawled-text?${params}`);
}

export async function checkNewsCredibility(params: {
  url?: string;
  title?: string;
  text?: string;
  published_at?: number;
}): Promise<CredibilityResult> {
  return apiFetch<CredibilityResult>('/data-agent/check-credibility', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}
