import express from 'express';
import { Pool } from 'pg';
import Redis from 'redis';
import { Kafka } from 'kafkajs';
import winston from 'winston';
import dotenv from 'dotenv';
import Joi from 'joi';
import axios from 'axios';
import cron from 'node-cron';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/crm-sync.log' })
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
  clientId: 'crm-sync-service',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092']
});

const producer = kafka.producer();

// Middleware
app.use(express.json({ limit: '10mb' }));

// Request validation schemas
const syncRequestSchema = Joi.object({
  crm_type: Joi.string().valid('salesforce', 'hubspot', 'pipedrive').required(),
  entity_type: Joi.string().valid('lead', 'contact', 'deal', 'company').required(),
  entity_id: Joi.string().required(),
  operation: Joi.string().valid('create', 'update', 'delete').required(),
  data: Joi.object().optional()
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'crm-sync',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Sync entity to CRM
app.post('/api/v1/sync', async (req, res) => {
  try {
    const { error, value } = syncRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.details.map(d => d.message)
      });
    }

    const { crm_type, entity_type, entity_id, operation, data } = value;

    // Get CRM configuration
    const crmConfig = await getCrmConfiguration(crm_type);
    if (!crmConfig) {
      return res.status(400).json({
        error: `CRM configuration not found for ${crm_type}`
      });
    }

    // Perform sync operation
    const syncResult = await performSync(crmConfig, entity_type, entity_id, operation, data);

    // Log sync operation
    await db.query(
      `INSERT INTO sync_logs (crm_type, entity_type, entity_id, operation, status, 
       sync_id, synced_at, details) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
      [crm_type, entity_type, entity_id, operation, syncResult.status, 
       syncResult.sync_id, JSON.stringify(syncResult.details)]
    );

    res.json({
      sync_id: syncResult.sync_id,
      status: syncResult.status,
      crm_type,
      entity_type,
      entity_id,
      operation,
      synced_at: new Date().toISOString(),
      details: syncResult.details
    });

  } catch (error) {
    logger.error('Sync error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get sync status
app.get('/api/v1/sync/:sync_id', async (req, res) => {
  try {
    const { sync_id } = req.params;

    const result = await db.query(
      'SELECT * FROM sync_logs WHERE sync_id = $1 ORDER BY synced_at DESC LIMIT 1',
      [sync_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Sync record not found'
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    logger.error('Get sync status error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Bulk sync
app.post('/api/v1/sync/bulk', async (req, res) => {
  try {
    const { crm_type, operations } = req.body;

    if (!crm_type || !Array.isArray(operations)) {
      return res.status(400).json({
        error: 'crm_type and operations array are required'
      });
    }

    if (operations.length > 1000) {
      return res.status(400).json({
        error: 'Maximum 1000 operations allowed per bulk request'
      });
    }

    const crmConfig = await getCrmConfiguration(crm_type);
    if (!crmConfig) {
      return res.status(400).json({
        error: `CRM configuration not found for ${crm_type}`
      });
    }

    const results = [];
    const batchId = `batch_${Date.now()}`;

    for (const operation of operations) {
      try {
        const syncResult = await performSync(
          crmConfig, 
          operation.entity_type, 
          operation.entity_id, 
          operation.operation, 
          operation.data
        );

        results.push({
          entity_id: operation.entity_id,
          status: syncResult.status,
          sync_id: syncResult.sync_id
        });

        // Log each operation
        await db.query(
          `INSERT INTO sync_logs (crm_type, entity_type, entity_id, operation, status, 
           sync_id, batch_id, synced_at, details) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
          [crm_type, operation.entity_type, operation.entity_id, operation.operation, 
           syncResult.status, syncResult.sync_id, batchId, JSON.stringify(syncResult.details)]
        );

      } catch (error) {
        results.push({
          entity_id: operation.entity_id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      batch_id: batchId,
      total_operations: operations.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      results
    });

  } catch (error) {
    logger.error('Bulk sync error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper functions
async function getCrmConfiguration(crmType: string) {
  const cacheKey = `crm_config:${crmType}`;
  
  // Try to get from cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Get from database
  const result = await db.query(
    'SELECT * FROM crm_configurations WHERE crm_type = $1 AND active = true',
    [crmType]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const config = result.rows[0];
  
  // Cache for 1 hour
  await redis.setEx(cacheKey, 3600, JSON.stringify(config));
  
  return config;
}

async function performSync(crmConfig: any, entityType: string, entityId: string, operation: string, data: any) {
  const syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    let result;
    
    switch (crmConfig.crm_type) {
      case 'salesforce':
        result = await syncToSalesforce(crmConfig, entityType, entityId, operation, data);
        break;
      case 'hubspot':
        result = await syncToHubspot(crmConfig, entityType, entityId, operation, data);
        break;
      case 'pipedrive':
        result = await syncToPipedrive(crmConfig, entityType, entityId, operation, data);
        break;
      default:
        throw new Error(`Unsupported CRM type: ${crmConfig.crm_type}`);
    }

    return {
      sync_id: syncId,
      status: 'success',
      details: result
    };

  } catch (error) {
    logger.error(`Sync failed for ${crmConfig.crm_type}:`, error);
    
    return {
      sync_id: syncId,
      status: 'error',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    };
  }
}

async function syncToSalesforce(config: any, entityType: string, entityId: string, operation: string, data: any) {
  const baseUrl = config.instance_url || 'https://login.salesforce.com';
  const accessToken = await getSalesforceAccessToken(config);

  const entityMapping = {
    'lead': 'Lead',
    'contact': 'Contact',
    'deal': 'Opportunity',
    'company': 'Account'
  };

  const sfEntityType = entityMapping[entityType as keyof typeof entityMapping];
  if (!sfEntityType) {
    throw new Error(`Unsupported entity type for Salesforce: ${entityType}`);
  }

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  let response: any;
  
  switch (operation) {
    case 'create':
      response = await axios.post(
        `${baseUrl}/services/data/v57.0/sobjects/${sfEntityType}`,
        data,
        { headers }
      );
      break;
    case 'update':
      response = await axios.patch(
        `${baseUrl}/services/data/v57.0/sobjects/${sfEntityType}/${entityId}`,
        data,
        { headers }
      );
      break;
    case 'delete':
      response = await axios.delete(
        `${baseUrl}/services/data/v57.0/sobjects/${sfEntityType}/${entityId}`,
        { headers }
      );
      break;
  }

  return {
    crm_id: response?.data?.id || entityId,
    operation,
    timestamp: new Date().toISOString()
  };
}

async function syncToHubspot(config: any, entityType: string, entityId: string, operation: string, data: any) {
  const baseUrl = 'https://api.hubapi.com';
  const accessToken = config.access_token;

  const entityMapping = {
    'lead': 'contacts',
    'contact': 'contacts',
    'deal': 'deals',
    'company': 'companies'
  };

  const hsEntityType = entityMapping[entityType as keyof typeof entityMapping];
  if (!hsEntityType) {
    throw new Error(`Unsupported entity type for HubSpot: ${entityType}`);
  }

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  let response: any;
  
  switch (operation) {
    case 'create':
      response = await axios.post(
        `${baseUrl}/crm/v3/objects/${hsEntityType}`,
        { properties: data },
        { headers }
      );
      break;
    case 'update':
      response = await axios.patch(
        `${baseUrl}/crm/v3/objects/${hsEntityType}/${entityId}`,
        { properties: data },
        { headers }
      );
      break;
    case 'delete':
      response = await axios.delete(
        `${baseUrl}/crm/v3/objects/${hsEntityType}/${entityId}`,
        { headers }
      );
      break;
  }

  return {
    crm_id: response?.data?.id || entityId,
    operation,
    timestamp: new Date().toISOString()
  };
}

async function syncToPipedrive(config: any, entityType: string, entityId: string, operation: string, data: any) {
  const baseUrl = `https://${config.company_domain}.pipedrive.com/api/v1`;
  const apiToken = config.api_token;

  const entityMapping = {
    'lead': 'leads',
    'contact': 'persons',
    'deal': 'deals',
    'company': 'organizations'
  };

  const pdEntityType = entityMapping[entityType as keyof typeof entityMapping];
  if (!pdEntityType) {
    throw new Error(`Unsupported entity type for Pipedrive: ${entityType}`);
  }

  const params = { api_token: apiToken };
  let response: any;
  
  switch (operation) {
    case 'create':
      response = await axios.post(
        `${baseUrl}/${pdEntityType}`,
        data,
        { params }
      );
      break;
    case 'update':
      response = await axios.put(
        `${baseUrl}/${pdEntityType}/${entityId}`,
        data,
        { params }
      );
      break;
    case 'delete':
      response = await axios.delete(
        `${baseUrl}/${pdEntityType}/${entityId}`,
        { params }
      );
      break;
  }

  return {
    crm_id: response?.data?.data?.id || entityId,
    operation,
    timestamp: new Date().toISOString()
  };
}

async function getSalesforceAccessToken(config: any): Promise<string> {
  // Implementation would handle OAuth token refresh
  // For now, return the stored access token
  return config.access_token;
}

// Schedule periodic sync
cron.schedule('*/5 * * * *', async () => {
  logger.info('Running scheduled sync check');
  
  try {
    // Get pending sync operations
    const result = await db.query(
      `SELECT * FROM sync_queue WHERE status = 'pending' 
       ORDER BY created_at LIMIT 100`
    );

    for (const syncOp of result.rows) {
      try {
        const crmConfig = await getCrmConfiguration(syncOp.crm_type);
        if (crmConfig) {
          await performSync(
            crmConfig,
            syncOp.entity_type,
            syncOp.entity_id,
            syncOp.operation,
            syncOp.data
          );

          // Mark as completed
          await db.query(
            'UPDATE sync_queue SET status = $1, completed_at = NOW() WHERE id = $2',
            ['completed', syncOp.id]
          );
        }
      } catch (error) {
        logger.error(`Scheduled sync failed for operation ${syncOp.id}:`, error);
        
        // Mark as failed
        await db.query(
          'UPDATE sync_queue SET status = $1, error_message = $2 WHERE id = $3',
          ['failed', error instanceof Error ? error.message : 'Unknown error', syncOp.id]
        );
      }
    }
  } catch (error) {
    logger.error('Scheduled sync error:', error);
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
    await redis.disconnect();
    await db.end();
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

app.listen(PORT, async () => {
  logger.info(`CRM Sync Service running on port ${PORT}`);
  await initKafka();
});

export default app;