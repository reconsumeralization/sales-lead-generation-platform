import Joi from 'joi';

export type DealStage = 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

export interface ConfidenceInterval {
  lower_bound: number;
  upper_bound: number;
  confidence_level: number; // e.g., 0.95 for 95% confidence
}

export interface StageProgression {
  current_stage: DealStage;
  previous_stage?: DealStage;
  stage_duration_days: number;
  expected_stage_duration_days: number;
  stage_velocity_score: number; // 0-1, higher is faster
  next_expected_stage?: DealStage;
  next_stage_probability: number;
}

export interface VelocityMetrics {
  days_in_pipeline: number;
  expected_close_days: number;
  velocity_score: number; // 0-1, higher is faster
  stage_progression_rate: number; // stages per day
  stalled_days: number;
  momentum_trend: 'accelerating' | 'steady' | 'decelerating' | 'stalled';
}

export interface RiskFactor {
  factor_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact_score: number; // 0-1
  likelihood: number; // 0-1
  mitigation_urgency: 'immediate' | 'within_week' | 'within_month' | 'monitor';
}

export interface MitigationStrategy {
  risk_factor_type: string;
  strategy_type: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimated_effort_hours: number;
  success_probability: number; // 0-1
  implementation_steps: string[];
}

export interface NextAction {
  action_type: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  description: string;
  recommended_owner: string;
  due_date: Date;
  estimated_impact: number; // 0-1
  effort_required: 'low' | 'medium' | 'high';
  dependencies?: string[];
}

export interface CoachingPoint {
  category: string;
  insight: string;
  recommendation: string;
  confidence: number; // 0-1
  supporting_data: Record<string, any>;
  urgency: 'immediate' | 'this_week' | 'this_month' | 'ongoing';
}

export interface CompetitorInfo {
  competitor_name: string;
  competitive_threat_level: 'low' | 'medium' | 'high' | 'critical';
  strengths: string[];
  weaknesses: string[];
  win_probability_impact: number; // -1 to 1
  last_updated: Date;
}

export interface CompetitiveIntelligence {
  competitors_identified: CompetitorInfo[];
  competitive_landscape_score: number; // 0-1, higher is more competitive
  our_competitive_position: 'strong' | 'moderate' | 'weak' | 'unknown';
  key_differentiators: string[];
  competitive_risks: string[];
  win_strategy_recommendations: string[];
}

export interface ForecastImpact {
  revenue_impact: number;
  probability_weighted_value: number;
  timeline_impact_days: number;
  resource_requirements: {
    sales_effort_hours: number;
    technical_effort_hours: number;
    executive_involvement_required: boolean;
  };
  pipeline_health_contribution: number; // -1 to 1
}

export interface Deal {
  id?: string;
  external_deal_id?: string;
  crm_source?: string;
  company_id?: string;
  contact_id?: string;
  title: string;
  description?: string;
  value: number;
  stage: DealStage;
  probability_score?: number;
  risk_score?: number;
  expected_close_date?: Date;
  actual_close_date?: Date;
  assigned_to?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface DealIntelligence {
  id?: string;
  deal_id: string;
  analysis_date: Date;
  probability_score: number;
  confidence_interval: ConfidenceInterval;
  stage_progression: StageProgression;
  velocity_metrics: VelocityMetrics;
  risk_factors: RiskFactor[];
  mitigation_strategies: MitigationStrategy[];
  next_actions: NextAction[];
  coaching_points: CoachingPoint[];
  competitive_intelligence: CompetitiveIntelligence;
  forecast_impact: ForecastImpact;
  created_at?: Date;
}

// Validation schemas
export const ConfidenceIntervalSchema = Joi.object({
  lower_bound: Joi.number().min(0).max(1).required(),
  upper_bound: Joi.number().min(0).max(1).required(),
  confidence_level: Joi.number().min(0).max(1).required()
}).custom((value, helpers) => {
  if (value.lower_bound >= value.upper_bound) {
    return helpers.error('confidence.interval.invalid');
  }
  return value;
});

export const StageProgressionSchema = Joi.object({
  current_stage: Joi.string().valid('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost').required(),
  previous_stage: Joi.string().valid('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost').optional(),
  stage_duration_days: Joi.number().min(0).required(),
  expected_stage_duration_days: Joi.number().min(0).required(),
  stage_velocity_score: Joi.number().min(0).max(1).required(),
  next_expected_stage: Joi.string().valid('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost').optional(),
  next_stage_probability: Joi.number().min(0).max(1).required()
});

export const VelocityMetricsSchema = Joi.object({
  days_in_pipeline: Joi.number().min(0).required(),
  expected_close_days: Joi.number().min(0).required(),
  velocity_score: Joi.number().min(0).max(1).required(),
  stage_progression_rate: Joi.number().min(0).required(),
  stalled_days: Joi.number().min(0).required(),
  momentum_trend: Joi.string().valid('accelerating', 'steady', 'decelerating', 'stalled').required()
});

export const RiskFactorSchema = Joi.object({
  factor_type: Joi.string().min(1).max(100).required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  description: Joi.string().min(1).max(500).required(),
  impact_score: Joi.number().min(0).max(1).required(),
  likelihood: Joi.number().min(0).max(1).required(),
  mitigation_urgency: Joi.string().valid('immediate', 'within_week', 'within_month', 'monitor').required()
});

export const MitigationStrategySchema = Joi.object({
  risk_factor_type: Joi.string().min(1).max(100).required(),
  strategy_type: Joi.string().min(1).max(100).required(),
  description: Joi.string().min(1).max(1000).required(),
  priority: Joi.string().valid('high', 'medium', 'low').required(),
  estimated_effort_hours: Joi.number().min(0).required(),
  success_probability: Joi.number().min(0).max(1).required(),
  implementation_steps: Joi.array().items(Joi.string()).min(1).required()
});

export const NextActionSchema = Joi.object({
  action_type: Joi.string().min(1).max(100).required(),
  priority: Joi.string().valid('urgent', 'high', 'medium', 'low').required(),
  description: Joi.string().min(1).max(500).required(),
  recommended_owner: Joi.string().min(1).max(100).required(),
  due_date: Joi.date().required(),
  estimated_impact: Joi.number().min(0).max(1).required(),
  effort_required: Joi.string().valid('low', 'medium', 'high').required(),
  dependencies: Joi.array().items(Joi.string()).optional()
});

export const CoachingPointSchema = Joi.object({
  category: Joi.string().min(1).max(100).required(),
  insight: Joi.string().min(1).max(500).required(),
  recommendation: Joi.string().min(1).max(500).required(),
  confidence: Joi.number().min(0).max(1).required(),
  supporting_data: Joi.object().required(),
  urgency: Joi.string().valid('immediate', 'this_week', 'this_month', 'ongoing').required()
});

export const CompetitorInfoSchema = Joi.object({
  competitor_name: Joi.string().min(1).max(255).required(),
  competitive_threat_level: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  strengths: Joi.array().items(Joi.string()).required(),
  weaknesses: Joi.array().items(Joi.string()).required(),
  win_probability_impact: Joi.number().min(-1).max(1).required(),
  last_updated: Joi.date().required()
});

export const CompetitiveIntelligenceSchema = Joi.object({
  competitors_identified: Joi.array().items(CompetitorInfoSchema).required(),
  competitive_landscape_score: Joi.number().min(0).max(1).required(),
  our_competitive_position: Joi.string().valid('strong', 'moderate', 'weak', 'unknown').required(),
  key_differentiators: Joi.array().items(Joi.string()).required(),
  competitive_risks: Joi.array().items(Joi.string()).required(),
  win_strategy_recommendations: Joi.array().items(Joi.string()).required()
});

export const ForecastImpactSchema = Joi.object({
  revenue_impact: Joi.number().required(),
  probability_weighted_value: Joi.number().required(),
  timeline_impact_days: Joi.number().required(),
  resource_requirements: Joi.object({
    sales_effort_hours: Joi.number().min(0).required(),
    technical_effort_hours: Joi.number().min(0).required(),
    executive_involvement_required: Joi.boolean().required()
  }).required(),
  pipeline_health_contribution: Joi.number().min(-1).max(1).required()
});

export const DealSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  external_deal_id: Joi.string().max(255).optional(),
  crm_source: Joi.string().max(100).optional(),
  company_id: Joi.string().uuid().optional(),
  contact_id: Joi.string().uuid().optional(),
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  value: Joi.number().min(0).required(),
  stage: Joi.string().valid('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost').required(),
  probability_score: Joi.number().min(0).max(1).optional(),
  risk_score: Joi.number().min(0).max(1).optional(),
  expected_close_date: Joi.date().optional(),
  actual_close_date: Joi.date().optional(),
  assigned_to: Joi.string().uuid().optional(),
  created_at: Joi.date().optional(),
  updated_at: Joi.date().optional()
});

export const DealIntelligenceSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  deal_id: Joi.string().uuid().required(),
  analysis_date: Joi.date().required(),
  probability_score: Joi.number().min(0).max(1).required(),
  confidence_interval: ConfidenceIntervalSchema.required(),
  stage_progression: StageProgressionSchema.required(),
  velocity_metrics: VelocityMetricsSchema.required(),
  risk_factors: Joi.array().items(RiskFactorSchema).required(),
  mitigation_strategies: Joi.array().items(MitigationStrategySchema).required(),
  next_actions: Joi.array().items(NextActionSchema).required(),
  coaching_points: Joi.array().items(CoachingPointSchema).required(),
  competitive_intelligence: CompetitiveIntelligenceSchema.required(),
  forecast_impact: ForecastImpactSchema.required(),
  created_at: Joi.date().optional()
});

// Validation functions
export class DealIntelligenceValidator {
  static validateDeal(deal: Deal): Joi.ValidationResult {
    return DealSchema.validate(deal, { abortEarly: false });
  }

  static validateDealIntelligence(intelligence: DealIntelligence): Joi.ValidationResult {
    return DealIntelligenceSchema.validate(intelligence, { abortEarly: false });
  }

  static validateDealForAnalysis(deal: Deal): boolean {
    // Deal must have minimum required data for analysis
    if (!deal.title || deal.value <= 0 || !deal.stage) {
      return false;
    }

    // Deal must not be closed
    return !['closed_won', 'closed_lost'].includes(deal.stage);
  }

  static validateProbabilityScore(score: number, stage: DealStage): boolean {
    // Validate probability score makes sense for the stage
    const stageMinProbabilities: Record<DealStage, number> = {
      prospecting: 0.0,
      qualification: 0.1,
      proposal: 0.3,
      negotiation: 0.5,
      closed_won: 1.0,
      closed_lost: 0.0
    };

    const stageMaxProbabilities: Record<DealStage, number> = {
      prospecting: 0.3,
      qualification: 0.5,
      proposal: 0.8,
      negotiation: 0.95,
      closed_won: 1.0,
      closed_lost: 0.0
    };

    return score >= stageMinProbabilities[stage] && score <= stageMaxProbabilities[stage];
  }

  static validateRiskFactors(riskFactors: RiskFactor[]): boolean {
    // Check for duplicate risk factor types
    const factorTypes = riskFactors.map(rf => rf.factor_type);
    const uniqueTypes = new Set(factorTypes);
    
    return factorTypes.length === uniqueTypes.size;
  }

  static validateForecastAccuracy(predicted: number, actual: number, tolerance: number = 0.15): boolean {
    // Validate forecast accuracy within tolerance
    const error = Math.abs(predicted - actual) / actual;
    return error <= tolerance;
  }
}

// Business logic helpers
export class DealIntelligenceHelper {
  static calculateOverallRiskScore(riskFactors: RiskFactor[]): number {
    if (riskFactors.length === 0) return 0;

    // Weight risk factors by severity and likelihood
    const severityWeights = { low: 0.25, medium: 0.5, high: 0.75, critical: 1.0 };
    
    const weightedRisks = riskFactors.map(rf => 
      severityWeights[rf.severity] * rf.likelihood * rf.impact_score
    );

    // Use root mean square to avoid single high risk dominating
    const rms = Math.sqrt(
      weightedRisks.reduce((sum, risk) => sum + risk * risk, 0) / weightedRisks.length
    );

    return Math.min(rms, 1.0);
  }

  static prioritizeNextActions(actions: NextAction[]): NextAction[] {
    // Sort by priority, then by estimated impact, then by due date
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
    
    return actions.sort((a, b) => {
      // First by priority
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by estimated impact
      const impactDiff = b.estimated_impact - a.estimated_impact;
      if (impactDiff !== 0) return impactDiff;

      // Finally by due date (earlier first)
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  }

  static calculateDealVelocity(deal: Deal, previousAnalyses: DealIntelligence[]): VelocityMetrics {
    const now = new Date();
    const createdDate = deal.created_at || now;
    const daysInPipeline = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate stage progression rate
    const stageOrder: DealStage[] = ['prospecting', 'qualification', 'proposal', 'negotiation'];
    const currentStageIndex = stageOrder.indexOf(deal.stage);
    const stageProgressionRate = currentStageIndex / Math.max(daysInPipeline, 1);

    // Calculate stalled days (days without stage progression)
    let stalledDays = 0;
    if (previousAnalyses.length > 0) {
      const lastAnalysis = previousAnalyses[previousAnalyses.length - 1];
      if (lastAnalysis.stage_progression.current_stage === deal.stage) {
        stalledDays = Math.floor(
          (now.getTime() - lastAnalysis.analysis_date.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
    }

    // Determine momentum trend
    let momentumTrend: VelocityMetrics['momentum_trend'] = 'steady';
    if (previousAnalyses.length >= 2) {
      const recent = previousAnalyses.slice(-2);
      const velocityChange = recent[1].velocity_metrics.velocity_score - recent[0].velocity_metrics.velocity_score;
      
      if (velocityChange > 0.1) momentumTrend = 'accelerating';
      else if (velocityChange < -0.1) momentumTrend = 'decelerating';
      else if (stalledDays > 14) momentumTrend = 'stalled';
    }

    // Calculate expected close days based on stage and historical data
    const stageExpectedDays: Record<DealStage, number> = {
      prospecting: 30,
      qualification: 45,
      proposal: 60,
      negotiation: 90,
      closed_won: 0,
      closed_lost: 0
    };

    const expectedCloseDays = stageExpectedDays[deal.stage] - daysInPipeline;
    const velocityScore = Math.max(0, Math.min(1, 1 - (stalledDays / 30)));

    return {
      days_in_pipeline: daysInPipeline,
      expected_close_days: Math.max(0, expectedCloseDays),
      velocity_score: velocityScore,
      stage_progression_rate: stageProgressionRate,
      stalled_days: stalledDays,
      momentum_trend: momentumTrend
    };
  }

  static generateCoachingInsights(deal: Deal, intelligence: DealIntelligence): CoachingPoint[] {
    const insights: CoachingPoint[] = [];

    // Velocity coaching
    if (intelligence.velocity_metrics.stalled_days > 7) {
      insights.push({
        category: 'velocity',
        insight: `Deal has been stalled for ${intelligence.velocity_metrics.stalled_days} days`,
        recommendation: 'Schedule immediate prospect meeting to identify blockers and create action plan',
        confidence: 0.9,
        supporting_data: { stalled_days: intelligence.velocity_metrics.stalled_days },
        urgency: intelligence.velocity_metrics.stalled_days > 14 ? 'immediate' : 'this_week'
      });
    }

    // Risk coaching
    const criticalRisks = intelligence.risk_factors.filter(rf => rf.severity === 'critical');
    if (criticalRisks.length > 0) {
      insights.push({
        category: 'risk_management',
        insight: `${criticalRisks.length} critical risk factors identified`,
        recommendation: 'Address critical risks immediately to prevent deal loss',
        confidence: 0.95,
        supporting_data: { critical_risks: criticalRisks.map(r => r.factor_type) },
        urgency: 'immediate'
      });
    }

    // Competitive coaching
    const highThreatCompetitors = intelligence.competitive_intelligence.competitors_identified
      .filter(c => ['high', 'critical'].includes(c.competitive_threat_level));
    
    if (highThreatCompetitors.length > 0) {
      insights.push({
        category: 'competitive',
        insight: `High-threat competitors detected: ${highThreatCompetitors.map(c => c.competitor_name).join(', ')}`,
        recommendation: 'Develop competitive differentiation strategy and address competitor strengths',
        confidence: 0.8,
        supporting_data: { competitors: highThreatCompetitors },
        urgency: 'this_week'
      });
    }

    // Probability coaching
    if (intelligence.probability_score < 0.3 && deal.stage !== 'prospecting') {
      insights.push({
        category: 'qualification',
        insight: 'Low probability score for current stage suggests qualification issues',
        recommendation: 'Re-qualify prospect needs, budget, authority, and timeline',
        confidence: 0.85,
        supporting_data: { probability_score: intelligence.probability_score, stage: deal.stage },
        urgency: 'this_week'
      });
    }

    return insights;
  }
}

// Database entity mapping
export class DealEntity {
  static fromDatabase(row: any): Deal {
    return {
      id: row.id,
      external_deal_id: row.external_deal_id,
      crm_source: row.crm_source,
      company_id: row.company_id,
      contact_id: row.contact_id,
      title: row.title,
      description: row.description,
      value: parseFloat(row.value),
      stage: row.stage as DealStage,
      probability_score: row.probability_score ? parseFloat(row.probability_score) : undefined,
      risk_score: row.risk_score ? parseFloat(row.risk_score) : undefined,
      expected_close_date: row.expected_close_date,
      actual_close_date: row.actual_close_date,
      assigned_to: row.assigned_to,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  static toDatabase(deal: Deal): any {
    return {
      id: deal.id,
      external_deal_id: deal.external_deal_id,
      crm_source: deal.crm_source,
      company_id: deal.company_id,
      contact_id: deal.contact_id,
      title: deal.title,
      description: deal.description,
      value: deal.value,
      stage: deal.stage,
      probability_score: deal.probability_score,
      risk_score: deal.risk_score,
      expected_close_date: deal.expected_close_date,
      actual_close_date: deal.actual_close_date,
      assigned_to: deal.assigned_to
    };
  }
}

export class DealIntelligenceEntity {
  static fromDatabase(row: any): DealIntelligence {
    return {
      id: row.id,
      deal_id: row.deal_id,
      analysis_date: row.analysis_date,
      probability_score: parseFloat(row.probability_score),
      confidence_interval: row.confidence_interval,
      stage_progression: row.stage_progression,
      velocity_metrics: row.velocity_metrics,
      risk_factors: row.risk_factors,
      mitigation_strategies: row.mitigation_strategies,
      next_actions: row.next_actions,
      coaching_points: row.coaching_points,
      competitive_intelligence: row.competitive_intelligence,
      forecast_impact: row.forecast_impact,
      created_at: row.created_at
    };
  }

  static toDatabase(intelligence: DealIntelligence): any {
    return {
      id: intelligence.id,
      deal_id: intelligence.deal_id,
      analysis_date: intelligence.analysis_date,
      probability_score: intelligence.probability_score,
      confidence_interval: JSON.stringify(intelligence.confidence_interval),
      stage_progression: JSON.stringify(intelligence.stage_progression),
      velocity_metrics: JSON.stringify(intelligence.velocity_metrics),
      risk_factors: JSON.stringify(intelligence.risk_factors),
      mitigation_strategies: JSON.stringify(intelligence.mitigation_strategies),
      next_actions: JSON.stringify(intelligence.next_actions),
      coaching_points: JSON.stringify(intelligence.coaching_points),
      competitive_intelligence: JSON.stringify(intelligence.competitive_intelligence),
      forecast_impact: JSON.stringify(intelligence.forecast_impact)
    };
  }
}

export default DealIntelligence;