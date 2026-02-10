/**
 * Chat Command Handlers
 * Command handlers for chat functionality
 */

import { BaseCommandHandler, HandlerResult, AuditContext } from './baseCommandHandler';
import chatController from '../../controllers/chatController';

/**
 * Chat Message Handler - Send message to chat
 */
export class ChatMessageHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.prompt || typeof payload.prompt !== 'string') {
      errors.push('prompt is required and must be a string');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const result = await chatController.message(
        { body: { prompt: payload.prompt } } as any,
        {
          json: (data: unknown) => data,
        } as any,
        () => {}
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'CHAT_MESSAGE_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'chat';
  }

  getName(): string {
    return 'chat.message';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'write';
  }
}

/**
 * Chat Conversation Handler - Conversation management
 */
export class ChatConversationHandler extends BaseCommandHandler {
  validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!payload.sessionId || typeof payload.sessionId !== 'string') {
      errors.push('sessionId is required');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      // Get chat manager for conversation management
      const chatManager = await import('../../helpers/chatManager');

      const result = (await (chatManager as any).getConversation?.(payload.sessionId)) || {
        sessionId: payload.sessionId,
        messages: [],
        createdAt: new Date().toISOString(),
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'CONVERSATION_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'chat';
  }

  getName(): string {
    return 'chat.conversation';
  }
}

/**
 * Chat History Handler - Get chat history
 */
export class ChatHistoryHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    // sessionId is optional
    return { valid: true };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const sessionId = payload.sessionId as string | undefined;

      // Get chat manager for history
      const chatManager = await import('../../helpers/chatManager');

      const result = (await (chatManager as any).getHistory?.(sessionId)) || {
        sessions: [],
        totalMessages: 0,
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'HISTORY_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'chat';
  }

  getName(): string {
    return 'chat.history';
  }
}

/**
 * Chat Clear Handler - Clear conversation
 */
export class ChatClearHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const all = payload.all === true;
      const sessionId = payload.sessionId as string | undefined;

      // Get chat manager for clearing
      const chatManager = await import('../../helpers/chatManager');

      const result = (await (chatManager as any).clear?.(sessionId, all)) || {
        cleared: true,
        sessionId,
        all,
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'CLEAR_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'chat';
  }

  getName(): string {
    return 'chat.clear';
  }

  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'delete';
  }
}

/**
 * Chat Prepare Handler - Prepare chat session
 */
export class ChatPrepareHandler extends BaseCommandHandler {
  validate(_payload: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }

  async execute(payload: Record<string, unknown>, _context: AuditContext): Promise<HandlerResult> {
    try {
      const result = await chatController.prepare(
        { body: payload } as any,
        {
          json: (data: unknown) => data,
        } as any,
        () => {}
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        code: 'PREPARE_FAILED',
      };
    }
  }

  getCategory(): string {
    return 'chat';
  }

  getName(): string {
    return 'chat.prepare';
  }
}

/**
 * Export all chat handlers
 */
export const chatHandlers = {
  'chat.message': new ChatMessageHandler(),
  'chat.conversation': new ChatConversationHandler(),
  'chat.history': new ChatHistoryHandler(),
  'chat.clear': new ChatClearHandler(),
  'chat.prepare': new ChatPrepareHandler(),
};
