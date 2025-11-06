import {
  Deal,
  DealIntelligence,
  DealIntelligenceValidator,
  DealIntelligenceHelper,
  DealEntity,
  DealIntelligenceEntity,
  RiskFactor,
  NextAction,
  VelocityMetrics
} from '../DealIntelligence';

describe('DealIntelligence Model Tests', () => {
  const mockDeal: Deal = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    external_deal_id: 'SF-12345',
    crm_source: 'salesforce',
    company_id: '123e4567-e89b-12d3-a456-426614174001',
    contact_id: '123e4567-e89b-12d3-a456-426614174002',
    title: 'Enterprise Software License',
    description: 'Annual software license for 500 users',
    value: 250000,
    stage: 'proposal',
    probability_score: 0.65,
    risk_score: 0.3,
    expected_close_date: new Date('2024-03-15'),
    assigned_to: '123e4567-e89b-12d3-a456-426614174003',
    created_at: new Date('2024-01-15'),
    updated_at: new Date()
  };

  const mockRiskFactors: RiskFactor[] = [
    {
      factor_type: 'budget_constraints',
      severity: 'medium',
      description: 'Customer mentioned budget review process',
      impact_score: 0.6,
      likelihood: 0.4,
      mitigation_urgency: 'within_week'
    },
    {
      factor_type: 'competitor_presence',
      severity: 'high',
      description: 'Competitor actively pursuing this account',
      impact_score: 0.8,
      likelihood: 0.7,
      mitigation_urgency: 'immediate'
    }
  ];

  const mockNextActions: NextAction[] = [
    {
      action_type: 'follow_up_call',
      priority: 'high',
      description: 'Schedule call with decision maker to address budget concerns',
      recommended_owner: 'Sales Rep',
      due_date: new Date('2024-02-10'),
      estimated_impact: 0.8,
      effort_required: 'medium'
    },
    {
      action_type: 'competitive_analysis',
      priority: 'urgent',
      description: 'Prepare competitive differentiation document',
      recommended_owner: 'Sales Engineer',
      due_date: new Date('2024-02-08'),
      estimated_impact: 0.9,
      effort_required: 'high',
      dependencies: ['competitor_research']
    }
  ];

  const mockDealIntelligence: DealIntelligence = {
    id: '123e4567-e89b-12d3-a456-426614174004',
    deal_id: mockDeal.id!,
    analysis_date: new Date(),
    probability_score: 0.65,
    confidence_interval: {
      lower_bound: 0.55,
      upper_bound: 0.75,
      confidence_level: 0.95
    },
    stage_progression: {
      current_stage: 'proposal',
      previous_stage: 'qualification',
      stage_duration_days: 15,
      expected_stage_duration_days: 21,
      stage_velocity_score: 0.8,
      next_expected_stage: 'negotiation',
      next_stage_probability: 0.7
    },
    velocity_metrics: {
      days_in_pipeline: 45,
      expected_close_days: 30,
      velocity_score: 0.75,
      stage_progression_rate: 0.067,
      stalled_days: 3,
      momentum_trend: 'steady'
    },
    risk_factors: mockRiskFactors,
    mitigation_strategies: [
      {
        risk_factor_type: 'budget_constraints',
        strategy_type: 'value_demonstration',
        description: 'Prepare ROI analysis and case studies',
        priority: 'high',
        estimated_effort_hours: 8,
        success_probability: 0.7,
        implementation_steps: ['Gather usage data', 'Calculate ROI', 'Create presentation']
      }
    ],
    next_actions: mockNextActions,
    coaching_points: [
      {
        category: 'competitive',
        insight: 'Competitor strength in pricing',
        recommendation: 'Focus on value differentiation rather than price matching',
        confidence: 0.85,
        supporting_data: { competitor_analysis: 'detailed' },
        urgency: 'this_week'
      }
    ],
    competitive_intelligence: {
      competitors_identified: [
        {
          competitor_name: 'CompetitorCorp',
          competitive_threat_level: 'high',
          strengths: ['Lower price', 'Existing relationship'],
          weaknesses: ['Limited features', 'Poor support'],
          win_probability_impact: -0.2,
          last_updated: new Date()
        }
      ],
      competitive_landscape_score: 0.7,
      our_competitive_position: 'moderate',
      key_differentiators: ['Advanced analytics', 'Better integration'],
      competitive_risks: ['Price pressure', 'Incumbent advantage'],
      win_strategy_recommendations: ['Emphasize ROI', 'Leverage references']
    },
    forecast_impact: {
      revenue_impact: 250000,
      probability_weighted_value: 162500,
      timeline_impact_days: 30,
      resource_requirements: {
        sales_effort_hours: 40,
        technical_effort_hours: 20,
        executive_involvement_required: true
      },
      pipeline_health_contribution: 0.15
    }
  };

  describe('Deal Validation', () => {
    test('should validate a complete deal successfully', () => {
      const result = DealIntelligenceValidator.validateDeal(mockDeal);
      expect(result.error).toBeUndefined();
    });

    test('should require title, value, and stage', () => {
      const invalidDeal = { ...mockDeal };
      delete (invalidDeal as any).title;
      delete (invalidDeal as any).value;
      delete (invalidDeal as any).stage;

      const result = DealIntelligenceValidator.validateDeal(invalidDeal);
      expect(result.error).toBeDefined();
      expect(result.error?.details).toHaveLength(3);
    });

    test('should validate deal value is positive', () => {
      const invalidDeal = { ...mockDeal, value: -1000 };
      const result = DealIntelligenceValidator.validateDeal(invalidDeal);
      expect(result.error).toBeDefined();
    });

    test('should validate deal stage enum', () => {
      const invalidDeal = { ...mockDeal, stage: 'invalid_stage' as any };
      const result = DealIntelligenceValidator.validateDeal(invalidDeal);
      expect(result.error).toBeDefined();
    });

    test('should validate probability score range', () => {
      const invalidDeal = { ...mockDeal, probability_score: 1.5 };
      const result = DealIntelligenceValidator.validateDeal(invalidDeal);
      expect(result.error).toBeDefined();
    });
  });

  describe('DealIntelligence Validation', () => {
    test('should validate complete deal intelligence successfully', () => {
      const result = DealIntelligenceValidator.validateDealIntelligence(mockDealIntelligence);
      expect(result.error).toBeUndefined();
    });

    test('should require deal_id, analysis_date, and probability_score', () => {
      const invalidIntelligence = { ...mockDealIntelligence };
      delete (invalidIntelligence as any).deal_id;
      delete (invalidIntelligence as any).analysis_date;
      delete (invalidIntelligence as any).probability_score;

      const result = DealIntelligenceValidator.validateDealIntelligence(invalidIntelligence);
      expect(result.error).toBeDefined();
      expect(result.error?.details.length).toBeGreaterThanOrEqual(3);
    });

    test('should validate confidence interval bounds', () => {
      const invalidIntelligence = {
        ...mockDealIntelligence,
        confidence_interval: {
          lower_bound: 0.8, // Invalid: greater than upper_bound
          upper_bound: 0.6,
          confidence_level: 0.95
        }
      };

      const result = DealIntelligenceValidator.validateDealIntelligence(invalidIntelligence);
      expect(result.error).toBeDefined();
    });
  });

  describe('Business Logic Validation', () => {
    test('should validate deal for analysis', () => {
      const validDeal = { ...mockDeal, stage: 'qualification' as const };
      expect(DealIntelligenceValidator.validateDealForAnalysis(validDeal)).toBe(true);

      const closedDeal = { ...mockDeal, stage: 'closed_won' as const };
      expect(DealIntelligenceValidator.validateDealForAnalysis(closedDeal)).toBe(false);

      const invalidValueDeal = { ...mockDeal, value: 0 };
      expect(DealIntelligenceValidator.validateDealForAnalysis(invalidValueDeal)).toBe(false);
    });

    test('should validate probability score for stage', () => {
      expect(DealIntelligenceValidator.validateProbabilityScore(0.2, 'prospecting')).toBe(true);
      expect(DealIntelligenceValidator.validateProbabilityScore(0.8, 'prospecting')).toBe(false);
      expect(DealIntelligenceValidator.validateProbabilityScore(0.6, 'negotiation')).toBe(true);
      expect(DealIntelligenceValidator.validateProbabilityScore(0.2, 'negotiation')).toBe(false);
    });

    test('should validate risk factors for duplicates', () => {
      const validRiskFactors = mockRiskFactors;
      expect(DealIntelligenceValidator.validateRiskFactors(validRiskFactors)).toBe(true);

      const duplicateRiskFactors = [
        ...mockRiskFactors,
        { ...mockRiskFactors[0] } // Duplicate factor_type
      ];
      expect(DealIntelligenceValidator.validateRiskFactors(duplicateRiskFactors)).toBe(false);
    });

    test('should validate forecast accuracy', () => {
      expect(DealIntelligenceValidator.validateForecastAccuracy(100, 110, 0.15)).toBe(true);
      expect(DealIntelligenceValidator.validateForecastAccuracy(100, 130, 0.15)).toBe(false);
    });
  });

  describe('Business Logic Helpers', () => {
    test('should calculate overall risk score', () => {
      const riskScore = DealIntelligenceHelper.calculateOverallRiskScore(mockRiskFactors);
      expect(riskScore).toBeGreaterThan(0);
      expect(riskScore).toBeLessThanOrEqual(1);

      const emptyRiskScore = DealIntelligenceHelper.calculateOverallRiskScore([]);
      expect(emptyRiskScore).toBe(0);
    });

    test('should prioritize next actions correctly', () => {
      const prioritized = DealIntelligenceHelper.prioritizeNextActions(mockNextActions);
      
      // Urgent priority should come first
      expect(prioritized[0].priority).toBe('urgent');
      expect(prioritized[1].priority).toBe('high');
    });

    test('should calculate deal velocity metrics', () => {
      const velocity = DealIntelligenceHelper.calculateDealVelocity(mockDeal, []);
      
      expect(velocity.days_in_pipeline).toBeGreaterThan(0);
      expect(velocity.velocity_score).toBeGreaterThanOrEqual(0);
      expect(velocity.velocity_score).toBeLessThanOrEqual(1);
      expect(velocity.stage_progression_rate).toBeGreaterThanOrEqual(0);
      expect(['accelerating', 'steady', 'decelerating', 'stalled']).toContain(velocity.momentum_trend);
    });

    test('should generate coaching insights', () => {
      const stalledIntelligence = {
        ...mockDealIntelligence,
        velocity_metrics: {
          ...mockDealIntelligence.velocity_metrics,
          stalled_days: 15
        }
      };

      const insights = DealIntelligenceHelper.generateCoachingInsights(mockDeal, stalledIntelligence);
      
      expect(insights.length).toBeGreaterThan(0);
      expect(insights.some(i => i.category === 'velocity')).toBe(true);
    });

    test('should generate risk coaching for critical risks', () => {
      const criticalRiskIntelligence = {
        ...mockDealIntelligence,
        risk_factors: [
          {
            ...mockRiskFactors[0],
            severity: 'critical' as const
          }
        ]
      };

      const insights = DealIntelligenceHelper.generateCoachingInsights(mockDeal, criticalRiskIntelligence);
      
      expect(insights.some(i => i.category === 'risk_management')).toBe(true);
      expect(insights.some(i => i.urgency === 'immediate')).toBe(true);
    });
  });

  describe('Database Entity Mapping', () => {
    test('should convert deal from database row to object', () => {
      const dbRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        external_deal_id: 'SF-12345',
        crm_source: 'salesforce',
        company_id: '123e4567-e89b-12d3-a456-426614174001',
        contact_id: '123e4567-e89b-12d3-a456-426614174002',
        title: 'Test Deal',
        description: 'Test Description',
        value: '250000.00',
        stage: 'proposal',
        probability_score: '0.65',
        risk_score: '0.30',
        expected_close_date: new Date('2024-03-15'),
        actual_close_date: null,
        assigned_to: '123e4567-e89b-12d3-a456-426614174003',
        created_at: new Date(),
        updated_at: new Date()
      };

      const deal = DealEntity.fromDatabase(dbRow);
      
      expect(deal.id).toBe(dbRow.id);
      expect(deal.value).toBe(250000);
      expect(deal.probability_score).toBe(0.65);
      expect(deal.stage).toBe('proposal');
    });

    test('should convert deal from object to database format', () => {
      const dbData = DealEntity.toDatabase(mockDeal);
      
      expect(dbData.id).toBe(mockDeal.id);
      expect(dbData.value).toBe(mockDeal.value);
      expect(dbData.stage).toBe(mockDeal.stage);
    });

    test('should convert deal intelligence from database row to object', () => {
      const dbRow = {
        id: '123e4567-e89b-12d3-a456-426614174004',
        deal_id: '123e4567-e89b-12d3-a456-426614174000',
        analysis_date: new Date(),
        probability_score: '0.65',
        confidence_interval: { lower_bound: 0.55, upper_bound: 0.75, confidence_level: 0.95 },
        stage_progression: mockDealIntelligence.stage_progression,
        velocity_metrics: mockDealIntelligence.velocity_metrics,
        risk_factors: mockDealIntelligence.risk_factors,
        mitigation_strategies: mockDealIntelligence.mitigation_strategies,
        next_actions: mockDealIntelligence.next_actions,
        coaching_points: mockDealIntelligence.coaching_points,
        competitive_intelligence: mockDealIntelligence.competitive_intelligence,
        forecast_impact: mockDealIntelligence.forecast_impact,
        created_at: new Date()
      };

      const intelligence = DealIntelligenceEntity.fromDatabase(dbRow);
      
      expect(intelligence.id).toBe(dbRow.id);
      expect(intelligence.deal_id).toBe(dbRow.deal_id);
      expect(intelligence.probability_score).toBe(0.65);
    });

    test('should convert deal intelligence from object to database format', () => {
      const dbData = DealIntelligenceEntity.toDatabase(mockDealIntelligence);
      
      expect(dbData.id).toBe(mockDealIntelligence.id);
      expect(dbData.deal_id).toBe(mockDealIntelligence.deal_id);
      expect(dbData.probability_score).toBe(mockDealIntelligence.probability_score);
      
      // Check that complex objects are stringified
      expect(typeof dbData.confidence_interval).toBe('string');
      expect(typeof dbData.risk_factors).toBe('string');
      expect(typeof dbData.competitive_intelligence).toBe('string');
    });
  });

  describe('Velocity Metrics Calculation', () => {
    test('should handle deals with no previous analyses', () => {
      const velocity = DealIntelligenceHelper.calculateDealVelocity(mockDeal, []);
      
      expect(velocity.stalled_days).toBe(0);
      expect(velocity.momentum_trend).toBe('steady');
    });

    test('should detect stalled deals', () => {
      const stalledDeal = {
        ...mockDeal,
        created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) // 20 days ago
      };

      const previousAnalysis = {
        ...mockDealIntelligence,
        analysis_date: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000), // 16 days ago
        stage_progression: {
          ...mockDealIntelligence.stage_progression,
          current_stage: 'proposal' as const
        }
      };

      const velocity = DealIntelligenceHelper.calculateDealVelocity(stalledDeal, [previousAnalysis]);
      
      expect(velocity.stalled_days).toBe(16);
      expect(velocity.momentum_trend).toBe('stalled');
    });
  });
});