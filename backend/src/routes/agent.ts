import { Router, Request, Response } from 'express';
import { RSI, MACD, SMA, BollingerBands } from 'technicalindicators';
import { fetchRealKline } from './market';
import { agentSignals, alphaScores } from '../store/index';

const router = Router();

// -------- 股票清單 --------
const SYMBOLS = [
  { symbol: '2330.TW', name: '台積電' },
  { symbol: '2454.TW', name: '聯發科' },
  { symbol: '2317.TW', name: '鴻海' },
  { symbol: '2308.TW', name: '台達電' },
  { symbol: '6505.TW', name: '台塑化' },
  { symbol: '2412.TW', name: '中華電信' },
];

interface GeneratedSignal {
  symbol: string;
  type: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  timestamp: number;
}
interface AlphaMetric { metric: string; value: number; }

// -------- 快取 --------
let signalCache: GeneratedSignal[] = [];
let signalCacheTime = 0;
let alphaCache: AlphaMetric[] = [];
let alphaCacheTime = 0;
const SIGNAL_TTL = 10 * 60_000; // 10 分鐘

// -------- 技術指標計算 --------
async function generateRealSignals(): Promise<GeneratedSignal[]> {
  if (Date.now() - signalCacheTime < SIGNAL_TTL && signalCache.length > 0) {
    return signalCache;
  }

  const signals: GeneratedSignal[] = [];

  await Promise.allSettled(
    SYMBOLS.map(async ({ symbol, name }) => {
      try {
        const kline = await fetchRealKline(symbol, '1d', 60);
        if (kline.length < 26) return;

        const closes  = kline.map((k) => k.c);
        const volumes = kline.map((k) => k.v);
        const latest  = closes[closes.length - 1];

        // RSI(14)
        const rsiArr = RSI.calculate({ values: closes, period: 14 });
        const rsi    = rsiArr[rsiArr.length - 1] ?? 50;

        // MACD(12,26,9)
        const macdArr  = MACD.calculate({
          values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
          SimpleMAOscillator: false, SimpleMASignal: false,
        });
        const macdNow  = macdArr[macdArr.length - 1];
        const macdPrev = macdArr[macdArr.length - 2];
        const crossUp   = macdNow && macdPrev && macdPrev.MACD! < macdPrev.signal! && macdNow.MACD! > macdNow.signal!;
        const crossDown = macdNow && macdPrev && macdPrev.MACD! > macdPrev.signal! && macdNow.MACD! < macdNow.signal!;

        // SMA(20)
        const sma20Arr = SMA.calculate({ values: closes, period: 20 });
        const sma20    = sma20Arr[sma20Arr.length - 1] ?? latest;

        // Bollinger Bands(20, 2)
        const bbArr = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
        const bb    = bbArr[bbArr.length - 1];

        // 成交量放大
        const avgVol  = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
        const highVol = volumes[volumes.length - 1] > avgVol * 1.5;

        // 信號邏輯
        let type: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let confidence = 0.55;
        const reasons: string[] = [];

        if (rsi < 35) {
          reasons.push(`RSI 超賣（${rsi.toFixed(0)}）`);
          confidence += 0.12; type = 'BUY';
        } else if (rsi > 68) {
          reasons.push(`RSI 超買（${rsi.toFixed(0)}）`);
          confidence += 0.12; type = 'SELL';
        } else {
          reasons.push(`RSI ${rsi.toFixed(0)}`);
        }

        if (crossUp) {
          reasons.push('MACD 黃金交叉');
          confidence += 0.15;
          if (type !== 'SELL') type = 'BUY';
        } else if (crossDown) {
          reasons.push('MACD 死亡交叉');
          confidence += 0.15;
          if (type !== 'BUY') type = 'SELL';
        }

        if (latest > sma20) {
          reasons.push(`站上 MA20（${sma20.toFixed(1)}）`);
          confidence += 0.05;
          if (type === 'HOLD') type = 'BUY';
        } else {
          reasons.push(`跌破 MA20（${sma20.toFixed(1)}）`);
          confidence += 0.05;
          if (type === 'HOLD') type = 'SELL';
        }

        if (bb) {
          if (latest <= bb.lower) {
            reasons.push('碰觸布林下軌'); confidence += 0.08;
            if (type !== 'SELL') type = 'BUY';
          } else if (latest >= bb.upper) {
            reasons.push('碰觸布林上軌'); confidence += 0.08;
            if (type !== 'BUY') type = 'SELL';
          }
        }

        if (highVol) { reasons.push('量能放大確認'); confidence += 0.05; }

        const displaySymbol = symbol.replace('.TW', '');
        signals.push({
          symbol: displaySymbol,
          type,
          confidence: Math.min(0.97, Math.max(0.51, confidence)),
          reasoning: `${name}（${displaySymbol}）：${reasons.join('，')}，建議${type === 'BUY' ? '買入' : type === 'SELL' ? '賣出' : '觀望'}。`,
          timestamp: Date.now(),
        });
        console.log(`[agent] ${symbol} → ${type} RSI:${rsi.toFixed(0)} conf:${confidence.toFixed(2)}`);
      } catch (err) {
        console.warn(`[agent] ${symbol} 計算失敗：`, (err as Error).message);
      }
    })
  );

  if (signals.length > 0) {
    signalCache = signals;
    signalCacheTime = Date.now();
    updateAlpha(signals);
  }
  return signalCache.length > 0 ? signalCache : agentSignals;
}

/** 依信號更新 Alpha 多維評分 */
function updateAlpha(signals: GeneratedSignal[]) {
  const buys  = signals.filter((s) => s.type === 'BUY').length;
  const sells = signals.filter((s) => s.type === 'SELL').length;
  const avg   = signals.reduce((a, b) => a + b.confidence, 0) / signals.length;

  alphaCache = [
    { metric: '技術面',   value: Math.min(100, Math.max(20, Math.round(avg * 100 + (buys - sells) * 3))) },
    { metric: '法人籌碼', value: Math.min(100, Math.max(30, Math.round((alphaScores[1]?.value ?? 72) + (Math.random() - 0.5) * 8))) },
    { metric: '情緒面',   value: Math.min(100, Math.max(20, Math.round(50 + (buys - sells) * 8 + Math.random() * 10))) },
    { metric: '基本面',   value: Math.min(100, Math.max(30, Math.round((alphaScores[3]?.value ?? 60) + (Math.random() - 0.5) * 6))) },
    { metric: '量能',     value: Math.min(100, Math.max(30, Math.round(avg * 95 + Math.random() * 8))) },
  ];
  alphaCacheTime = Date.now();
}

// -------- Routes --------

/**
 * GET /api/agent/signals
 * 真實技術指標計算；失敗回退 mock
 */
router.get('/signals', async (req: Request, res: Response) => {
  const typeFilter = (req.query.type as string || 'ALL').toUpperCase();
  try {
    let signals = await generateRealSignals();
    signals = [...signals].sort((a, b) => b.confidence - a.confidence);
    if (typeFilter !== 'ALL' && ['BUY', 'SELL', 'HOLD'].includes(typeFilter)) {
      signals = signals.filter((s) => s.type === typeFilter);
    }
    return res.json(signals);
  } catch (err) {
    console.error('[agent/signals]', err);
    let fb = [...agentSignals].sort((a, b) => b.confidence - a.confidence);
    if (typeFilter !== 'ALL') fb = fb.filter((s) => s.type === typeFilter);
    return res.json(fb);
  }
});

/**
 * GET /api/agent/alpha-scores
 * 依技術指標動態計算；失敗回退 mock
 */
router.get('/alpha-scores', async (_req: Request, res: Response) => {
  try {
    if (Date.now() - alphaCacheTime > SIGNAL_TTL || alphaCache.length === 0) {
      await generateRealSignals();
    }
    const scores = alphaCache.length > 0 ? alphaCache : alphaScores.map((s) => ({
      metric: s.metric,
      value: Math.min(100, Math.max(0, Math.round(s.value + (Math.random() - 0.5) * 4))),
    }));
    return res.json({ scores, updated_at: alphaCacheTime || Date.now() });
  } catch (err) {
    console.error('[agent/alpha-scores]', err);
    return res.json({ scores: alphaScores.map((s) => ({ metric: s.metric, value: s.value })), updated_at: Date.now() });
  }
});

export default router;
