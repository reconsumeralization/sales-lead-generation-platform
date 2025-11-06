// Automated GitHub Webhook Setup for Ron's Florida Solar LLC
// This script automatically configures webhooks in the target repository

const { Octokit } = require('@octokit/rest');
require('dotenv').config();

class WebhookSetup {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    
    this.repoOwner = 'reconsumeralization';
    this.repoName = 'a-a-ronsFloridaSolarLLC';
    this.webhookUrl = process.env.WEBHOOK_URL || 'https://your-platform-domain.com/webhooks/github';
  }

  async setupWebhooks() {
    try {
      console.log(`Setting up webhooks for ${this.repoOwner}/${this.repoName}...`);

      // Check if webhook already exists
      const existingWebhooks = await this.octokit.repos.listWebhooks({
        owner: this.repoOwner,
        repo: this.repoName
      });

      const existingWebhook = existingWebhooks.data.find(
        webhook => webhook.config.url === this.webhookUrl
      );

      if (existingWebhook) {
        console.log('Webhook already exists, updating...');
        await this.updateWebhook(existingWebhook.id);
      } else {
        console.log('Creating new webhook...');
        await this.createWebhook();
      }

      console.log('Webhook setup completed successfully!');
    } catch (error) {
      console.error('Failed to setup webhooks:', error);
    }
  }

  async createWebhook() {
    const webhookConfig = {
      owner: this.repoOwner,
      repo: this.repoName,
      name: 'web',
      config: {
        url: this.webhookUrl,
        content_type: 'json',
        secret: process.env.GITHUB_WEBHOOK_SECRET,
        insecure_ssl: '0'
      },
      events: [
        'push',
        'issues',
        'issue_comment',
        'pull_request',
        'pull_request_review',
        'release',
        'star',
        'watch',
        'fork'
      ],
      active: true
    };

    const { data: webhook } = await this.octokit.repos.createWebhook(webhookConfig);
    console.log(`Webhook created with ID: ${webhook.id}`);
    return webhook;
  }

  async updateWebhook(webhookId) {
    const webhookConfig = {
      owner: this.repoOwner,
      repo: this.repoName,
      hook_id: webhookId,
      config: {
        url: this.webhookUrl,
        content_type: 'json',
        secret: process.env.GITHUB_WEBHOOK_SECRET,
        insecure_ssl: '0'
      },
      events: [
        'push',
        'issues',
        'issue_comment',
        'pull_request',
        'pull_request_review',
        'release',
        'star',
        'watch',
        'fork'
      ],
      active: true
    };

    const { data: webhook } = await this.octokit.repos.updateWebhook(webhookConfig);
    console.log(`Webhook updated with ID: ${webhook.id}`);
    return webhook;
  }

  async setupIssueLabels() {
    console.log('Setting up solar-specific issue labels...');

    const solarLabels = [
      {
        name: 'solar',
        color: 'FFA500',
        description: 'Solar energy related issues'
      },
      {
        name: 'customer-inquiry',
        color: '0E8A16',
        description: 'Customer inquiries and quote requests'
      },
      {
        name: 'lead',
        color: '1D76DB',
        description: 'Potential sales lead'
      },
      {
        name: 'installation',
        color: 'B60205',
        description: 'Solar installation related'
      },
      {
        name: 'financing',
        color: 'FBCA04',
        description: 'Solar financing and rebates'
      },
      {
        name: 'technical',
        color: '5319E7',
        description: 'Technical solar questions'
      },
      {
        name: 'urgent',
        color: 'D93F0B',
        description: 'Urgent customer issue'
      },
      {
        name: 'platform-generated',
        color: '006B75',
        description: 'Automatically created by AI platform'
      }
    ];

    for (const label of solarLabels) {
      try {
        await this.octokit.issues.createLabel({
          owner: this.repoOwner,
          repo: this.repoName,
          ...label
        });
        console.log(`Created label: ${label.name}`);
      } catch (error) {
        if (error.status === 422) {
          // Label already exists, update it
          await this.octokit.issues.updateLabel({
            owner: this.repoOwner,
            repo: this.repoName,
            name: label.name,
            color: label.color,
            description: label.description
          });
          console.log(`Updated label: ${label.name}`);
        } else {
          console.error(`Failed to create label ${label.name}:`, error);
        }
      }
    }
  }

  async setupIssueTemplates() {
    console.log('Setting up issue templates...');

    const customerInquiryTemplate = `---
name: Customer Inquiry
about: Solar installation quote or inquiry
title: '[INQUIRY] '
labels: ['customer-inquiry', 'solar']
assignees: ['reconsumeralization']
---

## Customer Information
**Name:** 
**Phone:** 
**Email:** 
**Address:** 

## Solar Interest
**Property Type:** [ ] Residential [ ] Commercial
**Current Monthly Electric Bill:** $
**Roof Type:** 
**Timeline:** [ ] Immediate [ ] 3 months [ ] 6 months [ ] Just exploring

## Additional Details
**Message:** 

---
*This inquiry will be automatically processed by our AI sales platform for immediate follow-up.*`;

    const technicalIssueTemplate = `---
name: Technical Issue
about: Solar system technical problems
title: '[TECH] '
labels: ['technical', 'solar']
assignees: ['reconsumeralization']
---

## System Information
**Installation Date:** 
**System Size:** kW
**Panel Model:** 
**Inverter Model:** 

## Issue Description
**Problem:** 
**When did it start:** 
**Error messages:** 

## Troubleshooting Attempted
- [ ] Checked inverter display
- [ ] Checked circuit breakers
- [ ] Checked monitoring app
- [ ] Other: 

---
*Our technical team will respond within 24 hours.*`;

    // Create .github directory and templates
    const templates = [
      {
        path: '.github/ISSUE_TEMPLATE/customer-inquiry.md',
        content: customerInquiryTemplate
      },
      {
        path: '.github/ISSUE_TEMPLATE/technical-issue.md',
        content: technicalIssueTemplate
      }
    ];

    for (const template of templates) {
      try {
        // Check if file exists
        let existingFile;
        try {
          existingFile = await this.octokit.repos.getContent({
            owner: this.repoOwner,
            repo: this.repoName,
            path: template.path
          });
        } catch (error) {
          // File doesn't exist, that's fine
        }

        const fileData = {
          owner: this.repoOwner,
          repo: this.repoName,
          path: template.path,
          message: `Add ${template.path.includes('customer') ? 'customer inquiry' : 'technical issue'} template`,
          content: Buffer.from(template.content).toString('base64')
        };

        if (existingFile) {
          fileData.sha = existingFile.data.sha;
          await this.octokit.repos.createOrUpdateFileContents(fileData);
          console.log(`Updated template: ${template.path}`);
        } else {
          await this.octokit.repos.createOrUpdateFileContents(fileData);
          console.log(`Created template: ${template.path}`);
        }
      } catch (error) {
        console.error(`Failed to create template ${template.path}:`, error);
      }
    }
  }

  async testWebhook() {
    console.log('Testing webhook connection...');
    
    try {
      // Create a test issue to trigger webhook
      const testIssue = await this.octokit.issues.create({
        owner: this.repoOwner,
        repo: this.repoName,
        title: '[TEST] Webhook Integration Test',
        body: 'This is a test issue to verify webhook integration is working correctly.',
        labels: ['platform-generated', 'test']
      });

      console.log(`Test issue created: #${testIssue.data.number}`);
      
      // Close the test issue after a few seconds
      setTimeout(async () => {
        await this.octokit.issues.update({
          owner: this.repoOwner,
          repo: this.repoName,
          issue_number: testIssue.data.number,
          state: 'closed'
        });
        console.log('Test issue closed');
      }, 5000);

    } catch (error) {
      console.error('Webhook test failed:', error);
    }
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new WebhookSetup();
  
  (async () => {
    await setup.setupWebhooks();
    await setup.setupIssueLabels();
    await setup.setupIssueTemplates();
    
    // Uncomment to test webhook
    // await setup.testWebhook();
    
    console.log('\n🎉 GitHub integration setup complete!');
    console.log('\nNext steps:');
    console.log('1. Start the integration service: npm start');
    console.log('2. Test by creating an issue in the repository');
    console.log('3. Check platform logs for webhook events');
  })();
}

module.exports = WebhookSetup;