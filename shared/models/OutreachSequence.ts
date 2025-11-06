import Joi from 'joi';

export type MessageStatus = 'draft' | 'scheduled' | 'sent' | 'delivered' | 'opened' | 'replied' | 'bounced';
export type ChannelType = 'email' | 'linkedin' | 'phone' | 'sms';

export interface PersonalizationData {
  prospect_name?: string;
  company_name?: string;
  industry?: string;
  recent_news?: string;
  mutual_connections?: string[];
  company_size?: string;
  technologies_used?: string[];
  pain_points?: string[];
  custom_variables?: Record<string, any>;
}

export interface PerformanceMetrics {
  open_rate?: number;
  click_rate?: number;
  reply_rate?: number;
  bounce_rate?: number;
  unsubscribe_rate?: number;
  conversion_rate?: number;
  engagement_score?: number;
}

export interface Message {
  id?: string;
  sequence_id?: string;
  prospect_id: string;
  channel: ChannelType;
  template_id?: string;
  subject?: string;
  content: string;
  personalization_data?: PersonalizationData;
  scheduled_time?: Date;
  sent_time?: Date;
  delivered_time?: Date;
  opened_time?: Date;
  replied_time?: Date;
  status: MessageStatus;
  external_message_id?: string;
  performance_metrics?: PerformanceMetrics;
  created_at?: Date;
  updated_at?: Date;
}

export interface SequencePerformance {
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_replied: number;
  total_bounced: number;
  total_unsubscribed: number;
  total_converted: number;
  overall_open_rate: number;
  overall_reply_rate: number;
  overall_conversion_rate: number;
  average_response_time_hours?: number;
}

export interface OutreachSequence {
  id?: string;
  name: string;
  description?: string;
  sequence_type: string;
  brand_profile: string;
  is_active: boolean;
  messages?: Message[];
  performance?: SequencePerformance;
  created_by: string;
  created_at?: Date;
  updated_at?: Date;
}

// Validation schemas
export const PersonalizationDataSchema = Joi.object({
  prospect_name: Joi.string().max(200).optional(),
  company_name: Joi.string().max(255).optional(),
  industry: Joi.string().max(100).optional(),
  recent_news: Joi.string().max(1000).optional(),
  mutual_connections: Joi.array().items(Joi.string()).optional(),
  company_size: Joi.string().max(50).optional(),
  technologies_used: Joi.array().items(Joi.string()).optional(),
  pain_points: Joi.array().items(Joi.string()).optional(),
  custom_variables: Joi.object().optional()
});

export const PerformanceMetricsSchema = Joi.object({
  open_rate: Joi.number().min(0).max(1).optional(),
  click_rate: Joi.number().min(0).max(1).optional(),
  reply_rate: Joi.number().min(0).max(1).optional(),
  bounce_rate: Joi.number().min(0).max(1).optional(),
  unsubscribe_rate: Joi.number().min(0).max(1).optional(),
  conversion_rate: Joi.number().min(0).max(1).optional(),
  engagement_score: Joi.number().min(0).max(100).optional()
});

export const MessageSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  sequence_id: Joi.string().uuid().optional(),
  prospect_id: Joi.string().uuid().required(),
  channel: Joi.string().valid('email', 'linkedin', 'phone', 'sms').required(),
  template_id: Joi.string().uuid().optional(),
  subject: Joi.string().max(500).when('channel', {
    is: 'email',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  content: Joi.string().min(1).max(10000).required(),
  personalization_data: PersonalizationDataSchema.optional(),
  scheduled_time: Joi.date().optional(),
  sent_time: Joi.date().optional(),
  delivered_time: Joi.date().optional(),
  opened_time: Joi.date().optional(),
  replied_time: Joi.date().optional(),
  status: Joi.string().valid('draft', 'scheduled', 'sent', 'delivered', 'opened', 'replied', 'bounced').required(),
  external_message_id: Joi.string().max(255).optional(),
  performance_metrics: PerformanceMetricsSchema.optional(),
  created_at: Joi.date().optional(),
  updated_at: Joi.date().optional()
});

export const SequencePerformanceSchema = Joi.object({
  total_sent: Joi.number().integer().min(0).required(),
  total_delivered: Joi.number().integer().min(0).required(),
  total_opened: Joi.number().integer().min(0).required(),
  total_clicked: Joi.number().integer().min(0).required(),
  total_replied: Joi.number().integer().min(0).required(),
  total_bounced: Joi.number().integer().min(0).required(),
  total_unsubscribed: Joi.number().integer().min(0).required(),
  total_converted: Joi.number().integer().min(0).required(),
  overall_open_rate: Joi.number().min(0).max(1).required(),
  overall_reply_rate: Joi.number().min(0).max(1).required(),
  overall_conversion_rate: Joi.number().min(0).max(1).required(),
  average_response_time_hours: Joi.number().min(0).optional()
});

export const OutreachSequenceSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  sequence_type: Joi.string().min(1).max(100).required(),
  brand_profile: Joi.string().min(1).max(100).required(),
  is_active: Joi.boolean().required(),
  messages: Joi.array().items(MessageSchema).optional(),
  performance: SequencePerformanceSchema.optional(),
  created_by: Joi.string().uuid().required(),
  created_at: Joi.date().optional(),
  updated_at: Joi.date().optional()
});

// Validation functions
export class OutreachSequenceValidator {
  static validateSequence(sequence: OutreachSequence): Joi.ValidationResult {
    return OutreachSequenceSchema.validate(sequence, { abortEarly: false });
  }

  static validateMessage(message: Message): Joi.ValidationResult {
    return MessageSchema.validate(message, { abortEarly: false });
  }

  static validateMessageForSending(message: Message): boolean {
    // Check if message has required fields for sending
    if (!message.content || !message.prospect_id) {
      return false;
    }

    // Email messages must have subject
    if (message.channel === 'email' && !message.subject) {
      return false;
    }

    // Message must be in draft or scheduled status
    return ['draft', 'scheduled'].includes(message.status);
  }

  static validateSequenceForActivation(sequence: OutreachSequence): boolean {
    // Sequence must have at least one message
    if (!sequence.messages || sequence.messages.length === 0) {
      return false;
    }

    // All messages must be valid
    return sequence.messages.every(message => 
      this.validateMessage(message).error === undefined
    );
  }

  static validatePerformanceMetrics(metrics: PerformanceMetrics): boolean {
    // All rates should be between 0 and 1
    const rates = [
      metrics.open_rate,
      metrics.click_rate,
      metrics.reply_rate,
      metrics.bounce_rate,
      metrics.unsubscribe_rate,
      metrics.conversion_rate
    ];

    return rates.every(rate => 
      rate === undefined || (rate >= 0 && rate <= 1)
    );
  }
}

// Business logic helpers
export class OutreachSequenceHelper {
  static calculateSequencePerformance(messages: Message[]): SequencePerformance {
    const sentMessages = messages.filter(m => ['sent', 'delivered', 'opened', 'replied'].includes(m.status));
    const deliveredMessages = messages.filter(m => ['delivered', 'opened', 'replied'].includes(m.status));
    const openedMessages = messages.filter(m => ['opened', 'replied'].includes(m.status));
    const repliedMessages = messages.filter(m => m.status === 'replied');
    const bouncedMessages = messages.filter(m => m.status === 'bounced');

    const totalSent = sentMessages.length;
    const totalDelivered = deliveredMessages.length;
    const totalOpened = openedMessages.length;
    const totalReplied = repliedMessages.length;
    const totalBounced = bouncedMessages.length;

    return {
      total_sent: totalSent,
      total_delivered: totalDelivered,
      total_opened: totalOpened,
      total_clicked: 0, // Would need click tracking data
      total_replied: totalReplied,
      total_bounced: totalBounced,
      total_unsubscribed: 0, // Would need unsubscribe tracking
      total_converted: 0, // Would need conversion tracking
      overall_open_rate: totalSent > 0 ? totalOpened / totalSent : 0,
      overall_reply_rate: totalSent > 0 ? totalReplied / totalSent : 0,
      overall_conversion_rate: 0, // Would need conversion data
      average_response_time_hours: this.calculateAverageResponseTime(repliedMessages)
    };
  }

  static calculateAverageResponseTime(repliedMessages: Message[]): number | undefined {
    const responseTimes = repliedMessages
      .filter(m => m.sent_time && m.replied_time)
      .map(m => {
        const sentTime = new Date(m.sent_time!).getTime();
        const repliedTime = new Date(m.replied_time!).getTime();
        return (repliedTime - sentTime) / (1000 * 60 * 60); // Convert to hours
      });

    if (responseTimes.length === 0) {
      return undefined;
    }

    return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  }

  static getNextScheduledMessage(sequence: OutreachSequence, prospectId: string): Message | null {
    if (!sequence.messages) {
      return null;
    }

    const prospectMessages = sequence.messages
      .filter(m => m.prospect_id === prospectId)
      .sort((a, b) => {
        if (!a.scheduled_time || !b.scheduled_time) return 0;
        return new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime();
      });

    return prospectMessages.find(m => m.status === 'scheduled') || null;
  }

  static isSequenceCompleteForProspect(sequence: OutreachSequence, prospectId: string): boolean {
    if (!sequence.messages) {
      return true;
    }

    const prospectMessages = sequence.messages.filter(m => m.prospect_id === prospectId);
    
    // Sequence is complete if all messages are sent/delivered/opened/replied or if prospect replied
    return prospectMessages.every(m => 
      ['sent', 'delivered', 'opened', 'replied', 'bounced'].includes(m.status)
    ) || prospectMessages.some(m => m.status === 'replied');
  }

  static shouldStopSequenceForProspect(sequence: OutreachSequence, prospectId: string): boolean {
    if (!sequence.messages) {
      return false;
    }

    const prospectMessages = sequence.messages.filter(m => m.prospect_id === prospectId);
    
    // Stop sequence if prospect replied or unsubscribed
    return prospectMessages.some(m => 
      m.status === 'replied' || 
      (m.performance_metrics?.unsubscribe_rate && m.performance_metrics.unsubscribe_rate > 0)
    );
  }
}

// Database entity mapping
export class OutreachSequenceEntity {
  static fromDatabase(row: any): OutreachSequence {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      sequence_type: row.sequence_type,
      brand_profile: row.brand_profile,
      is_active: row.is_active,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  static toDatabase(sequence: OutreachSequence): any {
    return {
      id: sequence.id,
      name: sequence.name,
      description: sequence.description,
      sequence_type: sequence.sequence_type,
      brand_profile: sequence.brand_profile,
      is_active: sequence.is_active,
      created_by: sequence.created_by
    };
  }
}

export class MessageEntity {
  static fromDatabase(row: any): Message {
    return {
      id: row.id,
      sequence_id: row.sequence_id,
      prospect_id: row.prospect_id,
      channel: row.channel as ChannelType,
      template_id: row.template_id,
      subject: row.subject,
      content: row.content,
      personalization_data: row.personalization_data,
      scheduled_time: row.scheduled_time,
      sent_time: row.sent_time,
      delivered_time: row.delivered_time,
      opened_time: row.opened_time,
      replied_time: row.replied_time,
      status: row.status as MessageStatus,
      external_message_id: row.external_message_id,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  static toDatabase(message: Message): any {
    return {
      id: message.id,
      sequence_id: message.sequence_id,
      prospect_id: message.prospect_id,
      channel: message.channel,
      template_id: message.template_id,
      subject: message.subject,
      content: message.content,
      personalization_data: JSON.stringify(message.personalization_data),
      scheduled_time: message.scheduled_time,
      sent_time: message.sent_time,
      delivered_time: message.delivered_time,
      opened_time: message.opened_time,
      replied_time: message.replied_time,
      status: message.status,
      external_message_id: message.external_message_id
    };
  }
}

export default OutreachSequence;