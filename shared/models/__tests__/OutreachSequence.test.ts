import {
  OutreachSequence,
  Message,
  OutreachSequenceValidator,
  OutreachSequenceHelper,
  OutreachSequenceEntity,
  MessageEntity,
  PerformanceMetrics
} from '../OutreachSequence';

describe('OutreachSequence Model Tests', () => {
  const mockMessage: Message = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    sequence_id: '123e4567-e89b-12d3-a456-426614174001',
    prospect_id: '123e4567-e89b-12d3-a456-426614174002',
    channel: 'email',
    subject: 'Test Email Subject',
    content: 'Hello {{prospect_name}}, this is a test message.',
    personalization_data: {
      prospect_name: 'John Doe',
      company_name: 'Test Company',
      industry: 'Technology'
    },
    status: 'draft',
    created_at: new Date(),
    updated_at: new Date()
  };

  const mockSequence: OutreachSequence = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Demo Request Follow-up',
    description: 'Follow-up sequence for demo requests',
    sequence_type: 'demo_followup',
    brand_profile: 'professional',
    is_active: true,
    messages: [mockMessage],
    created_by: '123e4567-e89b-12d3-a456-426614174003',
    created_at: new Date(),
    updated_at: new Date()
  };

  describe('OutreachSequence Validation', () => {
    test('should validate a complete sequence successfully', () => {
      const result = OutreachSequenceValidator.validateSequence(mockSequence);
      expect(result.error).toBeUndefined();
    });

    test('should require name, sequence_type, brand_profile, and created_by', () => {
      const invalidSequence = { ...mockSequence };
      delete (invalidSequence as any).name;
      delete (invalidSequence as any).sequence_type;
      delete (invalidSequence as any).brand_profile;
      delete (invalidSequence as any).created_by;

      const result = OutreachSequenceValidator.validateSequence(invalidSequence);
      expect(result.error).toBeDefined();
      expect(result.error?.details).toHaveLength(4);
    });

    test('should validate sequence name length', () => {
      const invalidSequence = {
        ...mockSequence,
        name: '' // Empty name
      };

      const result = OutreachSequenceValidator.validateSequence(invalidSequence);
      expect(result.error).toBeDefined();
    });

    test('should validate is_active as boolean', () => {
      const invalidSequence = {
        ...mockSequence,
        is_active: 'true' as any // Should be boolean, not string
      };

      const result = OutreachSequenceValidator.validateSequence(invalidSequence);
      expect(result.error).toBeDefined();
    });
  });

  describe('Message Validation', () => {
    test('should validate a complete message successfully', () => {
      const result = OutreachSequenceValidator.validateMessage(mockMessage);
      expect(result.error).toBeUndefined();
    });

    test('should require prospect_id, channel, content, and status', () => {
      const invalidMessage = { ...mockMessage };
      delete (invalidMessage as any).prospect_id;
      delete (invalidMessage as any).channel;
      delete (invalidMessage as any).content;
      delete (invalidMessage as any).status;

      const result = OutreachSequenceValidator.validateMessage(invalidMessage);
      expect(result.error).toBeDefined();
      expect(result.error?.details).toHaveLength(4);
    });

    test('should require subject for email messages', () => {
      const emailMessage = {
        ...mockMessage,
        channel: 'email' as const,
        subject: undefined
      };

      const result = OutreachSequenceValidator.validateMessage(emailMessage);
      expect(result.error).toBeDefined();
    });

    test('should not require subject for non-email messages', () => {
      const linkedinMessage = {
        ...mockMessage,
        channel: 'linkedin' as const,
        subject: undefined
      };

      const result = OutreachSequenceValidator.validateMessage(linkedinMessage);
      expect(result.error).toBeUndefined();
    });

    test('should validate channel type', () => {
      const invalidMessage = {
        ...mockMessage,
        channel: 'invalid_channel' as any
      };

      const result = OutreachSequenceValidator.validateMessage(invalidMessage);
      expect(result.error).toBeDefined();
    });

    test('should validate message status', () => {
      const invalidMessage = {
        ...mockMessage,
        status: 'invalid_status' as any
      };

      const result = OutreachSequenceValidator.validateMessage(invalidMessage);
      expect(result.error).toBeDefined();
    });
  });

  describe('Business Logic Validation', () => {
    test('should validate message for sending', () => {
      const validMessage = { ...mockMessage, status: 'draft' as const };
      expect(OutreachSequenceValidator.validateMessageForSending(validMessage)).toBe(true);

      const sentMessage = { ...mockMessage, status: 'sent' as const };
      expect(OutreachSequenceValidator.validateMessageForSending(sentMessage)).toBe(false);

      const messageWithoutContent = { ...mockMessage, content: '' };
      expect(OutreachSequenceValidator.validateMessageForSending(messageWithoutContent)).toBe(false);
    });

    test('should validate sequence for activation', () => {
      const validSequence = { ...mockSequence };
      expect(OutreachSequenceValidator.validateSequenceForActivation(validSequence)).toBe(true);

      const sequenceWithoutMessages = { ...mockSequence, messages: [] };
      expect(OutreachSequenceValidator.validateSequenceForActivation(sequenceWithoutMessages)).toBe(false);
    });

    test('should validate performance metrics', () => {
      const validMetrics: PerformanceMetrics = {
        open_rate: 0.25,
        click_rate: 0.10,
        reply_rate: 0.05
      };
      expect(OutreachSequenceValidator.validatePerformanceMetrics(validMetrics)).toBe(true);

      const invalidMetrics: PerformanceMetrics = {
        open_rate: 1.5, // Invalid: > 1
        click_rate: -0.1 // Invalid: < 0
      };
      expect(OutreachSequenceValidator.validatePerformanceMetrics(invalidMetrics)).toBe(false);
    });
  });

  describe('Performance Calculation', () => {
    test('should calculate sequence performance correctly', () => {
      const messages: Message[] = [
        { ...mockMessage, status: 'sent', sent_time: new Date() },
        { ...mockMessage, status: 'delivered', sent_time: new Date() },
        { ...mockMessage, status: 'opened', sent_time: new Date() },
        { ...mockMessage, status: 'replied', sent_time: new Date(), replied_time: new Date() },
        { ...mockMessage, status: 'bounced' }
      ];

      const performance = OutreachSequenceHelper.calculateSequencePerformance(messages);

      expect(performance.total_sent).toBe(4); // Excludes bounced
      expect(performance.total_delivered).toBe(3);
      expect(performance.total_opened).toBe(2);
      expect(performance.total_replied).toBe(1);
      expect(performance.total_bounced).toBe(1);
      expect(performance.overall_open_rate).toBe(0.5); // 2/4
      expect(performance.overall_reply_rate).toBe(0.25); // 1/4
    });

    test('should calculate average response time', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const repliedMessages: Message[] = [
        { ...mockMessage, sent_time: oneHourAgo, replied_time: now },
        { ...mockMessage, sent_time: twoHoursAgo, replied_time: now }
      ];

      const avgTime = OutreachSequenceHelper.calculateAverageResponseTime(repliedMessages);
      expect(avgTime).toBe(1.5); // Average of 1 and 2 hours
    });
  });

  describe('Sequence Management', () => {
    test('should get next scheduled message for prospect', () => {
      const prospectId = '123e4567-e89b-12d3-a456-426614174002';
      const scheduledMessage = {
        ...mockMessage,
        prospect_id: prospectId,
        status: 'scheduled' as const,
        scheduled_time: new Date()
      };

      const sequenceWithScheduled = {
        ...mockSequence,
        messages: [mockMessage, scheduledMessage]
      };

      const nextMessage = OutreachSequenceHelper.getNextScheduledMessage(
        sequenceWithScheduled,
        prospectId
      );

      expect(nextMessage).toBeDefined();
      expect(nextMessage?.status).toBe('scheduled');
    });

    test('should determine if sequence is complete for prospect', () => {
      const prospectId = '123e4567-e89b-12d3-a456-426614174002';
      const completedMessages = [
        { ...mockMessage, prospect_id: prospectId, status: 'sent' as const },
        { ...mockMessage, prospect_id: prospectId, status: 'delivered' as const }
      ];

      const sequenceWithCompleted = {
        ...mockSequence,
        messages: completedMessages
      };

      const isComplete = OutreachSequenceHelper.isSequenceCompleteForProspect(
        sequenceWithCompleted,
        prospectId
      );

      expect(isComplete).toBe(true);
    });

    test('should determine if sequence should stop for prospect', () => {
      const prospectId = '123e4567-e89b-12d3-a456-426614174002';
      const repliedMessage = {
        ...mockMessage,
        prospect_id: prospectId,
        status: 'replied' as const
      };

      const sequenceWithReply = {
        ...mockSequence,
        messages: [repliedMessage]
      };

      const shouldStop = OutreachSequenceHelper.shouldStopSequenceForProspect(
        sequenceWithReply,
        prospectId
      );

      expect(shouldStop).toBe(true);
    });
  });

  describe('Database Entity Mapping', () => {
    test('should convert sequence from database row to object', () => {
      const dbRow = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Sequence',
        description: 'Test Description',
        sequence_type: 'demo_followup',
        brand_profile: 'professional',
        is_active: true,
        created_by: '123e4567-e89b-12d3-a456-426614174003',
        created_at: new Date(),
        updated_at: new Date()
      };

      const sequence = OutreachSequenceEntity.fromDatabase(dbRow);

      expect(sequence.id).toBe(dbRow.id);
      expect(sequence.name).toBe(dbRow.name);
      expect(sequence.is_active).toBe(dbRow.is_active);
    });

    test('should convert sequence from object to database format', () => {
      const dbData = OutreachSequenceEntity.toDatabase(mockSequence);

      expect(dbData.id).toBe(mockSequence.id);
      expect(dbData.name).toBe(mockSequence.name);
      expect(dbData.is_active).toBe(mockSequence.is_active);
    });

    test('should convert message from database row to object', () => {
      const dbRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        sequence_id: '123e4567-e89b-12d3-a456-426614174001',
        prospect_id: '123e4567-e89b-12d3-a456-426614174002',
        channel: 'email',
        subject: 'Test Subject',
        content: 'Test Content',
        personalization_data: { prospect_name: 'John' },
        status: 'draft',
        created_at: new Date(),
        updated_at: new Date()
      };

      const message = MessageEntity.fromDatabase(dbRow);

      expect(message.id).toBe(dbRow.id);
      expect(message.channel).toBe(dbRow.channel);
      expect(message.status).toBe(dbRow.status);
    });

    test('should convert message from object to database format', () => {
      const dbData = MessageEntity.toDatabase(mockMessage);

      expect(dbData.id).toBe(mockMessage.id);
      expect(dbData.channel).toBe(mockMessage.channel);
      expect(dbData.status).toBe(mockMessage.status);
      expect(typeof dbData.personalization_data).toBe('string');
    });
  });
});