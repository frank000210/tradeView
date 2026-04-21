import { useCallback, useEffect, useState } from 'react';
import {
  Code2,
  Plus,
  Trash2,
  CheckCircle2,
  Play,
  Save,
  RefreshCw,
  ChevronRight,
  Star,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  fetchSignalRules,
  createSignalRule,
  updateSignalRule,
  deleteSignalRule,
  activateSignalRule,
  testSignalRule,
} from '../api/client';
import type { SignalRule } from '../types/api';
import { clsx } from 'clsx';

const NEW_RULE_TEMPLATE = `# 自訂信號規則
# 可用變數: prices(list), volumes(list), rsi(float), macd(float),
#           macd_signal(float), sma20(float), bb_upper(float), bb_lower(float), symbol(str)
# 必須設定: signal("BUY"/"SELL"/"HOLD"), confidence(0-1), conditions(list), reasoning(str)

conditions = []

latest_price = prices[-1] if prices else 0

# RSI 條件
if rsi < 30:
    conditions.append({"name": "RSI 深度超賣 (< 30)", "met": True, "value": f"RSI = {rsi:.1f}"})
    signal = "BUY"
    confidence = 0.75
elif rsi > 70:
    conditions.append({"name": "RSI 深度超買 (> 70)", "met": True, "value": f"RSI = {rsi:.1f}"})
    signal = "SELL"
    confidence = 0.75
else:
    conditions.append({"name": "RSI 正常區間", "met": False, "value": f"RSI = {rsi:.1f}"})
    signal = "HOLD"
    confidence = 0.55

# MACD 條件
if macd > macd_signal:
    conditions.append({"name": "MACD 多頭", "met": True, "value": f"MACD={macd:.3f}"})
    if signal != "SELL":
        confidence += 0.10
else:
    conditions.append({"name": "MACD 空頭", "met": True, "value": f"MACD={macd:.3f}"})
    if signal != "BUY":
        confidence += 0.08

confidence = min(0.97, max(0.51, confidence))
reasoning = f"觸發條件：{', '.join([c['name'] for c in conditions if c['met']])}"
`;

interface TestResult {
  signal: string;
  confidence: number;
  conditions: Array<{ name: string; met: boolean; value: string }>;
  reasoning: string;
}

export function SignalRules() {
  const [rules, setRules] = useState<SignalRule[]>([]);
  const [activeRuleId, setActiveRuleId] = useState<string>('default');
  const [selectedId, setSelectedId] = useState<string>('default');
  const [editingRule, setEditingRule] = useState<SignalRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchSignalRules();
      setRules(data.rules);
      if (data.activeRule) setActiveRuleId(data.activeRule.id);
      // Select active rule by default
      const sel = data.activeRule?.id || data.rules[0]?.id || 'default';
      setSelectedId(sel);
      const selRule = data.rules.find((r) => r.id === sel);
      if (selRule) setEditingRule({ ...selRule });
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSelectRule = (rule: SignalRule) => {
    setSelectedId(rule.id);
    setEditingRule({ ...rule });
    setTestResult(null);
    setTestError(null);
  };

  const handleSave = async () => {
    if (!editingRule || editingRule.isDefault) return;
    setSaving(true);
    try {
      const updated = await updateSignalRule(editingRule.id, {
        name: editingRule.name,
        description: editingRule.description,
        script: editingRule.script,
      });
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditingRule({ ...updated });
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activateSignalRule(id);
      setActiveRuleId(id);
      setRules((prev) => prev.map((r) => ({ ...r, isActive: r.id === id })));
    } catch (e) {
      setError(e instanceof Error ? e.message : '啟用失敗');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('確定刪除此規則？')) return;
    try {
      await deleteSignalRule(id);
      const remaining = rules.filter((r) => r.id !== id);
      setRules(remaining);
      if (selectedId === id) {
        const next = remaining[0];
        if (next) handleSelectRule(next);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '刪除失敗');
    }
  };

  const handleTest = async () => {
    if (!editingRule) return;
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const result = await testSignalRule(editingRule.script);
      setTestResult(result);
    } catch (e) {
      setTestError(e instanceof Error ? e.message : '測試失敗');
    } finally {
      setTesting(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const created = await createSignalRule({
        name: newName.trim(),
        description: newDesc.trim(),
        script: NEW_RULE_TEMPLATE,
      });
      setRules((prev) => [...prev, created]);
      setIsCreating(false);
      setNewName('');
      setNewDesc('');
      handleSelectRule(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : '建立失敗');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#6b7280]">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span>載入信號規則…</span>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)] fade-in">
      {/* ── Left Panel: Rule List ── */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Code2 size={16} className="text-blue-400" />
            信號規則管理
          </h2>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Plus size={12} /> 新增
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 border border-red-500/30 rounded-lg px-3 py-2">
            <AlertCircle size={12} />
            {error}
          </div>
        )}

        {/* Create Form */}
        {isCreating && (
          <div className="bg-[#111827] border border-blue-500/30 rounded-xl p-3 space-y-2">
            <p className="text-xs text-[#9ca3af] font-medium">新增規則</p>
            <input
              className="w-full bg-[#0d1117] border border-[#1f2937] rounded-lg px-3 py-1.5 text-sm text-white placeholder-[#4b5563] focus:outline-none focus:border-blue-500"
              placeholder="規則名稱 *"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="w-full bg-[#0d1117] border border-[#1f2937] rounded-lg px-3 py-1.5 text-sm text-white placeholder-[#4b5563] focus:outline-none focus:border-blue-500"
              placeholder="規則說明（選填）"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || saving}
                className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                建立
              </button>
              <button
                onClick={() => { setIsCreating(false); setNewName(''); setNewDesc(''); }}
                className="text-xs px-3 py-1.5 bg-[#1f2937] hover:bg-[#374151] text-[#9ca3af] rounded-lg transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* Rule List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {rules.map((rule) => {
            const isSelected = selectedId === rule.id;
            const isActive = activeRuleId === rule.id;
            return (
              <button
                key={rule.id}
                onClick={() => handleSelectRule(rule)}
                className={clsx(
                  'w-full text-left bg-[#111827] border rounded-xl p-3 transition-all group relative',
                  isSelected
                    ? 'border-blue-500/50 bg-[#1a2235]'
                    : 'border-[#1f2937] hover:border-[#374151]'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {isActive && (
                        <Star size={10} className="text-yellow-400 flex-shrink-0 fill-yellow-400" />
                      )}
                      <span className={clsx('text-sm font-medium truncate', isSelected ? 'text-white' : 'text-[#d1d5db]')}>
                        {rule.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#6b7280] truncate">{rule.description || '無說明'}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {rule.isDefault && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-[#1f2937] text-[#6b7280] rounded-full">內建</span>
                      )}
                      {isActive && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded-full border border-yellow-500/20">使用中</span>
                      )}
                    </div>
                  </div>
                  {isSelected && <ChevronRight size={14} className="text-blue-400 flex-shrink-0 mt-1" />}
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={load}
          className="flex items-center justify-center gap-1.5 text-xs py-2 bg-[#1f2937] hover:bg-[#374151] text-[#9ca3af] rounded-lg transition-colors"
        >
          <RefreshCw size={12} /> 重新整理
        </button>
      </div>

      {/* ── Right Panel: Editor ── */}
      {editingRule ? (
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              {editingRule.isDefault ? (
                <h3 className="text-base font-semibold text-white">{editingRule.name}</h3>
              ) : (
                <input
                  className="bg-transparent border-b border-[#374151] focus:border-blue-500 outline-none text-base font-semibold text-white pb-0.5"
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                />
              )}
              <p className="text-xs text-[#6b7280] mt-0.5">
                {editingRule.isDefault ? editingRule.description : (
                  <input
                    className="bg-transparent focus:outline-none text-xs text-[#6b7280] w-full"
                    placeholder="規則說明…"
                    value={editingRule.description}
                    onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                  />
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {activeRuleId !== editingRule.id && (
                <button
                  onClick={() => handleActivate(editingRule.id)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg transition-colors"
                >
                  <Star size={12} /> 設為使用中
                </button>
              )}
              {activeRuleId === editingRule.id && (
                <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 text-yellow-400 border border-yellow-500/30 rounded-lg">
                  <Star size={12} className="fill-yellow-400" /> 使用中
                </span>
              )}
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg transition-colors disabled:opacity-50"
              >
                {testing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                測試
              </button>
              {!editingRule.isDefault && (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    儲存
                  </button>
                  <button
                    onClick={() => handleDelete(editingRule.id)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Script Editor */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#0d1117] border border-[#1f2937] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1f2937] bg-[#111827]">
              <Code2 size={12} className="text-blue-400" />
              <span className="text-xs text-[#6b7280]">Python 腳本</span>
              {editingRule.isDefault && (
                <span className="text-[10px] px-1.5 py-0.5 bg-[#1f2937] text-[#6b7280] rounded ml-auto">唯讀</span>
              )}
            </div>
            <textarea
              className="flex-1 w-full bg-[#0d1117] text-[#e2e8f0] text-xs font-mono p-4 focus:outline-none resize-none leading-relaxed"
              value={editingRule.script}
              readOnly={editingRule.isDefault}
              onChange={(e) => !editingRule.isDefault && setEditingRule({ ...editingRule, script: e.target.value })}
              spellCheck={false}
              style={{ minHeight: '280px' }}
            />
          </div>

          {/* Test Result */}
          {(testResult || testError) && (
            <div className={clsx(
              'bg-[#111827] border rounded-xl p-4',
              testError ? 'border-red-500/30' : 'border-[#1f2937]'
            )}>
              {testError ? (
                <div className="flex items-start gap-2 text-red-400 text-sm">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-xs mb-1">測試失敗</p>
                    <p className="text-xs text-red-300/70">{testError}</p>
                  </div>
                </div>
              ) : testResult ? (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle2 size={16} className="text-green-400" />
                    <span className="text-xs font-semibold text-white">測試結果</span>
                    <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full',
                      testResult.signal === 'BUY' ? 'bg-green-400/10 text-green-400' :
                      testResult.signal === 'SELL' ? 'bg-red-400/10 text-red-400' :
                      'bg-yellow-400/10 text-yellow-400'
                    )}>
                      {testResult.signal}
                    </span>
                    <span className="text-xs text-[#9ca3af]">
                      信心度 {(testResult.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  {testResult.reasoning && (
                    <p className="text-xs text-[#9ca3af] mb-3">{testResult.reasoning}</p>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
                    {testResult.conditions.map((c, i) => (
                      <div key={i} className={clsx(
                        'flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border',
                        c.met
                          ? 'bg-green-400/5 border-green-500/20 text-green-300'
                          : 'bg-[#0d1117] border-[#1f2937] text-[#6b7280]'
                      )}>
                        <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', c.met ? 'bg-green-400' : 'bg-[#374151]')} />
                        <span className="truncate">{c.name}</span>
                        <span className="ml-auto text-[10px] opacity-70 flex-shrink-0">{c.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Variable Reference */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-3">
            <p className="text-xs font-medium text-[#6b7280] mb-2">可用變數</p>
            <div className="flex flex-wrap gap-2">
              {['prices', 'volumes', 'rsi', 'macd', 'macd_signal', 'sma20', 'bb_upper', 'bb_lower', 'symbol'].map((v) => (
                <code key={v} className="text-[10px] px-2 py-0.5 bg-[#0d1117] text-blue-300 rounded border border-[#1f2937]">{v}</code>
              ))}
            </div>
            <p className="text-xs font-medium text-[#6b7280] mt-2 mb-1">必須輸出</p>
            <div className="flex flex-wrap gap-2">
              {['signal', 'confidence', 'conditions', 'reasoning'].map((v) => (
                <code key={v} className="text-[10px] px-2 py-0.5 bg-[#0d1117] text-purple-300 rounded border border-[#1f2937]">{v}</code>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[#6b7280]">
          <div className="text-center">
            <Code2 size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">請選擇左側規則</p>
          </div>
        </div>
      )}
    </div>
  );
}
