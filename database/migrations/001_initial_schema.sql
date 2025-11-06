-- Migration: 001_initial_schema
-- Description: Create initial database schema for Sales Lead Generation Platform
-- Date: 2024-01-01

-- This migration creates the foundational tables and indexes
-- for the sales lead generation platform

-- The schema includes:
-- - Companies and contacts management
-- - Lead scoring and tracking
-- - Outreach sequences and messages
-- - Deal intelligence and analytics
-- - CRM synchronization logging
-- - Compliance audit trails
-- - Performance metrics tracking

-- All tables include proper foreign key relationships,
-- indexes for performance, and audit timestamps

-- See database/init/01-create-tables.sql for the actual schema definition
-- This file serves as a migration record for version control

SELECT 'Initial schema migration completed' as status;