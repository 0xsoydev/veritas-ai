import { NextRequest, NextResponse } from 'next/server';
import { GroqAgentService, AgentConfig } from '@/lib/groqService';

// Initialize GroqCloud service
const groqService = new GroqAgentService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, agent, userInput } = body;

    switch (action) {
      case 'execute':
        if (!agent || !userInput) {
          return NextResponse.json(
            { error: 'Agent config and user input are required' },
            { status: 400 }
          );
        }

        // Context is no longer used in executeAgent

        const response = await groqService.executeAgent(
          agent as AgentConfig,
          userInput
        );

        return NextResponse.json({ success: true, response });

      case 'create':
        if (!body.config) {
          return NextResponse.json(
            { error: 'Agent configuration is required' },
            { status: 400 }
          );
        }

        // Validate configuration
        const validation = groqService.validateAgentConfig(body.config);
        if (!validation.valid) {
          return NextResponse.json(
            { error: 'Invalid configuration', details: validation.errors },
            { status: 400 }
          );
        }

        const newAgent = await groqService.createAgent(body.config, body.ownerAddress);
        return NextResponse.json({ success: true, agent: newAgent });

      case 'validate':
        if (!body.config) {
          return NextResponse.json(
            { error: 'Configuration to validate is required' },
            { status: 400 }
          );
        }

        const validationResult = groqService.validateAgentConfig(body.config);
        return NextResponse.json({ 
          success: true, 
          validation: validationResult 
        });

      case 'models':
        return NextResponse.json({
          success: true,
          models: groqService.getAvailableModels()
        });

      case 'tools':
        return NextResponse.json({
          success: true,
          tools: groqService.getAvailableTools()
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    console.error('GroqCloud API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'models':
        const models = await groqService.getAvailableModels();
        return NextResponse.json({
          success: true,
          models: models
        });

      case 'tools':
        return NextResponse.json({
          success: true,
          tools: groqService.getAvailableTools()
        });

      case 'status':
        return NextResponse.json({
          success: true,
          status: 'GroqCloud service is running',
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json({
          success: true,
          endpoints: {
            'POST /api/groq': {
              actions: ['execute', 'create', 'validate', 'models', 'tools'],
              description: 'Main GroqCloud API endpoint'
            },
            'GET /api/groq?action=models': 'Get available models',
            'GET /api/groq?action=tools': 'Get available tools',
            'GET /api/groq?action=status': 'Service health check'
          }
        });
    }
  } catch (error: unknown) {
    console.error('GroqCloud GET API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}
