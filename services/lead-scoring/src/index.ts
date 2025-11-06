import express from 'express';
import { Pool } from 'pg';
import Redis from 'redis';
import { Kafka } from 'kafkajs';
import winston from 'winston';
import dotenv from 'dotenv';
import Joi from 'joi';
import LeadScoringService from './services/LeadScoringService';
import { Lead } from '../../../shared/models/Lead';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/lead-scoring.log' })
  ]
});

// Database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/sales_platform'
});

// Redis connection
const redis = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.connect().catch(console.error);

// Kafka setup
const kafka = new Kafka({
  clientId: 'lead-scoring-service',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092']
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'lead-scoring-group' });

// Initialize Lead Scoring Service
const leadScoringService = new LeadScoringService(db, redis, producer, logger);

// Middleware
app.use(express.json({ limit: '10mb' }));

// Request validation schemas
const scoreRequestSchema = Joi.object({
  lead_data: Joi.object().required(),
  icp_model_id: Joi.string().uuid().optional(),
  force_refresh: Joi.boolean().optional()
});

const batchScoreRequestSchema = Joi.object({
  leads: Joi.array().items(Joi.object()).min(1).max(100).required(),
  icp_model_id: Joi.string().uuid().optional()
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'lead-scoring',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Lead scoring endpoint
app.post('/api/v1/score', async (req, res) => {
  try {
    // Validate request
    const { error, value } = scoreRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.details.map(d => d.message)
      });
    }

    const result = await leadScoringService.scoreLead(value);
    
    res.json(result);
  } catch (error) {
    logger.error('Lead scoring error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Batch lead scoring endpoint
app.post('/api/v1/score/batch', async (req, res) => {
  try {
    const { error, value } = batchScoreRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.details.map(d => d.message)
      });
    }

    const results = await leadScoringService.batchScoreLeads(value.leads);
    
    res.json({
      total_processed: value.leads.length,
      successful_scores: results.length,
      results
    });
  } catch (error) {
    logger.error('Batch scoring error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get leads by score range
app.get('/api/v1/leads/by-score', async (req, res) => {
  try {
    const minScore = parseInt(req.query.min_score as string) || 0;
    const maxScore = parseInt(req.query.max_score as string) || 100;
    const limit = parseInt(req.query.limit as string) || 100;

    if (minScore < 0 || maxScore > 100 || minScore > maxScore) {
      return res.status(400).json({
        error: 'Invalid score range. Min and max must be between 0-100, and min <= max'
      });
    }

    const leads = await leadScoringService.getLeadsByScore(minScore, maxScore, limit);
    
    res.json({
      count: leads.length,
      leads
    });
  } catch (error) {
    logger.error('Get leads by score error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get scoring metrics
app.get('/api/v1/metrics', async (req, res) => {
  try {
    const timeRange = req.query.time_range as string || '24h';
    const validRanges = ['1h', '24h', '7d', '30d'];
    
    if (!validRanges.includes(timeRange)) {
      return res.status(400).json({
        error: 'Invalid time range. Must be one of: ' + validRanges.join(', ')
      });
    }

    const metrics = await leadScoringService.getScoringMetrics(timeRange);
    
    res.json(metrics);
  } catch (error) {
    logger.error('Get metrics error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update scoring criteria
app.put('/api/v1/criteria', async (req, res) => {
  try {
    const { criteria } = req.body;
    
    if (!Array.isArray(criteria)) {
      return res.status(400).json({
        error: 'Criteria must be an array'
      });
    }

    await leadScoringService.updateScoringCriteria(criteria);
    
    res.json({
      message: 'Scoring criteria updated successfully',
      criteria_count: criteria.length
    });
  } catch (error) {
    logger.error('Update criteria error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Initialize Kafka
async function initKafka() {
  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topic: 'lead-events' });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const event = JSON.parse(message.value?.toString() || '{}');
        logger.info('Received Kafka message:', {
          topic,
          partition,
          offset: message.offset,
          event_type: event.event_type
        });

        // Handle different event types
        if (event.event_type === 'lead_created' || event.event_type === 'lead_updated') {
          // Auto-score new or updated leads
          if (event.lead_data) {
            await leadScoringService.scoreLead({ lead_data: event.lead_data });
          }
        }
      } catch (error) {
        logger.error('Kafka message processing error:', error);
      }
    }
  });
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  try {
    await producer.disconnect();
    await consumer.disconnect();
    await redis.disconnect();
    await db.end();
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

app.listen(PORT, async () => {
  logger.info(`Lead Scoring Service running on port ${PORT}`);
  await initKafka();
});

export default app;