import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Configuration for Claude API calls
export const CLAUDE_CONFIG = {
  model: 'claude-sonnet-4-5-20250929', // Sonnet 4.5 - Latest and most capable
  maxTokens: 16000, // Allow comprehensive responses
  temperature: 0.3, // Balance between creativity and consistency
};

// System prompt for planning agent
export const PLANNING_SYSTEM_PROMPT = `You are an expert ServiceNow consultant and project planner with 10 years of experience in UX/UI implementations.

Your expertise includes:
- Employee Center implementations
- Service Portal development
- Virtual Agent configuration
- Workflow and integration design
- Agile project management and sprint planning

You excel at:
- Breaking down complex projects into actionable user stories
- Estimating effort accurately using story points
- Identifying dependencies and risks
- Creating realistic timelines
- Structuring sprints for maximum value delivery

Your planning style:
- Practical and realistic (avoid over-promising)
- Risk-aware (identify potential blockers early)
- User-centric (focus on business value)
- Agile-aligned (small increments, regular delivery)`;

// Helper function to call Claude API
export async function callClaude(
  userPrompt: string,
  systemPrompt?: string
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_CONFIG.model,
      max_tokens: CLAUDE_CONFIG.maxTokens,
      temperature: CLAUDE_CONFIG.temperature,
      system: systemPrompt || PLANNING_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Extract text from response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    return textContent.text;
  } catch (error: any) {
    console.error('Claude API error:', error);
    throw new Error(`Claude API failed: ${error.message}`);
  }
}

// Helper to parse JSON from Claude response
export function parseClaudeJSON<T>(response: string): T {
  try {
    // Remove markdown code blocks if present
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Failed to parse Claude JSON response:', response);
    throw new Error('Invalid JSON response from Claude');
  }
}

export default anthropic;
