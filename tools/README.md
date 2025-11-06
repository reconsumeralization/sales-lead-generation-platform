# 🛠️ Solar Platform Automation Tools

Comprehensive automation toolkit for **Ron's Florida Solar LLC** AI-Native Sales & Lead Generation Platform.

## 🚀 Quick Start

### One-Command Deployment
```bash
# Install tool dependencies
cd tools && npm install

# Deploy entire platform automatically
npm run deploy
```

### Available Tools

| Tool | Command | Description |
|------|---------|-------------|
| **🔧 Auto Setup** | `npm run setup` | Interactive platform configuration |
| **🚀 Deploy** | `npm run deploy` | One-click full deployment |
| **🧪 Test** | `npm run test` | Comprehensive integration testing |
| **📊 Monitor** | `npm run monitor` | Real-time system monitoring |
| **❤️ Health Check** | `npm run health-check` | Quick health verification |
| **⚡ Load Test** | `npm run load-test` | Performance and load testing |

## 🔧 Tool Details

### 1. **Auto Setup** (`auto-setup.js`)
Interactive wizard that configures your entire platform:

```bash
node auto-setup.js
```

**Features:**
- ✅ Environment configuration
- ✅ API key setup
- ✅ Database initialization
- ✅ Service configuration
- ✅ GitHub integration setup
- ✅ Solar-specific customization

**Interactive Prompts:**
- Deployment mode (development/staging/production)
- API keys (OpenAI, GitHub, CRM integrations)
- Company information
- Feature toggles
- Sample data loading

### 2. **Solar Deployment** (`deploy-solar.js`)
Automated deployment orchestrator:

```bash
node deploy-solar.js
```

**Deployment Steps:**
1. **Pre-deployment Checks**
   - Node.js version validation
   - Docker availability
   - Port availability
   - System resources

2. **Infrastructure Deployment**
   - PostgreSQL database
   - Redis cache
   - Kafka messaging
   - Elasticsearch search

3. **Service Deployment**
   - API Gateway
   - Lead Scoring Service
   - Outreach Generation
   - Deal Intelligence
   - CRM Sync
   - Compliance Service
   - Analytics Service

4. **Integration Setup**
   - GitHub webhook configuration
   - Repository synchronization
   - Solar-specific features

5. **Health Verification**
   - Service health checks
   - Database connectivity
   - API endpoint testing

### 3. **Integration Testing** (`test-integration.js`)
Comprehensive testing suite:

```bash
node test-integration.js
```

**Test Categories:**
- **Service Health Tests** - All microservices responding
- **Database Connectivity** - PostgreSQL, Redis, Kafka
- **GitHub Integration** - Webhook processing, repo sync
- **Lead Generation** - End-to-end lead processing
- **Solar Scoring** - ICP model accuracy
- **Message Generation** - AI-powered outreach
- **Performance Tests** - Response times, throughput
- **Security Tests** - Authentication, authorization
- **Data Validation** - Schema compliance
- **Rate Limiting** - API protection

**Test Options:**
```bash
# Full test suite
node test-integration.js

# Health checks only
node test-integration.js --health-only

# Load testing
node test-integration.js --load-test

# Specific test category
node test-integration.js --category=solar-scoring
```

### 4. **System Monitor** (`monitor-system.js`)
Real-time monitoring dashboard:

```bash
node monitor-system.js
```

**Monitoring Features:**
- **Service Status** - Health, response times, uptime
- **Infrastructure** - Database, cache, messaging
- **System Resources** - CPU, memory, disk usage
- **Business Metrics** - Leads, conversions, deals
- **Alert System** - Performance thresholds
- **Real-time Dashboard** - Live status updates

**Alert Thresholds:**
- Response time > 2 seconds
- Error rate > 5%
- Memory usage > 85%
- Disk usage > 90%
- CPU usage > 80%

## 🌞 Solar-Specific Features

### Solar Lead Processing Test
```bash
# Test solar lead qualification
curl -X POST http://localhost:8081/api/v1/leads/score \
  -H "Content-Type: application/json" \
  -d '{
    "lead_data": {
      "first_name": "John",
      "last_name": "Smith",
      "email": "john@email.com",
      "phone": "555-0123",
      "address": "123 Sunny St, Miami, FL",
      "monthly_electric_bill": 285,
      "property_type": "single_family",
      "roof_age": 8,
      "timeline": "3_months"
    }
  }'
```

### GitHub Integration Test
```bash
# Test GitHub webhook processing
curl -X POST http://localhost:9000/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: issues" \
  -d '{
    "action": "opened",
    "issue": {
      "title": "Interested in solar for my home",
      "body": "Hi, I want solar panels. My bill is $300/month.",
      "user": {"login": "potential-customer"}
    }
  }'
```

### Solar Message Generation Test
```bash
# Test AI-powered solar messaging
curl -X POST http://localhost:8082/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prospect": {
      "first_name": "Sarah",
      "city": "Tampa",
      "monthly_bill": 320,
      "estimated_savings": 200
    },
    "sequence_type": "email",
    "message_type": "initial",
    "industry_template": "solar_residential"
  }'
```

## 📊 Monitoring Dashboard

The monitoring tool provides a real-time dashboard showing:

```
🌞 Ron's Florida Solar LLC - System Monitor
============================================================
Last updated: 12/15/2023, 2:30:45 PM
Monitoring for: 2h 15m 30s

📊 Application Services
┌─────────────────────┬─────────────┬───────────────┬────────────┐
│ Service             │ Status      │ Response Time │ Last Check │
├─────────────────────┼─────────────┼───────────────┼────────────┤
│ API Gateway         │ ✅ Healthy  │ 45ms          │ 2:30:45 PM │
│ Lead Scoring        │ ✅ Healthy  │ 120ms         │ 2:30:45 PM │
│ Outreach Generation │ ✅ Healthy  │ 89ms          │ 2:30:45 PM │
│ Deal Intelligence   │ ✅ Healthy  │ 67ms          │ 2:30:45 PM │
│ CRM Sync            │ ✅ Healthy  │ 156ms         │ 2:30:45 PM │
│ Compliance          │ ✅ Healthy  │ 34ms          │ 2:30:45 PM │
│ Analytics           │ ✅ Healthy  │ 78ms          │ 2:30:45 PM │
└─────────────────────┴─────────────┴───────────────┴────────────┘

💻 System Resources
┌──────────┬─────────────────────┬────────┐
│ Resource │ Usage               │ Status │
├──────────┼─────────────────────┼────────┤
│ CPU      │ 23.5%               │ Normal │
│ Memory   │ 67.2% (5.4GB/8GB)   │ Normal │
│ Disk     │ 45.8%               │ Normal │
└──────────┴─────────────────────┴────────┘

📈 Business Metrics (Last 24h)
┌─────────────────┬───────┬────────┐
│ Metric          │ Value │ Status │
├─────────────────┼───────┼────────┤
│ Total Leads     │ 127   │ Normal │
│ Conversion Rate │ 18.5% │ Good   │
│ Message Reply   │ 12.3% │ Normal │
│ Active Deals    │ 23    │ Normal │
└─────────────────┴───────┴────────┘

✅ No recent alerts
```

## 🔧 Configuration

### Environment Variables
```bash
# Platform Configuration
PLATFORM_BASE_URL=http://localhost:8080
MONITORING_INTERVAL=30000
TEST_TIMEOUT=10000

# GitHub Integration
GITHUB_TOKEN=your-github-token
REPO_OWNER=reconsumeralization
REPO_NAME=a-a-ronsFloridaSolarLLC

# Alert Thresholds
ALERT_RESPONSE_TIME=2000
ALERT_ERROR_RATE=0.05
ALERT_MEMORY_USAGE=0.85
```

### Tool Configuration
Each tool can be configured via environment variables or command-line arguments:

```bash
# Custom monitoring interval (30 seconds)
MONITORING_INTERVAL=30000 node monitor-system.js

# Custom test timeout (15 seconds)
TEST_TIMEOUT=15000 node test-integration.js

# Deployment mode
DEPLOYMENT_MODE=production node deploy-solar.js
```

## 📋 Troubleshooting

### Common Issues

**Port Conflicts:**
```bash
# Check port usage
netstat -tulpn | grep :8080

# Kill process using port
sudo kill -9 $(lsof -t -i:8080)
```

**Docker Issues:**
```bash
# Restart Docker services
docker-compose down
docker-compose up -d

# Clean Docker system
docker system prune -a
```

**Service Health Issues:**
```bash
# Check service logs
docker-compose logs api-gateway
docker-compose logs lead-scoring

# Restart specific service
docker-compose restart api-gateway
```

**GitHub Integration Issues:**
```bash
# Test webhook connectivity
curl -X POST http://localhost:9000/health

# Check GitHub token permissions
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user
```

## 🚀 Advanced Usage

### Custom Test Scenarios
```javascript
// Add custom test in test-integration.js
async testCustomSolarScenario() {
  const testLead = {
    monthly_bill: 400,
    roof_type: 'metal',
    location: 'Miami',
    timeline: 'immediate'
  };
  
  const response = await axios.post('/api/v1/leads/score', {
    lead_data: testLead
  });
  
  assert(response.data.score > 80, 'High-value lead should score >80');
}
```

### Custom Monitoring Alerts
```javascript
// Add custom alert in monitor-system.js
if (businessMetrics.leads.conversion_rate < 15) {
  this.addAlert('business', 'Solar conversion rate below target');
}
```

### Automated Deployment Pipeline
```bash
#!/bin/bash
# deploy-pipeline.sh

echo "🚀 Starting automated deployment..."

# Run tests
npm run test || exit 1

# Deploy platform
npm run deploy || exit 1

# Verify deployment
npm run health-check || exit 1

# Start monitoring
npm run monitor &

echo "✅ Deployment completed successfully!"
```

## 📞 Support

For tool support and issues:
- **GitHub Issues**: Create issue with `tools` label
- **Documentation**: Check individual tool README files
- **Logs**: Check `logs/` directory for detailed error logs

---

**🌞 Ready to automate your Ron's Florida Solar LLC platform!**

These tools provide complete automation for deployment, testing, and monitoring of your AI-powered solar sales platform.