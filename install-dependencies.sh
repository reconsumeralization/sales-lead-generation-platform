#!/bin/bash

# Bash script to install all dependencies for the Sales Lead Generation Platform

echo "Installing dependencies for Sales Lead Generation Platform..."

# Install root dependencies
echo "Installing root dependencies..."
npm install

# Install API Gateway dependencies
echo "Installing API Gateway dependencies..."
cd services/api-gateway
npm install
cd ../..

# Install Lead Scoring Service dependencies
echo "Installing Lead Scoring Service dependencies..."
cd services/lead-scoring
npm install
cd ../..

# Install Outreach Generation Service dependencies
echo "Installing Outreach Generation Service dependencies..."
cd services/outreach-generation
npm install
cd ../..

# Install Deal Intelligence Service dependencies
echo "Installing Deal Intelligence Service dependencies..."
cd services/deal-intelligence
npm install
cd ../..

# Install CRM Sync Service dependencies
echo "Installing CRM Sync Service dependencies..."
cd services/crm-sync
npm install
cd ../..

# Install Compliance Service dependencies
echo "Installing Compliance Service dependencies..."
cd services/compliance
npm install
cd ../..

# Install Analytics Service dependencies
echo "Installing Analytics Service dependencies..."
cd services/analytics
npm install
cd ../..

echo "All dependencies installed successfully!"
echo "Next steps:"
echo "1. Configure your .env file with API keys"
echo "2. Start the database: docker-compose up postgres -d"
echo "3. Run migrations: psql -h localhost -U postgres -d sales_platform -f database/init/01-create-tables.sql"
echo "4. Start all services: docker-compose up --build"