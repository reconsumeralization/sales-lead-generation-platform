// GitHub Integration for Ron's Florida Solar LLC
// Direct connection to https://github.com/reconsumeralization/a-a-ronsFloridaSolarLLC

const express = require('express');
const { Octokit } = require('@octokit/rest');
const crypto = require('crypto');
const axios = require('axios');

class GitHubSolarIntegration {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    
    this.repoOwner = 'reconsumeralization';
    this.repoName = 'a-a-ronsFloridaSolarLLC';
    this.webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    
    this.setupWebhookHandlers();
  }

  // Verify GitHub webhook signature
  verifySignature(payload, signature) {
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }

  // Setup webhook event handlers
  setupWebhookHandlers() {
    const app = express();
    app.use(express.raw({ type: 'application/json' }));

    // GitHub webhook endpoint
    app.post('/webhooks/github', async (req, res) => {
      const signature = req.headers['x-hub-signature-256'];
      const event = req.headers['x-github-event'];
      
      if (!this.verifySignature(req.body, signature)) {
        return res.status(401).send('Unauthorized');
      }

      const payload = JSON.parse(req.body);
      
      try {
        await this.handleWebhookEvent(event, payload);
        res.status(200).send('OK');
      } catch (error) {
        console.error('Webhook handling error:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    const port = process.env.GITHUB_INTEGRATION_PORT || 9000;
    app.listen(port, () => {
      console.log(`GitHub integration listening on port ${port}`);
    });
  }

  // Handle different GitHub webhook events
  async handleWebhookEvent(event, payload) {
    switch (event) {
      case 'push':
        await this.handlePushEvent(payload);
        break;
      case 'issues':
        await this.handleIssueEvent(payload);
        break;
      case 'pull_request':
        await this.handlePullRequestEvent(payload);
        break;
      case 'release':
        await this.handleReleaseEvent(payload);
        break;
      default:
        console.log(`Unhandled event: ${event}`);
    }
  }

  // Handle push events (code updates)
  async handlePushEvent(payload) {
    console.log(`Push to ${payload.ref} by ${payload.pusher.name}`);
    
    // If push to main branch, trigger deployment
    if (payload.ref === 'refs/heads/main') {
      await this.triggerSolarPlatformUpdate(payload);
    }

    // Extract solar-related changes
    const solarChanges = this.extractSolarChanges(payload.commits);
    if (solarChanges.length > 0) {
      await this.updateSolarConfiguration(solarChanges);
    }
  }

  // Handle issue events (customer feedback, bugs)
  async handleIssueEvent(payload) {
    const issue = payload.issue;
    
    if (payload.action === 'opened') {
      // Create lead from GitHub issue if it's a customer inquiry
      if (this.isCustomerInquiry(issue)) {
        await this.createLeadFromIssue(issue);
      }
      
      // Auto-assign solar-related issues
      if (this.isSolarRelated(issue)) {
        await this.assignSolarExpert(issue);
      }
    }
  }

  // Handle pull request events (feature updates)
  async handlePullRequestEvent(payload) {
    const pr = payload.pull_request;
    
    if (payload.action === 'opened') {
      // Auto-review solar-related PRs
      if (this.isSolarFeature(pr)) {
        await this.reviewSolarPR(pr);
      }
    }
    
    if (payload.action === 'closed' && pr.merged) {
      // Deploy solar features when merged
      await this.deploySolarFeatures(pr);
    }
  }

  // Trigger solar platform update
  async triggerSolarPlatformUpdate(payload) {
    try {
      // Call our platform's update endpoint
      await axios.post(`${process.env.PLATFORM_BASE_URL}/api/v1/system/update`, {
        source: 'github',
        repository: `${this.repoOwner}/${this.repoName}`,
        commit: payload.head_commit.id,
        message: payload.head_commit.message,
        author: payload.head_commit.author.name,
        timestamp: payload.head_commit.timestamp
      });

      console.log('Solar platform update triggered successfully');
    } catch (error) {
      console.error('Failed to trigger platform update:', error);
    }
  }

  // Extract solar-related changes from commits
  extractSolarChanges(commits) {
    const solarKeywords = [
      'solar', 'panel', 'inverter', 'installation', 'proposal',
      'financing', 'rebate', 'incentive', 'kwh', 'savings'
    ];

    return commits.filter(commit => {
      const message = commit.message.toLowerCase();
      return solarKeywords.some(keyword => message.includes(keyword));
    });
  }

  // Check if issue is a customer inquiry
  isCustomerInquiry(issue) {
    const customerLabels = ['customer-inquiry', 'lead', 'quote-request'];
    const customerKeywords = ['quote', 'price', 'cost', 'install', 'solar system'];
    
    const hasCustomerLabel = issue.labels.some(label => 
      customerLabels.includes(label.name.toLowerCase())
    );
    
    const hasCustomerKeywords = customerKeywords.some(keyword =>
      issue.title.toLowerCase().includes(keyword) ||
      issue.body.toLowerCase().includes(keyword)
    );

    return hasCustomerLabel || hasCustomerKeywords;
  }

  // Create lead from GitHub issue
  async createLeadFromIssue(issue) {
    try {
      const leadData = {
        source: 'github_issue',
        first_name: issue.user.login,
        email: `${issue.user.login}@github.user`, // Placeholder
        phone: 'Not provided',
        inquiry_type: 'solar_quote',
        message: issue.body,
        github_issue_id: issue.id,
        github_issue_url: issue.html_url,
        priority: this.determinePriority(issue),
        created_at: issue.created_at
      };

      // Send to lead scoring service
      await axios.post(`${process.env.PLATFORM_BASE_URL}/api/v1/leads/score`, {
        lead_data: leadData,
        source_attribution: {
          source: 'github',
          campaign: 'repository_inquiry',
          medium: 'issue'
        }
      });

      // Add comment to GitHub issue
      await this.octokit.issues.createComment({
        owner: this.repoOwner,
        repo: this.repoName,
        issue_number: issue.number,
        body: `Thank you for your inquiry! We've received your request and a solar consultant will contact you within 24 hours. 

For immediate assistance, please call us at ${process.env.COMPANY_PHONE} or visit ${process.env.COMPANY_WEBSITE}.

**Ron's Florida Solar LLC** - Your trusted solar partner in Florida! 🌞`
      });

      console.log(`Created lead from GitHub issue #${issue.number}`);
    } catch (error) {
      console.error('Failed to create lead from issue:', error);
    }
  }

  // Determine lead priority from issue
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

  // Check if issue is solar-related
  isSolarRelated(issue) {
    const solarKeywords = [
      'solar', 'panel', 'inverter', 'installation', 'energy',
      'kwh', 'savings', 'rebate', 'financing', 'roof'
    ];
    
    const text = (issue.title + ' ' + issue.body).toLowerCase();
    return solarKeywords.some(keyword => text.includes(keyword));
  }

  // Auto-assign solar expert to issues
  async assignSolarExpert(issue) {
    try {
      await this.octokit.issues.addAssignees({
        owner: this.repoOwner,
        repo: this.repoName,
        issue_number: issue.number,
        assignees: [process.env.SOLAR_EXPERT_GITHUB_USERNAME || 'reconsumeralization']
      });

      // Add solar label
      await this.octokit.issues.addLabels({
        owner: this.repoOwner,
        repo: this.repoName,
        issue_number: issue.number,
        labels: ['solar', 'needs-review']
      });

      console.log(`Assigned solar expert to issue #${issue.number}`);
    } catch (error) {
      console.error('Failed to assign solar expert:', error);
    }
  }

  // Sync repository data with our platform
  async syncRepositoryData() {
    try {
      // Get repository information
      const { data: repo } = await this.octokit.repos.get({
        owner: this.repoOwner,
        repo: this.repoName
      });

      // Get recent issues (potential leads)
      const { data: issues } = await this.octokit.issues.listForRepo({
        owner: this.repoOwner,
        repo: this.repoName,
        state: 'open',
        labels: 'customer-inquiry',
        per_page: 50
      });

      // Process each issue as potential lead
      for (const issue of issues) {
        if (this.isCustomerInquiry(issue)) {
          await this.createLeadFromIssue(issue);
        }
      }

      // Get repository statistics
      const stats = {
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        watchers: repo.watchers_count,
        open_issues: repo.open_issues_count,
        last_updated: repo.updated_at
      };

      // Update platform with repository stats
      await axios.post(`${process.env.PLATFORM_BASE_URL}/api/v1/integrations/github/stats`, {
        repository: `${this.repoOwner}/${this.repoName}`,
        stats: stats,
        synced_at: new Date().toISOString()
      });

      console.log('Repository data synced successfully');
    } catch (error) {
      console.error('Failed to sync repository data:', error);
    }
  }

  // Create GitHub issues from platform events
  async createIssueFromPlatformEvent(eventData) {
    try {
      const issueTitle = `${eventData.type}: ${eventData.title}`;
      const issueBody = `
**Event Type:** ${eventData.type}
**Priority:** ${eventData.priority}
**Description:** ${eventData.description}

**Platform Data:**
- Lead ID: ${eventData.lead_id}
- Customer: ${eventData.customer_name}
- System Size: ${eventData.system_size}kW
- Estimated Value: $${eventData.estimated_value}

**Action Required:** ${eventData.action_required}

---
*This issue was automatically created by the AI Sales Platform*
      `;

      const { data: issue } = await this.octokit.issues.create({
        owner: this.repoOwner,
        repo: this.repoName,
        title: issueTitle,
        body: issueBody,
        labels: ['platform-generated', eventData.type.toLowerCase()]
      });

      console.log(`Created GitHub issue #${issue.number} from platform event`);
      return issue;
    } catch (error) {
      console.error('Failed to create GitHub issue:', error);
    }
  }

  // Setup periodic sync
  startPeriodicSync() {
    // Sync every 15 minutes
    setInterval(async () => {
      await this.syncRepositoryData();
    }, 15 * 60 * 1000);

    console.log('Periodic GitHub sync started (every 15 minutes)');
  }
}

module.exports = GitHubSolarIntegration;

// Initialize integration if running directly
if (require.main === module) {
  const integration = new GitHubSolarIntegration();
  integration.startPeriodicSync();
}