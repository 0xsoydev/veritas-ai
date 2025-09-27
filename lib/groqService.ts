import Groq from "groq-sdk";
import { ethers } from "ethers";

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  
  // Advanced Features
  enabledTools: string[];
  responseFormat?: 'text' | 'json_object';
  enableStreaming: boolean;
  enableWebSearch: boolean;
  enableCodeExecution: boolean;
  enableBrowserAutomation: boolean;
  enableWolframAlpha: boolean;
  
  // Custom Settings
  customInstructions: string[];
  exampleConversations: Array<{input: string, output: string}>;
  guardrails: string[];
  
  // INFT Integration
  isNFT: boolean;
  ownerAddress?: string;
  usageCost: number;
  maxUsagesPerDay: number;
  isForRent?: boolean;
  rentPricePerUse?: number;
  sellingPrice?: number;
}

export interface ExecutionContext {
  userId: string;
  sessionId: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface AgentResponse {
  content: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: string;
  toolsUsed: string[];
  executionTime: number;
  cost: number;
}

export class GroqAgentService {
  private groq: Groq;
  // Updated to only include confirmed working models
  private readonly AVAILABLE_MODELS = [
    // Core Production Models (Verified Working)
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    'llama3-70b-8192',  // Alternative Llama naming
    'llama3-8b-8192',   // Alternative Llama naming
    
    // GPT OSS Models (Working with reasoning_effort)
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    
    // Mixtral Models (Popular on GroqCloud)  
    'mixtral-8x7b-32768',
    
    // Gemma Models
    'gemma-7b-it',
    'gemma2-9b-it',
    
    // System Models (if available)
    'groq/compound',
    'groq/compound-mini'
  ];

  private readonly AVAILABLE_TOOLS = [
    'browser_search',      // GPT OSS: browser_search
    'code_interpreter',    // GPT OSS: code_interpreter
    'web_search',          // Compound: web_search  
    'visit_website',       // Compound: visit_website
    'browser_automation',  // Compound: browser_automation
    // Note: Tool availability varies by model type
  ];

  constructor() {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  // Create model-specific Groq client
  private createModelSpecificClient(model: string): Groq {
    if (model.includes('groq/compound')) {
      // Compound models need specific headers
      return new Groq({
        apiKey: process.env.GROQ_API_KEY,
        defaultHeaders: {
          "Groq-Model-Version": "latest"
        }
      });
    }
    
    // Default client for other models
    return this.groq;
  }

  // Create new AI agent configuration
  async createAgent(config: Partial<AgentConfig>, ownerAddress?: string): Promise<AgentConfig> {
    const agentId = ethers.id(config.name! + Date.now()).slice(0, 10);
    
    const agent: AgentConfig = {
      id: agentId,
      name: config.name || 'Unnamed Agent',
      description: config.description || '',
      systemPrompt: config.systemPrompt || 'You are a helpful AI assistant.',
      model: config.model || 'llama-3.3-70b-versatile',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens || 4096,
      topP: config.topP ?? 1.0,
      frequencyPenalty: config.frequencyPenalty ?? 0,
      presencePenalty: config.presencePenalty ?? 0,
      
      enabledTools: config.enabledTools || [],
      responseFormat: config.responseFormat || 'text',
      enableStreaming: config.enableStreaming ?? false,
      enableWebSearch: config.enableWebSearch ?? false,
      enableCodeExecution: config.enableCodeExecution ?? false,
      enableBrowserAutomation: config.enableBrowserAutomation ?? false,
      enableWolframAlpha: config.enableWolframAlpha ?? false,
      
      customInstructions: config.customInstructions || [],
      exampleConversations: config.exampleConversations || [],
      guardrails: config.guardrails || [],
      
      isNFT: config.isNFT ?? false,
      ownerAddress: ownerAddress || config.ownerAddress,
      usageCost: config.usageCost || 0.01,
      maxUsagesPerDay: config.maxUsagesPerDay || 1000,
    };

    return agent;
  }

  // Execute agent with full feature support
  async executeAgent(
    agent: AgentConfig, 
    userInput: string
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      // Build system message with all configurations
      const systemMessage = this.buildSystemMessage(agent);
      
      // Prepare messages
      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemMessage },
        ...this.buildExampleMessages(agent),
        { role: 'user', content: userInput }
      ];

      // Get model-specific client
      const groqClient = this.createModelSpecificClient(agent.model);

      // Build model-specific request parameters
      const requestParams: any = {
        model: agent.model,
        messages,
        temperature: agent.temperature,
        max_completion_tokens: agent.maxTokens,
        top_p: agent.topP,
        stream: agent.enableStreaming,
        stop: null,
      };

      // Model-specific configurations
      if (agent.model.includes('openai/gpt-oss')) {
        // GPT OSS models support reasoning_effort
        requestParams.reasoning_effort = "medium";
        
        // GPT OSS models use simple tool format
        const tools = this.buildTools(agent);
        if (tools.length > 0) {
          requestParams.tools = tools;
        }
        
      } else if (agent.model.includes('groq/compound')) {
        // Compound models use compound_custom for tools
        const compoundTools = this.buildCompoundTools(agent);
        if (compoundTools.length > 0) {
          requestParams.compound_custom = {
            tools: {
              enabled_tools: compoundTools
            }
          };
        }
        
      } else if (agent.model.includes('llama-')) {
        // Llama models - basic parameters only, no tools or reasoning_effort
        // (no additional configuration needed)
        
      } else {
        // Other models - use basic configuration
        console.warn(`⚠️ Unknown model format: ${agent.model}. Using basic configuration.`);
      }

      // Add frequency and presence penalties if set (for models that support them)
      if (agent.frequencyPenalty !== 0) {
        requestParams.frequency_penalty = agent.frequencyPenalty;
      }
      if (agent.presencePenalty !== 0) {
        requestParams.presence_penalty = agent.presencePenalty;
      }

      // Add response format if JSON mode (for models that support it)
      if (agent.responseFormat === 'json_object') {
        requestParams.response_format = { type: 'json_object' };
      }

      console.log(`🚀 Executing agent "${agent.name}" with model: ${agent.model}`);
      console.log(`🛠️  Features enabled:`, {
        webSearch: agent.enableWebSearch,
        codeExecution: agent.enableCodeExecution,
        browserAutomation: agent.enableBrowserAutomation,
        wolframAlpha: agent.enableWolframAlpha,
        streaming: agent.enableStreaming,
        responseFormat: agent.responseFormat,
        modelType: this.getModelType(agent.model)
      });
      
      console.log(`📋 Request parameters:`, JSON.stringify(requestParams, null, 2));

      // Execute the request with model-specific client
      const response = await groqClient.chat.completions.create(requestParams);
      
      // Handle streaming if enabled
      if (agent.enableStreaming) {
        let fullContent = '';
        for await (const chunk of response as any) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            fullContent += content;
          }
        }
        
        // Return in standard format for streaming
        return {
          content: fullContent,
          tokenUsage: {
            promptTokens: 0, // Not available in streaming
            completionTokens: 0,
            totalTokens: 0,
          },
          model: agent.model,
          finishReason: 'stop',
          toolsUsed: [], // Tools detection would need different handling in streaming
          executionTime: Date.now() - startTime,
          cost: 0,
        };
      }

      const executionTime = Date.now() - startTime;
      const toolsUsed = this.extractUsedTools(response);
      
      console.log(`✅ Agent execution completed in ${executionTime}ms`);
      console.log(`🔧 Tools used:`, toolsUsed);
      
      return {
        content: response.choices[0].message.content || '',
        tokenUsage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        model: agent.model,
        finishReason: response.choices[0].finish_reason || '',
        toolsUsed,
        executionTime,
        cost: this.calculateCost(response.usage || null, agent.model),
      };

    } catch (error: unknown) {
      console.error(`❌ Agent execution failed for "${agent.name}":`, error);
      
      // Provide more specific error messages
      let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      if (error && typeof error === 'object' && 'status' in error) {
        const statusError = error as { status: number };
        if (statusError.status === 400) {
          errorMessage = `Model "${agent.model}" returned a 400 error. This model might not support the requested parameters or tools.`;
        } else if (statusError.status === 404) {
          errorMessage = `Model "${agent.model}" not found. This model might not be available in your GroqCloud plan.`;
        } else if (statusError.status === 429) {
          errorMessage = `Rate limit exceeded. Please wait before trying again.`;
        }
      } else if (error instanceof Error && error.message.includes('model')) {
        errorMessage = `Issue with model "${agent.model}": ${error.message}`;
      }
      
      console.error(`🔧 Suggestion: Try using a different model like "openai/gpt-oss-120b" or "llama-3.3-70b-versatile"`);
      
      throw new Error(errorMessage);
    }
  }

  // Build comprehensive system message
  private buildSystemMessage(agent: AgentConfig): string {
    let systemMessage = agent.systemPrompt;
    
    // Add model-specific optimizations
    systemMessage += `\n\nYou are running on the ${agent.model} model with the following configuration:`;
    systemMessage += `\n- Temperature: ${agent.temperature} (${agent.temperature < 0.3 ? 'focused/deterministic' : agent.temperature > 0.8 ? 'creative/diverse' : 'balanced'})`;
    systemMessage += `\n- Max tokens: ${agent.maxTokens}`;
    if (agent.topP !== 1.0) systemMessage += `\n- Top-P: ${agent.topP}`;

    // Add custom instructions
    if (agent.customInstructions && agent.customInstructions.length > 0) {
      systemMessage += '\n\n📋 CUSTOM INSTRUCTIONS:';
      systemMessage += agent.customInstructions.map(inst => `\n• ${inst}`).join('');
    }

    // Add model-specific tool usage instructions
    const modelType = this.getModelType(agent.model);
    
    if (this.supportsTools(agent.model)) {
      const availableTools = [];
      
      if (modelType === 'GPT-OSS') {
        systemMessage += '\n\n🛠️ AVAILABLE TOOLS - Use these actively when helpful:';
        
        if (agent.enableWebSearch) {
          availableTools.push('browser_search');
          systemMessage += '\n• BROWSER SEARCH: You can search the web for current information, news, recent data. Use this when users need up-to-date information.';
        }
        
        if (agent.enableCodeExecution) {
          availableTools.push('code_interpreter');
          systemMessage += '\n• CODE INTERPRETER: You can execute Python code for calculations, data analysis, visualizations. Use this to solve programming problems.';
        }
        
      } else if (modelType === 'Compound') {
        systemMessage += '\n\n🛠️ AVAILABLE TOOLS - Use these actively when helpful:';
        
        if (agent.enableWebSearch) {
          availableTools.push('web_search');
          systemMessage += '\n• WEB SEARCH: Search the web for current information, news, recent data. Use for up-to-date information.';
        }
        
        if (agent.enableCodeExecution) {
          availableTools.push('code_interpreter');
          systemMessage += '\n• CODE INTERPRETER: Execute Python code for calculations, analysis, visualizations.';
        }
        
        if (agent.enableBrowserAutomation) {
          availableTools.push('visit_website', 'browser_automation');
          systemMessage += '\n• WEBSITE VISITING: Visit and interact with websites, perform web automation tasks.';
        }
      }
      
      if (availableTools.length > 0) {
        systemMessage += '\n\nIMPORTANT: Actively use these tools when they would be helpful. The system will execute them and provide results.';
        systemMessage += '\n\nFORMATTING: Use markdown formatting in your responses for better readability. Use code blocks (```language) for code, **bold** for emphasis, ## headings for structure, bullet points for lists, and tables when presenting data.';
      }
      
    } else {
      // Llama and other models without tool support
      const requestedFeatures = [];
      if (agent.enableWebSearch) requestedFeatures.push('web search');
      if (agent.enableCodeExecution) requestedFeatures.push('code execution');
      if (agent.enableBrowserAutomation) requestedFeatures.push('browser automation');
      
      if (requestedFeatures.length > 0) {
        systemMessage += `\n\nNote: ${requestedFeatures.join(', ')} ${requestedFeatures.length > 1 ? 'are' : 'is'} enabled but not supported by the ${agent.model} model. You can still help with related tasks using your knowledge and reasoning capabilities.`;
      }
    }

    // Note about unavailable features (model-specific)
    if (agent.enableWolframAlpha) {
      systemMessage += '\n\nNote: Wolfram Alpha is not available in any GroqCloud model, but you can still help with mathematical computations using your knowledge and code interpreter.';
    }
    
    if (agent.enableBrowserAutomation && modelType !== 'Compound') {
      systemMessage += '\n\nNote: Browser automation is only available in Compound models. You can still help with web-related tasks using available search tools.';
    }

    // Add guardrails
    if (agent.guardrails && agent.guardrails.length > 0) {
      systemMessage += '\n\n🚨 SAFETY CONSTRAINTS - Always follow these:';
      systemMessage += agent.guardrails.map(rule => `\n• ${rule}`).join('');
    }

    // Add response format instruction
    if (agent.responseFormat === 'json_object') {
      systemMessage += '\n\n🔧 RESPONSE FORMAT: You MUST always respond with valid JSON only. No additional text outside the JSON structure.';
    }

    // Add streaming instruction
    if (agent.enableStreaming) {
      systemMessage += '\n\n⚡ STREAMING MODE: Provide responses in a flowing manner suitable for real-time display.';
    }

    // Add general formatting instruction
    systemMessage += '\n\n📝 FORMATTING: Use markdown formatting in your responses when appropriate. This includes:\n• Code blocks (```language) for code snippets\n• **Bold text** for emphasis\n• ## Headings for structure\n• Bullet points or numbered lists\n• Tables for data presentation\n• > Blockquotes for important notes';

    return systemMessage;
  }

  // Build example conversation messages
  private buildExampleMessages(agent: AgentConfig): Array<{ role: string; content: string }> {
    const examples: Array<{ role: string; content: string }> = [];
    
    for (const example of agent.exampleConversations) {
      examples.push({ role: 'user', content: example.input });
      examples.push({ role: 'assistant', content: example.output });
    }
    
    return examples;
  }

  // Build model-specific tools configuration
  private buildTools(agent: AgentConfig): Array<{ type: string }> {
    const tools: Array<{ type: string }> = [];

    // GPT OSS models use simple tool format
    if (agent.model.includes('openai/gpt-oss')) {
      if (agent.enableWebSearch) {
        tools.push({ type: "browser_search" });
      }
      if (agent.enableCodeExecution) {
        tools.push({ type: "code_interpreter" });
      }
      return tools;
    }

    // Compound models don't use tools array - they use compound_custom
    if (agent.model.includes('groq/compound')) {
      return []; // Tools handled in compound_custom parameter
    }

    // Llama models don't support tools in these examples
    if (agent.model.includes('llama-')) {
      return []; // No tool support shown for Llama models
    }

    // Other models - no tools support based on examples
    return [];
  }

  // Build compound model tools configuration
  private buildCompoundTools(agent: AgentConfig): string[] {
    const enabledTools: string[] = [];

    if (agent.enableWebSearch) {
      enabledTools.push("web_search");
    }
    if (agent.enableCodeExecution) {
      enabledTools.push("code_interpreter");
    }
    if (agent.enableBrowserAutomation) {
      enabledTools.push("visit_website", "browser_automation");
    }
    // Note: wolfram_alpha not shown in compound examples

    return enabledTools;
  }


  // Extract tools that were actually used (Function calling format)
  private extractUsedTools(response: { choices: Array<{ message?: { tool_calls?: Array<{ type: string; function?: { name: string } }> } }> }): string[] {
    const usedTools: string[] = [];
    
    // GroqCloud uses standard function calling response format
    if (response.choices[0]?.message?.tool_calls) {
      for (const toolCall of response.choices[0].message.tool_calls) {
        if (toolCall.type === 'function' && toolCall.function?.name) {
          usedTools.push(toolCall.function.name);
        }
      }
    }
    
    return usedTools;
  }

  // Calculate execution cost
  private calculateCost(usage: { total_tokens?: number } | null, model: string): number {
    if (!usage || !usage.total_tokens) return 0;
    
    // Simplified cost calculation - adjust based on actual GroqCloud pricing
    const costPerToken = model.includes('120b') ? 0.000001 : 0.0000005;
    return usage.total_tokens * costPerToken;
  }

  // Get available models (fetch from GroqCloud API)
  async getAvailableModels(): Promise<string[]> {
    try {
      // First try to fetch from GroqCloud API
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const modelIds = data.data
          .filter((model: { id?: string }) => model.id && !model.id.includes('whisper')) // Filter out non-chat models
          .map((model: { id: string }) => model.id)
          .sort();
        
        console.log('✅ Fetched models from GroqCloud API:', modelIds);
        return modelIds;
      } else {
        console.warn('⚠️ Failed to fetch models from API, using fallback list');
        return this.AVAILABLE_MODELS;
      }
    } catch (error) {
      console.warn('⚠️ Error fetching models from GroqCloud API:', error);
      return this.AVAILABLE_MODELS;
    }
  }

  // Get available models synchronously (fallback)
  getAvailableModelsSync(): string[] {
    return this.AVAILABLE_MODELS;
  }

  // Get available tools
  getAvailableTools(): string[] {
    return this.AVAILABLE_TOOLS;
  }

  // Check if model supports tools (based on provided examples)
  private supportsTools(model: string): boolean {
    // Based on the examples provided:
    // GPT OSS models: Support browser_search, code_interpreter
    if (model.includes('openai/gpt-oss')) {
      return true;
    }
    
    // Compound models: Support web_search, code_interpreter, visit_website, browser_automation
    if (model.includes('groq/compound')) {
      return true;
    }
    
    // Llama models: No tool examples provided
    if (model.includes('llama-')) {
      return false;
    }
    
    // Other models: Assume no tool support unless examples show otherwise
    return false;
  }

  // Get model type for debugging
  private getModelType(model: string): string {
    if (model.includes('openai/gpt-oss')) {
      return 'GPT-OSS';
    } else if (model.includes('groq/compound')) {
      return 'Compound';
    } else if (model.includes('llama-')) {
      return 'Llama';
    } else {
      return 'Other';
    }
  }

  // Check if model supports specific parameters
  private getModelSpecificParams(model: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    
    // reasoning_effort is only for GPT OSS models
    if (model.includes('openai/gpt-oss')) {
      params.reasoning_effort = "medium";
    }
    
    // Some models may have specific parameter requirements
    if (model.includes('mixtral')) {
      // Mixtral models might need different parameters
    }
    
    return params;
  }

  // Validate agent configuration
  validateAgentConfig(config: Partial<AgentConfig>): { valid: boolean; errors: string[]; warnings?: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.name || config.name.trim().length === 0) {
      errors.push('Agent name is required');
    }

    if (!config.model || !this.getAvailableModelsSync().includes(config.model)) {
      errors.push('Invalid model selected. Please select a valid model from the dropdown.');
    }

    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2');
    }

    if (config.maxTokens !== undefined && (config.maxTokens < 1 || config.maxTokens > 131072)) {
      errors.push('Max tokens must be between 1 and 131072');
    }

    // Add warnings for model-specific limitations
    const modelType = config.model ? this.getModelType(config.model) : 'Unknown';
    
    if (config.model && !this.supportsTools(config.model)) {
      if (config.enableWebSearch || config.enableCodeExecution) {
        warnings.push(`Model "${config.model}" (${modelType}) does not support tools. Consider using "openai/gpt-oss-120b" or "groq/compound" for full tool support.`);
      }
    }

    if (config.enableBrowserAutomation && modelType !== 'Compound') {
      warnings.push(`Browser automation is only available in Compound models (groq/compound). Your model "${config.model}" does not support this feature.`);
    }

    if (config.model && modelType === 'Llama' && config.responseFormat === 'json_object') {
      warnings.push(`JSON response format may not work reliably with Llama models. Consider using GPT OSS models for structured JSON responses.`);
    }

    if (config.enableWolframAlpha) {
      warnings.push(`Wolfram Alpha is not available in any GroqCloud model currently.`);
    }

    const result: { valid: boolean; errors: string[]; warnings?: string[] } = { valid: errors.length === 0, errors };
    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  }
}

