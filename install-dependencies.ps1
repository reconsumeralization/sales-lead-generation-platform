# PowerShell script to install all dependencies for the Sales Lead Generation Platform

Write-Host "Installing dependencies for Sales Lead Generation Platform..." -ForegroundColor Green

# Install root dependencies
Write-Host "Installing root dependencies..." -ForegroundColor Yellow
npm install

# Install API Gateway dependencies
Write-Host "Installing API Gateway dependencies..." -ForegroundColor Yellow
Set-Location services/api-gateway
npm install
Set-Location ../..

# Install Lead Scoring Service dependencies
Write-Host "Installing Lead Scoring Service dependencies..." -ForegroundColor Yellow
Set-Location services/lead-scoring
npm install
Set-Location ../..

# Install Outreach Generation Service dependencies
Write-Host "Installing Outreach Generation Service dependencies..." -ForegroundColor Yellow
Set-Location services/outreach-generation
npm install
Set-Location ../..

# Install Deal Intelligence Service dependencies
Write-Host "Installing Deal Intelligence Service dependencies..." -ForegroundColor Yellow
Set-Location services/deal-intelligence
npm install
Set-Location ../..

# Install CRM Sync Service dependencies
Write-Host "Installing CRM Sync Service dependencies..." -ForegroundColor Yellow
Set-Location services/crm-sync
npm install
Set-Location ../..

# Install Compliance Service dependencies
Write-Host "Installing Compliance Service dependencies..." -ForegroundColor Yellow
Set-Location services/compliance
npm install
Set-Location ../..

# Install Analytics Service dependencies
Write-Host "Installing Analytics Service dependencies..." -ForegroundColor Yellow
Set-Location services/analytics
npm install
Set-Location ../..

Write-Host "All dependencies installed successfully!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Configure your .env file with API keys" -ForegroundColor White
Write-Host "2. Start the database: docker-compose up postgres -d" -ForegroundColor White
Write-Host "3. Run migrations: psql -h localhost -U postgres -d sales_platform -f database/init/01-create-tables.sql" -ForegroundColor White
Write-Host "4. Start all services: docker-compose up --build" -ForegroundColor White