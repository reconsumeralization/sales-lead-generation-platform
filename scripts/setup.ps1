# Sales Lead Generation Platform Setup Script for Windows

Write-Host "🚀 Setting up Sales Lead Generation Platform..." -ForegroundColor Green

# Check if Docker is installed
try {
    docker --version | Out-Null
    Write-Host "✅ Docker is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if Docker Compose is installed
try {
    docker-compose --version | Out-Null
    Write-Host "✅ Docker Compose is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose is not installed. Please install Docker Compose first." -ForegroundColor Red
    exit 1
}

# Create environment file if it doesn't exist
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating environment file..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ Environment file created. Please update .env with your actual values." -ForegroundColor Green
}

# Create necessary directories
Write-Host "📁 Creating directories..." -ForegroundColor Yellow
$directories = @("logs", "data\postgres", "data\redis", "data\elasticsearch")
foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

# Build and start services
Write-Host "🔨 Building Docker images..." -ForegroundColor Yellow
docker-compose build

Write-Host "🚀 Starting services..." -ForegroundColor Yellow
docker-compose up -d

# Wait for services to be ready
Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Check service health
Write-Host "🔍 Checking service health..." -ForegroundColor Yellow
$services = @("postgres", "redis", "kafka", "api-gateway")
foreach ($service in $services) {
    $status = docker-compose ps $service
    if ($status -match "Up") {
        Write-Host "✅ $service is running" -ForegroundColor Green
    } else {
        Write-Host "❌ $service is not running" -ForegroundColor Red
    }
}

Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Services are running on:" -ForegroundColor Cyan
Write-Host "  - API Gateway: http://localhost:3000"
Write-Host "  - Lead Scoring: http://localhost:3001"
Write-Host "  - Outreach Generation: http://localhost:3002"
Write-Host "  - Deal Intelligence: http://localhost:3003"
Write-Host "  - CRM Sync: http://localhost:3004"
Write-Host "  - Compliance: http://localhost:3005"
Write-Host "  - Analytics: http://localhost:3006"
Write-Host ""
Write-Host "Database and cache:" -ForegroundColor Cyan
Write-Host "  - PostgreSQL: localhost:5432"
Write-Host "  - Redis: localhost:6379"
Write-Host "  - Elasticsearch: localhost:9200"
Write-Host ""
Write-Host "To stop services: docker-compose down" -ForegroundColor Yellow
Write-Host "To view logs: docker-compose logs -f [service-name]" -ForegroundColor Yellow