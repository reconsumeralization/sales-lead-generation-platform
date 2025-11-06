import { Lead, LeadValidator, LeadEntity, Company, Contact } from '../Lead';

describe('Lead Model Tests', () => {
  const mockCompany: Company = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Company',
    domain: 'testcompany.com',
    industry: 'Technology',
    size_employees: 100,
    annual_revenue: 1000000,
    location: {
      country: 'USA',
      state: 'CA',
      city: 'San Francisco'
    }
  };

  const mockContact: Contact = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    company_id: '123e4567-e89b-12d3-a456-426614174000',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@testcompany.com',
    phone: '+1234567890',
    title: 'CEO',
    linkedin_url: 'https://linkedin.com/in/johndoe'
  };

  const mockLead: Lead = {
    id: '123e4567-e89b-12d3-a456-426614174002',
    company_id: mockCompany.id,
    contact_id: mockContact.id,
    company: mockCompany,
    contact: mockContact,
    source: {
      channel: 'website',
      campaign: 'demo-request',
      medium: 'organic'
    },
    status: 'new',
    scoring: {
      icp_score: 85,
      confidence_score: 0.92,
      reasoning: 'High-value prospect in target industry',
      model_version: 'v1.0'
    },
    enrichment_data: {
      technographics: {
        technologies: ['Salesforce', 'HubSpot'],
        platforms: ['AWS', 'Azure']
      },
      intent_signals: [{
        signal_type: 'content_engagement',
        strength: 0.8,
        source: 'website',
        timestamp: new Date()
      }]
    }
  };

  describe('Lead Validation', () => {
    test('should validate a complete lead successfully', () => {
      const result = LeadValidator.validateLead(mockLead);
      expect(result.error).toBeUndefined();
    });

    test('should require source and status fields', () => {
      const invalidLead = { ...mockLead };
      delete (invalidLead as any).source;
      delete (invalidLead as any).status;

      const result = LeadValidator.validateLead(invalidLead);
      expect(result.error).toBeDefined();
      expect(result.error?.details).toHaveLength(2);
    });

    test('should validate ICP score range', () => {
      const invalidLead = {
        ...mockLead,
        scoring: {
          ...mockLead.scoring!,
          icp_score: 150 // Invalid: > 100
        }
      };

      const result = LeadValidator.validateLead(invalidLead);
      expect(result.error).toBeDefined();
    });

    test('should validate confidence score range', () => {
      const invalidLead = {
        ...mockLead,
        scoring: {
          ...mockLead.scoring!,
          confidence_score: 1.5 // Invalid: > 1
        }
      };

      const result = LeadValidator.validateLead(invalidLead);
      expect(result.error).toBeDefined();
    });

    test('should validate email format', () => {
      const invalidContact = {
        ...mockContact,
        email: 'invalid-email'
      };

      const result = LeadValidator.validateContact(invalidContact);
      expect(result.error).toBeDefined();
    });

    test('should validate phone number format', () => {
      const invalidContact = {
        ...mockContact,
        phone: 'invalid-phone'
      };

      const result = LeadValidator.validateContact(invalidContact);
      expect(result.error).toBeDefined();
    });
  });

  describe('Lead Business Logic Validation', () => {
    test('should validate lead for scoring', () => {
      const validLead = { ...mockLead, status: 'new' as const };
      expect(LeadValidator.validateLeadForScoring(validLead)).toBe(true);

      const invalidLead = { ...mockLead, status: 'converted' as const };
      expect(LeadValidator.validateLeadForScoring(invalidLead)).toBe(false);
    });

    test('should validate lead for enrichment based on staleness', () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 31); // 31 days ago

      const staleLead = { ...mockLead, last_enriched_at: staleDate };
      expect(LeadValidator.validateLeadForEnrichment(staleLead)).toBe(true);

      const freshLead = { ...mockLead, last_enriched_at: new Date() };
      expect(LeadValidator.validateLeadForEnrichment(freshLead)).toBe(false);
    });

    test('should validate ICP score and confidence', () => {
      expect(LeadValidator.validateICPScore(85, 0.92)).toBe(true);
      expect(LeadValidator.validateICPScore(150, 0.92)).toBe(false);
      expect(LeadValidator.validateICPScore(85, 1.5)).toBe(false);
    });
  });

  describe('Database Entity Mapping', () => {
    test('should convert from database row to Lead object', () => {
      const dbRow = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        company_id: '123e4567-e89b-12d3-a456-426614174000',
        contact_id: '123e4567-e89b-12d3-a456-426614174001',
        source_channel: 'website',
        source_campaign: 'demo-request',
        source_medium: 'organic',
        status: 'new',
        icp_score: 85,
        confidence_score: 0.92,
        scoring_reasoning: 'High-value prospect',
        model_version: 'v1.0',
        assigned_to: null,
        enrichment_data: { technologies: ['Salesforce'] },
        created_at: new Date(),
        updated_at: new Date(),
        last_enriched_at: new Date()
      };

      const lead = LeadEntity.fromDatabase(dbRow);
      
      expect(lead.id).toBe(dbRow.id);
      expect(lead.source.channel).toBe(dbRow.source_channel);
      expect(lead.scoring?.icp_score).toBe(dbRow.icp_score);
    });

    test('should convert from Lead object to database format', () => {
      const dbData = LeadEntity.toDatabase(mockLead);
      
      expect(dbData.id).toBe(mockLead.id);
      expect(dbData.source_channel).toBe(mockLead.source.channel);
      expect(dbData.icp_score).toBe(mockLead.scoring?.icp_score);
      expect(typeof dbData.enrichment_data).toBe('string');
    });
  });

  describe('Company Validation', () => {
    test('should validate company with required fields', () => {
      const result = LeadValidator.validateCompany(mockCompany);
      expect(result.error).toBeUndefined();
    });

    test('should require company name', () => {
      const invalidCompany = { ...mockCompany };
      delete (invalidCompany as any).name;

      const result = LeadValidator.validateCompany(invalidCompany);
      expect(result.error).toBeDefined();
    });

    test('should validate domain format', () => {
      const invalidCompany = {
        ...mockCompany,
        domain: 'invalid-domain'
      };

      const result = LeadValidator.validateCompany(invalidCompany);
      expect(result.error).toBeDefined();
    });

    test('should validate employee size range', () => {
      const invalidCompany = {
        ...mockCompany,
        size_employees: -1
      };

      const result = LeadValidator.validateCompany(invalidCompany);
      expect(result.error).toBeDefined();
    });
  });

  describe('Contact Validation', () => {
    test('should validate contact with required fields', () => {
      const result = LeadValidator.validateContact(mockContact);
      expect(result.error).toBeUndefined();
    });

    test('should require first name, last name, and email', () => {
      const invalidContact = { ...mockContact };
      delete (invalidContact as any).first_name;
      delete (invalidContact as any).last_name;
      delete (invalidContact as any).email;

      const result = LeadValidator.validateContact(invalidContact);
      expect(result.error).toBeDefined();
      expect(result.error?.details).toHaveLength(3);
    });

    test('should validate LinkedIn URL format', () => {
      const invalidContact = {
        ...mockContact,
        linkedin_url: 'not-a-url'
      };

      const result = LeadValidator.validateContact(invalidContact);
      expect(result.error).toBeDefined();
    });
  });
});