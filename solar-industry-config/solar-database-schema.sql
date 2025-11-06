-- Solar Industry Database Schema Extensions
-- For Ron's Florida Solar LLC

-- Solar Prospects Table (extends leads)
CREATE TABLE solar_prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Property Information
    property_type VARCHAR(50), -- single_family, townhouse, condo, commercial
    roof_type VARCHAR(50), -- asphalt_shingle, metal, tile, flat, slate
    roof_age INTEGER,
    roof_condition VARCHAR(20), -- excellent, good, fair, poor
    roof_orientation VARCHAR(20), -- south, southwest, southeast, etc.
    roof_size_sqft INTEGER,
    shading_level VARCHAR(20), -- none, minimal, moderate, heavy
    hoa_restrictions BOOLEAN DEFAULT false,
    
    -- Energy Profile
    monthly_electric_bill DECIMAL(10,2),
    monthly_kwh_usage INTEGER,
    utility_company VARCHAR(100),
    rate_structure VARCHAR(50), -- tiered, time_of_use, flat
    peak_usage_time VARCHAR(20), -- morning, afternoon, evening
    
    -- Financial Information
    credit_score INTEGER,
    annual_income DECIMAL(12,2),
    homeownership_years INTEGER,
    debt_to_income_ratio DECIMAL(5,2),
    financing_preference VARCHAR(50), -- cash, loan, lease, ppa
    
    -- Solar Suitability
    solar_irradiance_score DECIMAL(5,2), -- kWh/m²/day
    estimated_system_size DECIMAL(8,2), -- kW
    estimated_annual_production INTEGER, -- kWh
    estimated_monthly_savings DECIMAL(10,2),
    estimated_payback_years DECIMAL(4,1),
    
    -- Lead Qualification
    solar_suitability_score INTEGER, -- 0-100
    financial_qualification_score INTEGER, -- 0-100
    timeline_readiness VARCHAR(20), -- immediate, 3_months, 6_months, 12_months, exploring
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Solar Proposals Table
CREATE TABLE solar_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID REFERENCES solar_prospects(id) ON DELETE CASCADE,
    proposal_number VARCHAR(50) UNIQUE,
    
    -- System Design
    system_size_kw DECIMAL(8,2),
    panel_count INTEGER,
    panel_model VARCHAR(100),
    panel_wattage INTEGER,
    inverter_type VARCHAR(100),
    inverter_count INTEGER,
    mounting_type VARCHAR(50), -- roof_mount, ground_mount, carport
    
    -- Production Estimates
    estimated_annual_production INTEGER, -- kWh
    estimated_monthly_production INTEGER, -- kWh
    production_degradation_rate DECIMAL(4,2), -- % per year
    
    -- Financial Analysis
    system_cost DECIMAL(12,2),
    cost_per_watt DECIMAL(6,2),
    federal_tax_credit DECIMAL(12,2),
    state_incentives DECIMAL(12,2),
    utility_rebates DECIMAL(12,2),
    net_system_cost DECIMAL(12,2),
    
    -- Savings Analysis
    year_1_savings DECIMAL(10,2),
    annual_escalation_rate DECIMAL(4,2),
    lifetime_savings DECIMAL(12,2),
    payback_period_years DECIMAL(4,1),
    roi_percentage DECIMAL(5,2),
    
    -- Financing Options
    cash_price DECIMAL(12,2),
    loan_amount DECIMAL(12,2),
    loan_term_years INTEGER,
    loan_interest_rate DECIMAL(5,2),
    monthly_loan_payment DECIMAL(10,2),
    lease_monthly_payment DECIMAL(10,2),
    ppa_rate_per_kwh DECIMAL(6,4),
    
    -- Proposal Status
    status VARCHAR(50) DEFAULT 'draft', -- draft, sent, viewed, accepted, rejected, expired
    sent_at TIMESTAMP,
    viewed_at TIMESTAMP,
    accepted_at TIMESTAMP,
    expires_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Solar Installations Table
CREATE TABLE solar_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID REFERENCES solar_proposals(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Installation Details
    installation_address TEXT,
    permit_number VARCHAR(100),
    permit_status VARCHAR(50), -- pending, approved, rejected
    permit_submitted_at TIMESTAMP,
    permit_approved_at TIMESTAMP,
    
    -- Utility Interconnection
    utility_application_number VARCHAR(100),
    interconnection_status VARCHAR(50), -- pending, approved, connected
    pto_date TIMESTAMP, -- Permission to Operate
    
    -- Installation Schedule
    scheduled_install_date DATE,
    actual_install_date DATE,
    installation_duration_days INTEGER,
    installer_crew_id VARCHAR(50),
    
    -- System Commissioning
    system_commissioned_at TIMESTAMP,
    final_inspection_date DATE,
    inspection_passed BOOLEAN,
    warranty_start_date DATE,
    
    -- Performance Monitoring
    monitoring_system_id VARCHAR(100),
    monitoring_login_created BOOLEAN DEFAULT false,
    customer_portal_activated BOOLEAN DEFAULT false,
    
    -- Status Tracking
    installation_status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
    completion_percentage INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Solar Performance Data Table
CREATE TABLE solar_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id UUID REFERENCES solar_installations(id) ON DELETE CASCADE,
    
    -- Performance Metrics
    measurement_date DATE,
    daily_production_kwh DECIMAL(8,2),
    monthly_production_kwh DECIMAL(10,2),
    annual_production_kwh DECIMAL(12,2),
    
    -- System Health
    system_efficiency_percentage DECIMAL(5,2),
    inverter_efficiency_percentage DECIMAL(5,2),
    panel_degradation_percentage DECIMAL(5,2),
    
    -- Environmental Data
    solar_irradiance DECIMAL(6,2), -- kWh/m²
    temperature_celsius DECIMAL(4,1),
    weather_conditions VARCHAR(50),
    
    -- Financial Performance
    energy_savings_dollar DECIMAL(10,2),
    cumulative_savings DECIMAL(12,2),
    avoided_co2_lbs DECIMAL(10,2),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Solar Lead Sources Table
CREATE TABLE solar_lead_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Source Attribution
    source_type VARCHAR(50), -- website, google_ads, facebook, referral, canvassing
    source_campaign VARCHAR(100),
    source_medium VARCHAR(50),
    source_content VARCHAR(100),
    referral_customer_id UUID REFERENCES leads(id),
    
    -- Cost Attribution
    cost_per_lead DECIMAL(10,2),
    campaign_budget DECIMAL(12,2),
    attribution_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Performance Tracking
    lead_quality_score INTEGER, -- 0-100
    conversion_probability DECIMAL(5,2),
    estimated_ltv DECIMAL(12,2), -- Lifetime Value
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Solar Financing Applications Table
CREATE TABLE solar_financing_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID REFERENCES solar_prospects(id) ON DELETE CASCADE,
    proposal_id UUID REFERENCES solar_proposals(id) ON DELETE CASCADE,
    
    -- Financing Details
    financing_type VARCHAR(50), -- loan, lease, ppa
    financing_partner VARCHAR(100), -- sunlight, mosaic, goodleap
    application_number VARCHAR(100),
    
    -- Loan Details
    loan_amount DECIMAL(12,2),
    loan_term_months INTEGER,
    interest_rate DECIMAL(5,2),
    monthly_payment DECIMAL(10,2),
    
    -- Application Status
    application_status VARCHAR(50), -- pending, approved, rejected, funded
    submitted_at TIMESTAMP,
    approved_at TIMESTAMP,
    funded_at TIMESTAMP,
    
    -- Credit Information
    credit_score_used INTEGER,
    debt_to_income_ratio DECIMAL(5,2),
    approval_conditions TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Solar Compliance Tracking Table
CREATE TABLE solar_compliance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    
    -- TCPA Compliance
    tcpa_consent_given BOOLEAN DEFAULT false,
    tcpa_consent_date TIMESTAMP,
    tcpa_consent_method VARCHAR(50), -- verbal, written, electronic
    
    -- Sales Disclosure
    sales_disclosure_provided BOOLEAN DEFAULT false,
    disclosure_provided_date TIMESTAMP,
    three_day_rescission_period TIMESTAMP,
    contract_rescinded BOOLEAN DEFAULT false,
    
    -- Truth in Advertising
    savings_claims_documented BOOLEAN DEFAULT false,
    production_estimates_documented BOOLEAN DEFAULT false,
    warranty_terms_disclosed BOOLEAN DEFAULT false,
    
    -- Record Keeping
    call_recordings_stored BOOLEAN DEFAULT false,
    contract_documents_stored BOOLEAN DEFAULT false,
    compliance_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_solar_prospects_lead_id ON solar_prospects(lead_id);
CREATE INDEX idx_solar_prospects_suitability_score ON solar_prospects(solar_suitability_score);
CREATE INDEX idx_solar_prospects_timeline ON solar_prospects(timeline_readiness);
CREATE INDEX idx_solar_proposals_prospect_id ON solar_proposals(prospect_id);
CREATE INDEX idx_solar_proposals_status ON solar_proposals(status);
CREATE INDEX idx_solar_installations_status ON solar_installations(installation_status);
CREATE INDEX idx_solar_performance_installation_id ON solar_performance(installation_id);
CREATE INDEX idx_solar_performance_date ON solar_performance(measurement_date);
CREATE INDEX idx_solar_lead_sources_lead_id ON solar_lead_sources(lead_id);
CREATE INDEX idx_solar_financing_status ON solar_financing_applications(application_status);

-- Views for Common Queries
CREATE VIEW solar_qualified_leads AS
SELECT 
    l.*,
    sp.solar_suitability_score,
    sp.financial_qualification_score,
    sp.estimated_monthly_savings,
    sp.timeline_readiness
FROM leads l
JOIN solar_prospects sp ON l.id = sp.lead_id
WHERE sp.solar_suitability_score >= 70
AND sp.financial_qualification_score >= 60;

CREATE VIEW solar_pipeline_summary AS
SELECT 
    sp.timeline_readiness,
    COUNT(*) as lead_count,
    AVG(sp.estimated_monthly_savings) as avg_monthly_savings,
    SUM(sp.estimated_system_size * 25000) as potential_revenue -- Assuming $25k average system
FROM solar_prospects sp
JOIN leads l ON sp.lead_id = l.id
WHERE l.status = 'active'
GROUP BY sp.timeline_readiness;

CREATE VIEW solar_performance_summary AS
SELECT 
    si.id as installation_id,
    si.actual_install_date,
    sp_perf.monthly_production_kwh,
    sp_perf.energy_savings_dollar,
    sp_perf.cumulative_savings,
    sp_perf.system_efficiency_percentage
FROM solar_installations si
LEFT JOIN solar_performance sp_perf ON si.id = sp_perf.installation_id
WHERE si.installation_status = 'completed';