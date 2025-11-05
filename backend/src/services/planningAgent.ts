import { callClaude, parseClaudeJSON, PLANNING_SYSTEM_PROMPT } from '../config/anthropic';
import { searchRelevantContent, isEmbeddingEnabled } from './embeddingService';
import {
  PlanningContext,
  GeneratedPlan,
  GeneratedStory,
  GeneratedSprint,
} from '../types';

/**
 * Planning Agent Service
 * Core AI logic for generating comprehensive project plans using Claude
 */

/**
 * Build the planning prompt for Claude
 */
function buildPlanningPrompt(context: PlanningContext): string {
  const { projectName, clientName, projectType, documents, relevantKnowledge } = context;

  // Combine all document content
  const documentContents = documents
    .map((doc) => `--- ${doc.title} (${doc.type}) ---\n${doc.content}\n`)
    .join('\n');

  // Add relevant past project knowledge if available
  const pastProjectsSection = relevantKnowledge && relevantKnowledge.length > 0
    ? `\nRELEVANT PAST PROJECT INSIGHTS:\n${relevantKnowledge.join('\n\n')}\n`
    : '';

  return `You are an expert ServiceNow consultant and project planner with 10 years of experience.

You've been given project context for a new ServiceNow ${projectType || 'UX/UI'} project:

PROJECT NAME: ${projectName}
CLIENT: ${clientName}

PROJECT DOCUMENTS:
${documentContents}
${pastProjectsSection}

Your task is to create a comprehensive project plan.

Generate:

1. USER STORIES: Break the project into actionable user stories
   Format: "As a [user type], I want [goal] so that [benefit]"
   Include:
   - Unique ID (e.g., "STORY-001", "STORY-002", etc.)
   - Title (concise, under 100 characters)
   - Description (detailed, 2-3 sentences)
   - Acceptance criteria (specific, testable bullets)
   - Story points (1, 2, 3, 5, 8, 13, 21) - use Fibonacci sequence
   - Priority (Critical, High, Medium, or Low)
   - Type (feature, bug, technical, design, documentation)
   - Dependencies (array of story IDs that must complete first, empty array if none)
   - Estimated hours (realistic hour estimate)

2. SPRINT PLAN: Organize stories into 2-week sprints
   - Balance story points per sprint (aim for 20-30 points per sprint)
   - Respect dependencies (prerequisite stories must be in earlier sprints)
   - Front-load risky/uncertain work
   - Assign sequential sprint numbers starting at 1
   - Calculate start and end dates based on 2-week sprints
   - Each sprint should have a clear, focused goal

3. PROJECT TIMELINE:
   - Estimated total weeks (sum of all sprint durations)
   - Start date (use a reasonable future date)
   - End date (calculated from start date + total weeks)
   - Key milestones with dates and deliverables

4. MEETING CADENCE & GOVERNANCE:
   - Sprint ceremonies (planning, daily standups, reviews, retrospectives)
   - Client status review meetings (frequency and format)
   - Showback/demo sessions with stakeholders
   - Decision points and approval gates
   - Communication plan and escalation path

5. RISK ASSESSMENT:
   - Technical risks with probability and impact
   - Timeline risks
   - Scope risks
   - Provide specific mitigation strategies for each risk

IMPORTANT CONTEXT:
- Adam Pflantzer is the solo consultant handling all aspects
- Typical ServiceNow projects are 6-16 weeks (3-8 sprints)
- Stories should be specific to ServiceNow platform work
- Consider: Employee Center, Service Portal, Virtual Agent, UI Builder, workflows
- Be realistic about effort - quality over speed
- Each story should be completable within a sprint
- Stories over 13 points should be broken down further

OUTPUT FORMAT: Respond with ONLY valid JSON, no markdown code blocks, no explanation text:

{
  "stories": [
    {
      "id": "STORY-001",
      "title": "string",
      "description": "string",
      "acceptanceCriteria": "string",
      "storyPoints": 5,
      "priority": "High",
      "type": "feature",
      "dependencies": [],
      "estimatedHours": 10
    }
  ],
  "sprints": [
    {
      "sprintNumber": 1,
      "name": "Sprint 1: Foundation Setup",
      "startDate": "2024-03-15",
      "endDate": "2024-03-29",
      "goal": "string describing sprint focus",
      "storyIds": ["STORY-001", "STORY-002"]
    }
  ],
  "timeline": {
    "totalWeeks": 12,
    "startDate": "2024-03-15",
    "endDate": "2024-06-07",
    "milestones": [
      {
        "name": "Design Approval",
        "date": "2024-04-05",
        "deliverables": ["Wireframes", "Mockups"]
      }
    ]
  },
  "meetings": [
    {
      "type": "Sprint Planning",
      "frequency": "Every 2 weeks",
      "duration": "2 hours",
      "participants": ["Adam", "Client Stakeholders"],
      "purpose": "Plan upcoming sprint work"
    }
  ],
  "risks": [
    {
      "description": "string",
      "probability": "high",
      "impact": "medium",
      "mitigation": "string with specific actions"
    }
  ]
}

Generate the complete project plan now:`;
}

/**
 * Generate project plan using Claude AI
 */
export async function generateProjectPlan(
  context: PlanningContext
): Promise<GeneratedPlan> {
  try {
    console.log('🤖 Generating project plan with Claude AI...');
    console.log(`   Project: ${context.projectName}`);
    console.log(`   Documents: ${context.documents.length}`);

    // Optionally search for relevant past project knowledge
    // (Skip if embeddings not configured)
    let relevantKnowledge: string[] = [];
    if (isEmbeddingEnabled() && context.documents.length > 0) {
      try {
        const searchQuery = `${context.projectName} ${context.projectType || ''} requirements`;
        relevantKnowledge = await searchRelevantContent(
          'global', // Could use a "global" project for past projects
          searchQuery,
          3
        );
        console.log(`   Found ${relevantKnowledge.length} relevant knowledge chunks`);
      } catch (error) {
        console.warn('   Could not search relevant knowledge:', error);
      }
    }

    // Build the planning prompt
    const prompt = buildPlanningPrompt({
      ...context,
      relevantKnowledge,
    });

    // Call Claude API
    const response = await callClaude(prompt, PLANNING_SYSTEM_PROMPT);
    console.log('✓ Received response from Claude');

    // Parse JSON response
    const plan = parseClaudeJSON<GeneratedPlan>(response);

    // Validate the plan
    validateGeneratedPlan(plan);

    console.log('✓ Generated plan:');
    console.log(`   Stories: ${plan.stories.length}`);
    console.log(`   Sprints: ${plan.sprints.length}`);
    console.log(`   Duration: ${plan.timeline.totalWeeks} weeks`);
    console.log(`   Risks: ${plan.risks.length}`);

    return plan;
  } catch (error: any) {
    console.error('❌ Planning agent error:', error);
    throw new Error(`Failed to generate project plan: ${error.message}`);
  }
}

/**
 * Validate the generated plan structure
 */
function validateGeneratedPlan(plan: GeneratedPlan): void {
  if (!plan.stories || !Array.isArray(plan.stories) || plan.stories.length === 0) {
    throw new Error('Plan must contain at least one story');
  }

  if (!plan.sprints || !Array.isArray(plan.sprints) || plan.sprints.length === 0) {
    throw new Error('Plan must contain at least one sprint');
  }

  if (!plan.timeline || !plan.timeline.totalWeeks) {
    throw new Error('Plan must contain a valid timeline');
  }

  // Validate story structure
  for (const story of plan.stories) {
    if (!story.id || !story.title || !story.description) {
      throw new Error(`Invalid story structure: ${JSON.stringify(story)}`);
    }
  }

  // Validate sprint structure
  for (const sprint of plan.sprints) {
    if (!sprint.sprintNumber || !sprint.name || !sprint.storyIds) {
      throw new Error(`Invalid sprint structure: ${JSON.stringify(sprint)}`);
    }
  }

  // Validate that all sprint story IDs reference valid stories
  const storyIds = new Set(plan.stories.map((s) => s.id));
  for (const sprint of plan.sprints) {
    for (const storyId of sprint.storyIds) {
      if (!storyIds.has(storyId)) {
        console.warn(`Warning: Sprint ${sprint.name} references non-existent story ${storyId}`);
      }
    }
  }
}

/**
 * Regenerate a specific aspect of the plan
 * Useful for iterating on specific parts without regenerating everything
 */
export async function regeneratePlanSection(
  context: PlanningContext,
  section: 'stories' | 'sprints' | 'timeline' | 'risks',
  currentPlan: GeneratedPlan
): Promise<Partial<GeneratedPlan>> {
  const prompt = `Given the existing project plan for ${context.projectName}, regenerate the ${section} section.

Current plan summary:
- Stories: ${currentPlan.stories.length}
- Sprints: ${currentPlan.sprints.length}
- Duration: ${currentPlan.timeline.totalWeeks} weeks

Focus on improving or adjusting the ${section} based on:
${context.documents.map((d) => `- ${d.title}: ${d.content.substring(0, 200)}...`).join('\n')}

Return ONLY the JSON for the ${section} section in the same format as the original plan.`;

  const response = await callClaude(prompt, PLANNING_SYSTEM_PROMPT);
  return parseClaudeJSON<Partial<GeneratedPlan>>(response);
}

export default {
  generateProjectPlan,
  regeneratePlanSection,
};
