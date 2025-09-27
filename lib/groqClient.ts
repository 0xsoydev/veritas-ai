// Client-side service for interacting with GroqCloud API
import { AgentConfig, AgentResponse, ExecutionContext } from './groqService';

export class GroqClient {
  private baseUrl: string;

  constructor(baseUrl = '/api/groq') {
    this.baseUrl = baseUrl;
  }

  async executeAgent(
    agent: AgentConfig,
    userInput: string,
    context?: Partial<ExecutionContext>
  ): Promise<AgentResponse> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'execute',
        agent,
        userInput,
        context: {
          userId: context?.userId || 'anonymous',
          sessionId: context?.sessionId || `session-${Date.now()}`,
          timestamp: Date.now(),
          metadata: context?.metadata || {}
        }
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Unknown error occurred');
    }

    return result.response;
  }

  async createAgent(config: Partial<AgentConfig>, ownerAddress?: string): Promise<AgentConfig> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create',
        config,
        ownerAddress,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Unknown error occurred');
    }

    return result.agent;
  }

  async validateAgentConfig(config: Partial<AgentConfig>): Promise<{
    valid: boolean;
    errors: string[];
    warnings?: string[];
  }> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'validate',
        config,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Unknown error occurred');
    }

    return result.validation;
  }

  async getAvailableModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}?action=models`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Unknown error occurred');
    }

    return result.models;
  }

  async getAvailableTools(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}?action=tools`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Unknown error occurred');
    }

    return result.tools;
  }

  async checkServiceStatus(): Promise<{
    status: string;
    timestamp: string;
  }> {
    const response = await fetch(`${this.baseUrl}?action=status`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Unknown error occurred');
    }

    return {
      status: result.status,
      timestamp: result.timestamp
    };
  }
}
