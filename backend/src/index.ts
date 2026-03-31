import express from 'express';
import { corsMiddleware } from './middleware/cors';
import marketRouter from './routes/market';
import agentRouter from './routes/agent';
import riskRouter from './routes/risk';
import tradeRouter from './routes/trade';
import dataAgentRouter from './routes/dataAgent';
import signalRulesRouter from './routes/signalRules';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ── Middleware ────────────────────────────────────────────────
app.use(corsMiddleware);
app.use(express.json());

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api/market', marketRouter);
app.use('/api/agent', agentRouter);
app.use('/api/risk', riskRouter);
app.use('/api/trade', tradeRouter);
app.use('/api/data-agent', dataAgentRouter);
app.use('/api/signal-rules', signalRulesRouter);

// ── 404 handler ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: '找不到此路由' });
});

// ── Global error handler ──────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err.message);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message || '伺服器發生錯誤',
  });
});

// ── Start server ──────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ TradeView Backend running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   API:    http://localhost:${PORT}/api`);
});
