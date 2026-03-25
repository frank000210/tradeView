import type { KlineData, AgentSignal, AlphaScoreResponse, RiskStatus, EquityPoint, CrawledInfo, PendingTrade } from '../types/api';

// === 生成 K 線模擬資料 (台積電 2330) ===
function generateKlineData(count = 60, basePrice = 910): KlineData[] {
  const now = Math.floor(Date.now() / 1000);
  const interval = 3600; // 1 小時
  const data: KlineData[] = [];
  let price = basePrice;

  for (let i = count; i >= 0; i--) {
    const change = (Math.random() - 0.48) * price * 0.015;
    const open = price;
    const close = Math.max(price + change, price * 0.95);
    const high = Math.max(open, close) + Math.random() * price * 0.005;
    const low = Math.min(open, close) - Math.random() * price * 0.005;
    const volume = Math.floor(Math.random() * 50000 + 10000);
    data.push({
      t: now - i * interval,
      o: parseFloat(open.toFixed(1)),
      h: parseFloat(high.toFixed(1)),
      l: parseFloat(low.toFixed(1)),
      c: parseFloat(close.toFixed(1)),
      v: volume,
    });
    price = close;
  }
  return data;
}

export const mockKlineData: KlineData[] = generateKlineData(60, 910);

// === AI 信號模擬資料 ===
export const mockAgentSignals: AgentSignal[] = [
  {
    symbol: '2330.TW',
    type: 'BUY',
    confidence: 0.91,
    reasoning: 'RSI 超賣 (28)，三大法人連三日買超，MACD 金叉確認，外資持倉創近月高點',
    timestamp: Date.now() - 1000 * 60 * 5,
  },
  {
    symbol: '2454.TW',
    type: 'HOLD',
    confidence: 0.67,
    reasoning: '布林通道收縮，等待突破方向確認。技術面中性，法人籌碼無明顯動向',
    timestamp: Date.now() - 1000 * 60 * 12,
  },
  {
    symbol: '2317.TW',
    type: 'SELL',
    confidence: 0.83,
    reasoning: 'KD 死叉，股價跌破 60 日均線，三大法人連五日賣超，融資餘額持續增加警示',
    timestamp: Date.now() - 1000 * 60 * 18,
  },
  {
    symbol: '2308.TW',
    type: 'BUY',
    confidence: 0.78,
    reasoning: '季報優於預期，外資上調目標價，成交量突破 20 日均量，技術面向好',
    timestamp: Date.now() - 1000 * 60 * 25,
  },
  {
    symbol: '6505.TW',
    type: 'HOLD',
    confidence: 0.55,
    reasoning: '油價波動不確定，等待下季財報。股價處於盤整區間，信心度不足以觸發交易',
    timestamp: Date.now() - 1000 * 60 * 40,
  },
  {
    symbol: '2412.TW',
    type: 'BUY',
    confidence: 0.88,
    reasoning: '5G 相關題材持續發酵，機構法人調升評等，股價突破頸線，量能配合',
    timestamp: Date.now() - 1000 * 60 * 55,
  },
];

// === 風險狀態模擬資料 ===
export const mockRiskStatus: RiskStatus = {
  mdd: 0.018,             // 1.8% 回撤
  daily_trades: 7,        // 今日 7 筆交易
  circuit_breaker: 'ACTIVE',
  portfolio_value: 2_450_000,  // 245 萬
};

// === 爬蟲資料模擬 ===
export const mockCrawledData: CrawledInfo[] = [
  {
    source: '證交所 (TWSE)',
    title: '外資買超前 20 名 - 2330 台積電連續第 5 日居冠',
    sentiment_score: 0.82,
    original_url: 'https://www.twse.com.tw/zh/fund/TWT38U',
    highlighted_content: '<p>外資今日買超台積電 <strong class="highlight">18,420 張</strong>，連五日買超合計達 <strong class="highlight">92,150 張</strong>。三大法人合計買超 24,680 張。</p>',
    timestamp: Date.now() - 1000 * 60 * 30,
  },
  {
    source: '公開資訊觀測站 (MOPS)',
    title: '2330 台積電重大訊息 - 第二季營收展望優於市場預期',
    sentiment_score: 0.75,
    original_url: 'https://mops.twse.com.tw/mops/web/t05st01',
    highlighted_content: '<p>台積電發布重大訊息，管理層預計第二季營收將達 <strong class="highlight">260-268 億美元</strong>，高於分析師共識預估。AI 相關需求持續強勁。</p>',
    timestamp: Date.now() - 1000 * 60 * 90,
  },
  {
    source: 'PTT Stock 版',
    title: '[情報] 台積電 ADR 漲幅 3.2%，美股盤後強勢',
    sentiment_score: 0.68,
    original_url: 'https://www.ptt.cc/bbs/Stock/index.html',
    highlighted_content: '<p>PTT 網友討論：「ADR 今晚 <span class="highlight">+3.2%</span>，明天開盤應該有表現」，看多留言佔比達 <span class="highlight">76%</span>。融券餘額連日下降。</p>',
    timestamp: Date.now() - 1000 * 60 * 120,
  },
  {
    source: '股市爆料同學會',
    title: '2317 鴻海供應鏈傳出訂單縮減消息，情緒偏空',
    sentiment_score: -0.45,
    original_url: 'https://www.facebook.com/groups/stockboard',
    highlighted_content: '<p>消息面：鴻海某供應商透露 <span class="highlight-neg">Q3 訂單較預期減少 15-20%</span>，蘋果新機備貨保守。市場情緒轉趨謹慎。</p>',
    timestamp: Date.now() - 1000 * 60 * 150,
  },
  {
    source: '證交所 (TWSE)',
    title: '融資融券異動 - 2454 聯發科融資大幅增加警示',
    sentiment_score: -0.22,
    original_url: 'https://www.twse.com.tw/zh/fund/MI_MARGN',
    highlighted_content: '<p>聯發科融資餘額單日增加 <span class="highlight-neg">2,340 張 (+8.3%)</span>，融資使用率達 <span class="highlight-neg">34.5%</span>，需關注散戶過度槓桿風險。</p>',
    timestamp: Date.now() - 1000 * 60 * 200,
  },
];

// === Alpha 評分模擬資料 ===
export const mockAlphaScores: AlphaScoreResponse = {
  scores: [
    { metric: '技術面',   value: 82 },
    { metric: '法人籌碼', value: 74 },
    { metric: '情緒面',   value: 68 },
    { metric: '基本面',   value: 60 },
    { metric: '量能',     value: 78 },
  ],
  updated_at: Date.now(),
};

// === 淨值曲線模擬資料 ===
function generateEquityCurve(hours = 30, base = 2_450_000): EquityPoint[] {
  const points: EquityPoint[] = [];
  let val = base * 0.962;
  const now = Date.now();
  for (let i = hours; i >= 0; i--) {
    val = val + (Math.random() - 0.46) * val * 0.004;
    val = Math.max(val, base * 0.94);
    const ts = now - i * 3_600_000;
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    points.push({ time: `${hh}:${mm}`, equity: Math.round(val), timestamp: ts });
  }
  if (points.length > 0) points[points.length - 1].equity = base;
  return points;
}
export const mockEquityCurve: EquityPoint[] = generateEquityCurve(30);

// === 待核准交易模擬資料 ===
export const mockPendingTrades: PendingTrade[] = [
  {
    task_id: 'TRD-20240115-001',
    symbol: '2330.TW',
    type: 'BUY',
    confidence: 0.91,
    quantity: 10,
    estimated_price: 912.5,
    reasoning: 'RSI 超賣 (28)，三大法人連三日買超，MACD 金叉確認，外資持倉創近月高點',
    created_at: Date.now() - 1000 * 60 * 5,
    status: 'PENDING',
  },
  {
    task_id: 'TRD-20240115-002',
    symbol: '2412.TW',
    type: 'BUY',
    confidence: 0.88,
    quantity: 5,
    estimated_price: 132.0,
    reasoning: '5G 相關題材持續發酵，機構法人調升評等，股價突破頸線，量能配合',
    created_at: Date.now() - 1000 * 60 * 55,
    status: 'PENDING',
  },
  {
    task_id: 'TRD-20240115-003',
    symbol: '2317.TW',
    type: 'SELL',
    confidence: 0.83,
    quantity: 8,
    estimated_price: 178.5,
    reasoning: 'KD 死叉，股價跌破 60 日均線，三大法人連五日賣超，融資餘額持續增加',
    created_at: Date.now() - 1000 * 60 * 18,
    status: 'PENDING',
  },
];
