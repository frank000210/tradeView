import type {
  KlineData,
  AgentSignal,
  RiskStatus,
  CrawledInfo,
  TradeApproveRequest,
  TradeApproveResponse,
} from '../types/api';
import {
  mockKlineData,
  mockAgentSignals,
  mockRiskStatus,
  mockCrawledData,
} from './mockData';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

// 模擬網路延遲
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// === Market Data ===
export async function fetchKlineData(
  symbol: string,
  interval: '1m' | '5m' | '1h' | '1d' = '1h'
): Promise<KlineData[]> {
  if (USE_MOCK) {
    await delay(300);
    return mockKlineData;
  }
  const res = await fetch(
    `${BASE_URL}/market/kline?symbol=${symbol}&interval=${interval}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// === AI Signals ===
export async function fetchAgentSignals(): Promise<AgentSignal[]> {
  if (USE_MOCK) {
    await delay(200);
    return mockAgentSignals;
  }
  const res = await fetch(`${BASE_URL}/agent/signals`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// === Risk Status ===
export async function fetchRiskStatus(): Promise<RiskStatus> {
  if (USE_MOCK) {
    await delay(150);
    return mockRiskStatus;
  }
  const res = await fetch(`${BASE_URL}/risk/status`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// === Data Agent ===
export async function fetchCrawledData(): Promise<CrawledInfo[]> {
  if (USE_MOCK) {
    await delay(400);
    return mockCrawledData;
  }
  const res = await fetch(`${BASE_URL}/data-agent/crawled-text`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// === Trade Approval (HITL) ===
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
  const res = await fetch(`${BASE_URL}/trade/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
