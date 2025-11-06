import express from 'express';
import { Pool } from 'pg';
import { Kafka } from 'kafkajs';
import winston from 'winston';
import dotenv from 'dotenv';
import Joi from 'joi';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/outreach-generation.log' })
  ]
});

// Database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/sales_platform'
});

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Kafka setup
const kafka = new Kafka({
  clientId: 'outreach-generation-service',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092']
});

const producer = kafka.producer();

// Middleware
app.use(express.json({ limit: '10mb' }));

// Request validation schemas
const generateMessageSchema = Joi.object({
  prospect: Joi.object().required(),
  sequence_type: Joi.string().valid('email', 'linkedin').required(),
  brand_profile: Joi.string().optional(),
  message_type: Joi.string().valid('initial', 'follow_up', 'final').optional()
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'outreach-generation',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Generate outreach message
app.post('/api/v1/generate', async (req, res) => {
  try {
    const { error, value } = generateMessageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.details.map(d => d.message)
      });
    }

    const { prospect, sequence_type, brand_profile = 'professional', message_type = 'initial' } = value;

    // Generate personalized message using OpenAI
    const prompt = `Generate a ${sequence_type} ${message_type} outreach message for:
Company: ${prospect.company?.name || 'Unknown'}
Contact: ${prospect.contact?.name || 'Unknown'}
Role: ${prospect.contact?.title || 'Unknown'}
Industry: ${prospect.company?.industry || 'Unknown'}

Brand tone: ${brand_profile}
Keep it concise, personalized, and professional.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.7
    });

    const generatedMessage = completion.choices[0]?.message?.content || '';

    // Store message in database
    const result = await db.query(
      `INSERT INTO messages (prospect_id, sequence_type, message_type, content, generated_at) 
       VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
      [prospect.id, sequence_type, message_type, generatedMessage]
    );

    res.json({
      message_id: result.rows[0].id,
      content: generatedMessage,
      sequence_type,
      message_type,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Message generation error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate sequence
app.post('/api/v1/sequence', async (req, res) => {
  try {
    const { prospect, sequence_config } = req.body;
    
    if (!prospect || !sequence_config) {
      return res.status(400).json({
        error: 'Prospect and sequence_config are required'
      });
    }

    const messages = [];
    const messageTypes = ['initial', 'follow_up', 'final'];

    for (const messageType of messageTypes) {
      const prompt = `Generate a ${sequence_config.channel} ${messageType} message for:
Company: ${prospect.company?.name || 'Unknown'}
Contact: ${prospect.contact?.name || 'Unknown'}
Role: ${prospect.contact?.title || 'Unknown'}

This is part of a sequence. Make it ${messageType === 'initial' ? 'engaging and introductory' : 
messageType === 'follow_up' ? 'value-focused and helpful' : 'final attempt with urgency'}.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 250,
        temperature: 0.7
      });

      messages.push({
        type: messageType,
        content: completion.choices[0]?.message?.content || '',
        delay_days: messageType === 'initial' ? 0 : messageType === 'follow_up' ? 3 : 7
      });
    }

    res.json({
      sequence_id: `seq_${Date.now()}`,
      prospect_id: prospect.id,
      channel: sequence_config.channel,
      messages,
      created_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Sequence generation error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Initialize Kafka
async function initKafka() {
  await producer.connect();
  logger.info('Kafka producer connected');
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
    await db.end();
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

app.listen(PORT, async () => {
  logger.info(`Outreach Generation Service running on port ${PORT}`);
  await initKafka();
});

export default app;