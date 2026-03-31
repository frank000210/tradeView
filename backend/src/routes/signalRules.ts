import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// Environment configuration
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

// Initialize with default rule
rulesStore.set('default', DEFAULT_RULE);

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
  // Basic validation - check for required variables
  const requiredVars = ['signal', 'confidence', 'conditions'];
  const missing = requiredVars.filter((v) => !script.includes(v));
  if (missing.length > 0) {
    return {
      valid: false,
      error: `Script must define: ${missing.join(', ')}`,
    };
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
    const response = await axios.post(`${NEWS_CHECKER_URL}/api/execute-rule`, {
      script,
      marketData,
    });

    return response.data;
  } catch (error) {
    console.error('[signalRules] execute script error:', error);
    throw new Error(
      `Failed to execute script: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// -------- Routes --------

/**
 * GET /api/signal-rules
 * List all signal rules
 */
router.get('/', (_req: Request, res: Response) => {
  const rules = Array.from(rulesStore.values());
  return res.json({
    rules,
    activeRule: rules.find((r) => r.isActive),
  });
});

/**
 * POST /api/signal-rules
 * Create a new signal rule
 */
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

    console.log(`[signalRules] Created rule: ${newRule.id} - ${newRule.name}`);
    return res.status(201).json(newRule);
  } catch (err) {
    console.error('[signalRules/POST]', err);
    return res.status(500).json({ error: 'Failed to create rule' });
  }
});

/**
 * PUT /api/signal-rules/:id
 * Update a signal rule
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, script } = req.body;

    const rule = rulesStore.get(id);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    if (rule.isDefault) {
      return res.status(403).json({ error: 'Cannot modify default rule' });
    }

    if (script && script !== rule.script) {
      const validation = validateScript(script);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      rule.script = script;
    }

    if (name) rule.name = name.trim();
    if (description !== undefined) rule.description = description;
    rule.updatedAt = Date.now();

    rulesStore.set(id, rule);

    console.log(`[signalRules] Updated rule: ${id}`);
    return res.json(rule);
  } catch (err) {
    console.error('[signalRules/PUT]', err);
    return res.status(500).json({ error: 'Failed to update rule' });
  }
});

/**
 * DELETE /api/signal-rules/:id
 * Delete a signal rule (cannot delete default)
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const rule = rulesStore.get(id);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    if (rule.isDefault) {
      return res.status(403).json({ error: 'Cannot delete default rule' });
    }

    // If deleting the active rule, deactivate it
    if (rule.isActive) {
      rule.isActive = false;
      const defaultRule = rulesStore.get('default');
      if (defaultRule) {
        defaultRule.isActive = true;
        rulesStore.set('default', defaultRule);
      }
    }

    rulesStore.delete(id);

    console.log(`[signalRules] Deleted rule: ${id}`);
    return res.json({ message: 'Rule deleted', id });
  } catch (err) {
    console.error('[signalRules/DELETE]', err);
    return res.status(500).json({ error: 'Failed to delete rule' });
  }
});

/**
 * POST /api/signal-rules/:id/activate
 * Set a rule as the active rule (only one active at a time)
 */
router.post('/:id/activate', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const rule = rulesStore.get(id);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    // Deactivate all other rules
    rulesStore.forEach((r) => {
      if (r.id !== id && r.isActive) {
        r.isActive = false;
        rulesStore.set(r.id, r);
      }
    });

    // Activate the specified rule
    rule.isActive = true;
    rulesStore.set(id, rule);

    console.log(`[signalRules] Activated rule: ${id} - ${rule.name}`);
    return res.json({ message: 'Rule activated', rule });
  } catch (err) {
    console.error('[signalRules/activate]', err);
    return res.status(500).json({ error: 'Failed to activate rule' });
  }
});

/**
 * POST /api/signal-rules/test
 * Test a script without saving
 * Body: { script: string, marketData?: object }
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { script, marketData } = req.body;

    if (!script) {
      return res.status(400).json({ error: 'Script is required' });
    }

    const validation = validateScript(script);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Use provided market data or sample data
    const testData = marketData || {
      symbol: 'TEST',
      prices: [100, 101, 102, 103, 104, 105, 106, 107, 108, 109],
      volumes: [1000, 1100, 1050, 1200, 1150, 1300, 1250, 1400, 1350, 1500],
      rsi: 65,
      macd: 0.5,
      macd_signal: 0.4,
      sma20: 105,
      bb_upper: 110,
      bb_lower: 100,
    };

    const result = await executeScriptWithData(script, testData);

    console.log(`[signalRules] Test result: signal=${result.signal}, confidence=${result.confidence}`);
    return res.json(result);
  } catch (err) {
    console.error('[signalRules/test]', err);
    return res.status(500).json({
      error: 'Failed to test script',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
