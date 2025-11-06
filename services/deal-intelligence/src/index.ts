import express from 'express';
import { Pool } from 'pg';
import { Kafka } from 'kafkajs';
import winston from 'winston';
import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/deal-intelligence.log' })
  ]
});

// Database connection
const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/sales_platform'
});

// Kafka setup
const kafka = new Kafka({
  clientId: 'deal-intelligence-service',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092']
});

const producer = kafka.producer();

// Middleware
app.use(express.json({ limit: '10mb' }));

// Request validation schemas
const analyzeDealSchema = Joi.object({
  deal_id: Joi.string().required(),
  deal_data: Joi.object().required(),
  include_recommendations: Joi.boolean().optional()
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'deal-intelligence',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Analyze deal probability
app.post('/api/v1/analyze', async (req, res) => {
  try {
    const { error, value } = analyzeDealSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.details.map(d => d.message)
      });
    }

    const { deal_id, deal_data, include_recommendations = true } = value;

    // Calculate deal probability based on various factors
    const factors = {
      stage_weight: getDealStageWeight(deal_data.stage),
      engagement_score: calculateEngagementScore(deal_data.activities || []),
      company_fit: calculateCompanyFit(deal_data.company),
      timeline_factor: calculateTimelineFactor(deal_data.timeline),
      budget_alignment: calculateBudgetAlignment(deal_data.budget, deal_data.value)
    };

    const probability = Math.min(100, Math.max(0, 
      (factors.stage_weight * 0.3) +
      (factors.engagement_score * 0.25) +
      (factors.company_fit * 0.2) +
      (factors.timeline_factor * 0.15) +
      (factors.budget_alignment * 0.1)
    ));

    const confidence_interval = {
      lower: Math.max(0, probability - 15),
      upper: Math.min(100, probability + 15)
    };

    const risk_factors = identifyRiskFactors(deal_data, factors);
    
    let recommendations: string[] = [];
    if (include_recommendations) {
      recommendations = generateRecommendations(deal_data, factors, probability);
    }

    // Store analysis in database
    await db.query(
      `INSERT INTO deal_analyses (deal_id, probability, confidence_lower, confidence_upper, 
       risk_factors, recommendations, analyzed_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [deal_id, probability, confidence_interval.lower, confidence_interval.upper, 
       JSON.stringify(risk_factors), JSON.stringify(recommendations)]
    );

    res.json({
      deal_id,
      probability: Math.round(probability),
      confidence_interval,
      risk_factors,
      recommendations,
      factors,
      analyzed_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Deal analysis error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get pipeline forecast
app.get('/api/v1/forecast', async (req, res) => {
  try {
    const timeframe = req.query.timeframe as string || 'quarter';
    const team_id = req.query.team_id as string;

    let query = `
      SELECT 
        d.stage,
        COUNT(*) as deal_count,
        SUM(d.value) as total_value,
        AVG(da.probability) as avg_probability,
        SUM(d.value * da.probability / 100) as weighted_value
      FROM deals d
      LEFT JOIN deal_analyses da ON d.id = da.deal_id
      WHERE d.status = 'active'
    `;

    const params: any[] = [];
    
    if (team_id) {
      query += ` AND d.team_id = $${params.length + 1}`;
      params.push(team_id);
    }

    if (timeframe === 'quarter') {
      query += ` AND d.expected_close_date <= NOW() + INTERVAL '3 months'`;
    } else if (timeframe === 'month') {
      query += ` AND d.expected_close_date <= NOW() + INTERVAL '1 month'`;
    }

    query += ` GROUP BY d.stage ORDER BY d.stage`;

    const result = await db.query(query, params);

    const forecast = {
      timeframe,
      total_deals: result.rows.reduce((sum, row) => sum + parseInt(row.deal_count), 0),
      total_value: result.rows.reduce((sum, row) => sum + parseFloat(row.total_value || 0), 0),
      weighted_value: result.rows.reduce((sum, row) => sum + parseFloat(row.weighted_value || 0), 0),
      by_stage: result.rows,
      generated_at: new Date().toISOString()
    };

    res.json(forecast);

  } catch (error) {
    logger.error('Forecast error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper functions
function getDealStageWeight(stage: string): number {
  const stageWeights: { [key: string]: number } = {
    'prospecting': 10,
    'qualification': 25,
    'proposal': 50,
    'negotiation': 75,
    'closed_won': 100,
    'closed_lost': 0
  };
  return stageWeights[stage?.toLowerCase()] || 20;
}

function calculateEngagementScore(activities: any[]): number {
  if (!activities || activities.length === 0) return 20;
  
  const recentActivities = activities.filter(a => 
    new Date(a.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  
  const engagementTypes = {
    'email_reply': 15,
    'meeting_attended': 25,
    'demo_completed': 30,
    'proposal_viewed': 20,
    'contract_reviewed': 35
  };
  
  const score = recentActivities.reduce((sum, activity) => {
    return sum + (engagementTypes[activity.type as keyof typeof engagementTypes] || 5);
  }, 0);
  
  return Math.min(100, score);
}

function calculateCompanyFit(company: any): number {
  if (!company) return 50;
  
  let score = 50;
  
  // Company size fit
  if (company.employee_count >= 100 && company.employee_count <= 5000) score += 20;
  else if (company.employee_count > 5000) score += 10;
  
  // Industry fit
  const targetIndustries = ['technology', 'saas', 'fintech', 'healthcare'];
  if (targetIndustries.includes(company.industry?.toLowerCase())) score += 15;
  
  // Revenue fit
  if (company.annual_revenue >= 10000000) score += 15;
  
  return Math.min(100, score);
}

function calculateTimelineFactor(timeline: any): number {
  if (!timeline || !timeline.expected_close) return 50;
  
  const daysToClose = Math.ceil(
    (new Date(timeline.expected_close).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysToClose < 0) return 10; // Overdue
  if (daysToClose <= 30) return 90; // Closing soon
  if (daysToClose <= 90) return 70; // This quarter
  if (daysToClose <= 180) return 50; // Next quarter
  return 30; // Far future
}

function calculateBudgetAlignment(budget: any, dealValue: number): number {
  if (!budget || !dealValue) return 50;
  
  const budgetRatio = dealValue / budget.amount;
  
  if (budgetRatio <= 1) return 90; // Within budget
  if (budgetRatio <= 1.2) return 70; // Slightly over
  if (budgetRatio <= 1.5) return 40; // Significantly over
  return 20; // Way over budget
}

function identifyRiskFactors(dealData: any, factors: any): string[] {
  const risks = [];
  
  if (factors.engagement_score < 30) {
    risks.push('Low prospect engagement in recent activities');
  }
  
  if (factors.timeline_factor < 40) {
    risks.push('Extended timeline may indicate lack of urgency');
  }
  
  if (factors.budget_alignment < 50) {
    risks.push('Deal value exceeds prospect budget significantly');
  }
  
  if (!dealData.decision_maker_identified) {
    risks.push('Decision maker not clearly identified');
  }
  
  if (dealData.competitors && dealData.competitors.length > 2) {
    risks.push('High competitive pressure with multiple vendors');
  }
  
  return risks;
}

function generateRecommendations(dealData: any, factors: any, probability: number): string[] {
  const recommendations = [];
  
  if (factors.engagement_score < 50) {
    recommendations.push('Schedule a discovery call to re-engage the prospect');
    recommendations.push('Send value-focused content to maintain interest');
  }
  
  if (probability < 40) {
    recommendations.push('Conduct a thorough needs assessment');
    recommendations.push('Identify and address key objections');
  }
  
  if (factors.budget_alignment < 60) {
    recommendations.push('Discuss ROI and value proposition to justify pricing');
    recommendations.push('Consider offering flexible payment terms');
  }
  
  if (probability > 70) {
    recommendations.push('Prepare proposal and move to next stage');
    recommendations.push('Schedule decision maker meeting');
  }
  
  return recommendations;
}

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
  logger.info(`Deal Intelligence Service running on port ${PORT}`);
  await initKafka();
});

export default app;