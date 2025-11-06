#!/usr/bin/env node

// System Monitoring Tool for Ron's Florida Solar LLC Platform
// Real-time monitoring, alerting, and performance tracking

const axios = require('axios');
const chalk = require('chalk');
const { table } = require('table');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const EventEmitter = require('events');

class SolarSystemMonitor extends EventEmitter {
  constructor() {
    super();
    
    this.config = {
      platformBaseUrl: process.env.PLATFORM_BASE_URL || 'http://localhost:8080',
      monitoringInterval: parseInt(process.env.MONITORING_INTERVAL) || 30000, // 30 seconds
      alertThresholds: {
        responseTime: 2000, // 2 seconds
        errorRate: 0.05, // 5%
        memoryUsage: 0.85, // 85%
        diskUsage: 0.90, // 90%
        cpuUsage: 0.80 // 80%
      },
      services: [
        { name: 'API Gateway', url: 'http://localhost:8080', port: 8080 },
        { name: 'Lead Scoring', url: 'http://localhost:8081', port: 8081 },
        { name: 'Outreach Generation', url: 'http://localhost:8082', port: 8082 },
        { name: 'Deal Intelligence', url: 'http://localhost:8083', port: 8083 },
        { name: 'CRM Sync', url: 'http://localhost:8084', port: 8084 },
        { name: 'Compliance', url: 'http://localhost:8085', port: 8085 },
        { name: 'Analytics', url: 'http://localhost:8086', port: 8086 }
      ],
      infrastructure: [
        { name: 'PostgreSQL', port: 8432, type: 'database' },
        { name: 'Redis', port: 8379, type: 'cache' },
        { name: 'Kafka', port: 8092, type: 'messaging' },
        { name: 'Elasticsearch', port: 8200, type: 'search' }
      ]
    };
    
    this.metrics = {
      services: new Map(),
      infrastructure: new Map(),
      system: {},
      alerts: [],
      uptime: Date.now()
    };
    
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  // Start continuous monitoring
  async startMonitoring() {
    console.log(chalk.blue.bold('🔍 Starting Solar Platform Monitoring'));
    console.log(chalk.blue('='.repeat(50)));
    console.log(chalk.cyan(`📊 Monitoring interval: ${this.config.monitoringInterval / 1000}s`));
    console.log(chalk.cyan(`🚨 Alert thresholds configured`));
    
    this.isMonitoring = true;
    
    // Initial system check
    await this.performSystemCheck();
    
    // Start periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performSystemCheck();
        this.displayRealTimeStatus();
      } catch (error) {
        console.error(chalk.red('❌ Monitoring error:'), error.message);
      }
    }, this.config.monitoringInterval);
    
    // Setup graceful shutdown
    process.on('SIGINT', () => {
      this.stopMonitoring();
    });
    
    console.log(chalk.green('✅ Monitoring started. Press Ctrl+C to stop.\n'));
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    console.log(chalk.yellow('\n🛑 Monitoring stopped'));
    
    // Generate final report
    this.generateMonitoringReport();
    process.exit(0);
  }

  // Perform comprehensive system check
  async performSystemCheck() {
    const checkStartTime = Date.now();
    
    // Check services
    await this.checkServices();
    
    // Check infrastructure
    await this.checkInfrastructure();
    
    // Check system resources
    await this.checkSystemResources();
    
    // Check business metrics
    await this.checkBusinessMetrics();
    
    // Process alerts
    this.processAlerts();
    
    const checkDuration = Date.now() - checkStartTime;
    this.metrics.lastCheckDuration = checkDuration;
    this.metrics.lastCheckTime = new Date().toISOString();
  }

  // Check application services
  async checkServices() {
    for (const service of this.config.services) {
      const startTime = Date.now();
      
      try {
        const response = await axios.get(`${service.url}/health`, {
          timeout: 5000,
          headers: { 'User-Agent': 'SolarMonitor/1.0' }
        });
        
        const responseTime = Date.now() - startTime;
        
        const serviceMetrics = {
          name: service.name,
          status: 'healthy',
          responseTime: responseTime,
          statusCode: response.status,
          lastCheck: new Date().toISOString(),
          uptime: response.data?.uptime || 'unknown',
          version: response.data?.version || 'unknown',
          memoryUsage: response.data?.memory || null,
          activeConnections: response.data?.connections || null
        };
        
        this.metrics.services.set(service.name, serviceMetrics);
        
        // Check for performance alerts
        if (responseTime > this.config.alertThresholds.responseTime) {
          this.addAlert('performance', `${service.name} slow response: ${responseTime}ms`);
        }
        
      } catch (error) {
        const responseTime = Date.now() - startTime;
        
        const serviceMetrics = {
          name: service.name,
          status: 'unhealthy',
          responseTime: responseTime,
          error: error.message,
          lastCheck: new Date().toISOString(),
          statusCode: error.response?.status || 'timeout'
        };
        
        this.metrics.services.set(service.name, serviceMetrics);
        this.addAlert('service', `${service.name} is down: ${error.message}`);
      }
    }
  }

  // Check infrastructure services
  async checkInfrastructure() {
    for (const infra of this.config.infrastructure) {
      try {
        const isPortOpen = await this.checkPort('localhost', infra.port);
        
        const infraMetrics = {
          name: infra.name,
          type: infra.type,
          status: isPortOpen ? 'healthy' : 'unhealthy',
          port: infra.port,
          lastCheck: new Date().toISOString()
        };
        
        // Get additional metrics based on type
        if (infra.type === 'database' && isPortOpen) {
          infraMetrics.connections = await this.getDatabaseConnections();
        }
        
        if (infra.type === 'cache' && isPortOpen) {
          infraMetrics.memoryUsage = await this.getRedisMemoryUsage();
        }
        
        this.metrics.infrastructure.set(infra.name, infraMetrics);
        
        if (!isPortOpen) {
          this.addAlert('infrastructure', `${infra.name} is not responding on port ${infra.port}`);
        }
        
      } catch (error) {
        this.metrics.infrastructure.set(infra.name, {
          name: infra.name,
          status: 'error',
          error: error.message,
          lastCheck: new Date().toISOString()
        });
      }
    }
  }

  // Check system resources
  async checkSystemResources() {
    const cpuUsage = await this.getCpuUsage();
    const memoryUsage = this.getMemoryUsage();
    const diskUsage = await this.getDiskUsage();
    const networkStats = this.getNetworkStats();
    
    this.metrics.system = {
      cpu: {
        usage: cpuUsage,
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'unknown'
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        usage: memoryUsage
      },
      disk: {
        usage: diskUsage
      },
      network: networkStats,
      uptime: os.uptime(),
      loadAverage: os.loadavg(),
      platform: os.platform(),
      arch: os.arch(),
      lastCheck: new Date().toISOString()
    };
    
    // Check for resource alerts
    if (cpuUsage > this.config.alertThresholds.cpuUsage) {
      this.addAlert('resource', `High CPU usage: ${(cpuUsage * 100).toFixed(1)}%`);
    }
    
    if (memoryUsage > this.config.alertThresholds.memoryUsage) {
      this.addAlert('resource', `High memory usage: ${(memoryUsage * 100).toFixed(1)}%`);
    }
    
    if (diskUsage > this.config.alertThresholds.diskUsage) {
      this.addAlert('resource', `High disk usage: ${(diskUsage * 100).toFixed(1)}%`);
    }
  }

  // Check business metrics
  async checkBusinessMetrics() {
    try {
      // Get lead generation metrics
      const leadsResponse = await axios.get(`${this.config.platformBaseUrl}/api/v1/metrics/leads`, {
        timeout: 5000
      });
      
      // Get message performance metrics
      const messagesResponse = await axios.get(`${this.config.platformBaseUrl}/api/v1/metrics/messages`, {
        timeout: 5000
      });
      
      // Get deal metrics
      const dealsResponse = await axios.get(`${this.config.platformBaseUrl}/api/v1/metrics/deals`, {
        timeout: 5000
      });
      
      this.metrics.business = {
        leads: leadsResponse.data,
        messages: messagesResponse.data,
        deals: dealsResponse.data,
        lastCheck: new Date().toISOString()
      };
      
      // Check for business alerts
      if (leadsResponse.data.conversion_rate < 10) {
        this.addAlert('business', `Low lead conversion rate: ${leadsResponse.data.conversion_rate}%`);
      }
      
    } catch (error) {
      this.metrics.business = {
        error: error.message,
        lastCheck: new Date().toISOString()
      };
    }
  }

  // Display real-time status
  displayRealTimeStatus() {
    // Clear console
    console.clear();
    
    console.log(chalk.blue.bold('🌞 Ron\'s Florida Solar LLC - System Monitor'));
    console.log(chalk.blue('='.repeat(60)));
    console.log(chalk.gray(`Last updated: ${new Date().toLocaleString()}`));
    console.log(chalk.gray(`Monitoring for: ${this.formatUptime(Date.now() - this.metrics.uptime)}`));
    
    // Services status
    this.displayServicesStatus();
    
    // Infrastructure status
    this.displayInfrastructureStatus();
    
    // System resources
    this.displaySystemResources();
    
    // Business metrics
    this.displayBusinessMetrics();
    
    // Recent alerts
    this.displayRecentAlerts();
    
    console.log(chalk.gray('\nPress Ctrl+C to stop monitoring'));
  }

  // Display services status table
  displayServicesStatus() {
    console.log(chalk.cyan('\n📊 Application Services'));
    
    const serviceData = [
      ['Service', 'Status', 'Response Time', 'Last Check']
    ];
    
    for (const [name, metrics] of this.metrics.services) {
      const status = metrics.status === 'healthy' 
        ? chalk.green('✅ Healthy') 
        : chalk.red('❌ Unhealthy');
      
      const responseTime = metrics.responseTime 
        ? `${metrics.responseTime}ms`
        : 'N/A';
      
      const lastCheck = new Date(metrics.lastCheck).toLocaleTimeString();
      
      serviceData.push([name, status, responseTime, lastCheck]);
    }
    
    console.log(table(serviceData, {
      border: {
        topBody: '─',
        topJoin: '┬',
        topLeft: '┌',
        topRight: '┐',
        bottomBody: '─',
        bottomJoin: '┴',
        bottomLeft: '└',
        bottomRight: '┘',
        bodyLeft: '│',
        bodyRight: '│',
        bodyJoin: '│',
        joinBody: '─',
        joinLeft: '├',
        joinRight: '┤',
        joinJoin: '┼'
      }
    }));
  }

  // Display infrastructure status
  displayInfrastructureStatus() {
    console.log(chalk.cyan('\n🏗️  Infrastructure Services'));
    
    const infraData = [
      ['Service', 'Type', 'Status', 'Port']
    ];
    
    for (const [name, metrics] of this.metrics.infrastructure) {
      const status = metrics.status === 'healthy' 
        ? chalk.green('✅ Online') 
        : chalk.red('❌ Offline');
      
      infraData.push([name, metrics.type, status, metrics.port]);
    }
    
    console.log(table(infraData));
  }

  // Display system resources
  displaySystemResources() {
    if (!this.metrics.system.cpu) return;
    
    console.log(chalk.cyan('\n💻 System Resources'));
    
    const cpu = this.metrics.system.cpu;
    const memory = this.metrics.system.memory;
    const disk = this.metrics.system.disk;
    
    const resourceData = [
      ['Resource', 'Usage', 'Status'],
      [
        'CPU', 
        `${(cpu.usage * 100).toFixed(1)}%`,
        cpu.usage > 0.8 ? chalk.red('High') : chalk.green('Normal')
      ],
      [
        'Memory', 
        `${((memory.used / memory.total) * 100).toFixed(1)}% (${this.formatBytes(memory.used)}/${this.formatBytes(memory.total)})`,
        (memory.used / memory.total) > 0.85 ? chalk.red('High') : chalk.green('Normal')
      ],
      [
        'Disk', 
        `${(disk.usage * 100).toFixed(1)}%`,
        disk.usage > 0.9 ? chalk.red('High') : chalk.green('Normal')
      ]
    ];
    
    console.log(table(resourceData));
  }

  // Display business metrics
  displayBusinessMetrics() {
    if (!this.metrics.business || this.metrics.business.error) return;
    
    console.log(chalk.cyan('\n📈 Business Metrics (Last 24h)'));
    
    const business = this.metrics.business;
    
    const businessData = [
      ['Metric', 'Value', 'Status'],
      [
        'Total Leads',
        business.leads?.total_leads || 'N/A',
        chalk.green('Normal')
      ],
      [
        'Conversion Rate',
        business.leads?.conversion_rate ? `${business.leads.conversion_rate}%` : 'N/A',
        business.leads?.conversion_rate > 10 ? chalk.green('Good') : chalk.yellow('Low')
      ],
      [
        'Message Performance',
        business.messages?.metrics?.[0]?.reply_rate ? `${business.messages.metrics[0].reply_rate.toFixed(1)}%` : 'N/A',
        chalk.green('Normal')
      ],
      [
        'Active Deals',
        business.deals?.total_deals || 'N/A',
        chalk.green('Normal')
      ]
    ];
    
    console.log(table(businessData));
  }

  // Display recent alerts
  displayRecentAlerts() {
    const recentAlerts = this.metrics.alerts.slice(-5); // Last 5 alerts
    
    if (recentAlerts.length === 0) {
      console.log(chalk.green('\n✅ No recent alerts'));
      return;
    }
    
    console.log(chalk.yellow('\n🚨 Recent Alerts'));
    
    recentAlerts.forEach(alert => {
      const time = new Date(alert.timestamp).toLocaleTimeString();
      const typeColor = alert.type === 'service' ? chalk.red : 
                       alert.type === 'performance' ? chalk.yellow : 
                       alert.type === 'resource' ? chalk.magenta : chalk.cyan;
      
      console.log(`   ${typeColor(alert.type.toUpperCase())} [${time}] ${alert.message}`);
    });
  }

  // Add alert
  addAlert(type, message) {
    const alert = {
      type: type,
      message: message,
      timestamp: new Date().toISOString(),
      id: Date.now()
    };
    
    this.metrics.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.metrics.alerts.length > 100) {
      this.metrics.alerts = this.metrics.alerts.slice(-100);
    }
    
    // Emit alert event
    this.emit('alert', alert);
  }

  // Process alerts (send notifications, etc.)
  processAlerts() {
    // This could be extended to send emails, Slack notifications, etc.
    const newAlerts = this.metrics.alerts.filter(alert => 
      Date.now() - new Date(alert.timestamp).getTime() < this.config.monitoringInterval
    );
    
    if (newAlerts.length > 0) {
      // Could send notifications here
      // await this.sendSlackNotification(newAlerts);
      // await this.sendEmailAlert(newAlerts);
    }
  }

  // Generate monitoring report
  async generateMonitoringReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      monitoringDuration: Date.now() - this.metrics.uptime,
      services: Object.fromEntries(this.metrics.services),
      infrastructure: Object.fromEntries(this.metrics.infrastructure),
      system: this.metrics.system,
      business: this.metrics.business,
      alerts: this.metrics.alerts,
      summary: {
        totalServices: this.config.services.length,
        healthyServices: Array.from(this.metrics.services.values()).filter(s => s.status === 'healthy').length,
        totalAlerts: this.metrics.alerts.length,
        criticalAlerts: this.metrics.alerts.filter(a => a.type === 'service').length
      }
    };
    
    try {
      const reportsDir = path.join(process.cwd(), 'monitoring-reports');
      await fs.mkdir(reportsDir, { recursive: true });
      
      const filename = `monitoring-report-${Date.now()}.json`;
      const filepath = path.join(reportsDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      console.log(chalk.blue(`📄 Monitoring report saved: ${filepath}`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Could not save monitoring report: ${error.message}`));
    }
  }

  // Utility methods
  async checkPort(host, port) {
    return new Promise((resolve) => {
      const net = require('net');
      const socket = new net.Socket();
      
      socket.setTimeout(2000);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.connect(port, host);
    });
  }

  async getCpuUsage() {
    return new Promise((resolve) => {
      const startMeasure = this.cpuAverage();
      
      setTimeout(() => {
        const endMeasure = this.cpuAverage();
        const idleDifference = endMeasure.idle - startMeasure.idle;
        const totalDifference = endMeasure.total - startMeasure.total;
        const usage = 1 - idleDifference / totalDifference;
        resolve(Math.max(0, Math.min(1, usage)));
      }, 1000);
    });
  }

  cpuAverage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }
    
    return {
      idle: totalIdle / cpus.length,
      total: totalTick / cpus.length
    };
  }

  getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    return (total - free) / total;
  }

  async getDiskUsage() {
    try {
      const stats = await fs.statfs(process.cwd());
      const total = stats.blocks * stats.bsize;
      const free = stats.bavail * stats.bsize;
      return (total - free) / total;
    } catch (error) {
      return 0;
    }
  }

  getNetworkStats() {
    const interfaces = os.networkInterfaces();
    const stats = {};
    
    for (const [name, addresses] of Object.entries(interfaces)) {
      if (addresses) {
        stats[name] = addresses.filter(addr => !addr.internal);
      }
    }
    
    return stats;
  }

  async getDatabaseConnections() {
    try {
      const response = await axios.get(`${this.config.platformBaseUrl}/api/health/db/connections`, {
        timeout: 3000
      });
      return response.data.activeConnections || 0;
    } catch (error) {
      return 'unknown';
    }
  }

  async getRedisMemoryUsage() {
    try {
      const response = await axios.get(`${this.config.platformBaseUrl}/api/health/redis/memory`, {
        timeout: 3000
      });
      return response.data.memoryUsage || 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

// Export the class
module.exports = SolarSystemMonitor;

// Run monitoring if called directly
if (require.main === module) {
  const monitor = new SolarSystemMonitor();
  
  // Setup alert handlers
  monitor.on('alert', (alert) => {
    // Could send notifications here
    console.log(chalk.red(`🚨 ALERT: ${alert.message}`));
  });
  
  monitor.startMonitoring().catch(error => {
    console.error(chalk.red.bold('💥 Monitoring failed:'), error);
    process.exit(1);
  });
}