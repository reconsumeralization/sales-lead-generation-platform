import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import { Kafka, Producer } from 'kafkajs';
import winston from 'winston';
import { Lead, LeadValidator, LeadEntity } from '../../../../shared/models/Lead';
import ICPScoringEngine, { ICPScore } from '../models/ICPModel';

export interface ScoringRequest {
  lead_data: Lead;
  icp_model_id?: string;
  force_refresh?: boolean;
}

export interface ScoringResponse {
  score: number;
  confidence: number;
  reasoning: string;
  enriched_data?: any;
  routing_recommendation?: RoutingRecommendation;
  model_version: string;
  cached: boolean;
}

export interface RoutingRecommendation {
  assigned_to?: string;
  priority: 'high' | 'medium' | 'low';
  follow_up_action: string;
  estimated_conversion_probability: number;
}

export class LeadScoringService {
  private db: Pool;
  private redis: any;
  private kafka: Producer;
  private logger: winston.Logger;
  private scoringEngine: ICPScoringEngine;

  constructor(
    db: Pool,
    redis: any,
    kafka: Producer,
    logger: winston.Logger
  ) {
    this.db = db;
    this.redis = redis;
    this.kafka = kafka;
    this.logger = logger;
    this.scoringEngine = new ICPScoringEngine();
  }

  async scoreLead(request: ScoringRequest): Promise<ScoringResponse> {
    const startTime = Date.now();
    
    try {
      // Validate input
      const validation = LeadValidator.validateLead(request.lead_data);
      if (validation.error) {
        throw new Error(`Invalid lead data: ${validation.error.message}`);
      }

      // Check cache first (unless force refresh)
      if (!request.force_refresh) {
        const cachedScore = await this.getCachedScore(request.lead_data);
        if (cachedScore) {
          this.logger.info('Returning cached lead score', { 
            leadId: request.lead_data.id,
            score: cachedScore.score,
            responseTime: Date.now() - startTime
          });
          return { ...cachedScore, cached: true };
        }
      }

      // Score the lead
      const icpScore = await this.scoringEngine.scoreLead(request.lead_data);
      
      // Generate routing recommendation
      const routingRecommendation = this.generateRoutingRecommendation(icpScore);

      // Prepare response
      const response: ScoringResponse = {
        score: icpScore.score,
        confidence: icpScore.confidence,
        reasoning: icpScore.reasoning,
        routing_recommendation: routingRecommendation,
        model_version: icpScore.model_version,
        cached: false
      };

      // Cache the result
      await this.cacheScore(request.lead_data, response);

      // Store scoring result in database
      await this.storeScoringResult(request.lead_data, icpScore);

      // Publish scoring event
      await this.publishScoringEvent(request.lead_data, icpScore);

      const responseTime = Date.now() - startTime;
      this.logger.info('Lead scored successfully', {
        leadId: request.lead_data.id,
        score: icpScore.score,
        confidence: icpScore.confidence,
        responseTime
      });

      // Ensure sub-200ms response time requirement
      if (responseTime > 200) {
        this.logger.warn('Scoring response time exceeded 200ms', {
          leadId: request.lead_data.id,
          responseTime
        });
      }

      return response;

    } catch (error) {
      this.logger.error('Lead scoring failed', {
        leadId: request.lead_data.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime
      });
      throw error;
    }
  }

  private async getCachedScore(lead: Lead): Promise<ScoringResponse | null> {
    try {
      const cacheKey = this.generateCacheKey(lead);
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      this.logger.warn('Cache retrieval failed', { error });
      return null;
    }
  }

  private async cacheScore(lead: Lead, response: ScoringResponse): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(lead);
      const ttl = 3600; // 1 hour cache
      
      await this.redis.setEx(cacheKey, ttl, JSON.stringify(response));
    } catch (error) {
      this.logger.warn('Cache storage failed', { error });
    }
  }

  private generateCacheKey(lead: Lead): string {
    // Create cache key based on lead data that affects scoring
    const keyData = {
      company_name: lead.company?.name,
      company_domain: lead.company?.domain,
      company_size: lead.company?.size_employees,
      company_revenue: lead.company?.annual_revenue,
      company_industry: lead.company?.industry,
      contact_title: lead.contact?.title,
      contact_email: lead.contact?.email,
      model_version: this.scoringEngine.getModelVersion()
    };
    
    const keyString = JSON.stringify(keyData);
    return `lead_score:${Buffer.from(keyString).toString('base64')}`;
  }

  private generateRoutingRecommendation(icpScore: ICPScore): RoutingRecommendation {
    let priority: 'high' | 'medium' | 'low' = 'low';
    let followUpAction = 'Add to nurture sequence';
    let assignedTo: string | undefined;

    // Determine priority based on score and confidence
    if (icpScore.score >= 80 && icpScore.confidence >= 0.8) {
      priority = 'high';
      followUpAction = 'Immediate personal outreach';
      assignedTo = 'senior_sales_rep';
    } else if (icpScore.score >= 60 && icpScore.confidence >= 0.6) {
      priority = 'medium';
      followUpAction = 'Automated sequence with personal touch';
      assignedTo = 'sales_rep';
    } else if (icpScore.score >= 40) {
      priority = 'low';
      followUpAction = 'Automated nurture sequence';
    } else {
      followUpAction = 'Disqualify or long-term nurture';
    }

    // Calculate conversion probability based on historical data
    const conversionProbability = this.calculateConversionProbability(icpScore);

    return {
      assigned_to: assignedTo,
      priority,
      follow_up_action: followUpAction,
      estimated_conversion_probability: conversionProbability
    };
  }

  private calculateConversionProbability(icpScore: ICPScore): number {
    // Simplified conversion probability calculation
    // In production, this would use historical conversion data
    const baseRate = 0.05; // 5% base conversion rate
    const scoreMultiplier = icpScore.score / 100;
    const confidenceMultiplier = icpScore.confidence;
    
    return Math.min(baseRate * scoreMultiplier * confidenceMultiplier * 10, 0.95);
  }

  private async storeScoringResult(lead: Lead, icpScore: ICPScore): Promise<void> {
    try {
      const query = `
        UPDATE leads 
        SET 
          icp_score = $1,
          confidence_score = $2,
          scoring_reasoning = $3,
          model_version = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `;
      
      await this.db.query(query, [
        icpScore.score,
        icpScore.confidence,
        icpScore.reasoning,
        icpScore.model_version,
        lead.id
      ]);
    } catch (error) {
      this.logger.error('Failed to store scoring result', { 
        leadId: lead.id, 
        error 
      });
    }
  }

  private async publishScoringEvent(lead: Lead, icpScore: ICPScore): Promise<void> {
    try {
      const event = {
        event_type: 'lead_scored',
        lead_id: lead.id,
        score: icpScore.score,
        confidence: icpScore.confidence,
        model_version: icpScore.model_version,
        timestamp: new Date().toISOString(),
        enrichment_needed: icpScore.enrichment_needed
      };

      await this.kafka.send({
        topic: 'lead-events',
        messages: [{
          key: lead.id,
          value: JSON.stringify(event)
        }]
      });
    } catch (error) {
      this.logger.error('Failed to publish scoring event', { 
        leadId: lead.id, 
        error 
      });
    }
  }

  async batchScoreLeads(leads: Lead[]): Promise<ScoringResponse[]> {
    const results: ScoringResponse[] = [];
    const batchSize = 10;
    
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      const batchPromises = batch.map(lead => 
        this.scoreLead({ lead_data: lead }).catch(error => {
          this.logger.error('Batch scoring failed for lead', { 
            leadId: lead.id, 
            error 
          });
          return null;
        })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(result => result !== null) as ScoringResponse[]);
    }
    
    return results;
  }

  async getLeadsByScore(
    minScore: number, 
    maxScore: number = 100, 
    limit: number = 100
  ): Promise<Lead[]> {
    try {
      const query = `
        SELECT l.*, c.name as company_name, co.first_name, co.last_name, co.email
        FROM leads l
        LEFT JOIN companies c ON l.company_id = c.id
        LEFT JOIN contacts co ON l.contact_id = co.id
        WHERE l.icp_score BETWEEN $1 AND $2
        ORDER BY l.icp_score DESC, l.confidence_score DESC
        LIMIT $3
      `;
      
      const result = await this.db.query(query, [minScore, maxScore, limit]);
      return result.rows.map(row => LeadEntity.fromDatabase(row));
    } catch (error) {
      this.logger.error('Failed to retrieve leads by score', { error });
      throw error;
    }
  }

  async getScoringMetrics(timeRange: string = '24h'): Promise<any> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_scored,
          AVG(icp_score) as avg_score,
          AVG(confidence_score) as avg_confidence,
          COUNT(CASE WHEN icp_score >= 80 THEN 1 END) as high_quality_leads,
          COUNT(CASE WHEN icp_score >= 60 THEN 1 END) as medium_quality_leads
        FROM leads 
        WHERE updated_at >= NOW() - INTERVAL '${timeRange}'
        AND icp_score IS NOT NULL
      `;
      
      const result = await this.db.query(query);
      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to retrieve scoring metrics', { error });
      throw error;
    }
  }

  async updateScoringCriteria(criteria: any[]): Promise<void> {
    this.scoringEngine.updateCriteria(criteria);
    
    // Clear cache when criteria change
    try {
      const keys = await this.redis.keys('lead_score:*');
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } catch (error) {
      this.logger.warn('Failed to clear cache after criteria update', { error });
    }
  }
}

export default LeadScoringService;