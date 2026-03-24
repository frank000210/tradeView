export interface RiskStatus {
  mdd: number;
  daily_trades: number;
  circuit_breaker: 'ACTIVE' | 'WARNING' | 'PAUSED';
  portfolio_value: number;
}
export interface AgentSignal {
  symbol: string;
  type: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  timestamp: number;
}
export interface AlphaScore { metric: string; value: number; }
export interface PendingTrade {
  task_id: string; symbol: string; type: 'BUY' | 'SELL';
  confidence: number; quantity: number; estimated_price: number;
  reasoning: string; created_at: number; status: 'PENDING' | 'APPROVED' | 'REJECTED';
}
export interface EquityPoint { time: string; equity: number; timestamp: number; }
export interface CrawledInfo {
  source: string; title: string; sentiment_score: number;
  original_url: string; highlighted_content: string; timestamp: number;
}

export const riskState: RiskStatus = {
  mdd: 0.018, daily_trades: 7, circuit_breaker: 'ACTIVE', portfolio_value: 2_450_000,
};

let lastResetDate = new Date().toDateString();
export function checkDailyReset() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) { riskState.daily_trades = 0; lastResetDate = today; }
}

export const agentSignals: AgentSignal[] = [
  { symbol: '2330', type: 'BUY', confidence: 0.91, reasoning: '三大法人連續三日買超，外資持股比例上升至 78%，技術面突破季線壓力，MACD 黃金交叉確立，建議積極買入。', timestamp: Date.now() - 5 * 60 * 1000 },
  { symbol: '2454', type: 'HOLD', confidence: 0.67, reasoning: '法人籌碼中性偏多，KD 值超買區間，等待 Q1 財報公布後確認後續方向，暫時持有。', timestamp: Date.now() - 15 * 60 * 1000 },
  { symbol: '2317', type: 'SELL', confidence: 0.83, reasoning: '外資連續賣超 5 日，庫存警示訊號觸發，RSI 進入超買區域（>75），建議減碼或出場。', timestamp: Date.now() - 28 * 60 * 1000 },
  { symbol: '2308', type: 'BUY', confidence: 0.78, reasoning: 'AI Server 供應鏈受惠，法人持股增加，均線多頭排列，布林通道收窄後向上突破。', timestamp: Date.now() - 42 * 60 * 1000 },
  { symbol: '6505', type: 'HOLD', confidence: 0.55, reasoning: '國際油價走勢不明，本益比合理但缺乏明確催化劑，維持中立觀望。', timestamp: Date.now() - 60 * 60 * 1000 },
  { symbol: '2412', type: 'BUY', confidence: 0.88, reasoning: '5G 基礎建設持續擴張，電信業績穩健，高殖利率具防禦性，技術面底部成型，建議買入。', timestamp: Date.now() - 75 * 60 * 1000 },
];

export const alphaScores: AlphaScore[] = [
  { metric: '技術面', value: 82 },
  { metric: '法人籌碼', value: 74 },
  { metric: '情緒面', value: 68 },
  { metric: '基本面', value: 60 },
  { metric: '量能', value: 78 },
];
export const alphaUpdatedAt: number = Date.now();

export const pendingTrades: PendingTrade[] = [
  { task_id: 'TRD-001', symbol: '2330', type: 'BUY', confidence: 0.88, quantity: 2, estimated_price: 940.0, reasoning: '外資連三日買超，突破月線壓力，MACD 黃金交叉，RSI 未達超買，建議買進 2 張。', created_at: Date.now() - 3 * 60 * 1000, status: 'PENDING' },
  { task_id: 'TRD-002', symbol: '2412', type: 'BUY', confidence: 0.82, quantity: 1, estimated_price: 115.5, reasoning: '5G 基礎建設概念股，基本面良好，技術面底部確立，殖利率具吸引力。', created_at: Date.now() - 8 * 60 * 1000, status: 'PENDING' },
  { task_id: 'TRD-003', symbol: '2317', type: 'SELL', confidence: 0.79, quantity: 1, estimated_price: 98.3, reasoning: '庫存循環下行，外資賣超，技術面跌破支撐，信心度未達自動執行閾值，需人工確認。', created_at: Date.now() - 20 * 60 * 1000, status: 'PENDING' },
];

export function generateEquityCurve(hours = 30): EquityPoint[] {
  const points: EquityPoint[] = [];
  const base = riskState.portfolio_value;
  let val = base * 0.96;
  const now = Date.now();
  for (let i = hours; i >= 0; i--) {
    val = val + (Math.random() - 0.46) * val * 0.004;
    const ts = now - i * 3_600_000;
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    points.push({ time: hh + ':' + mm, equity: Math.round(val), timestamp: ts });
  }
  if (points.length > 0) points[points.length - 1].equity = base;
  return points;
}

export const crawledData: CrawledInfo[] = [
  { source: '證交所 (TWSE)', title: '三大法人買賣超日報：外資買超台積電 2,850 張，連續三日買超創近月新高', sentiment_score: 0.72, original_url: 'https://www.twse.com.tw/zh/trading/fund/T86.html', highlighted_content: '外資今日<mark>買超台積電 2,850 張</mark>，連續三日買超累計達 7,200 張，持股比例升至 78.3%，法人籌碼持續偏多。', timestamp: Date.now() - 30 * 60 * 1000 },
  { source: '公開資訊觀測站 (MOPS)', title: '台積電 (2330) 重大訊息：董事會決議發放現金股利 16 元，優於市場預期', sentiment_score: 0.85, original_url: 'https://mops.twse.com.tw/mops/web/t05st02', highlighted_content: '台積電董事會決議發放<mark>現金股利 16 元</mark>，較去年同期成長 14%，殖利率約 1.7%，優於市場預期。', timestamp: Date.now() - 45 * 60 * 1000 },
  { source: 'PTT Stock 版', title: '台積電法說會後續效應：多家外資上調目標價至 1,100-1,200 元', sentiment_score: 0.78, original_url: 'https://www.ptt.cc/bbs/Stock/index.html', highlighted_content: '法說會後多家外資機構陸續<mark>上調台積電目標價</mark>，摩根士丹利調至 1,150 元，花旗 1,100 元，高盛維持 1,200 元。', timestamp: Date.now() - 60 * 60 * 1000 },
  { source: '股市爆料同學會', title: '聯發科 (2454) 傳 AI 晶片新訂單消息，股價盤中急拉 3.5%', sentiment_score: 0.61, original_url: 'https://www.facebook.com/groups/stockfriend/', highlighted_content: '聯發科盤中傳出<mark>獲得 AI 邊緣運算晶片大單</mark>，股價急拉 3.5%，成交量放大至平均量的 2.3 倍。', timestamp: Date.now() - 90 * 60 * 1000 },
  { source: '證交所 (TWSE)', title: '鴻海 (2317) 法人動態：外資連五日賣超，合計賣出 4,200 張', sentiment_score: -0.58, original_url: 'https://www.twse.com.tw/zh/trading/fund/T86.html', highlighted_content: '鴻海<mark>外資連續五個交易日賣超</mark>，本周合計賣出 4,200 張，持股比例由 42.1% 降至 41.5%。', timestamp: Date.now() - 2 * 60 * 60 * 1000 },
];