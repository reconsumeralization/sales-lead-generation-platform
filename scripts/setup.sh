#!/bin/bash

# Sales Lead Generation Platform Setup Script

set -e

echo "🚀 Setting up Sales Lead Generation Platform..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating environment file..."
    cp .env.example .env
    echo "✅ Environment file created. Please update .env with your actual values."
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p data/postgres
mkdir -p data/redis
mkdir -p data/elasticsearch

# Set permissions
chmod 755 logs
chmod 755 data

# Build and start services
echo "🔨 Building Docker images..."
docker-compose build

echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check service health
echo "🔍 Checking service health..."

services=("postgres" "redis" "kafka" "api-gateway")
for service in "${services[@]}"; do
    if docker-compose ps | grep -q "$service.*Up"; then
        echo "✅ $service is running"
    else
        echo "❌ $service is not running"
    fi
done

# Run database migrations
echo "🗄️ Running database migrations..."
docker-compose exec postgres psql -U postgres -d sales_platform -f /docker-entrypoint-initdb.d/01-create-tables.sql

echo "🎉 Setup complete!"
echo ""
echo "Services are running on:"
echo "  - API Gateway: http://localhost:3000"
echo "  - Lead Scoring: http://localhost:3001"
echo "  - Outreach Generation: http://localhost:3002"
echo "  - Deal Intelligence: http://localhost:3003"
echo "  - CRM Sync: http://localhost:3004"
echo "  - Compliance: http://localhost:3005"
echo "  - Analytics: http://localhost:3006"
echo ""
echo "Database and cache:"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo "  - Elasticsearch: localhost:9200"
echo ""
echo "To stop services: docker-compose down"
echo "To view logs: docker-compose logs -f [service-name]"