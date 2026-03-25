// ─── In-memory state store ────────────────────────────────────────────────────
// 模擬後端資料庫，實際上線後可替換為 PostgreSQL / Redis

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

export interface AlphaScore {
  metric: string;
  value: number;
}

export interface PendingTrade {
  task_id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  confidence: number;
  quantity: number;
  estimated_price: number;
  reasoning: string;
  created_at: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface EquityPoint {
  time: string;
  equity: number;
  timestamp: number;
}

export interface CrawledInfo {
  source: string;
  title: string;
  sentiment_score: number;
  original_url: string;
  highlighted_content: string;
  timestamp: number;
}

// ── 風控狀態 ──────────────────────────────────────────────────
export const riskState: RiskStatus = {
  mdd: 0.018,
  daily_trades: 7,
  circuit_breaker: 'ACTIVE',
  portfolio_value: 2_450_000,
};

// 每日重置交易次數（模擬）
let lastResetDate = new Date().toDateString();
export function checkDailyReset() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    riskState.daily_trades = 0;
    lastResetDate = today;
  }
}

// ── AI 信號 ───────────────────────────────────────────────────
export const agentSignals: AgentSignal[] = [
  {
    symbol: '2330',
    type: 'BUY',
    confidence: 0.91,
    reasoning: '三大法人連續三日買超，外資持股比例上升至 78%，技術面突破季線壓力，MACD 黃金交叉確立，建議積極買入。',
    timestamp: Date.now() - 5 * 60 * 1000,
  },
  {
    symbol: '2454',
    type: 'HOLD',
    confidence: 0.67,
    reasoning: '法人籌碼中性偏多，KD 值超買區間，等待 Q1 財報公布後確認後續方向，暫時持有。',
    timestamp: Date.now() - 15 * 60 * 1000,
  },
  {
    symbol: '2317',
    type: 'SELL',
    confidence: 0.83,
    reasoning: '外資連續賣超 5 日，庫存警示訊號觸發，RSI 進入超買區域（>75），建議減碼或出場。',
    timestamp: Date.now() - 28 * 60 * 1000,
  },
  {
    symbol: '2308',
    type: 'BUY',
    confidence: 0.78,
    reasoning: 'AI Server 供應鏈受惠，法人持股增加，均線多頭排列，布林通道收窄後向上突破。',
    timestamp: Date.now() - 42 * 60 * 1000,
  },
  {
    symbol: '6505',
    type: 'HOLD',
    confidence: 0.55,
    reasoning: '國際油價走勢不明，本益比合理但缺乏明確催化劑，維持中立觀望。',
    timestamp: Date.now() - 60 * 60 * 1000,
  },
  {
    symbol: '2412',
    type: 'BUY',
    confidence: 0.88,
    reasoning: '5G 基礎建設持續擴張，電信業績穩健，高殖利率具防禦性，技術面底部成型，建議買入。',
    timestamp: Date.now() - 75 * 60 * 1000,
  },
];

// ── Alpha Agent 評分 ──────────────────────────────────────────
export const alphaScores: AlphaScore[] = [
  { metric: '技術面', value: 82 },
  { metric: '法人籌碼', value: 74 },
  { metric: '情緒面', value: 68 },
  { metric: '基本面', value: 60 },
  { metric: '量能', value: 78 },
];
export let alphaUpdatedAt: number = Date.now();

// ── 待核准交易（含歷史紀錄）────────────────────────────────────
export const pendingTrades: PendingTrade[] = [
  // ── 待核准 ──
  {
    task_id: 'TRD-001',
    symbol: '2330',
    type: 'BUY',
    confidence: 0.88,
    quantity: 2,
    estimated_price: 855.0,
    reasoning: '外資連三日買超，突破月線壓力，MACD 黃金交叉，RSI 未達超買，建議買進 2 張。',
    created_at: Date.now() - 3 * 60 * 1000,
    status: 'PENDING',
  },
  {
    task_id: 'TRD-002',
    symbol: '2412',
    type: 'BUY',
    confidence: 0.82,
    quantity: 1,
    estimated_price: 78.5,
    reasoning: '5G 基礎建設概念股，基本面良好，技術面底部確立，殖利率具吸引力。',
    created_at: Date.now() - 8 * 60 * 1000,
    status: 'PENDING',
  },
  {
    task_id: 'TRD-003',
    symbol: '2317',
    type: 'SELL',
    confidence: 0.79,
    quantity: 1,
    estimated_price: 182.0,
    reasoning: '庫存循環下行，外資賣超，技術面跌破支撐，信心度未達自動執行閾值，需人工確認。',
    created_at: Date.now() - 20 * 60 * 1000,
    status: 'PENDING',
  },
  {
    task_id: 'TRD-004',
    symbol: '2308',
    type: 'BUY',
    confidence: 0.85,
    quantity: 3,
    estimated_price: 42.5,
    reasoning: 'AI 伺服器電源供應需求爆發，訂單能見度高，技術面突破箱型整理，建議買進 3 張。',
    created_at: Date.now() - 35 * 60 * 1000,
    status: 'PENDING',
  },
  // ── 已核准（歷史紀錄）──
  {
    task_id: 'TRD-005',
    symbol: '2454',
    type: 'BUY',
    confidence: 0.91,
    quantity: 1,
    estimated_price: 1048.0,
    reasoning: 'AI 邊緣運算晶片新訂單確認，外資大幅買超，技術面強勢突破。',
    created_at: Date.now() - 2 * 60 * 60 * 1000,
    status: 'APPROVED',
  },
  {
    task_id: 'TRD-006',
    symbol: '6505',
    type: 'SELL',
    confidence: 0.76,
    quantity: 2,
    estimated_price: 308.5,
    reasoning: '國際油價下跌壓力持續，外資減碼，技術面跌破月線，建議減碼 2 張。',
    created_at: Date.now() - 3 * 60 * 60 * 1000,
    status: 'APPROVED',
  },
  {
    task_id: 'TRD-007',
    symbol: '2330',
    type: 'BUY',
    confidence: 0.94,
    quantity: 1,
    estimated_price: 840.0,
    reasoning: '法說會後外資目標價上調，技術面底部完成，信心度 94% 接近自動執行閾值。',
    created_at: Date.now() - 5 * 60 * 60 * 1000,
    status: 'APPROVED',
  },
  // ── 已拒絕（歷史紀錄）──
  {
    task_id: 'TRD-008',
    symbol: '2317',
    type: 'BUY',
    confidence: 0.62,
    quantity: 2,
    estimated_price: 188.0,
    reasoning: '短線反彈訊號，但信心度偏低（62%），籌碼面仍偏空，建議觀望。',
    created_at: Date.now() - 4 * 60 * 60 * 1000,
    status: 'REJECTED',
  },
  {
    task_id: 'TRD-009',
    symbol: '2412',
    type: 'SELL',
    confidence: 0.58,
    quantity: 1,
    estimated_price: 80.0,
    reasoning: '短線獲利了結訊號，但殖利率保護仍強，信心度不足，不建議賣出。',
    created_at: Date.now() - 6 * 60 * 60 * 1000,
    status: 'REJECTED',
  },
];

// ── 帳戶淨值曲線 ─────────────────────────────────────────────
export function generateEquityCurve(hours = 30): EquityPoint[] {
  const points: EquityPoint[] = [];
  const base = riskState.portfolio_value;
  let val = base * 0.962; // 從略低的起始點開始，讓曲線有向上趨勢
  const now = Date.now();

  for (let i = hours; i >= 0; i--) {
    // 模擬真實性：白天波動大，夜間穩定
    const ts = now - i * 3_600_000;
    const hour = new Date(ts).getHours();
    const isMarketHour = hour >= 9 && hour <= 13;
    const volatility = isMarketHour ? 0.005 : 0.001;
    val = val + (Math.random() - 0.46) * val * volatility;
    val = Math.max(val, base * 0.94); // 不低於起始的 94%

    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    points.push({
      time: `${hh}:${mm}`,
      equity: Math.round(val),
      timestamp: ts,
    });
  }
  // 確保最後一點是目前淨值
  if (points.length > 0) {
    points[points.length - 1].equity = base;
  }
  return points;
}

// ── 爬蟲資料（多元來源，含近 48 小時時間分布）────────────────
const now = Date.now();
export const crawledData: CrawledInfo[] = [
  // ── 證交所 (TWSE) ──
  {
    source: '證交所 (TWSE)',
    title: '三大法人買賣超日報：外資買超台積電 2,850 張，連續三日買超創近月新高',
    sentiment_score: 0.72,
    original_url: 'https://www.twse.com.tw/zh/trading/fund/T86.html',
    highlighted_content: '外資今日<mark>買超台積電 2,850 張</mark>，連續三日買超累計達 7,200 張，持股比例升至 78.3%，法人籌碼持續偏多。',
    timestamp: now - 30 * 60 * 1000,
  },
  {
    source: '證交所 (TWSE)',
    title: '鴻海 (2317) 法人動態：外資連五日賣超，合計賣出 4,200 張',
    sentiment_score: -0.58,
    original_url: 'https://www.twse.com.tw/zh/trading/fund/T86.html',
    highlighted_content: '鴻海<mark>外資連續五個交易日賣超</mark>，本周合計賣出 4,200 張，持股比例由 42.1% 降至 41.5%，籌碼面出現鬆動跡象。',
    timestamp: now - 2 * 60 * 60 * 1000,
  },
  {
    source: '證交所 (TWSE)',
    title: '台股今日成交量達 3,850 億元，三大法人合計買超 152 億元',
    sentiment_score: 0.45,
    original_url: 'https://www.twse.com.tw/zh/trading/fund/T86.html',
    highlighted_content: '今日台股<mark>成交量 3,850 億元</mark>，較昨日增加 12%，三大法人合計買超 152 億元，外資買超 98 億，投信買超 34 億，自營商買超 20 億。',
    timestamp: now - 4 * 60 * 60 * 1000,
  },
  {
    source: '證交所 (TWSE)',
    title: '聯發科 (2454) 三大法人動向：外資連三日買超，投信同步加碼',
    sentiment_score: 0.61,
    original_url: 'https://www.twse.com.tw/zh/trading/fund/T86.html',
    highlighted_content: '聯發科<mark>外資連三日買超合計 1,580 張</mark>，投信同步加碼 320 張，籌碼面轉趨積極，法人買超動能持續。',
    timestamp: now - 6 * 60 * 60 * 1000,
  },
  {
    source: '證交所 (TWSE)',
    title: '台塑化 (6505) 外資賣超創三週新高，籌碼面偏空',
    sentiment_score: -0.42,
    original_url: 'https://www.twse.com.tw/zh/trading/fund/T86.html',
    highlighted_content: '台塑化今日<mark>外資賣超 1,240 張</mark>，創近三週以來單日賣超新高，油價走弱加上煉油毛利收窄，法人持續調降持股。',
    timestamp: now - 8 * 60 * 60 * 1000,
  },
  // ── 公開資訊觀測站 (MOPS) ──
  {
    source: '公開資訊觀測站 (MOPS)',
    title: '台積電 (2330) 重大訊息：董事會決議發放現金股利 16 元，優於市場預期',
    sentiment_score: 0.85,
    original_url: 'https://mops.twse.com.tw/mops/web/t05st02',
    highlighted_content: '台積電董事會決議發放<mark>現金股利 16 元</mark>，較去年同期成長 14%，以目前股價計算殖利率約 1.7%，優於市場原先預期的 14-15 元。',
    timestamp: now - 45 * 60 * 1000,
  },
  {
    source: '公開資訊觀測站 (MOPS)',
    title: '聯發科 (2454) Q1 財報預告：EPS 預估 22-25 元，優於市場共識',
    sentiment_score: 0.79,
    original_url: 'https://mops.twse.com.tw/mops/web/t05st02',
    highlighted_content: '聯發科預告<mark> Q1 每股盈餘 22-25 元</mark>，優於市場共識的 20 元，主要受惠於 AI 手機晶片需求強勁及高階製程良率提升。',
    timestamp: now - 3 * 60 * 60 * 1000,
  },
  {
    source: '公開資訊觀測站 (MOPS)',
    title: '鴻海 (2317) 重大訊息：與 NVIDIA 擴大 AI 伺服器合作備忘錄簽署',
    sentiment_score: 0.68,
    original_url: 'https://mops.twse.com.tw/mops/web/t05st02',
    highlighted_content: '鴻海宣布與 NVIDIA <mark>擴大 AI 伺服器合作規模</mark>，預計 2025 年 AI 伺服器營收占比將突破 30%，為長期業績成長提供新動能。',
    timestamp: now - 5 * 60 * 60 * 1000,
  },
  {
    source: '公開資訊觀測站 (MOPS)',
    title: '台達電 (2308) 法說會：2025 年 AI 電源管理營收佔比目標 40%',
    sentiment_score: 0.72,
    original_url: 'https://mops.twse.com.tw/mops/web/t05st02',
    highlighted_content: '台達電執行長在法說會中表示，<mark> AI 相關電源管理產品 2025 年目標佔比達 40%</mark>，目前訂單能見度已延伸至 Q3，整體展望樂觀。',
    timestamp: now - 7 * 60 * 60 * 1000,
  },
  {
    source: '公開資訊觀測站 (MOPS)',
    title: '台塑化 (6505) 說明：Q1 煉油利潤受原油成本壓縮，下修全年獲利預估',
    sentiment_score: -0.55,
    original_url: 'https://mops.twse.com.tw/mops/web/t05st02',
    highlighted_content: '台塑化公告 <mark>Q1 煉油利潤率下滑至 4.2%</mark>，因國際原油成本攀升壓縮毛利，管理層保守看待 Q2，部分外資下修全年 EPS 預估。',
    timestamp: now - 10 * 60 * 60 * 1000,
  },
  // ── PTT Stock 版 ──
  {
    source: 'PTT Stock 版',
    title: '台積電法說會後續效應：多家外資上調目標價至 1,100-1,200 元',
    sentiment_score: 0.78,
    original_url: 'https://www.ptt.cc/bbs/Stock/index.html',
    highlighted_content: '法說會後多家外資機構陸續<mark>上調台積電目標價</mark>，摩根士丹利調至 1,150 元，花旗調至 1,100 元，高盛維持 1,200 元，整體氛圍偏多。',
    timestamp: now - 60 * 60 * 1000,
  },
  {
    source: 'PTT Stock 版',
    title: '[討論] 台積電 3nm 良率突破 85%，CoWoS 產能持續擴張',
    sentiment_score: 0.82,
    original_url: 'https://www.ptt.cc/bbs/Stock/index.html',
    highlighted_content: '業界消息指出台積電 <mark>3nm 良率已突破 85%</mark>，超越市場預期，CoWoS 先進封裝月產能預計 Q3 擴至 3 萬片，供應商受惠股蠢蠢欲動。',
    timestamp: now - 90 * 60 * 1000,
  },
  {
    source: 'PTT Stock 版',
    title: '[新聞] 美科技股大漲帶動，費半指數創歷史新高，台積電 ADR 夜盤漲 2.3%',
    sentiment_score: 0.65,
    original_url: 'https://www.ptt.cc/bbs/Stock/index.html',
    highlighted_content: '美股費城半導體指數<mark>創歷史新高</mark>，台積電 ADR 夜盤上漲 2.3%，法人預期明日台積電開盤將有正面反應，相關供應鏈也可望同步走強。',
    timestamp: now - 12 * 60 * 60 * 1000,
  },
  {
    source: 'PTT Stock 版',
    title: '[心得] 鴻海 AI 伺服器佈局解析：GB200 訂單量超乎市場預期',
    sentiment_score: 0.54,
    original_url: 'https://www.ptt.cc/bbs/Stock/index.html',
    highlighted_content: '根據供應鏈透露，鴻海 <mark>GB200 伺服器訂單量達 8 萬台</mark>，高於市場先前預期的 5 萬台，AI 伺服器業務有望成為 2025 年主要成長動能。',
    timestamp: now - 15 * 60 * 60 * 1000,
  },
  {
    source: 'PTT Stock 版',
    title: '[討論] 台塑化基本面利空持續，近期下跌是止跌還是繼續探底？',
    sentiment_score: -0.38,
    original_url: 'https://www.ptt.cc/bbs/Stock/index.html',
    highlighted_content: '油價走跌加上下游需求疲弱，<mark>台塑化基本面壓力持續</mark>，技術面月線被跌破，多空分歧，有人認為現價已反映悲觀預期，也有人看到 280 元支撐。',
    timestamp: now - 20 * 60 * 60 * 1000,
  },
  // ── 股市爆料同學會 ──
  {
    source: '股市爆料同學會',
    title: '聯發科 (2454) 傳 AI 晶片新訂單消息，股價盤中急拉 3.5%',
    sentiment_score: 0.61,
    original_url: 'https://www.facebook.com/groups/stockfriend/',
    highlighted_content: '聯發科盤中傳出<mark>獲得 AI 邊緣運算晶片大單</mark>，股價急拉 3.5% 至 1,060 元附近，成交量放大至平均量的 2.3 倍，但尚未有官方確認。',
    timestamp: now - 2 * 60 * 60 * 1000,
  },
  {
    source: '股市爆料同學會',
    title: '台積電供應鏈爆料：CoWoS 2.0 技術突破，蘋果 A20 晶片將採用',
    sentiment_score: 0.74,
    original_url: 'https://www.facebook.com/groups/stockfriend/',
    highlighted_content: '業內消息人士爆料，台積電 <mark>CoWoS 2.0 封裝技術已獲蘋果 A20 採用</mark>，2026 年出貨量預估超過 1.5 億顆，為封測相關供應鏈帶來重大利多。',
    timestamp: now - 4 * 60 * 60 * 1000,
  },
  {
    source: '股市爆料同學會',
    title: '中華電信 (2412) 爆料：5G 用戶數突破 800 萬，下半年將啟動 6G 研發',
    sentiment_score: 0.52,
    original_url: 'https://www.facebook.com/groups/stockfriend/',
    highlighted_content: '據傳中華電信 <mark>5G 用戶達 800 萬突破</mark>，市佔率維持第一，下半年將與愛立信合作啟動 6G 研發計畫，股價防禦性加上成長性題材吸引長線資金。',
    timestamp: now - 7 * 60 * 60 * 1000,
  },
  {
    source: '股市爆料同學會',
    title: '鴻海內部消息：印度廠 iPhone 17 良率已達 92%，超越鄭州廠歷史最佳',
    sentiment_score: 0.69,
    original_url: 'https://www.facebook.com/groups/stockfriend/',
    highlighted_content: '爆料稱鴻海印度廠 <mark>iPhone 17 製程良率高達 92%</mark>，超越鄭州廠歷史最佳的 89%，印度廠逐步具備承接高階產品的能力，為地緣風險分散加分。',
    timestamp: now - 11 * 60 * 60 * 1000,
  },
  {
    source: '股市爆料同學會',
    title: '台達電爆料：與 Microsoft Azure 簽署 UPS 供電系統 3 年大單，金額逾百億',
    sentiment_score: 0.81,
    original_url: 'https://www.facebook.com/groups/stockfriend/',
    highlighted_content: '消息指台達電與 Microsoft Azure <mark>簽署超過百億元的 UPS 不斷電系統供應合約</mark>，為期三年，AI 資料中心建置加速驅動電源管理設備需求大增。',
    timestamp: now - 16 * 60 * 60 * 1000,
  },
  {
    source: '股市爆料同學會',
    title: '負面消息：傳某 IC 設計廠遭客戶取消訂單，影響下半年出貨',
    sentiment_score: -0.72,
    original_url: 'https://www.facebook.com/groups/stockfriend/',
    highlighted_content: '據爆料，<mark>某 IC 設計廠遭北美客戶大幅削減下半年訂單</mark>，金額估計達 5 億美元，若屬實將對該公司 Q3 業績造成顯著衝擊，市場正在觀察官方回應。',
    timestamp: now - 24 * 60 * 60 * 1000,
  },
  {
    source: '股市爆料同學會',
    title: '台積電 2nm 良率已達 72%，預計 2026 Q1 量產，蘋果優先鎖產能',
    sentiment_score: 0.88,
    original_url: 'https://www.facebook.com/groups/stockfriend/',
    highlighted_content: '業內消息：台積電 <mark>2nm 製程良率達 72%</mark>，提前達到量產門檻，蘋果已優先鎖定 2026 Q1 產能，預計 A20 晶片為首款採用 2nm 的消費性產品。',
    timestamp: now - 30 * 60 * 60 * 1000,
  },
  {
    source: '證交所 (TWSE)',
    title: '本週外資佈局：半導體族群獲淨買超 320 億，金融股遭賣超 85 億',
    sentiment_score: 0.38,
    original_url: 'https://www.twse.com.tw/zh/trading/fund/T86.html',
    highlighted_content: '本週外資<mark>半導體族群累計淨買超 320 億元</mark>，台積電、聯發科、台達電均入選，金融股則遭賣超 85 億，顯示資金轉向高科技成長股。',
    timestamp: now - 36 * 60 * 60 * 1000,
  },
  {
    source: 'PTT Stock 版',
    title: '[請益] 台積電 H2 展望如何？外資目標價差距懸殊的原因',
    sentiment_score: 0.15,
    original_url: 'https://www.ptt.cc/bbs/Stock/index.html',
    highlighted_content: '各大外資對台積電 H2 看法分歧，<mark>目標價區間從 900 到 1,250 元</mark>均有，多頭押注 AI 需求持續，空頭擔憂地緣政治與估值過高，市場分歧明顯。',
    timestamp: now - 40 * 60 * 60 * 1000,
  },
  {
    source: '公開資訊觀測站 (MOPS)',
    title: '中華電信 (2412) 配息公告：擬配發現金股利 4.6 元，殖利率約 5.9%',
    sentiment_score: 0.66,
    original_url: 'https://mops.twse.com.tw/mops/web/t05st02',
    highlighted_content: '中華電信公告擬配發<mark>現金股利 4.6 元</mark>，以目前股價計算殖利率約 5.9%，為台股高殖利率代表性個股，吸引長線存股族持續買進。',
    timestamp: now - 44 * 60 * 60 * 1000,
  },
];
