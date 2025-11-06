import express from 'express';
import { Pool } from 'pg';
import { Kafka } from 'kafkajs';
import winston from 'winston';
import dotenv from 'dotenv';
import Joi from 'joi';
import cron from 'node-cron';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/compliance.log' })
  ]
});

// Database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/sales_platform'
});

// Kafka setup
const kafka = new Kafka({
  clientId: 'compliance-service',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092']
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'compliance-group' });

// Middleware
app.use(express.json({ limit: '10mb' }));

// Request validation schemas
const consentSchema = Joi.object({
  contact_id: Joi.string().required(),
  consent_type: Joi.string().valid('email', 'phone', 'data_processing').required(),
  granted: Joi.boolean().required(),
  source: Joi.string().required(),
  ip_address: Joi.string().optional(),
  user_agent: Joi.string().optional()
});

const optOutSchema = Joi.object({
  contact_id: Joi.string().required(),
  opt_out_type: Joi.string().valid('email', 'phone', 'all_communications').required(),
  reason: Joi.string().optional(),
  source: Joi.string().required()
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'compliance',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Record consent
app.post('/api/v1/consent', async (req, res) => {
  try {
    const { error, value } = consentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.details.map(d => d.message)
      });
    }

    const { contact_id, consent_type, granted, source, ip_address, user_agent } = value;

    // Record consent in database
    const result = await db.query(
      `INSERT INTO consent_records (contact_id, consent_type, granted, source, 
       ip_address, user_agent, recorded_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
      [contact_id, consent_type, granted, source, ip_address, user_agent]
    );

    // Update contact's consent status
    await db.query(
      `INSERT INTO contact_consent_status (contact_id, consent_type, status, last_updated) 
       VALUES ($1, $2, $3, NOW()) 
       ON CONFLICT (contact_id, consent_type) 
       DO UPDATE SET status = $3, last_updated = NOW()`,
      [contact_id, consent_type, granted ? 'granted' : 'revoked']
    );

    // Publish consent event
    await producer.send({
      topic: 'compliance-events',
      messages: [{
        key: contact_id,
        value: JSON.stringify({
          event_type: 'consent_recorded',
          contact_id,
          consent_type,
          granted,
          timestamp: new Date().toISOString()
        })
      }]
    });

    res.json({
      consent_id: result.rows[0].id,
      contact_id,
      consent_type,
      granted,
      recorded_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Consent recording error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Process opt-out request
app.post('/api/v1/opt-out', async (req, res) => {
  try {
    const { error, value } = optOutSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.details.map(d => d.message)
      });
    }

    const { contact_id, opt_out_type, reason, source } = value;

    // Record opt-out request
    const result = await db.query(
      `INSERT INTO opt_out_requests (contact_id, opt_out_type, reason, source, 
       status, requested_at) 
       VALUES ($1, $2, $3, $4, 'processing', NOW()) RETURNING id`,
      [contact_id, opt_out_type, reason, source]
    );

    const optOutId = result.rows[0].id;

    // Process opt-out immediately
    await processOptOut(optOutId, contact_id, opt_out_type);

    res.json({
      opt_out_id: optOutId,
      contact_id,
      opt_out_type,
      status: 'processing',
      estimated_completion: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    });

  } catch (error) {
    logger.error('Opt-out processing error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get compliance status for contact
app.get('/api/v1/compliance/:contact_id', async (req, res) => {
  try {
    const { contact_id } = req.params;

    // Get consent status
    const consentResult = await db.query(
      'SELECT consent_type, status, last_updated FROM contact_consent_status WHERE contact_id = $1',
      [contact_id]
    );

    // Get opt-out status
    const optOutResult = await db.query(
      `SELECT opt_out_type, status, requested_at, completed_at 
       FROM opt_out_requests WHERE contact_id = $1 
       ORDER BY requested_at DESC`,
      [contact_id]
    );

    // Get data retention info
    const retentionResult = await db.query(
      `SELECT data_type, retention_period, expires_at 
       FROM data_retention WHERE contact_id = $1`,
      [contact_id]
    );

    res.json({
      contact_id,
      consent_status: consentResult.rows,
      opt_out_requests: optOutResult.rows,
      data_retention: retentionResult.rows,
      compliance_score: calculateComplianceScore(consentResult.rows, optOutResult.rows),
      last_updated: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Get compliance status error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate compliance report
app.get('/api/v1/reports/compliance', async (req, res) => {
  try {
    const startDate = req.query.start_date as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = req.query.end_date as string || new Date().toISOString();

    // Consent metrics
    const consentMetrics = await db.query(
      `SELECT consent_type, 
              COUNT(*) as total_requests,
              COUNT(*) FILTER (WHERE granted = true) as granted,
              COUNT(*) FILTER (WHERE granted = false) as revoked
       FROM consent_records 
       WHERE recorded_at BETWEEN $1 AND $2 
       GROUP BY consent_type`,
      [startDate, endDate]
    );

    // Opt-out metrics
    const optOutMetrics = await db.query(
      `SELECT opt_out_type,
              COUNT(*) as total_requests,
              COUNT(*) FILTER (WHERE status = 'completed') as completed,
              COUNT(*) FILTER (WHERE status = 'processing') as processing,
              AVG(EXTRACT(EPOCH FROM (completed_at - requested_at))/3600) as avg_completion_hours
       FROM opt_out_requests 
       WHERE requested_at BETWEEN $1 AND $2 
       GROUP BY opt_out_type`,
      [startDate, endDate]
    );

    // Data retention metrics
    const retentionMetrics = await db.query(
      `SELECT data_type,
              COUNT(*) as total_records,
              COUNT(*) FILTER (WHERE expires_at < NOW()) as expired,
              COUNT(*) FILTER (WHERE expires_at > NOW()) as active
       FROM data_retention 
       GROUP BY data_type`
    );

    // Compliance violations
    const violations = await db.query(
      `SELECT violation_type, severity, COUNT(*) as count
       FROM compliance_violations 
       WHERE detected_at BETWEEN $1 AND $2 
       GROUP BY violation_type, severity 
       ORDER BY severity DESC, count DESC`,
      [startDate, endDate]
    );

    res.json({
      report_period: { start_date: startDate, end_date: endDate },
      consent_metrics: consentMetrics.rows,
      opt_out_metrics: optOutMetrics.rows,
      data_retention_metrics: retentionMetrics.rows,
      compliance_violations: violations.rows,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Compliance report error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper functions
async function processOptOut(optOutId: number, contactId: string, optOutType: string) {
  try {
    // Update consent status
    if (optOutType === 'email' || optOutType === 'all_communications') {
      await db.query(
        `UPDATE contact_consent_status 
         SET status = 'revoked', last_updated = NOW() 
         WHERE contact_id = $1 AND consent_type = 'email'`,
        [contactId]
      );
    }

    if (optOutType === 'phone' || optOutType === 'all_communications') {
      await db.query(
        `UPDATE contact_consent_status 
         SET status = 'revoked', last_updated = NOW() 
         WHERE contact_id = $1 AND consent_type = 'phone'`,
        [contactId]
      );
    }

    // Stop active campaigns
    await producer.send({
      topic: 'campaign-events',
      messages: [{
        key: contactId,
        value: JSON.stringify({
          event_type: 'contact_opted_out',
          contact_id: contactId,
          opt_out_type: optOutType,
          timestamp: new Date().toISOString()
        })
      }]
    });

    // Mark opt-out as completed
    await db.query(
      'UPDATE opt_out_requests SET status = $1, completed_at = NOW() WHERE id = $2',
      ['completed', optOutId]
    );

    logger.info(`Opt-out processed successfully for contact ${contactId}`);

  } catch (error) {
    logger.error(`Failed to process opt-out ${optOutId}:`, error);
    
    await db.query(
      'UPDATE opt_out_requests SET status = $1, error_message = $2 WHERE id = $3',
      ['failed', error instanceof Error ? error.message : 'Unknown error', optOutId]
    );
  }
}

function calculateComplianceScore(consentRecords: any[], optOutRecords: any[]): number {
  let score = 100;

  // Deduct points for missing consent
  const requiredConsents = ['email', 'data_processing'];
  const grantedConsents = consentRecords.filter(c => c.status === 'granted').map(c => c.consent_type);
  
  for (const required of requiredConsents) {
    if (!grantedConsents.includes(required)) {
      score -= 25;
    }
  }

  // Deduct points for pending opt-out requests
  const pendingOptOuts = optOutRecords.filter(o => o.status === 'processing');
  score -= pendingOptOuts.length * 10;

  return Math.max(0, score);
}

// Schedule data retention cleanup
cron.schedule('0 2 * * *', async () => {
  logger.info('Running data retention cleanup');
  
  try {
    // Find expired data
    const expiredData = await db.query(
      'SELECT * FROM data_retention WHERE expires_at < NOW() AND status = $1',
      ['active']
    );

    for (const record of expiredData.rows) {
      try {
        // Delete expired data based on type
        await deleteExpiredData(record.contact_id, record.data_type);
        
        // Mark as purged
        await db.query(
          'UPDATE data_retention SET status = $1, purged_at = NOW() WHERE id = $2',
          ['purged', record.id]
        );

        logger.info(`Purged expired ${record.data_type} data for contact ${record.contact_id}`);
      } catch (error) {
        logger.error(`Failed to purge data for record ${record.id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Data retention cleanup error:', error);
  }
});

async function deleteExpiredData(contactId: string, dataType: string) {
  switch (dataType) {
    case 'contact_data':
      await db.query('DELETE FROM contacts WHERE id = $1', [contactId]);
      break;
    case 'activity_logs':
      await db.query('DELETE FROM activity_logs WHERE contact_id = $1', [contactId]);
      break;
    case 'message_history':
      await db.query('DELETE FROM messages WHERE prospect_id = $1', [contactId]);
      break;
    default:
      logger.warn(`Unknown data type for deletion: ${dataType}`);
  }
}

// Initialize Kafka
async function initKafka() {
  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topic: 'user-events' });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const event = JSON.parse(message.value?.toString() || '{}');
        
        if (event.event_type === 'contact_created') {
          // Set up data retention schedule for new contacts
          await setupDataRetention(event.contact_id);
        }
      } catch (error) {
        logger.error('Kafka message processing error:', error);
      }
    }
  });

  logger.info('Kafka consumer connected');
}

async function setupDataRetention(contactId: string) {
  const retentionPeriods = [
    { data_type: 'contact_data', years: 7 },
    { data_type: 'activity_logs', years: 3 },
    { data_type: 'message_history', years: 2 }
  ];

  for (const retention of retentionPeriods) {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + retention.years);

    await db.query(
      `INSERT INTO data_retention (contact_id, data_type, retention_period, expires_at, status) 
       VALUES ($1, $2, $3, $4, 'active')`,
      [contactId, retention.data_type, `${retention.years} years`, expiresAt]
    );
  }
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
    await db.end();
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

app.listen(PORT, async () => {
  logger.info(`Compliance Service running on port ${PORT}`);
  await initKafka();
});

export default app;