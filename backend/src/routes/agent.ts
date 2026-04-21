import { Router, Request, Response } from 'express';
import { RSI, MACD, SMA, BollingerBands } from 'technicalindicators';
import axios from 'axios';
import { fetchRealKline } from './market';
import { agentSignals, alphaScores } from '../store/index';
import { rulesStore, SignalRule, SignalCondition } from './signalRules';

const router = Router();

// Environment configuration
const NEWS_CHECKER_URL = process.env.NEWS_CHECKER_URL || 'http://localhost:5000';

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
  conditions: SignalCondition[];
  ruleId: string;
  ruleName: string;
}

interface AlphaMetric {
  metric: string;
  value: number;
}

// -------- 快取 --------
let signalCache: GeneratedSignal[] = [];
let signalCacheTime = 0;
let alphaCache: AlphaMetric[] = [];
let alphaCacheTime = 0;
const SIGNAL_TTL = 2 * 60_000; // 2 分鐘

// -------- 技術指標計算 --------

/**
 * Build signal conditions for the default algorithm
 */
function buildDefaultConditions(
  rsi: number,
  macdNow: any,
  macdPrev: any,
  sma20: number,
  latest: number,
  bb: any,
  volumes: number[],
  avgVol: number
): SignalCondition[] {
  const crossUp = macdNow && macdPrev && macdPrev.MACD! < macdPrev.signal! && macdNow.MACD! > macdNow.signal!;
  const crossDown = macdNow && macdPrev && macdPrev.MACD! > macdPrev.signal! && macdNow.MACD! < macdNow.signal!;
  const highVol = volumes[volumes.length - 1] > avgVol * 1.5;

  const conditions: SignalCondition[] = [
    {
      name: 'RSI 超賣 (< 35)',
      met: rsi < 35,
      value: `RSI = ${rsi.toFixed(1)}`,
    },
    {
      name: 'RSI 超買 (> 68)',
      met: rsi > 68,
      value: `RSI = ${rsi.toFixed(1)}`,
    },
    {
      name: 'MACD 黃金交叉',
      met: crossUp,
      value: `MACD=${macdNow?.MACD?.toFixed(3) ?? 'N/A'} > Signal=${macdNow?.signal?.toFixed(3) ?? 'N/A'}`,
    },
    {
      name: 'MACD 死亡交叉',
      met: crossDown,
      value: `MACD=${macdNow?.MACD?.toFixed(3) ?? 'N/A'} < Signal=${macdNow?.signal?.toFixed(3) ?? 'N/A'}`,
    },
    {
      name: '站上 MA20',
      met: latest > sma20,
      value: `價格=${latest.toFixed(1)} > SMA20=${sma20.toFixed(1)}`,
    },
    {
      name: '碰觸布林下軌',
      met: bb && latest <= bb.lower,
      value: `BB下軌=${bb?.lower?.toFixed(1) ?? 'N/A'}`,
    },
    {
      name: '碰觸布林上軌',
      met: bb && latest >= bb.upper,
      value: `BB上軌=${bb?.upper?.toFixed(1) ?? 'N/A'}`,
    },
    {
      name: '量能放大 (> 1.5x)',
      met: highVol,
      value: `量能=${(volumes[volumes.length - 1] / avgVol).toFixed(2)}x`,
    },
  ];

  return conditions;
}

async function generateRealSignals(ruleId?: string): Promise<GeneratedSignal[]> {
  if (!ruleId && Date.now() - signalCacheTime < SIGNAL_TTL && signalCache.length > 0) {
    return signalCache;
  }

  const signals: GeneratedSignal[] = [];
  let activeRule = ruleId ? rulesStore.get(ruleId) : Array.from(rulesStore.values()).find((r) => r.isActive);

  if (!activeRule) {
    activeRule = rulesStore.get('default');
  }

  if (!activeRule) {
    console.warn('[agent] No active rule found, using default');
    return [];
  }

  const isCustomRule = activeRule.id !== 'default';

  await Promise.allSettled(
    SYMBOLS.map(async ({ symbol, name }) => {
      try {
        const kline = await fetchRealKline(symbol, '1d', 60);
        if (kline.length < 26) return;

        const closes = kline.map((k) => k.c);
        const volumes = kline.map((k) => k.v);
        const latest = closes[closes.length - 1];

        // RSI(14)
        const rsiArr = RSI.calculate({ values: closes, period: 14 });
        const rsi = rsiArr[rsiArr.length - 1] ?? 50;

        // MACD(12,26,9)
        const macdArr = MACD.calculate({
          values: closes,
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9,
          SimpleMAOscillator: false,
          SimpleMASignal: false,
        });
        const macdNow = macdArr[macdArr.length - 1];
        const macdPrev = macdArr[macdArr.length - 2];

        // SMA(20)
        const sma20Arr = SMA.calculate({ values: closes, period: 20 });
        const sma20 = sma20Arr[sma20Arr.length - 1] ?? latest;

        // Bollinger Bands(20, 2)
        const bbArr = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
        const bb = bbArr[bbArr.length - 1];

        // 成交量放大
        const avgVol = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;

        let type: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let confidence = 0.55;
        let reasoning = '';
        let conditions: SignalCondition[] = [];

        if (isCustomRule) {
          // Execute custom Python script
          const marketData = {
            symbol: symbol.replace('.TW', ''),
            prices: closes,
            volumes,
            rsi,
            macd: macdNow?.MACD ?? 0,
            macd_signal: macdNow?.signal ?? 0,
            sma20,
            bb_upper: bb?.upper ?? 0,
            bb_lower: bb?.lower ?? 0,
          };

          try {
            const result = await axios.post(`${NEWS_CHECKER_URL}/api/execute-rule`, {
              script: activeRule.script,
              marketData,
            });

            type = result.data.signal || 'HOLD';
            confidence = result.data.confidence || 0.55;
            conditions = result.data.conditions || [];
            reasoning = result.data.reasoning || '';
          } catch (err) {
            console.warn(`[agent] Failed to execute custom rule for ${symbol}:`, err instanceof Error ? err.message : 'Unknown error');
            // Fall back to default algorithm
            type = 'HOLD';
            confidence = 0.50;
            conditions = buildDefaultConditions(rsi, macdNow, macdPrev, sma20, latest, bb, volumes, avgVol);
            reasoning = `無法執行自訂規則，使用預設演算法。`;
          }
        } else {
          // Default algorithm
          const crossUp = macdNow && macdPrev && macdPrev.MACD! < macdPrev.signal! && macdNow.MACD! > macdNow.signal!;
          const crossDown = macdNow && macdPrev && macdPrev.MACD! > macdPrev.signal! && macdNow.MACD! < macdNow.signal!;
          const highVol = volumes[volumes.length - 1] > avgVol * 1.5;

          conditions = buildDefaultConditions(rsi, macdNow, macdPrev, sma20, latest, bb, volumes, avgVol);
          const reasons: string[] = [];

          if (rsi < 35) {
            reasons.push(`RSI 超賣（${rsi.toFixed(0)}）`);
            confidence += 0.12;
            type = 'BUY';
          } else if (rsi > 68) {
            reasons.push(`RSI 超買（${rsi.toFixed(0)}）`);
            confidence += 0.12;
            type = 'SELL';
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
              reasons.push('碰觸布林下軌');
              confidence += 0.08;
              if (type !== 'SELL') type = 'BUY';
            } else if (latest >= bb.upper) {
              reasons.push('碰觸布林上軌');
              confidence += 0.08;
              if (type !== 'BUY') type = 'SELL';
            }
          }

          if (highVol) {
            reasons.push('量能放大確認');
            confidence += 0.05;
          }

          reasoning = `${name}（${symbol.replace('.TW', '')}）：${reasons.join('，')}，建議${type === 'BUY' ? '買入' : type === 'SELL' ? '賣出' : '觀望'}。`;
        }

        const displaySymbol = symbol.replace('.TW', '');
        signals.push({
          symbol: displaySymbol,
          type,
          confidence: Math.min(0.97, Math.max(0.51, confidence)),
          reasoning,
          timestamp: Date.now(),
          conditions,
          ruleId: activeRule.id,
          ruleName: activeRule.name,
        });
        console.log(`[agent] ${symbol} → ${type} RSI:${rsi.toFixed(0)} conf:${confidence.toFixed(2)} rule:${activeRule.id}`);
      } catch (err) {
        console.warn(`[agent] ${symbol} 計算失敗：`, (err as Error).message);
      }
    })
  );

  if (signals.length > 0) {
    if (!ruleId) {
      signalCache = signals;
      signalCacheTime = Date.now();
    }
    updateAlpha(signals);
  }
  return signals.length > 0 ? signals : agentSignals.map((s) => ({
    ...s,
    conditions: [],
    ruleId: 'default',
    ruleName: '預設技術分析規則',
  }));
}

/** 依信號更新 Alpha 多維評分 */
function updateAlpha(signals: GeneratedSignal[]) {
  const buys = signals.filter((s) => s.type === 'BUY').length;
  const sells = signals.filter((s) => s.type === 'SELL').length;
  const avg = signals.reduce((a, b) => a + b.confidence, 0) / signals.length;

  alphaCache = [
    { metric: '技術面', value: Math.min(100, Math.max(20, Math.round(avg * 100 + (buys - sells) * 3))) },
    { metric: '法人籌碼', value: Math.min(100, Math.max(30, Math.round((alphaScores[1]?.value ?? 72) + (Math.random() - 0.5) * 8))) },
    { metric: '情緒面', value: Math.min(100, Math.max(20, Math.round(50 + (buys - sells) * 8 + Math.random() * 10))) },
    { metric: '基本面', value: Math.min(100, Math.max(30, Math.round((alphaScores[3]?.value ?? 60) + (Math.random() - 0.5) * 6))) },
    { metric: '量能', value: Math.min(100, Math.max(30, Math.round(avg * 95 + Math.random() * 8))) },
  ];
  alphaCacheTime = Date.now();
}

// -------- Routes --------

/**
 * GET /api/agent/signals
 * 真實技術指標計算；失敗回退 mock
 * Query params:
 *   - type: 'ALL', 'BUY', 'SELL', 'HOLD'
 *   - ruleId: specific rule ID to use (if not 'default')
 */
router.get('/signals', async (req: Request, res: Response) => {
  const typeFilter = (req.query.type as string || 'ALL').toUpperCase();
  const ruleId = req.query.ruleId as string | undefined;

  try {
    let signals = await generateRealSignals(ruleId);
    signals = [...signals].sort((a, b) => b.confidence - a.confidence);

    if (typeFilter !== 'ALL' && ['BUY', 'SELL', 'HOLD'].includes(typeFilter)) {
      signals = signals.filter((s) => s.type === typeFilter);
    }
    return res.json(signals);
  } catch (err) {
    console.error('[agent/signals]', err);
    let fb = [...agentSignals].map((s) => ({
      ...s,
      conditions: [],
      ruleId: 'default',
      ruleName: '預設技術分析規則',
    }));
    fb = fb.sort((a, b) => b.confidence - a.confidence);
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
    const scores =
      alphaCache.length > 0
        ? alphaCache
        : alphaScores.map((s) => ({
            metric: s.metric,
            value: Math.min(100, Math.max(0, Math.round(s.value + (Math.random() - 0.5) * 4))),
          }));
    return res.json({ scores, updated_at: alphaCacheTime || Date.now() });
  } catch (err) {
    console.error('[agent/alpha-scores]', err);
    return res.json({
      scores: alphaScores.map((s) => ({ metric: s.metric, value: s.value })),
      updated_at: Date.now(),
    });
  }
});

/**
 * GET /api/agent/active-rule
 * Returns the currently active rule info
 */
router.get('/active-rule', (_req: Request, res: Response) => {
  try {
    const activeRule = Array.from(rulesStore.values()).find((r) => r.isActive);
    const rule = activeRule || rulesStore.get('default');

    if (!rule) {
      return res.status(404).json({ error: 'No active rule found' });
    }

    return res.json({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      isDefault: rule.isDefault,
      isActive: rule.isActive,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    });
  } catch (err) {
    console.error('[agent/active-rule]', err);
    return res.status(500).json({ error: 'Failed to get active rule' });
  }
});

export default router;
