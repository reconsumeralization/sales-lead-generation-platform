// Solar Repository Synchronization Service
// Bidirectional sync between AI platform and Ron's Florida Solar LLC repo

const { Octokit } = require('@octokit/rest');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class SolarRepoSync {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    
    this.repoOwner = 'reconsumeralization';
    this.repoName = 'a-a-ronsFloridaSolarLLC';
    this.platformBaseUrl = process.env.PLATFORM_BASE_URL || 'http://localhost:8080';
    
    this.syncConfig = {
      syncInterval: 5 * 60 * 1000, // 5 minutes
      batchSize: 50,
      retryAttempts: 3
    };
  }

  // Start continuous synchronization
  async startSync() {
    console.log('🌞 Starting Solar Repository Synchronization...');
    
    // Initial sync
    await this.performFullSync();
    
    // Setup periodic sync
    setInterval(async () => {
      await this.performIncrementalSync();
    }, this.syncConfig.syncInterval);
    
    console.log(`✅ Sync service started (interval: ${this.syncConfig.syncInterval / 1000}s)`);
  }

  // Perform full synchronization
  async performFullSync() {
    console.log('🔄 Performing full repository sync...');
    
    try {
      // Sync repository metadata
      await this.syncRepositoryMetadata();
      
      // Sync issues (potential leads)
      await this.syncIssues();
      
      // Sync pull requests (feature updates)
      await this.syncPullRequests();
      
      // Sync releases (version updates)
      await this.syncReleases();
      
      // Sync repository content (documentation, configs)
      await this.syncRepositoryContent();
      
      console.log('✅ Full sync completed successfully');
    } catch (error) {
      console.error('❌ Full sync failed:', error);
    }
  }

  // Perform incremental synchronization
  async performIncrementalSync() {
    console.log('🔄 Performing incremental sync...');
    
    try {
      const since = new Date(Date.now() - this.syncConfig.syncInterval).toISOString();
      
      // Sync recent issues
      await this.syncRecentIssues(since);
      
      // Sync recent commits
      await this.syncRecentCommits(since);
      
      // Sync platform updates to repository
      await this.syncPlatformUpdatesToRepo();
      
      console.log('✅ Incremental sync completed');
    } catch (error) {
      console.error('❌ Incremental sync failed:', error);
    }
  }

  // Sync repository metadata
  async syncRepositoryMetadata() {
    try {
      const { data: repo } = await this.octokit.repos.get({
        owner: this.repoOwner,
        repo: this.repoName
      });

      const metadata = {
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        homepage: repo.homepage,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        watchers: repo.watchers_count,
        language: repo.language,
        topics: repo.topics,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at
      };

      await this.sendToPlatform('/api/v1/integrations/github/repository', metadata);
      console.log('📊 Repository metadata synced');
    } catch (error) {
      console.error('Failed to sync repository metadata:', error);
    }
  }

  // Sync issues as potential leads
  async syncIssues() {
    try {
      const { data: issues } = await this.octokit.issues.listForRepo({
        owner: this.repoOwner,
        repo: this.repoName,
        state: 'all',
        per_page: this.syncConfig.batchSize,
        sort: 'updated',
        direction: 'desc'
      });

      for (const issue of issues) {
        await this.processIssueAsLead(issue);
      }

      console.log(`📋 Synced ${issues.length} issues`);
    } catch (error) {
      console.error('Failed to sync issues:', error);
    }
  }

  // Process GitHub issue as potential lead
  async processIssueAsLead(issue) {
    try {
      // Determine if issue is a customer inquiry
      const isCustomerInquiry = this.isCustomerInquiry(issue);
      
      if (isCustomerInquiry) {
        const leadData = {
          source: 'github_issue',
          github_issue_id: issue.id,
          github_issue_number: issue.number,
          github_issue_url: issue.html_url,
          title: issue.title,
          description: issue.body,
          author: issue.user.login,
          author_avatar: issue.user.avatar_url,
          labels: issue.labels.map(label => label.name),
          state: issue.state,
          created_at: issue.created_at,
          updated_at: issue.updated_at,
          priority: this.determinePriority(issue),
          lead_type: this.determineLeadType(issue)
        };

        // Extract contact information from issue
        const contactInfo = this.extractContactInfo(issue.body);
        Object.assign(leadData, contactInfo);

        // Send to lead scoring service
        await this.sendToPlatform('/api/v1/leads/github-import', leadData);
        
        console.log(`👤 Processed issue #${issue.number} as lead`);
      }
    } catch (error) {
      console.error(`Failed to process issue #${issue.number}:`, error);
    }
  }

  // Extract contact information from issue body
  extractContactInfo(body) {
    const contactInfo = {};
    
    if (!body) return contactInfo;
    
    // Extract email
    const emailMatch = body.match(/(?:email|e-mail):\s*([^\s\n]+@[^\s\n]+)/i);
    if (emailMatch) contactInfo.email = emailMatch[1];
    
    // Extract phone
    const phoneMatch = body.match(/(?:phone|tel|telephone):\s*([+]?[\d\s\-\(\)]+)/i);
    if (phoneMatch) contactInfo.phone = phoneMatch[1].trim();
    
    // Extract name
    const nameMatch = body.match(/(?:name):\s*([^\n]+)/i);
    if (nameMatch) {
      const fullName = nameMatch[1].trim();
      const nameParts = fullName.split(' ');
      contactInfo.first_name = nameParts[0];
      if (nameParts.length > 1) {
        contactInfo.last_name = nameParts.slice(1).join(' ');
      }
    }
    
    // Extract address
    const addressMatch = body.match(/(?:address):\s*([^\n]+)/i);
    if (addressMatch) contactInfo.address = addressMatch[1].trim();
    
    // Extract monthly bill
    const billMatch = body.match(/(?:monthly.*bill|electric.*bill):\s*\$?(\d+)/i);
    if (billMatch) contactInfo.monthly_electric_bill = parseInt(billMatch[1]);
    
    return contactInfo;
  }

  // Determine lead type from issue content
  determineLeadType(issue) {
    const content = (issue.title + ' ' + issue.body).toLowerCase();
    
    if (content.includes('commercial') || content.includes('business')) {
      return 'commercial';
    }
    
    if (content.includes('residential') || content.includes('home')) {
      return 'residential';
    }
    
    if (content.includes('agricultural') || content.includes('farm')) {
      return 'agricultural';
    }
    
    return 'residential'; // Default
  }

  // Check if issue is customer inquiry
  isCustomerInquiry(issue) {
    const customerLabels = ['customer-inquiry', 'lead', 'quote-request'];
    const customerKeywords = [
      'quote', 'price', 'cost', 'install', 'solar system',
      'how much', 'interested in', 'want to', 'need'
    ];
    
    // Check labels
    const hasCustomerLabel = issue.labels.some(label => 
      customerLabels.includes(label.name.toLowerCase())
    );
    
    // Check content
    const content = (issue.title + ' ' + issue.body).toLowerCase();
    const hasCustomerKeywords = customerKeywords.some(keyword =>
      content.includes(keyword)
    );

    return hasCustomerLabel || hasCustomerKeywords;
  }

  // Sync recent commits
  async syncRecentCommits(since) {
    try {
      const { data: commits } = await this.octokit.repos.listCommits({
        owner: this.repoOwner,
        repo: this.repoName,
        since: since,
        per_page: this.syncConfig.batchSize
      });

      for (const commit of commits) {
        await this.processCommit(commit);
      }

      console.log(`📝 Synced ${commits.length} recent commits`);
    } catch (error) {
      console.error('Failed to sync recent commits:', error);
    }
  }

  // Process commit for solar-related changes
  async processCommit(commit) {
    try {
      const solarKeywords = [
        'solar', 'panel', 'inverter', 'installation', 'proposal',
        'financing', 'rebate', 'incentive', 'kwh', 'savings'
      ];

      const message = commit.commit.message.toLowerCase();
      const isSolarRelated = solarKeywords.some(keyword => message.includes(keyword));

      if (isSolarRelated) {
        const commitData = {
          sha: commit.sha,
          message: commit.commit.message,
          author: commit.commit.author.name,
          author_email: commit.commit.author.email,
          date: commit.commit.author.date,
          url: commit.html_url,
          solar_related: true
        };

        await this.sendToPlatform('/api/v1/integrations/github/commits', commitData);
        console.log(`🔧 Processed solar-related commit: ${commit.sha.substring(0, 7)}`);
      }
    } catch (error) {
      console.error(`Failed to process commit ${commit.sha}:`, error);
    }
  }

  // Sync platform updates back to repository
  async syncPlatformUpdatesToRepo() {
    try {
      // Get recent platform events that should be synced to repo
      const response = await axios.get(`${this.platformBaseUrl}/api/v1/integrations/github/pending-updates`);
      const pendingUpdates = response.data;

      for (const update of pendingUpdates) {
        await this.processPlatformUpdate(update);
      }

      if (pendingUpdates.length > 0) {
        console.log(`🔄 Synced ${pendingUpdates.length} platform updates to repository`);
      }
    } catch (error) {
      console.error('Failed to sync platform updates:', error);
    }
  }

  // Process platform update to repository
  async processPlatformUpdate(update) {
    try {
      switch (update.type) {
        case 'customer_milestone':
          await this.createCustomerMilestoneIssue(update);
          break;
        case 'system_alert':
          await this.createSystemAlertIssue(update);
          break;
        case 'performance_report':
          await this.updatePerformanceFile(update);
          break;
        case 'lead_summary':
          await this.updateLeadSummaryFile(update);
          break;
      }

      // Mark update as processed
      await this.sendToPlatform(`/api/v1/integrations/github/updates/${update.id}/processed`, {});
    } catch (error) {
      console.error(`Failed to process platform update ${update.id}:`, error);
    }
  }

  // Create customer milestone issue
  async createCustomerMilestoneIssue(update) {
    const issueTitle = `🎉 Customer Milestone: ${update.milestone_type}`;
    const issueBody = `
**Customer:** ${update.customer_name}
**Milestone:** ${update.milestone_type}
**Date:** ${update.date}
**System Size:** ${update.system_size}kW
**Value:** $${update.value}

**Details:**
${update.details}

---
*Automatically created by AI Sales Platform*
    `;

    await this.octokit.issues.create({
      owner: this.repoOwner,
      repo: this.repoName,
      title: issueTitle,
      body: issueBody,
      labels: ['customer-milestone', 'platform-generated']
    });
  }

  // Update performance summary file
  async updatePerformanceFile(update) {
    const filePath = 'reports/performance-summary.md';
    const content = this.generatePerformanceReport(update.data);

    await this.updateRepositoryFile(filePath, content, 'Update performance summary');
  }

  // Update repository file
  async updateRepositoryFile(filePath, content, commitMessage) {
    try {
      // Get existing file
      let existingFile;
      try {
        existingFile = await this.octokit.repos.getContent({
          owner: this.repoOwner,
          repo: this.repoName,
          path: filePath
        });
      } catch (error) {
        // File doesn't exist
      }

      const fileData = {
        owner: this.repoOwner,
        repo: this.repoName,
        path: filePath,
        message: commitMessage,
        content: Buffer.from(content).toString('base64')
      };

      if (existingFile) {
        fileData.sha = existingFile.data.sha;
      }

      await this.octokit.repos.createOrUpdateFileContents(fileData);
      console.log(`📄 Updated file: ${filePath}`);
    } catch (error) {
      console.error(`Failed to update file ${filePath}:`, error);
    }
  }

  // Generate performance report content
  generatePerformanceReport(data) {
    return `# Solar Business Performance Report

Generated: ${new Date().toISOString()}

## Key Metrics
- **Total Leads**: ${data.total_leads}
- **Qualified Leads**: ${data.qualified_leads}
- **Conversion Rate**: ${data.conversion_rate}%
- **Average Deal Size**: $${data.average_deal_size}
- **Monthly Revenue**: $${data.monthly_revenue}

## Lead Sources
${data.lead_sources.map(source => 
  `- **${source.name}**: ${source.count} leads (${source.conversion_rate}% conversion)`
).join('\n')}

## Recent Installations
${data.recent_installations.map(install => 
  `- ${install.customer_name}: ${install.system_size}kW system ($${install.value})`
).join('\n')}

---
*Report generated automatically by AI Sales Platform*
`;
  }

  // Send data to platform
  async sendToPlatform(endpoint, data) {
    try {
      await axios.post(`${this.platformBaseUrl}${endpoint}`, data, {
        headers: {
          'Authorization': `Bearer ${process.env.PLATFORM_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error(`Failed to send data to platform ${endpoint}:`, error.message);
    }
  }

  // Determine priority from issue
  determinePriority(issue) {
    const urgentKeywords = ['urgent', 'asap', 'immediate', 'emergency'];
    const highValueKeywords = ['commercial', 'business', 'large system'];
    
    const text = (issue.title + ' ' + issue.body).toLowerCase();
    
    if (urgentKeywords.some(keyword => text.includes(keyword))) {
      return 'urgent';
    }
    
    if (highValueKeywords.some(keyword => text.includes(keyword))) {
      return 'high';
    }
    
    return 'normal';
  }
}

module.exports = SolarRepoSync;

// Start sync service if run directly
if (require.main === module) {
  const syncService = new SolarRepoSync();
  syncService.startSync();
}