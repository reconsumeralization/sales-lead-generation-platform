import express from 'express';
import { Pool } from 'pg';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { Kafka } from 'kafkajs';
import winston from 'winston';
import dotenv from 'dotenv';
import Joi from 'joi';
import cron from 'node-cron';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3006;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/analytics.log' })
  ]
});

// Database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/sales_platform'
});

// Elasticsearch client
const elasticsearch = new ElasticsearchClient({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
});

// Kafka setup
const kafka = new Kafka({
  clientId: 'analytics-service',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092']
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'analytics-group' });

// Middleware
app.use(express.json({ limit: '10mb' }));

// Request validation schemas
const dashboardSchema = Joi.object({
  dashboard_id: Joi.string().required(),
  widgets: Joi.array().items(Joi.object()).required(),
  filters: Joi.object().optional(),
  time_range: Joi.object().optional()
});

// Health check
app.get('/health', (req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'analytics',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Get dashboard data
app.post('/api/v1/dashboard', async (req: express.Request, res: express.Response) => {
  try {
    const { error, value } = dashboardSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.details.map((d: any) => d.message)
      });
    }

    const { dashboard_id, widgets, filters = {}, time_range } = value;

    const dashboardData: any = {
      dashboard_id,
      widgets: [],
      generated_at: new Date().toISOString()
    };

    // Process each widget
    for (const widget of widgets) {
      try {
        const widgetData = await generateWidgetData(widget, filters, time_range);
        dashboardData.widgets.push({
          widget_id: widget.id,
          type: widget.type,
          title: widget.title,
          data: widgetData
        });
      } catch (error) {
        logger.error(`Widget generation failed for ${widget.id}:`, error);
        dashboardData.widgets.push({
          widget_id: widget.id,
          type: widget.type,
          title: widget.title,
          error: 'Failed to load widget data'
        });
      }
    }

    res.json(dashboardData);

  } catch (error) {
    logger.error('Dashboard generation error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get lead conversion metrics
app.get('/api/v1/metrics/leads', async (req: express.Request, res: express.Response) => {
  try {
    const timeRange = req.query.time_range as string || '30d';
    const teamId = req.query.team_id as string;

    let query = `
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE score >= 70) as qualified_leads,
        COUNT(*) FILTER (WHERE status = 'converted') as converted_leads,
        AVG(score) as avg_score
      FROM leads 
      WHERE created_at >= NOW() - INTERVAL '${timeRange}'
    `;

    const params: any[] = [];
    
    if (teamId) {
      query += ` AND team_id = $${params.length + 1}`;
      params.push(teamId);
    }

    query += ` GROUP BY DATE_TRUNC('day', created_at) ORDER BY date`;

    const result = await db.query(query, params);

    const metrics = {
      time_range: timeRange,
      total_leads: result.rows.reduce((sum, row) => sum + parseInt(row.total_leads), 0),
      qualified_leads: result.rows.reduce((sum, row) => sum + parseInt(row.qualified_leads), 0),
      converted_leads: result.rows.reduce((sum, row) => sum + parseInt(row.converted_leads), 0),
      conversion_rate: 0,
      daily_breakdown: result.rows
    };

    if (metrics.total_leads > 0) {
      metrics.conversion_rate = (metrics.converted_leads / metrics.total_leads) * 100;
    }

    res.json(metrics);

  } catch (error) {
    logger.error('Lead metrics error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get message performance metrics
app.get('/api/v1/metrics/messages', async (req: express.Request, res: express.Response) => {
  try {
    const timeRange = req.query.time_range as string || '30d';
    const channel = req.query.channel as string;

    let query = `
      SELECT 
        sequence_type,
        message_type,
        COUNT(*) as sent_count,
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opened_count,
        COUNT(*) FILTER (WHERE replied_at IS NOT NULL) as replied_count,
        COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicked_count,
        AVG(EXTRACT(EPOCH FROM (replied_at - sent_at))/3600) as avg_response_time_hours
      FROM messages 
      WHERE sent_at >= NOW() - INTERVAL '${timeRange}'
    `;

    const params: any[] = [];
    
    if (channel) {
      query += ` AND sequence_type = $${params.length + 1}`;
      params.push(channel);
    }

    query += ` GROUP BY sequence_type, message_type ORDER BY sequence_type, message_type`;

    const result = await db.query(query, params);

    const metrics = result.rows.map(row => ({
      channel: row.sequence_type,
      message_type: row.message_type,
      sent_count: parseInt(row.sent_count),
      opened_count: parseInt(row.opened_count || 0),
      replied_count: parseInt(row.replied_count || 0),
      clicked_count: parseInt(row.clicked_count || 0),
      open_rate: row.sent_count > 0 ? (parseInt(row.opened_count || 0) / parseInt(row.sent_count)) * 100 : 0,
      reply_rate: row.sent_count > 0 ? (parseInt(row.replied_count || 0) / parseInt(row.sent_count)) * 100 : 0,
      click_rate: row.sent_count > 0 ? (parseInt(row.clicked_count || 0) / parseInt(row.sent_count)) * 100 : 0,
      avg_response_time_hours: parseFloat(row.avg_response_time_hours || 0)
    }));

    res.json({
      time_range: timeRange,
      channel_filter: channel,
      metrics,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Message metrics error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get deal velocity metrics
app.get('/api/v1/metrics/deals', async (req: express.Request, res: express.Response) => {
  try {
    const timeRange = req.query.time_range as string || '90d';
    const teamId = req.query.team_id as string;

    let query = `
      SELECT 
        stage,
        COUNT(*) as deal_count,
        SUM(value) as total_value,
        AVG(value) as avg_deal_size,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400) as avg_stage_duration_days
      FROM deals 
      WHERE created_at >= NOW() - INTERVAL '${timeRange}'
    `;

    const params: any[] = [];
    
    if (teamId) {
      query += ` AND team_id = $${params.length + 1}`;
      params.push(teamId);
    }

    query += ` GROUP BY stage ORDER BY 
      CASE stage 
        WHEN 'prospecting' THEN 1
        WHEN 'qualification' THEN 2
        WHEN 'proposal' THEN 3
        WHEN 'negotiation' THEN 4
        WHEN 'closed_won' THEN 5
        WHEN 'closed_lost' THEN 6
        ELSE 7
      END`;

    const result = await db.query(query, params);

    // Calculate win rate
    const totalDeals = result.rows.reduce((sum, row) => sum + parseInt(row.deal_count), 0);
    const wonDeals = result.rows.find(row => row.stage === 'closed_won')?.deal_count || 0;
    const winRate = totalDeals > 0 ? (parseInt(wonDeals) / totalDeals) * 100 : 0;

    // Calculate average sales cycle
    const avgSalesCycle = await db.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (closed_at - created_at))/86400) as avg_cycle_days
      FROM deals 
      WHERE status = 'closed_won' 
      AND created_at >= NOW() - INTERVAL '${timeRange}'
      ${teamId ? `AND team_id = '${teamId}'` : ''}
    `);

    res.json({
      time_range: timeRange,
      team_filter: teamId,
      total_deals: totalDeals,
      win_rate: winRate,
      avg_sales_cycle_days: parseFloat(avgSalesCycle.rows[0]?.avg_cycle_days || 0),
      pipeline_breakdown: result.rows.map(row => ({
        stage: row.stage,
        deal_count: parseInt(row.deal_count),
        total_value: parseFloat(row.total_value),
        avg_deal_size: parseFloat(row.avg_deal_size),
        avg_stage_duration_days: parseFloat(row.avg_stage_duration_days)
      })),
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Deal metrics error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate custom report
app.post('/api/v1/reports/custom', async (req: express.Request, res: express.Response) => {
  try {
    const { report_type, parameters, filters } = req.body;

    if (!report_type) {
      return res.status(400).json({
        error: 'report_type is required'
      });
    }

    let reportData;

    switch (report_type) {
      case 'team_performance':
        reportData = await generateTeamPerformanceReport(parameters, filters);
        break;
      case 'campaign_effectiveness':
        reportData = await generateCampaignEffectivenessReport(parameters, filters);
        break;
      case 'lead_source_analysis':
        reportData = await generateLeadSourceAnalysisReport(parameters, filters);
        break;
      default:
        return res.status(400).json({
          error: `Unsupported report type: ${report_type}`
        });
    }

    res.json({
      report_type,
      parameters,
      filters,
      data: reportData,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Custom report error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper functions
async function generateWidgetData(widget: any, filters: any, timeRange: any) {
  switch (widget.type) {
    case 'kpi_card':
      return await generateKpiData(widget.metric, filters, timeRange);
    case 'line_chart':
      return await generateTimeSeriesData(widget.metric, filters, timeRange);
    case 'bar_chart':
      return await generateCategoricalData(widget.metric, filters, timeRange);
    case 'pie_chart':
      return await generateDistributionData(widget.metric, filters, timeRange);
    default:
      throw new Error(`Unsupported widget type: ${widget.type}`);
  }
}

async function generateKpiData(metric: string, filters: any, timeRange: any) {
  // Implementation would vary based on metric type
  const mockData = {
    value: Math.floor(Math.random() * 1000),
    change: Math.floor(Math.random() * 20) - 10,
    trend: 'up'
  };
  return mockData;
}

async function generateTimeSeriesData(metric: string, filters: any, timeRange: any) {
  // Generate mock time series data
  const data = [];
  const days = 30;
  
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.floor(Math.random() * 100) + 50
    });
  }
  
  return data;
}

async function generateCategoricalData(metric: string, filters: any, timeRange: any) {
  // Generate mock categorical data
  return [
    { category: 'Email', value: Math.floor(Math.random() * 100) },
    { category: 'LinkedIn', value: Math.floor(Math.random() * 100) },
    { category: 'Phone', value: Math.floor(Math.random() * 100) },
    { category: 'Website', value: Math.floor(Math.random() * 100) }
  ];
}

async function generateDistributionData(metric: string, filters: any, timeRange: any) {
  // Generate mock distribution data
  return [
    { label: 'Qualified', value: 45, percentage: 45 },
    { label: 'Unqualified', value: 30, percentage: 30 },
    { label: 'Pending', value: 25, percentage: 25 }
  ];
}

async function generateTeamPerformanceReport(parameters: any, filters: any) {
  // Mock team performance data
  return {
    teams: [
      { team_name: 'Team A', leads_generated: 150, conversion_rate: 12.5, revenue: 75000 },
      { team_name: 'Team B', leads_generated: 120, conversion_rate: 15.2, revenue: 82000 },
      { team_name: 'Team C', leads_generated: 180, conversion_rate: 10.8, revenue: 68000 }
    ]
  };
}

async function generateCampaignEffectivenessReport(parameters: any, filters: any) {
  // Mock campaign effectiveness data
  return {
    campaigns: [
      { campaign_name: 'Q1 Outbound', sent: 1000, opened: 250, replied: 45, converted: 12 },
      { campaign_name: 'LinkedIn Sequence', sent: 800, opened: 320, replied: 68, converted: 18 },
      { campaign_name: 'Email Nurture', sent: 1500, opened: 450, replied: 72, converted: 24 }
    ]
  };
}

async function generateLeadSourceAnalysisReport(parameters: any, filters: any) {
  // Mock lead source analysis data
  return {
    sources: [
      { source: 'Website', leads: 450, quality_score: 8.2, cost_per_lead: 25 },
      { source: 'LinkedIn', leads: 320, quality_score: 7.8, cost_per_lead: 35 },
      { source: 'Referrals', leads: 180, quality_score: 9.1, cost_per_lead: 15 },
      { source: 'Cold Email', leads: 280, quality_score: 6.5, cost_per_lead: 18 }
    ]
  };
}

// Schedule analytics aggregation
cron.schedule('0 1 * * *', async () => {
  logger.info('Running daily analytics aggregation');
  
  try {
    // Aggregate daily metrics
    await aggregateDailyMetrics();
    
    // Update Elasticsearch indices
    await updateSearchIndices();
    
    logger.info('Daily analytics aggregation completed');
  } catch (error) {
    logger.error('Analytics aggregation error:', error);
  }
});

async function aggregateDailyMetrics() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  // Aggregate lead metrics
  await db.query(`
    INSERT INTO daily_metrics (date, metric_type, metric_name, value)
    SELECT $1, 'leads', 'total_created', COUNT(*)
    FROM leads WHERE DATE(created_at) = $1
    ON CONFLICT (date, metric_type, metric_name) 
    DO UPDATE SET value = EXCLUDED.value
  `, [dateStr]);

  // Aggregate message metrics
  await db.query(`
    INSERT INTO daily_metrics (date, metric_type, metric_name, value)
    SELECT $1, 'messages', 'total_sent', COUNT(*)
    FROM messages WHERE DATE(sent_at) = $1
    ON CONFLICT (date, metric_type, metric_name) 
    DO UPDATE SET value = EXCLUDED.value
  `, [dateStr]);

  // Aggregate deal metrics
  await db.query(`
    INSERT INTO daily_metrics (date, metric_type, metric_name, value)
    SELECT $1, 'deals', 'total_closed_won', COUNT(*)
    FROM deals WHERE DATE(closed_at) = $1 AND status = 'closed_won'
    ON CONFLICT (date, metric_type, metric_name) 
    DO UPDATE SET value = EXCLUDED.value
  `, [dateStr]);
}

async function updateSearchIndices() {
  try {
    // Index recent activities for search
    const activities = await db.query(`
      SELECT * FROM activity_logs 
      WHERE created_at >= NOW() - INTERVAL '1 day'
    `);

    for (const activity of activities.rows) {
      await elasticsearch.index({
        index: 'activities',
        id: activity.id,
        body: {
          ...activity,
          timestamp: activity.created_at
        }
      });
    }

    logger.info(`Indexed ${activities.rows.length} activities to Elasticsearch`);
  } catch (error) {
    logger.error('Elasticsearch indexing error:', error);
  }
}

// Initialize Kafka
async function initKafka() {
  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topic: 'analytics-events' });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }: { topic: string, partition: number, message: any }) => {
      try {
        const event = JSON.parse(message.value?.toString() || '{}');
        
        // Process real-time analytics events
        await processAnalyticsEvent(event);
      } catch (error) {
        logger.error('Kafka message processing error:', error);
      }
    }
  });

  logger.info('Kafka consumer connected');
}

async function processAnalyticsEvent(event: any) {
  // Store event for real-time analytics
  await elasticsearch.index({
    index: 'events',
    body: {
      ...event,
      processed_at: new Date().toISOString()
    }
  });
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  try {
    await producer.disconnect();
    await consumer.disconnect();
    await elasticsearch.close();
    await db.end();
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

app.listen(PORT, async () => {
  logger.info(`Analytics Service running on port ${PORT}`);
  await initKafka();
});

export default app;