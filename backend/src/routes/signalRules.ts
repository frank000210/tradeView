import { Router, Request, Response } from 'express';
import axios from 'axios';
import { RSI, MACD, SMA, BollingerBands } from 'technicalindicators';
import { getPool } from '../db';
import { fetchRealKline } from './market';

const router = Router();

const NEWS_CHECKER_URL = process.env.NEWS_CHECKER_URL || 'http://localhost:5000';

// -------- Interfaces --------

export interface SignalCondition {
  name: string;
  met: boolean;
  value: string;
}

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

// -------- Default Built-in Rule --------

const DEFAULT_RULE_SCRIPT = `# 預設技術分析規則
# 可用變數: prices, volumes, rsi, macd, macd_signal, sma20, bb_upper, bb_lower, symbol

conditions = []

# RSI 條件
if rsi < 35:
    conditions.append({"name": "RSI 超賣 (< 35)", "met": True, "value": f"RSI = {rsi:.1f}"})
    signal = "BUY"
    confidence = 0.70
elif rsi > 68:
    conditions.append({"name": "RSI 超買 (> 68)", "met": True, "value": f"RSI = {rsi:.1f}"})
    signal = "SELL"
    confidence = 0.70
else:
    conditions.append({"name": "RSI 超賣 (< 35)", "met": False, "value": f"RSI = {rsi:.1f}"})
    conditions.append({"name": "RSI 超買 (> 68)", "met": False, "value": f"RSI = {rsi:.1f}"})
    signal = "HOLD"
    confidence = 0.55

# MACD 條件
if macd > macd_signal:
    conditions.append({"name": "MACD 黃金交叉", "met": True, "value": f"MACD={macd:.3f} > Signal={macd_signal:.3f}"})
    if signal != "SELL":
        signal = "BUY"
        confidence += 0.12
else:
    conditions.append({"name": "MACD 黃金交叉", "met": False, "value": f"MACD={macd:.3f} <= Signal={macd_signal:.3f}"})
    if signal != "BUY":
        signal = "SELL"
        confidence += 0.10

# SMA20 條件
latest_price = prices[-1] if prices else 0
if latest_price > sma20:
    conditions.append({"name": "站上 MA20", "met": True, "value": f"價格={latest_price:.1f} > SMA20={sma20:.1f}"})
    confidence += 0.05
else:
    conditions.append({"name": "站上 MA20", "met": False, "value": f"價格={latest_price:.1f} < SMA20={sma20:.1f}"})

# Bollinger Bands
if bb_lower > 0 and latest_price <= bb_lower:
    conditions.append({"name": "碰觸布林下軌", "met": True, "value": f"價格={latest_price:.1f} <= BB下={bb_lower:.1f}"})
    confidence += 0.08
elif bb_upper > 0 and latest_price >= bb_upper:
    conditions.append({"name": "碰觸布林上軌", "met": True, "value": f"價格={latest_price:.1f} >= BB上={bb_upper:.1f}"})
    confidence += 0.08
else:
    conditions.append({"name": "碰觸布林通道", "met": False, "value": f"價格在通道內"})

confidence = min(0.97, max(0.51, confidence))
reasoning = f"觸發條件：{', '.join([c['name'] for c in conditions if c['met']])}"
`;

const DEFAULT_RULE: SignalRule = {
  id: 'default',
  name: '預設技術分析規則',
  description: '內置的技術分析規則，基於 RSI、MACD、SMA20 和布林通道',
  script: DEFAULT_RULE_SCRIPT,
  isDefault: true,
  isActive: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// -------- In-Memory Store --------

export const rulesStore = new Map<string, SignalRule>();
rulesStore.set('default', { ...DEFAULT_RULE });

// -------- DB Helpers --------

function rowToRule(row: Record<string, unknown>): SignalRule {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || '',
    script: row.script as string,
    isDefault: row.is_default as boolean,
    isActive: row.is_active as boolean,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

async function persistRuleToDb(rule: SignalRule): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO signal_rules
         (id, name, description, script, is_default, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         name        = EXCLUDED.name,
         description = EXCLUDED.description,
         script      = EXCLUDED.script,
         is_default  = EXCLUDED.is_default,
         is_active   = EXCLUDED.is_active,
         updated_at  = EXCLUDED.updated_at`,
      [rule.id, rule.name, rule.description, rule.script,
       rule.isDefault, rule.isActive, rule.createdAt, rule.updatedAt]
    );
  } catch (err) {
    console.error('[signalRules] persistRuleToDb error:', (err as Error).message);
  }
}

async function deleteRuleFromDb(id: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query('DELETE FROM signal_rules WHERE id = $1', [id]);
  } catch (err) {
    console.error('[signalRules] deleteRuleFromDb error:', (err as Error).message);
  }
}

async function deactivateAllInDb(): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query('UPDATE signal_rules SET is_active = FALSE');
  } catch (err) {
    console.error('[signalRules] deactivateAllInDb error:', (err as Error).message);
  }
}

/**
 * Called once on startup from index.ts.
 * Loads persisted rules from PostgreSQL into rulesStore.
 * Seeds default rule if DB is empty.
 */
export async function loadRulesFromDb(): Promise<void> {
  const pool = getPool();
  if (!pool) {
    console.log('[signalRules] No DB — in-memory store with default rule');
    return;
  }
  try {
    const result = await pool.query('SELECT * FROM signal_rules ORDER BY created_at ASC');

    if (result.rows.length === 0) {
      console.log('[signalRules] No rules in DB — seeding default rule');
      const seed = { ...DEFAULT_RULE, createdAt: Date.now(), updatedAt: Date.now() };
      await persistRuleToDb(seed);
      rulesStore.set('default', seed);
      return;
    }

    rulesStore.clear();
    for (const row of result.rows) {
      const rule = rowToRule(row);
      rulesStore.set(rule.id, rule);
    }

    if (!rulesStore.has('default')) {
      const seed = { ...DEFAULT_RULE, createdAt: Date.now(), updatedAt: Date.now() };
      rulesStore.set('default', seed);
      await persistRuleToDb(seed);
    }

    const anyActive = Array.from(rulesStore.values()).some((r) => r.isActive);
    if (!anyActive) {
      const def = rulesStore.get('default')!;
      def.isActive = true;
      rulesStore.set('default', def);
      await persistRuleToDb(def);
    }

    console.log(`[signalRules] Loaded ${rulesStore.size} rules from DB`);
  } catch (err) {
    console.error('[signalRules] loadRulesFromDb error:', (err as Error).message);
  }
}

// -------- Utility Functions --------

function generateId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function validateScript(script: string): { valid: boolean; error?: string } {
  if (!script || script.trim().length === 0) {
    return { valid: false, error: 'Script cannot be empty' };
  }
  if (script.length > 50000) {
    return { valid: false, error: 'Script too large (max 50KB)' };
  }
  const requiredVars = ['signal', 'confidence', 'conditions'];
  const missing = requiredVars.filter((v) => !script.includes(v));
  if (missing.length > 0) {
    return { valid: false, error: `Script must define: ${missing.join(', ')}` };
  }
  return { valid: true };
}

async function executeScriptWithData(
  script: string,
  marketData: Record<string, unknown>
): Promise<{
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  conditions: SignalCondition[];
  reasoning: string;
}> {
  try {
    const response = await axios.post(`${NEWS_CHECKER_URL}/api/execute-rule`, { script, marketData });
    return response.data;
  } catch (error) {
    throw new Error(
      `Failed to execute script: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// -------- Routes --------

router.get('/', (_req: Request, res: Response) => {
  const rules = Array.from(rulesStore.values());
  return res.json({ rules, activeRule: rules.find((r) => r.isActive) });
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { name, description, script } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Rule name is required' });
    }
    const validation = validateScript(script);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    const newRule: SignalRule = {
      id: generateId(),
      name: name.trim(),
      description: description || '',
      script,
      isDefault: false,
      isActive: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    rulesStore.set(newRule.id, newRule);
    persistRuleToDb(newRule).catch(console.error);
    console.log(`[signalRules] Created rule: ${newRule.id} - ${newRule.name}`);
    return res.status(201).json(newRule);
  } catch (err) {
    console.error('[signalRules/POST]', err);
    return res.status(500).json({ error: 'Failed to create rule' });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, script } = req.body;
    const rule = rulesStore.get(id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    if (rule.isDefault) return res.status(403).json({ error: 'Cannot modify default rule' });
    if (script && script !== rule.script) {
      const validation = validateScript(script);
      if (!validation.valid) return res.status(400).json({ error: validation.error });
      rule.script = script;
    }
    if (name) rule.name = name.trim();
    if (description !== undefined) rule.description = description;
    rule.updatedAt = Date.now();
    rulesStore.set(id, rule);
    persistRuleToDb(rule).catch(console.error);
    console.log(`[signalRules] Updated rule: ${id}`);
    return res.json(rule);
  } catch (err) {
    console.error('[signalRules/PUT]', err);
    return res.status(500).json({ error: 'Failed to update rule' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rule = rulesStore.get(id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    if (rule.isDefault) return res.status(403).json({ error: 'Cannot delete default rule' });
    if (rule.isActive) {
      const defaultRule = rulesStore.get('default');
      if (defaultRule) {
        defaultRule.isActive = true;
        rulesStore.set('default', defaultRule);
        persistRuleToDb(defaultRule).catch(console.error);
      }
    }
    rulesStore.delete(id);
    deleteRuleFromDb(id).catch(console.error);
    console.log(`[signalRules] Deleted rule: ${id}`);
    return res.json({ message: 'Rule deleted', id });
  } catch (err) {
    console.error('[signalRules/DELETE]', err);
    return res.status(500).json({ error: 'Failed to delete rule' });
  }
});

router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rule = rulesStore.get(id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    rulesStore.forEach((r) => { r.isActive = r.id === id; });
    await deactivateAllInDb();
    rule.isActive = true;
    await persistRuleToDb(rule);
    console.log(`[signalRules] Activated rule: ${id} - ${rule.name}`);
    return res.json({ message: 'Rule activated', rule });
  } catch (err) {
    console.error('[signalRules/activate]', err);
    return res.status(500).json({ error: 'Failed to activate rule' });
  }
});

/**
 * POST /api/signal-rules/test
 * Tests a script using real 台積電 (2330.TW) market data.
 * Falls back to sample data if Yahoo Finance is unavailable.
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { script, marketData: providedData } = req.body;
    if (!script) return res.status(400).json({ error: 'Script is required' });
    const validation = validateScript(script);
    if (!validation.valid) return res.status(400).json({ error: validation.error });

    let testData: Record<string, unknown>;
    let marketDataSource: 'real' | 'sample' = 'sample';
    let testSymbol = 'SAMPLE';

    if (providedData) {
      testData = providedData as Record<string, unknown>;
    } else {
      try {
        const kline = await fetchRealKline('2330.TW', '1d', 60);
        if (kline.length < 26) throw new Error('Insufficient kline data');

        const closes = kline.map((k) => k.c);
        const volumes = kline.map((k) => k.v);

        const rsiArr = RSI.calculate({ values: closes, period: 14 });
        const rsi = rsiArr[rsiArr.length - 1] ?? 50;

        const macdArr = MACD.calculate({
          values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
          SimpleMAOscillator: false, SimpleMASignal: false,
        });
        const macdNow = macdArr[macdArr.length - 1];

        const sma20Arr = SMA.calculate({ values: closes, period: 20 });
        const sma20 = sma20Arr[sma20Arr.length - 1] ?? closes[closes.length - 1];

        const bbArr = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
        const bb = bbArr[bbArr.length - 1];

        testData = {
          symbol: '2330',
          prices: closes,
          volumes,
          rsi,
          macd: macdNow?.MACD ?? 0,
          macd_signal: macdNow?.signal ?? 0,
          sma20,
          bb_upper: bb?.upper ?? closes[closes.length - 1] * 1.05,
          bb_lower: bb?.lower ?? closes[closes.length - 1] * 0.95,
        };
        marketDataSource = 'real';
        testSymbol = '2330';
        console.log(`[signalRules/test] Real data: 2330.TW RSI=${rsi.toFixed(1)} SMA20=${sma20.toFixed(1)}`);
      } catch (_fetchErr) {
        testData = {
          symbol: 'TEST',
          prices: [100, 101, 102, 103, 104, 105, 106, 107, 108, 109],
          volumes: [1000, 1100, 1050, 1200, 1150, 1300, 1250, 1400, 1350, 1500],
          rsi: 65, macd: 0.5, macd_signal: 0.4, sma20: 105, bb_upper: 110, bb_lower: 100,
        };
        console.log('[signalRules/test] Using sample data (real fetch failed)');
      }
    }

    const result = await executeScriptWithData(script, testData);
    console.log(`[signalRules/test] signal=${result.signal} confidence=${result.confidence} source=${marketDataSource}`);
    return res.json({ ...result, testSymbol, marketDataSource });
  } catch (err) {
    console.error('[signalRules/test]', err);
    return res.status(500).json({
      error: 'Failed to test script',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
