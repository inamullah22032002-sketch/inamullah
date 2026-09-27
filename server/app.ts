import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { authRouter } from './auth/routes';
import { moviesRouter } from './movies/routes';
import { uploadsRouter } from './uploads/routes';
import { adminRouter } from './admin/routes';

dotenv.config();

export const app = express();

// Path normalization middleware for Netlify Functions & proxy setups
app.use((req: Request, _res: Response, next: NextFunction) => {
  // If request hits /.netlify/functions/api/*, normalize to /api/*
  if (req.url.startsWith('/.netlify/functions/api')) {
    req.url = req.url.replace('/.netlify/functions/api', '/api') || '/api';
  }
  next();
});

// Request Correlation ID & Structured Logging Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const reqId = (req.headers['x-request-id'] as string) || crypto.randomUUID().slice(0, 8);
  req.headers['x-request-id'] = reqId;
  res.setHeader('X-Request-Id', reqId);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.startsWith('/@') && !req.path.includes('.vite')) {
      console.log(`[${new Date().toISOString()}] [${reqId}] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Security & Parsing
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint (Both /api/health and /health)
const healthHandler = (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    ok: true,
    service: 'FunclubSI API',
  });
};
app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

// Mount API Routers under /api
app.use('/api/auth', authRouter);
app.use('/api/movies', moviesRouter);
app.use('/api/admin/uploads', uploadsRouter);
app.use('/api/admin', adminRouter);

// Also mount routers without /api prefix for flexible serverless path routing
app.use('/auth', authRouter);
app.use('/movies', moviesRouter);
app.use('/admin/uploads', uploadsRouter);
app.use('/admin', adminRouter);

// Global API 404 Handler (Guarantees JSON error, NEVER returns HTML)
app.all(['/api/*', '/auth/*', '/movies/*', '/admin/*'], (_req: Request, res: Response) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Requested resource was not found.',
  });
});

// Global API Error Handler (Guarantees structured JSON)
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const reqId = req.headers['x-request-id'] || 'unknown';
  console.error(`[API Error] [${reqId}]`, err);

  const statusCode = err.status || err.statusCode || 500;
  const errorCode = err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR');

  res.status(statusCode).json({
    error: errorCode,
    message: err.message || 'An unexpected internal server error occurred.',
    requestId: reqId,
  });
});
