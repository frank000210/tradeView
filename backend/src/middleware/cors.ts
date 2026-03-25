import cors from 'cors';

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://tradeview-frank.zeabur.app',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // 允許無 origin（如 Postman、curl）
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
