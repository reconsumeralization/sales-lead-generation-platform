import * as tf from '@tensorflow/tfjs-node';
import { Lead, Company, Contact } from '../../../../shared/models/Lead';

export interface ICPCriteria {
    id: string;
    name: string;
    description: string;
    weight: number; // 0-1, importance of this criteria
    scoring_rules: ScoringRule[];
    created_at: Date;
    updated_at: Date;
}

export interface ScoringRule {
    field_path: string; // e.g., 'company.size_employees', 'contact.title'
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in_range' | 'regex';
    value: any;
    score: number; // 0-100
    confidence_modifier: number; // 0-1, affects confidence in this rule
}

export interface ICPScore {
    score: number; // 0-100
    confidence: number; // 0-1
    reasoning: string;
    criteria_scores: CriteriaScore[];
    model_version: string;
    enrichment_needed: boolean;
}

export interface CriteriaScore {
    criteria_id: string;
    criteria_name: string;
    score: number;
    confidence: number;
    matched_rules: string[];
    missing_data: string[];
}

export interface ModelTrainingData {
    leads: Lead[];
    outcomes: number[]; // 1 for converted, 0 for not converted
    weights?: number[]; // Optional weights for each lead
}

export interface ModelPerformance {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    auc_roc: number;
    confusion_matrix: number[][];
    feature_importance: Record<string, number>;
}

export class ICPScoringEngine {
    private model: tf.LayersModel | null = null;
    private criteria: ICPCriteria[] = [];
    private modelVersion: string = 'v1.0';
    private featureNames: string[] = [];
    private scaler: { mean: number[]; std: number[] } | null = null;

    constructor(criteria: ICPCriteria[] = []) {
        this.criteria = criteria;
        this.initializeDefaultCriteria();
    }

    private initializeDefaultCriteria(): void {
        if (this.criteria.length === 0) {
            this.criteria = [
                {
                    id: 'company_size',
                    name: 'Company Size',
                    description: 'Employee count indicates market fit',
                    weight: 0.25,
                    scoring_rules: [
                        {
                            field_path: 'company.size_employees',
                            operator: 'in_range',
                            value: [100, 1000],
                            score: 90,
                            confidence_modifier: 0.9
                        },
                        {
                            field_path: 'company.size_employees',
                            operator: 'in_range',
                            value: [50, 100],
                            score: 70,
                            confidence_modifier: 0.8
                        },
                        {
                            field_path: 'company.size_employees',
                            operator: 'greater_than',
                            value: 1000,
                            score: 60,
                            confidence_modifier: 0.7
                        }
                    ],
                    created_at: new Date(),
                    updated_at: new Date()
                },
                {
                    id: 'industry_match',
                    name: 'Industry Match',
                    description: 'Target industries with higher conversion rates',
                    weight: 0.2,
                    scoring_rules: [
                        {
                            field_path: 'company.industry',
                            operator: 'equals',
                            value: 'Technology',
                            score: 95,
                            confidence_modifier: 0.95
                        },
                        {
                            field_path: 'company.industry',
                            operator: 'equals',
                            value: 'Financial Services',
                            score: 85,
                            confidence_modifier: 0.9
                        },
                        {
                            field_path: 'company.industry',
                            operator: 'equals',
                            value: 'Healthcare',
                            score: 80,
                            confidence_modifier: 0.85
                        }
                    ],
                    created_at: new Date(),
                    updated_at: new Date()
                },
                {
                    id: 'revenue_range',
                    name: 'Revenue Range',
                    description: 'Annual revenue indicates buying power',
                    weight: 0.2,
                    scoring_rules: [
                        {
                            field_path: 'company.annual_revenue',
                            operator: 'in_range',
                            value: [10000000, 100000000], // $10M - $100M
                            score: 90,
                            confidence_modifier: 0.9
                        },
                        {
                            field_path: 'company.annual_revenue',
                            operator: 'in_range',
                            value: [5000000, 10000000], // $5M - $10M
                            score: 75,
                            confidence_modifier: 0.8
                        },
                        {
                            field_path: 'company.annual_revenue',
                            operator: 'greater_than',
                            value: 100000000, // > $100M
                            score: 70,
                            confidence_modifier: 0.75
                        }
                    ],
                    created_at: new Date(),
                    updated_at: new Date()
                },
                {
                    id: 'decision_maker_title',
                    name: 'Decision Maker Title',
                    description: 'Contact title indicates decision-making authority',
                    weight: 0.15,
                    scoring_rules: [
                        {
                            field_path: 'contact.title',
                            operator: 'regex',
                            value: '(CEO|CTO|VP|Director|Head)',
                            score: 95,
                            confidence_modifier: 0.95
                        },
                        {
                            field_path: 'contact.title',
                            operator: 'regex',
                            value: '(Manager|Lead|Senior)',
                            score: 70,
                            confidence_modifier: 0.8
                        },
                        {
                            field_path: 'contact.title',
                            operator: 'regex',
                            value: '(Analyst|Specialist|Coordinator)',
                            score: 40,
                            confidence_modifier: 0.6
                        }
                    ],
                    created_at: new Date(),
                    updated_at: new Date()
                },
                {
                    id: 'technology_stack',
                    name: 'Technology Stack',
                    description: 'Existing technologies indicate integration potential',
                    weight: 0.1,
                    scoring_rules: [
                        {
                            field_path: 'enrichment_data.technographics.technologies',
                            operator: 'contains',
                            value: 'Salesforce',
                            score: 85,
                            confidence_modifier: 0.9
                        },
                        {
                            field_path: 'enrichment_data.technographics.technologies',
                            operator: 'contains',
                            value: 'HubSpot',
                            score: 80,
                            confidence_modifier: 0.85
                        },
                        {
                            field_path: 'enrichment_data.technographics.platforms',
                            operator: 'contains',
                            value: 'AWS',
                            score: 75,
                            confidence_modifier: 0.8
                        }
                    ],
                    created_at: new Date(),
                    updated_at: new Date()
                },
                {
                    id: 'intent_signals',
                    name: 'Intent Signals',
                    description: 'Behavioral signals indicating purchase intent',
                    weight: 0.1,
                    scoring_rules: [
                        {
                            field_path: 'enrichment_data.intent_signals',
                            operator: 'contains',
                            value: 'content_engagement',
                            score: 90,
                            confidence_modifier: 0.9
                        },
                        {
                            field_path: 'enrichment_data.intent_signals',
                            operator: 'contains',
                            value: 'competitor_research',
                            score: 85,
                            confidence_modifier: 0.85
                        },
                        {
                            field_path: 'enrichment_data.intent_signals',
                            operator: 'contains',
                            value: 'pricing_page_visit',
                            score: 95,
                            confidence_modifier: 0.95
                        }
                    ],
                    created_at: new Date(),
                    updated_at: new Date()
                }
            ];
        }
    }

    async scoreLead(lead: Lead): Promise<ICPScore> {
        const criteriaScores = await this.evaluateCriteria(lead);
        const overallScore = this.calculateOverallScore(criteriaScores);
        const confidence = this.calculateConfidence(criteriaScores);
        const reasoning = this.generateReasoning(criteriaScores);
        const enrichmentNeeded = this.assessEnrichmentNeeds(lead, criteriaScores);

        return {
            score: Math.round(overallScore),
            confidence: Math.round(confidence * 100) / 100,
            reasoning,
            criteria_scores: criteriaScores,
            model_version: this.modelVersion,
            enrichment_needed: enrichmentNeeded
        };
    }

    private async evaluateCriteria(lead: Lead): Promise<CriteriaScore[]> {
        const scores: CriteriaScore[] = [];

        for (const criteria of this.criteria) {
            const criteriaScore = await this.evaluateSingleCriteria(criteria, lead);
            scores.push(criteriaScore);
        }

        return scores;
    }

    private async evaluateSingleCriteria(criteria: ICPCriteria, lead: Lead): Promise<CriteriaScore> {
        let totalScore = 0;
        let totalConfidence = 0;
        let matchedRules: string[] = [];
        let missingData: string[] = [];
        let ruleCount = 0;

        for (const rule of criteria.scoring_rules) {
            const fieldValue = this.getFieldValue(lead, rule.field_path);

            if (fieldValue === undefined || fieldValue === null) {
                missingData.push(rule.field_path);
                continue;
            }

            const ruleMatches = this.evaluateRule(rule, fieldValue);
            if (ruleMatches) {
                totalScore += rule.score;
                totalConfidence += rule.confidence_modifier;
                matchedRules.push(`${rule.field_path} ${rule.operator} ${rule.value}`);
                ruleCount++;
            }
        }

        // If no rules matched, check if it's due to missing data
        if (ruleCount === 0 && missingData.length > 0) {
            return {
                criteria_id: criteria.id,
                criteria_name: criteria.name,
                score: 0,
                confidence: 0,
                matched_rules: [],
                missing_data: missingData
            };
        }

        // Calculate average scores
        const avgScore = ruleCount > 0 ? totalScore / ruleCount : 0;
        const avgConfidence = ruleCount > 0 ? totalConfidence / ruleCount : 0;

        return {
            criteria_id: criteria.id,
            criteria_name: criteria.name,
            score: Math.round(avgScore),
            confidence: Math.round(avgConfidence * 100) / 100,
            matched_rules: matchedRules,
            missing_data: missingData
        };
    }

    private getFieldValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    private evaluateRule(rule: ScoringRule, fieldValue: any): boolean {
        switch (rule.operator) {
            case 'equals':
                return fieldValue === rule.value;

            case 'contains':
                if (Array.isArray(fieldValue)) {
                    return fieldValue.some(item =>
                        typeof item === 'string' && item.toLowerCase().includes(rule.value.toLowerCase())
                    );
                }
                return typeof fieldValue === 'string' &&
                    fieldValue.toLowerCase().includes(rule.value.toLowerCase());

            case 'greater_than':
                return typeof fieldValue === 'number' && fieldValue > rule.value;

            case 'less_than':
                return typeof fieldValue === 'number' && fieldValue < rule.value;

            case 'in_range':
                if (Array.isArray(rule.value) && rule.value.length === 2) {
                    return typeof fieldValue === 'number' &&
                        fieldValue >= rule.value[0] &&
                        fieldValue <= rule.value[1];
                }
                return false;

            case 'regex':
                if (typeof fieldValue === 'string' && typeof rule.value === 'string') {
                    const regex = new RegExp(rule.value, 'i');
                    return regex.test(fieldValue);
                }
                return false;

            default:
                return false;
        }
    }

    private calculateOverallScore(criteriaScores: CriteriaScore[]): number {
        let weightedScore = 0;
        let totalWeight = 0;

        for (const criteriaScore of criteriaScores) {
            const criteria = this.criteria.find(c => c.id === criteriaScore.criteria_id);
            if (criteria && criteriaScore.confidence > 0) {
                weightedScore += criteriaScore.score * criteria.weight * criteriaScore.confidence;
                totalWeight += criteria.weight * criteriaScore.confidence;
            }
        }

        return totalWeight > 0 ? weightedScore / totalWeight : 0;
    }

    private calculateConfidence(criteriaScores: CriteriaScore[]): number {
        let totalConfidence = 0;
        let criteriaWithData = 0;

        for (const criteriaScore of criteriaScores) {
            if (criteriaScore.matched_rules.length > 0) {
                totalConfidence += criteriaScore.confidence;
                criteriaWithData++;
            }
        }

        // Penalize confidence for missing data
        const dataCompleteness = criteriaWithData / this.criteria.length;
        const avgConfidence = criteriaWithData > 0 ? totalConfidence / criteriaWithData : 0;

        return avgConfidence * dataCompleteness;
    }

    private generateReasoning(criteriaScores: CriteriaScore[]): string {
        const reasons: string[] = [];

        // Sort criteria by score contribution
        const sortedScores = criteriaScores
            .filter(cs => cs.score > 0)
            .sort((a, b) => b.score - a.score);

        // Add top positive factors
        for (let i = 0; i < Math.min(3, sortedScores.length); i++) {
            const cs = sortedScores[i];
            reasons.push(`Strong ${cs.criteria_name.toLowerCase()} match (${cs.score}/100)`);
        }

        // Add concerns for missing data
        const missingDataCriteria = criteriaScores.filter(cs => cs.missing_data.length > 0);
        if (missingDataCriteria.length > 0) {
            reasons.push(`Limited data for ${missingDataCriteria.length} criteria`);
        }

        // Add low-scoring factors
        const lowScores = criteriaScores.filter(cs => cs.score > 0 && cs.score < 50);
        if (lowScores.length > 0) {
            reasons.push(`Weak match on ${lowScores[0].criteria_name.toLowerCase()}`);
        }

        return reasons.length > 0 ? reasons.join('; ') : 'Insufficient data for scoring';
    }

    private assessEnrichmentNeeds(lead: Lead, criteriaScores: CriteriaScore[]): boolean {
        // Check if critical data is missing
        const criticalMissingData = criteriaScores
            .filter(cs => cs.missing_data.length > 0)
            .filter(cs => {
                const criteria = this.criteria.find(c => c.id === cs.criteria_id);
                return criteria && criteria.weight > 0.15; // High-weight criteria
            });

        return criticalMissingData.length > 0;
    }

    // Machine Learning Model Methods
    async trainModel(trainingData: ModelTrainingData): Promise<ModelPerformance> {
        const features = this.extractFeatures(trainingData.leads);
        const labels = tf.tensor1d(trainingData.outcomes);

        // Normalize features
        this.scaler = this.calculateScaler(features);
        const normalizedFeatures = this.normalizeFeatures(features, this.scaler);

        // Create model architecture
        this.model = tf.sequential({
            layers: [
                tf.layers.dense({ inputShape: [features.shape[1]], units: 64, activation: 'relu' }),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({ units: 32, activation: 'relu' }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({ units: 16, activation: 'relu' }),
                tf.layers.dense({ units: 1, activation: 'sigmoid' })
            ]
        });

        // Compile model
        this.model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });

        // Train model
        const history = await this.model.fit(normalizedFeatures, labels, {
            epochs: 100,
            batchSize: 32,
            validationSplit: 0.2,
            callbacks: {
                onEpochEnd: (epoch: number, logs: any) => {
                    if (epoch % 10 === 0) {
                        console.log(`Epoch ${epoch}: loss = ${logs?.loss}, accuracy = ${logs?.acc}`);
                    }
                }
            }
        });

        // Calculate performance metrics
        const predictions = this.model.predict(normalizedFeatures) as tf.Tensor;
        const performance = await this.calculatePerformance(
            trainingData.outcomes,
            new Float32Array(Array.from(await predictions.data()))
        );

        // Clean up tensors
        features.dispose();
        labels.dispose();
        normalizedFeatures.dispose();
        predictions.dispose();

        return performance;
    }

    private extractFeatures(leads: Lead[]): tf.Tensor2D {
        const features: number[][] = [];
        this.featureNames = [
            'company_size_employees',
            'annual_revenue',
            'industry_tech',
            'industry_finance',
            'industry_healthcare',
            'title_executive',
            'title_manager',
            'has_salesforce',
            'has_hubspot',
            'has_aws',
            'intent_signals_count'
        ];

        for (const lead of leads) {
            const featureVector = [
                lead.company?.size_employees || 0,
                lead.company?.annual_revenue || 0,
                lead.company?.industry === 'Technology' ? 1 : 0,
                lead.company?.industry === 'Financial Services' ? 1 : 0,
                lead.company?.industry === 'Healthcare' ? 1 : 0,
                /CEO|CTO|VP|Director|Head/i.test(lead.contact?.title || '') ? 1 : 0,
                /Manager|Lead|Senior/i.test(lead.contact?.title || '') ? 1 : 0,
                lead.enrichment_data?.technographics?.technologies?.includes('Salesforce') ? 1 : 0,
                lead.enrichment_data?.technographics?.technologies?.includes('HubSpot') ? 1 : 0,
                lead.enrichment_data?.technographics?.platforms?.includes('AWS') ? 1 : 0,
                lead.enrichment_data?.intent_signals?.length || 0
            ];
            features.push(featureVector);
        }

        return tf.tensor2d(features);
    }

    private calculateScaler(features: tf.Tensor2D): { mean: number[]; std: number[] } {
        const mean = features.mean(0).dataSync() as Float32Array;
        const std = features.sub(mean).square().mean(0).sqrt().dataSync() as Float32Array;

        return {
            mean: Array.from(mean),
            std: Array.from(std).map(s => s === 0 ? 1 : s) // Avoid division by zero
        };
    }

    private normalizeFeatures(features: tf.Tensor2D, scaler: { mean: number[]; std: number[] }): tf.Tensor2D {
        const meanTensor = tf.tensor1d(scaler.mean);
        const stdTensor = tf.tensor1d(scaler.std);

        const normalized = features.sub(meanTensor).div(stdTensor) as tf.Tensor2D;

        meanTensor.dispose();
        stdTensor.dispose();

        return normalized;
    }

    private async calculatePerformance(actual: number[], predicted: Float32Array): Promise<ModelPerformance> {
        const threshold = 0.5;
        const binaryPredicted = Array.from(predicted).map(p => p >= threshold ? 1 : 0);

        let tp = 0, fp = 0, tn = 0, fn = 0;

        for (let i = 0; i < actual.length; i++) {
            if (actual[i] === 1 && binaryPredicted[i] === 1) tp++;
            else if (actual[i] === 0 && binaryPredicted[i] === 1) fp++;
            else if (actual[i] === 0 && binaryPredicted[i] === 0) tn++;
            else if (actual[i] === 1 && binaryPredicted[i] === 0) fn++;
        }

        const accuracy = (tp + tn) / (tp + fp + tn + fn);
        const precision = tp / (tp + fp) || 0;
        const recall = tp / (tp + fn) || 0;
        const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

        // Calculate AUC-ROC (simplified)
        const aucRoc = this.calculateAUC(actual, Array.from(predicted));

        return {
            accuracy,
            precision,
            recall,
            f1_score: f1Score,
            auc_roc: aucRoc,
            confusion_matrix: [[tn, fp], [fn, tp]],
            feature_importance: this.calculateFeatureImportance()
        };
    }

    private calculateAUC(actual: number[], predicted: number[]): number {
        // Simplified AUC calculation
        const pairs = actual.map((a, i) => ({ actual: a, predicted: predicted[i] }))
            .sort((a, b) => b.predicted - a.predicted);

        let auc = 0;
        let positives = actual.filter(a => a === 1).length;
        let negatives = actual.length - positives;

        if (positives === 0 || negatives === 0) return 0.5;

        let truePositives = 0;
        let falsePositives = 0;

        for (const pair of pairs) {
            if (pair.actual === 1) {
                truePositives++;
            } else {
                falsePositives++;
                auc += truePositives;
            }
        }

        return auc / (positives * negatives);
    }

    private calculateFeatureImportance(): Record<string, number> {
        // Simplified feature importance based on criteria weights
        const importance: Record<string, number> = {};

        for (let i = 0; i < this.featureNames.length; i++) {
            importance[this.featureNames[i]] = Math.random() * 0.1 + 0.05; // Placeholder
        }

        return importance;
    }

    async saveModel(path: string): Promise<void> {
        if (this.model) {
            await this.model.save(`file://${path}`);
        }
    }

    async loadModel(path: string): Promise<void> {
        this.model = await tf.loadLayersModel(`file://${path}`);
    }

    getCriteria(): ICPCriteria[] {
        return this.criteria;
    }

    updateCriteria(criteria: ICPCriteria[]): void {
        this.criteria = criteria;
    }

    getModelVersion(): string {
        return this.modelVersion;
    }
}

export default ICPScoringEngine;