// === K 線資料 ===
export interface KlineData {
  t: number;   // UNIX 時間戳記 (秒)
  o: number;   // 開盤價
  h: number;   // 最高價
  l: number;   // 最低價
  c: number;   // 收盤價
  v: number;   // 成交量
}

// === AI 信號 ===
export type SignalType = 'BUY' | 'SELL' | 'HOLD';

export interface SignalCondition {
  name: string;
  met: boolean;
  value: string;
}

export interface AgentSignal {
  symbol: string;
  type: SignalType;
  confidence: number;  // 0.0 - 1.0
  reasoning: string;
  timestamp?: number;
  conditions?: SignalCondition[];
  ruleId?: string;
  ruleName?: string;
}

// === 信號規則 ===
export interface SignalRule {
  id: string;
  name: string;
  description: string;
  script: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SignalRulesResponse {
  rules: SignalRule[];
  activeRule?: SignalRule;
}

// === 風險狀態 ===
export type CircuitBreakerStatus = 'ACTIVE' | 'WARNING' | 'PAUSED';

export interface RiskStatus {
  mdd: number;               // 最大回撤百分比 (0.01 = 1%)
  daily_trades: number;      // 今日已交易次數 (上限 15)
  circuit_breaker: CircuitBreakerStatus;
  portfolio_value: number;   // 帳戶總淨值
}

// === 爬蟲資料 ===
export interface CrawledInfo {
  source: string;
  title: string;
  sentiment_score: number;   // -1 (極度看空) ~ 1 (極度看多)
  original_url: string;
  highlighted_content: string;  // HTML 片段
  timestamp?: number;
}

// === 交易核准 ===
export type TradeAction = 'APPROVE' | 'REJECT';

export interface TradeApproveRequest {
  task_id: string;
  action: TradeAction;
}

export interface TradeApproveResponse {
  success: boolean;
  message: string;
}

// === 待核准交易任務 ===
export interface PendingTrade {
  task_id: string;
  symbol: string;
  type: SignalType;
  confidence: number;
  quantity: number;
  estimated_price: number;
  reasoning: string;
  created_at: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

// === Alpha 評分 ===
export interface AlphaScore {
  metric: string;
  value: number;
}

export interface AlphaScoreResponse {
  scores: AlphaScore[];
  updated_at: number;
}

// === 淨值曲線 ===
export interface EquityPoint {
  time: string;      // "HH:mm" 格式
  equity: number;
  timestamp: number;
}

// === 新聞可信度查核 ===
export interface CredibilityLayer {
  name: string;
  label: string;
  score: number;
  weight: number;
  detail: string;
}

export interface CredibilityResult {
  overall_score: number;
  verdict: 'CREDIBLE' | 'UNCERTAIN' | 'SUSPICIOUS';
  verdict_label: string;
  verdict_color: string;
  summary: string;
  layers: CredibilityLayer[];
  cofacts_found: boolean;
  cofacts_verdict?: string;
  processing_ms: number;
}

// === 頁面路由 ===
export type PageType =
  | 'dashboard'
  | 'market'
  | 'signals'
  | 'risk'
  | 'data-agent'
  | 'trade-approval'
  | 'signal-rules';
