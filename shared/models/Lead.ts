import Joi from 'joi';

export interface Company {
  id?: string;
  name: string;
  domain?: string;
  industry?: string;
  size_employees?: number;
  annual_revenue?: number;
  location?: {
    country?: string;
    state?: string;
    city?: string;
    address?: string;
  };
  technographics?: {
    technologies?: string[];
    platforms?: string[];
    integrations?: string[];
  };
  created_at?: Date;
  updated_at?: Date;
}

export interface Contact {
  id?: string;
  company_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  title?: string;
  linkedin_url?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface LeadSource {
  channel: string;
  campaign?: string;
  medium?: string;
}

export interface LeadScoring {
  icp_score?: number;
  confidence_score?: number;
  reasoning?: string;
  model_version?: string;
}

export interface EnrichmentData {
  technographics?: {
    technologies?: string[];
    platforms?: string[];
    integrations?: string[];
  };
  intent_signals?: Array<{
    signal_type: string;
    strength: number;
    source: string;
    timestamp: Date;
  }>;
  social_presence?: {
    linkedin_followers?: number;
    twitter_followers?: number;
    company_size_verified?: boolean;
  };
}

export type LeadStatus = 'new' | 'qualified' | 'contacted' | 'converted' | 'rejected';

export interface Lead {
  id?: string;
  company_id?: string;
  contact_id?: string;
  company?: Company;
  contact?: Contact;
  source: LeadSource;
  status: LeadStatus;
  scoring?: LeadScoring;
  assigned_to?: string;
  enrichment_data?: EnrichmentData;
  created_at?: Date;
  updated_at?: Date;
  last_enriched_at?: Date;
}

// Validation schemas
export const CompanySchema = Joi.object({
  id: Joi.string().uuid().optional(),
  name: Joi.string().min(1).max(255).required(),
  domain: Joi.string().domain().optional(),
  industry: Joi.string().max(100).optional(),
  size_employees: Joi.number().integer().min(1).max(1000000).optional(),
  annual_revenue: Joi.number().integer().min(0).optional(),
  location: Joi.object({
    country: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    city: Joi.string().max(100).optional(),
    address: Joi.string().max(500).optional()
  }).optional(),
  technographics: Joi.object({
    technologies: Joi.array().items(Joi.string()).optional(),
    platforms: Joi.array().items(Joi.string()).optional(),
    integrations: Joi.array().items(Joi.string()).optional()
  }).optional(),
  created_at: Joi.date().optional(),
  updated_at: Joi.date().optional()
});

export const ContactSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  company_id: Joi.string().uuid().optional(),
  first_name: Joi.string().min(1).max(100).required(),
  last_name: Joi.string().min(1).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).optional(),
  title: Joi.string().max(150).optional(),
  linkedin_url: Joi.string().uri().optional(),
  created_at: Joi.date().optional(),
  updated_at: Joi.date().optional()
});

export const LeadSourceSchema = Joi.object({
  channel: Joi.string().min(1).max(100).required(),
  campaign: Joi.string().max(200).optional(),
  medium: Joi.string().max(100).optional()
});

export const LeadScoringSchema = Joi.object({
  icp_score: Joi.number().integer().min(0).max(100).optional(),
  confidence_score: Joi.number().min(0).max(1).optional(),
  reasoning: Joi.string().max(1000).optional(),
  model_version: Joi.string().max(50).optional()
});

export const EnrichmentDataSchema = Joi.object({
  technographics: Joi.object({
    technologies: Joi.array().items(Joi.string()).optional(),
    platforms: Joi.array().items(Joi.string()).optional(),
    integrations: Joi.array().items(Joi.string()).optional()
  }).optional(),
  intent_signals: Joi.array().items(
    Joi.object({
      signal_type: Joi.string().required(),
      strength: Joi.number().min(0).max(1).required(),
      source: Joi.string().required(),
      timestamp: Joi.date().required()
    })
  ).optional(),
  social_presence: Joi.object({
    linkedin_followers: Joi.number().integer().min(0).optional(),
    twitter_followers: Joi.number().integer().min(0).optional(),
    company_size_verified: Joi.boolean().optional()
  }).optional()
});

export const LeadSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  company_id: Joi.string().uuid().optional(),
  contact_id: Joi.string().uuid().optional(),
  company: CompanySchema.optional(),
  contact: ContactSchema.optional(),
  source: LeadSourceSchema.required(),
  status: Joi.string().valid('new', 'qualified', 'contacted', 'converted', 'rejected').required(),
  scoring: LeadScoringSchema.optional(),
  assigned_to: Joi.string().uuid().optional(),
  enrichment_data: EnrichmentDataSchema.optional(),
  created_at: Joi.date().optional(),
  updated_at: Joi.date().optional(),
  last_enriched_at: Joi.date().optional()
});

// Validation functions
export class LeadValidator {
  static validateLead(lead: Lead): Joi.ValidationResult {
    return LeadSchema.validate(lead, { abortEarly: false });
  }

  static validateCompany(company: Company): Joi.ValidationResult {
    return CompanySchema.validate(company, { abortEarly: false });
  }

  static validateContact(contact: Contact): Joi.ValidationResult {
    return ContactSchema.validate(contact, { abortEarly: false });
  }

  static validateLeadForScoring(lead: Lead): boolean {
    // Check if lead has minimum required data for scoring
    if (!lead.company?.name || !lead.contact?.email) {
      return false;
    }

    // Check if lead is in a scorable status
    const scorableStatuses: LeadStatus[] = ['new', 'qualified'];
    return scorableStatuses.includes(lead.status);
  }

  static validateLeadForEnrichment(lead: Lead): boolean {
    // Check if lead needs enrichment
    if (!lead.last_enriched_at) {
      return true;
    }

    // Check if enrichment is stale (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return lead.last_enriched_at < thirtyDaysAgo;
  }

  static validateICPScore(score: number, confidence: number): boolean {
    return score >= 0 && score <= 100 && confidence >= 0 && confidence <= 1;
  }
}

// Database entity mapping
export class LeadEntity {
  static fromDatabase(row: any): Lead {
    return {
      id: row.id,
      company_id: row.company_id,
      contact_id: row.contact_id,
      source: {
        channel: row.source_channel,
        campaign: row.source_campaign,
        medium: row.source_medium
      },
      status: row.status as LeadStatus,
      scoring: {
        icp_score: row.icp_score,
        confidence_score: row.confidence_score,
        reasoning: row.scoring_reasoning,
        model_version: row.model_version
      },
      assigned_to: row.assigned_to,
      enrichment_data: row.enrichment_data,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_enriched_at: row.last_enriched_at
    };
  }

  static toDatabase(lead: Lead): any {
    return {
      id: lead.id,
      company_id: lead.company_id,
      contact_id: lead.contact_id,
      source_channel: lead.source.channel,
      source_campaign: lead.source.campaign,
      source_medium: lead.source.medium,
      status: lead.status,
      icp_score: lead.scoring?.icp_score,
      confidence_score: lead.scoring?.confidence_score,
      scoring_reasoning: lead.scoring?.reasoning,
      model_version: lead.scoring?.model_version,
      assigned_to: lead.assigned_to,
      enrichment_data: JSON.stringify(lead.enrichment_data),
      last_enriched_at: lead.last_enriched_at
    };
  }
}

export default Lead;