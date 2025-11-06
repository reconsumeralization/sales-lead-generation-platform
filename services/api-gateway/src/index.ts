import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/api-gateway.log' })
  ]
});

// Redis client for caching and rate limiting
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.connect().catch(console.error);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Authentication middleware
const authenticateToken = async (req: any, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Check if token is blacklisted
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Service proxy configurations
const serviceProxies = {
  '/api/v1/leads': {
    target: 'http://lead-scoring:3001',
    changeOrigin: true,
    pathRewrite: { '^/api/v1/leads': '/api/v1' }
  },
  '/api/v1/outreach': {
    target: 'http://outreach-generation:3002',
    changeOrigin: true,
    pathRewrite: { '^/api/v1/outreach': '/api/v1' }
  },
  '/api/v1/deals': {
    target: 'http://deal-intelligence:3003',
    changeOrigin: true,
    pathRewrite: { '^/api/v1/deals': '/api/v1' }
  },
  '/api/v1/crm': {
    target: 'http://crm-sync:3004',
    changeOrigin: true,
    pathRewrite: { '^/api/v1/crm': '/api/v1' }
  },
  '/api/v1/compliance': {
    target: 'http://compliance:3005',
    changeOrigin: true,
    pathRewrite: { '^/api/v1/compliance': '/api/v1' }
  },
  '/api/v1/analytics': {
    target: 'http://analytics:3006',
    changeOrigin: true,
    pathRewrite: { '^/api/v1/analytics': '/api/v1' }
  }
};

// Apply authentication to all API routes except health and auth
app.use('/api/v1', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/auth/')) {
    return next();
  }
  return authenticateToken(req, res, next);
});

// Setup service proxies
Object.entries(serviceProxies).forEach(([path, config]) => {
  app.use(path, createProxyMiddleware({
    ...config,
    onError: (err: any, req: express.Request, res: express.Response) => {
      logger.error(`Proxy error for ${path}:`, err);
      res.status(502).json({ error: 'Service temporarily unavailable' });
    },
    onProxyReq: (proxyReq: any, req: any, res: express.Response) => {
      // Add user context to proxied requests
      if (req.user) {
        proxyReq.setHeader('X-User-ID', req.user.userId);
        proxyReq.setHeader('X-User-Role', req.user.role);
      }
    }
  }));
});

// Authentication endpoints
app.post('/api/v1/auth/login', async (req: express.Request, res: express.Response) => {
  try {
    const { email, password } = req.body;

    // TODO: Implement actual authentication logic
    // For now, return a mock token
    const token = jwt.sign(
      { userId: '123', email, role: 'user' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: '123', email, role: 'user' }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/v1/auth/logout', authenticateToken, async (req: any, res: express.Response) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    if (token) {
      // Add token to blacklist
      await redis.setEx(`blacklist:${token}`, 24 * 60 * 60, 'true');
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
});

export default app;