# Sales Lead Generation Platform

An AI-Native Sales & Lead Generation Platform built with microservices architecture, featuring intelligent lead qualification, automated outreach sequences, and real-time deal intelligence.

## 🏗️ Architecture

The platform consists of the following microservices:

- **API Gateway** (Port 8080) - Authentication, rate limiting, and request routing
- **Lead Scoring Service** (Port 8081) - AI-powered lead qualification and ICP scoring
- **Outreach Generation Service** (Port 8082) - Personalized message creation and multi-channel orchestration
- **Deal Intelligence Service** (Port 8083) - Deal probability scoring and coaching recommendations
- **CRM Sync Service** (Port 8084) - Real-time synchronization with external CRM systems
- **Compliance Service** (Port 8085) - GDPR/CCPA compliance monitoring and audit logging
- **Analytics Service** (Port 8086) - Performance metrics and business intelligence

## 🚀 Quick Start

### Prerequisites

- Docker Desktop
- Docker Compose
- Node.js 18+ (for local development)

### Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd sales-lead-generation-platform
   ```

2. **Run the setup script**

   **Windows (PowerShell):**

   ```powershell
   .\scripts\setup.ps1
   ```

   **Linux/macOS:**

   ```bash
   ./scripts/setup.sh
   ```

3. **Configure environment variables**

   Update the `.env` file with your actual API keys and configuration:

   ```bash
   # Required API keys
   OPENAI_API_KEY=your-openai-api-key
   SALESFORCE_CLIENT_ID=your-salesforce-client-id
   HUBSPOT_API_KEY=your-hubspot-api-key
   # ... other configuration
   ```

4. **Access the platform**

   The API Gateway will be available at `http://localhost:8080`

## 📊 Database Schema

The platform uses PostgreSQL with the following core entities:

- **Companies** - Organization data and technographics
- **Contacts** - Individual prospect information
- **Leads** - Lead scoring and qualification data
- **Messages** - Outreach sequences and performance tracking
- **Deals** - Sales opportunities and intelligence
- **Audit Logs** - Compliance and activity tracking

## 🔧 Development

### Local Development

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start individual services**

   ```bash
   # API Gateway
   cd services/api-gateway && npm run dev

   # Lead Scoring Service
   cd services/lead-scoring && npm run dev
   ```

3. **Run tests**
   ```bash
   npm test
   ```

### Service Structure

Each microservice follows this structure:

```
services/[service-name]/
├── src/
│   ├── index.ts          # Main application entry
│   ├── routes/           # API route handlers
│   ├── models/           # Data models
│   ├── services/         # Business logic
│   └── utils/            # Utility functions
├── tests/                # Unit and integration tests
├── Dockerfile           # Container configuration
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

## 🔐 Security

The platform implements comprehensive security measures:

- **JWT Authentication** - Secure API access with token-based auth
- **Rate Limiting** - Protection against abuse and DDoS attacks
- **GDPR Compliance** - Automated consent management and data retention
- **Audit Logging** - Complete activity trails for compliance
- **Encryption** - Data encryption at rest and in transit

## 📈 Performance

Performance targets and optimizations:

- **Sub-200ms Response Time** - Lead scoring with Redis caching
- **Real-time Sync** - CRM synchronization within 30 seconds
- **High Availability** - 99.9% uptime with auto-scaling
- **Concurrent Users** - Support for 10,000+ simultaneous users

## 🔌 Integrations

### CRM Systems

- Salesforce
- HubSpot
- Pipedrive

### Data Enrichment

- ZoomInfo
- Apollo.io
- LinkedIn Sales Navigator

### Communication Channels

- Email (SendGrid, SMTP)
- LinkedIn messaging
- SMS/Phone integration

### AI/ML Services

- OpenAI GPT-4 for message generation
- Custom ML models for lead scoring
- TensorFlow.js for predictive analytics

## 📋 API Documentation

### Authentication

```bash
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "password"
}
```

### Lead Scoring

```bash
POST /api/v1/leads/score
{
  "lead_data": {
    "company": "Example Corp",
    "contact": {...},
    "source": "website"
  },
  "icp_model_id": "model-123"
}
```

### Message Generation

```bash
POST /api/v1/outreach/generate
{
  "prospect": {...},
  "sequence_type": "email",
  "brand_profile": "professional"
}
```

## 🚀 Deployment

### Docker Compose (Development)

```bash
docker-compose up -d
```

### Kubernetes (Production)

```bash
kubectl apply -f k8s/
```

### Environment Variables

Key configuration options:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis cache connection
- `KAFKA_BROKERS` - Message broker endpoints
- `JWT_SECRET` - Authentication secret key
- `OPENAI_API_KEY` - AI service integration

## 📊 Monitoring

The platform includes comprehensive monitoring:

- **Application Metrics** - Response times, error rates, throughput
- **Business Metrics** - Lead conversion, message performance, deal velocity
- **Infrastructure Metrics** - CPU, memory, disk, network utilization
- **Custom Dashboards** - Real-time visibility into system health

## 🧪 Testing

### Test Types

- **Unit Tests** - Individual component testing
- **Integration Tests** - Service interaction testing
- **Performance Tests** - Load and stress testing
- **Security Tests** - Vulnerability and penetration testing

### Running Tests

```bash
# All tests
npm test

# Specific service
cd services/lead-scoring && npm test

# Performance tests
npm run test:performance
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the documentation in `/docs`
- Review the API specifications in `/api-docs`

## 🗺️ Roadmap

Upcoming features:

- Mobile application (React Native)
- Advanced AI coaching recommendations
- Multi-language support
- Enhanced competitive intelligence
- Voice integration capabilities
