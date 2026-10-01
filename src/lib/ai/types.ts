export interface LlmMessage {
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string;
  name?: string;
  functionCall?: {
    name: string;
    arguments: Record<string, any>;
  };
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      items?: any;
    }>;
    required?: string[];
  };
}

export interface LlmRequest {
  messages: LlmMessage[];
  systemInstruction?: string;
  tools?: LlmToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}

export interface LlmResponse {
  content: string;
  functionCall?: {
    name: string;
    arguments: Record<string, any>;
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  isFallback?: boolean;
}

export interface ILlmProvider {
  name: string;
  generateResponse(request: LlmRequest): Promise<LlmResponse>;
}

export interface ToolExecutionContext {
  organizationId: string;
  userId: string;
  userName: string;
  userRole: string; // OWNER, PARTNER, SITE_SUPERVISOR, ACCOUNTANT
}
