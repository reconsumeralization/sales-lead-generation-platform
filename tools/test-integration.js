#!/usr/bin/env node

// Integration Testing Tool
// Comprehensive testing suite for Ron's Florida Solar LLC integration

const axios = require('axios');
const { Octokit } = require('@octokit/rest');
const chalk = require('chalk');
const { table } = require('table');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

class IntegrationTester {
    constructor() {
        this.octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN
        });

        this.config = {
            platformBaseUrl: process.env.PLATFORM_BASE_URL || 'http://localhost:8080',
            webhookUrl: process.env.WEBHOOK_URL || 'http://localhost:9000/webhooks/github',
            repoOwner: 'reconsumeralization',
            repoName: 'a-a-ronsFloridaSolarLLC',
            timeout: parseInt(process.env.TEST_TIMEOUT) || 10000,
            retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 3,
            retryDelay: parseInt(process.env.RETRY_DELAY) || 1000
        };

        this.testResults = [];
        this.startTime = Date.now();
        this.testMetrics = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0
        };
    }

    // Run all integration tests with enhanced error handling and reporting
    async runAllTests() {
        console.log(chalk.blue.bold('🧪 Ron\'s Florida Solar LLC - Enhanced Integration Testing Suite'));
        console.log(chalk.blue('='.repeat(70)));
        console.log(chalk.cyan(`🕐 Test started at: ${new Date().toLocaleString()}`));
        console.log(chalk.cyan(`🔧 Platform URL: ${this.config.platformBaseUrl}`));
        console.log(chalk.cyan(`⚙️  Timeout: ${this.config.timeout}ms | Retries: ${this.config.retryAttempts}`));

        const testSuites = [
            { name: 'Service Health Tests', method: 'testServiceHealth', critical: true },
            { name: 'Database Connectivity Tests', method: 'testDatabaseConnectivity', critical: true },
            { name: 'GitHub Integration Tests', method: 'testGitHubIntegration', critical: false },
            { name: 'Webhook Processing Tests', method: 'testWebhookProcessing', critical: false },
            { name: 'Lead Generation Tests', method: 'testLeadGeneration', critical: true },
            { name: 'Solar Scoring Tests', method: 'testSolarScoring', critical: true },
            { name: 'Message Generation Tests', method: 'testMessageGeneration', critical: false },
            { name: 'Email Integration Tests', method: 'testEmailIntegration', critical: false },
            { name: 'Performance Tests', method: 'testPerformance', critical: false },
            { name: 'Security Tests', method: 'testSecurity', critical: true },
            { name: 'Data Validation Tests', method: 'testDataValidation', critical: true },
            { name: 'API Rate Limiting Tests', method: 'testRateLimiting', critical: false }
        ];

        for (const suite of testSuites) {
            console.log(chalk.yellow(`\n📋 Running ${suite.name}...`));
            const suiteStartTime = Date.now();

            try {
                await this.executeWithRetry(suite.method, suite.name);
                const duration = Date.now() - suiteStartTime;
                console.log(chalk.gray(`   ⏱️  Completed in ${duration}ms`));
            } catch (error) {
                const duration = Date.now() - suiteStartTime;
                this.addTestResult(suite.name, 'FAILED', error.message, duration, suite.critical);
                console.log(chalk.red(`❌ ${suite.name} failed: ${error.message}`));
                console.log(chalk.gray(`   ⏱️  Failed after ${duration}ms`));

                // Stop execution if critical test fails
                if (suite.critical) {
                    console.log(chalk.red.bold(`🚨 Critical test failed! Stopping execution.`));
                    break;
                }
            }
        }

        await this.generateTestReport();
        this.displayResults();
    }

    // Execute test method with retry logic
    async executeWithRetry(methodName, testName) {
        let lastError;

        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                if (attempt > 1) {
                    console.log(chalk.yellow(`   🔄 Retry attempt ${attempt}/${this.config.retryAttempts}`));
                    await this.delay(this.config.retryDelay * attempt);
                }

                await this[methodName]();
                return; // Success, exit retry loop
            } catch (error) {
                lastError = error;
                if (attempt === this.config.retryAttempts) {
                    throw error; // Final attempt failed
                }
            }
        }
    }

    // Utility method for delays
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Enhanced test result tracking
    addTestResult(testName, status, details = '', duration = 0, critical = false) {
        const result = {
            test: testName,
            status: status,
            details: details,
            duration: duration,
            critical: critical,
            timestamp: new Date().toISOString()
        };

        this.testResults.push(result);
        this.testMetrics.total++;

        switch (status) {
            case 'PASSED':
                this.testMetrics.passed++;
                break;
            case 'FAILED':
                this.testMetrics.failed++;
                break;
            case 'SKIPPED':
                this.testMetrics.skipped++;
                break;
        }
    }

    // Enhanced service health tests with detailed checks
    async testServiceHealth() {
        const endpoints = [
            {
                name: 'Platform Health',
                url: `${this.config.platformBaseUrl}/health`,
                expectedStatus: 200,
                timeout: 5000
            },
            {
                name: 'API Status',
                url: `${this.config.platformBaseUrl}/api/status`,
                expectedStatus: 200,
                timeout: 5000
            },
            {
                name: 'Database Health',
                url: `${this.config.platformBaseUrl}/api/health/db`,
                expectedStatus: 200,
                timeout: 8000
            },
            {
                name: 'Memory Usage',
                url: `${this.config.platformBaseUrl}/api/health/memory`,
                expectedStatus: 200,
                timeout: 3000
            },
            {
                name: 'Disk Space',
                url: `${this.config.platformBaseUrl}/api/health/disk`,
                expectedStatus: 200,
                timeout: 3000
            }
        ];

        for (const endpoint of endpoints) {
            const startTime = Date.now();
            try {
                const response = await axios.get(endpoint.url, {
                    timeout: endpoint.timeout,
                    headers: {
                        'User-Agent': 'IntegrationTester/1.0',
                        'Accept': 'application/json'
                    }
                });

                const duration = Date.now() - startTime;

                if (response.status === endpoint.expectedStatus) {
                    const details = `Status: ${response.status}, Response time: ${duration}ms`;
                    this.addTestResult(`${endpoint.name}`, 'PASSED', details, duration);
                    console.log(chalk.green(`✅ ${endpoint.name} - OK (${duration}ms)`));

                    // Additional validation for specific endpoints
                    if (endpoint.name === 'Memory Usage' && response.data) {
                        this.validateMemoryUsage(response.data);
                    }
                } else {
                    this.addTestResult(`${endpoint.name}`, 'FAILED', `Unexpected status: ${response.status}`, duration);
                    console.log(chalk.red(`❌ ${endpoint.name} - Status: ${response.status}`));
                }
            } catch (error) {
                const duration = Date.now() - startTime;
                this.addTestResult(`${endpoint.name}`, 'FAILED', error.message, duration);
                console.log(chalk.red(`❌ ${endpoint.name} - ${error.message}`));
            }
        }
    }
    // Validate memory usage metrics
    validateMemoryUsage(memoryData) {
        if (memoryData.usage && memoryData.usage > 0.9) {
            console.log(chalk.yellow(`⚠️  High memory usage detected: ${(memoryData.usage * 100).toFixed(1)}%`));
        }
    }

    // Enhanced database connectivity tests
    async testDatabaseConnectivity() {
        const dbTests = [
            { name: 'Connection Test', endpoint: '/api/health/db' },
            { name: 'Query Performance', endpoint: '/api/health/db/performance' },
            { name: 'Connection Pool', endpoint: '/api/health/db/pool' }
        ];

        for (const test of dbTests) {
            const startTime = Date.now();
            try {
                const response = await axios.get(`${this.config.platformBaseUrl}${test.endpoint}`, {
                    timeout: this.config.timeout
                });

                const duration = Date.now() - startTime;

                if (response.data && response.data.connected) {
                    const details = `Connected: ${response.data.connected}, Response time: ${duration}ms`;
                    this.addTestResult(`Database ${test.name}`, 'PASSED', details, duration);
                    console.log(chalk.green(`✅ Database ${test.name} - OK (${duration}ms)`));

                    // Log additional database metrics if available
                    if (response.data.metrics) {
                        console.log(chalk.gray(`   📊 Active connections: ${response.data.metrics.activeConnections || 'N/A'}`));
                        console.log(chalk.gray(`   📊 Query time avg: ${response.data.metrics.avgQueryTime || 'N/A'}ms`));
                    }
                } else {
                    this.addTestResult(`Database ${test.name}`, 'FAILED', 'Database not connected', duration);
                    console.log(chalk.red(`❌ Database ${test.name} - Failed`));
                }
            } catch (error) {
                const duration = Date.now() - startTime;
                this.addTestResult(`Database ${test.name}`, 'FAILED', error.message, duration);
                console.log(chalk.red(`❌ Database ${test.name} - ${error.message}`));
            }
        }
    }

    // New test method for data validation
    async testDataValidation() {
        const validationTests = [
            {
                name: 'Lead Data Schema',
                endpoint: '/api/validate/lead-schema',
                testData: {
                    name: 'Test Customer',
                    email: 'test@example.com',
                    phone: '555-0123',
                    address: '123 Solar St, Miami, FL'
                }
            },
            {
                name: 'Solar Score Validation',
                endpoint: '/api/validate/solar-score',
                testData: {
                    roofArea: 1500,
                    sunlightHours: 6.5,
                    energyUsage: 1200
                }
            }
        ];

        for (const test of validationTests) {
            const startTime = Date.now();
            try {
                const response = await axios.post(
                    `${this.config.platformBaseUrl}${test.endpoint}`,
                    test.testData,
                    {
                        timeout: this.config.timeout,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );

                const duration = Date.now() - startTime;

                if (response.data && response.data.valid) {
                    this.addTestResult(`${test.name}`, 'PASSED', 'Data validation successful', duration);
                    console.log(chalk.green(`✅ ${test.name} - Valid`));
                } else {
                    const errors = response.data?.errors?.join(', ') || 'Unknown validation error';
                    this.addTestResult(`${test.name}`, 'FAILED', `Validation errors: ${errors}`, duration);
                    console.log(chalk.red(`❌ ${test.name} - ${errors}`));
                }
            } catch (error) {
                const duration = Date.now() - startTime;
                this.addTestResult(`${test.name}`, 'FAILED', error.message, duration);
                console.log(chalk.red(`❌ ${test.name} - ${error.message}`));
            }
        }
    }

    // New test method for API rate limiting
    async testRateLimiting() {
        const testEndpoint = `${this.config.platformBaseUrl}/api/test/rate-limit`;
        const requestCount = 10;
        const requests = [];

        console.log(chalk.gray(`   🔄 Sending ${requestCount} concurrent requests...`));

        const startTime = Date.now();

        // Send multiple concurrent requests
        for (let i = 0; i < requestCount; i++) {
            requests.push(
                axios.get(testEndpoint, {
                    timeout: this.config.timeout,
                    validateStatus: (status) => status < 500 // Accept rate limit responses
                }).catch(error => ({ error: error.message }))
            );
        }

        try {
            const responses = await Promise.all(requests);
            const duration = Date.now() - startTime;

            const successCount = responses.filter(r => r.status === 200).length;
            const rateLimitedCount = responses.filter(r => r.status === 429).length;
            const errorCount = responses.filter(r => r.error).length;

            const details = `Success: ${successCount}, Rate Limited: ${rateLimitedCount}, Errors: ${errorCount}`;

            if (rateLimitedCount > 0) {
                this.addTestResult('Rate Limiting', 'PASSED', details, duration);
                console.log(chalk.green(`✅ Rate Limiting - Working (${rateLimitedCount} requests limited)`));
            } else {
                this.addTestResult('Rate Limiting', 'FAILED', 'No rate limiting detected', duration);
                console.log(chalk.yellow(`⚠️  Rate Limiting - No limits detected`));
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            this.addTestResult('Rate Limiting', 'FAILED', error.message, duration);
            console.log(chalk.red(`❌ Rate Limiting - ${error.message}`));
        }
    }

    // Generate comprehensive test report
    async generateTestReport() {
        this.testMetrics.duration = Date.now() - this.startTime;

        const report = {
            testSuite: 'Ron\'s Florida Solar LLC Integration Tests',
            timestamp: new Date().toISOString(),
            metrics: this.testMetrics,
            results: this.testResults,
            environment: {
                platformUrl: this.config.platformBaseUrl,
                nodeVersion: process.version,
                timeout: this.config.timeout,
                retryAttempts: this.config.retryAttempts
            }
        };

        try {
            const reportPath = path.join(process.cwd(), 'test-reports');
            await fs.mkdir(reportPath, { recursive: true });

            const filename = `integration-test-${Date.now()}.json`;
            const filepath = path.join(reportPath, filename);

            await fs.writeFile(filepath, JSON.stringify(report, null, 2));
            console.log(chalk.blue(`📄 Test report saved: ${filepath}`));
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Could not save test report: ${error.message}`));
        }
    }

    // Display final test results
    displayResults() {
        console.log(chalk.blue('\n' + '='.repeat(70)));
        console.log(chalk.blue.bold('📊 TEST RESULTS SUMMARY'));
        console.log(chalk.blue('='.repeat(70)));

        const data = [
            ['Metric', 'Value'],
            ['Total Tests', this.testMetrics.total],
            ['Passed', chalk.green(this.testMetrics.passed)],
            ['Failed', chalk.red(this.testMetrics.failed)],
            ['Skipped', chalk.yellow(this.testMetrics.skipped)],
            ['Duration', `${this.testMetrics.duration}ms`],
            ['Success Rate', `${((this.testMetrics.passed / this.testMetrics.total) * 100).toFixed(1)}%`]
        ];

        console.log(table(data));

        if (this.testMetrics.failed > 0) {
            console.log(chalk.red.bold('\n❌ FAILED TESTS:'));
            this.testResults
                .filter(result => result.status === 'FAILED')
                .forEach(result => {
                    console.log(chalk.red(`   • ${result.test}: ${result.details}`));
                });
        }

        const overallStatus = this.testMetrics.failed === 0 ? 'PASSED' : 'FAILED';
        const statusColor = overallStatus === 'PASSED' ? chalk.green : chalk.red;

        console.log(statusColor.bold(`\n🎯 OVERALL STATUS: ${overallStatus}`));
        console.log(chalk.gray(`🕐 Test completed at: ${new Date().toLocaleString()}`));
    }
}

// Export the class
module.exports = IntegrationTester;

// Run tests if called directly
if (require.main === module) {
    const tester = new IntegrationTester();
    tester.runAllTests().catch(error => {
        console.error(chalk.red.bold('💥 Test execution failed:'), error);
        process.exit(1);
    });
}