-- Sales Lead Generation Platform Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE lead_status AS ENUM ('new', 'qualified', 'contacted', 'converted', 'rejected');
CREATE TYPE message_status AS ENUM ('draft', 'scheduled', 'sent', 'delivered', 'opened', 'replied', 'bounced');
CREATE TYPE deal_stage AS ENUM ('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost');
CREATE TYPE channel_type AS ENUM ('email', 'linkedin', 'phone', 'sms');

-- Companies table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    industry VARCHAR(100),
    size_employees INTEGER,
    annual_revenue BIGINT,
    location JSONB,
    technographics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Contacts table
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    title VARCHAR(150),
    linkedin_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Leads table
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    source_channel VARCHAR(100),
    source_campaign VARCHAR(200),
    source_medium VARCHAR(100),
    status lead_status DEFAULT 'new',
    icp_score INTEGER CHECK (icp_score >= 0 AND icp_score <= 100),
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    scoring_reasoning TEXT,
    model_version VARCHAR(50),
    assigned_to UUID, -- Reference to user/sales rep
    enrichment_data JSONB,
    intent_signals JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_enriched_at TIMESTAMP WITH TIME ZONE
);

-- Outreach sequences table
CREATE TABLE outreach_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sequence_type VARCHAR(100),
    brand_profile VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL, -- Reference to user
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_id UUID REFERENCES outreach_sequences(id) ON DELETE CASCADE,
    prospect_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    channel channel_type NOT NULL,
    template_id UUID,
    subject VARCHAR(500),
    content TEXT NOT NULL,
    personalization_data JSONB,
    scheduled_time TIMESTAMP WITH TIME ZONE,
    sent_time TIMESTAMP WITH TIME ZONE,
    delivered_time TIMESTAMP WITH TIME ZONE,
    opened_time TIMESTAMP WITH TIME ZONE,
    replied_time TIMESTAMP WITH TIME ZONE,
    status message_status DEFAULT 'draft',
    external_message_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Deals table
CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_deal_id VARCHAR(255), -- CRM deal ID
    crm_source VARCHAR(100),
    company_id UUID REFERENCES companies(id),
    contact_id UUID REFERENCES contacts(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    value DECIMAL(15,2),
    stage deal_stage DEFAULT 'prospecting',
    probability_score DECIMAL(3,2) CHECK (probability_score >= 0 AND probability_score <= 1),
    risk_score DECIMAL(3,2) CHECK (risk_score >= 0 AND risk_score <= 1),
    expected_close_date DATE,
    actual_close_date DATE,
    assigned_to UUID, -- Reference to user/sales rep
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Deal intelligence table
CREATE TABLE deal_intelligence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    analysis_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    probability_score DECIMAL(3,2),
    confidence_interval JSONB,
    stage_progression JSONB,
    velocity_metrics JSONB,
    risk_factors JSONB,
    mitigation_strategies JSONB,
    next_actions JSONB,
    coaching_points JSONB,
    competitive_intelligence JSONB,
    forecast_impact JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CRM sync logs table
CREATE TABLE crm_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crm_type VARCHAR(100) NOT NULL,
    operation VARCHAR(50) NOT NULL, -- create, update, delete
    entity_type VARCHAR(100) NOT NULL, -- lead, contact, deal, etc.
    entity_id UUID NOT NULL,
    external_id VARCHAR(255),
    sync_status VARCHAR(50) DEFAULT 'pending', -- pending, success, failed, conflict
    sync_data JSONB,
    error_message TEXT,
    conflict_data JSONB,
    resolution_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Compliance audit logs table
CREATE TABLE compliance_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    data_before JSONB,
    data_after JSONB,
    ip_address INET,
    user_agent TEXT,
    compliance_flags JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance metrics table
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type VARCHAR(100) NOT NULL, -- lead_conversion, message_performance, deal_velocity
    entity_type VARCHAR(100), -- lead, message, deal, sequence
    entity_id UUID,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4),
    metric_metadata JSONB,
    measurement_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_icp_score ON leads(icp_score DESC);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);

CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_channel ON messages(channel);
CREATE INDEX idx_messages_scheduled_time ON messages(scheduled_time);
CREATE INDEX idx_messages_prospect_id ON messages(prospect_id);

CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_probability_score ON deals(probability_score DESC);
CREATE INDEX idx_deals_expected_close_date ON deals(expected_close_date);
CREATE INDEX idx_deals_assigned_to ON deals(assigned_to);

CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_industry ON companies(industry);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company_id ON contacts(company_id);

CREATE INDEX idx_crm_sync_logs_status ON crm_sync_logs(sync_status);
CREATE INDEX idx_crm_sync_logs_created_at ON crm_sync_logs(created_at DESC);

CREATE INDEX idx_compliance_audit_logs_created_at ON compliance_audit_logs(created_at DESC);
CREATE INDEX idx_compliance_audit_logs_user_id ON compliance_audit_logs(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_outreach_sequences_updated_at BEFORE UPDATE ON outreach_sequences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crm_sync_logs_updated_at BEFORE UPDATE ON crm_sync_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();