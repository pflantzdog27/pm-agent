import { callClaude, parseClaudeJSON } from '../config/anthropic';
import {
  DailyScrumAnalysis,
  ExecutionContext,
  StoryUpdateDetection,
  BlockerDetection,
  NewWorkDetection,
  TimelineAssessment,
} from '../types';

/**
 * Execution Agent Service
 * Analyzes daily scrum transcripts and extracts actionable intelligence:
 * - Story status updates
 * - Blockers and risks
 * - New work/scope changes
 * - Timeline impact assessment
 */

// System prompt for execution agent
const EXECUTION_SYSTEM_PROMPT = `You are an AI Project Manager specializing in ServiceNow consulting projects.

Your expertise includes:
- Parsing daily scrum/standup transcripts
- Identifying story status changes and progress updates
- Detecting blockers and risks that could impact delivery
- Recognizing scope creep and new work requests
- Assessing timeline impact based on team updates

Your analysis style:
- Precise and actionable (extract specific story references)
- Risk-aware (flag blockers early)
- Context-sensitive (understand ServiceNow terminology)
- Conservative (don't make assumptions - flag low confidence matches)`;

/**
 * Build the analysis prompt for Claude
 */
function buildDailyScrumPrompt(
  transcript: string,
  context: ExecutionContext
): string {
  // Format story list for context
  const storyList = context.stories
    .map(
      (s) =>
        `${s.key}: ${s.title} (${s.storyPoints} pts, status: ${s.status})`
    )
    .join('\n');

  return `You are analyzing a daily scrum transcript to extract project intelligence.

TRANSCRIPT:
${transcript}

CURRENT PROJECT CONTEXT:
Project ID: ${context.projectId}
Active Sprint: Sprint ${context.sprintNumber} (Day ${context.daysIntoSprint} of ${context.totalDays})

Stories in Sprint:
${storyList}

INSTRUCTIONS:

1. STORY STATUS UPDATES
For each story mentioned in the transcript, determine:
- Which story is being referenced (match by ID like "STORY-001" or by description/title)
- The new status based on what was said:
  - "completed", "finished", "done" → status: "done"
  - "working on", "started", "in progress" → status: "in_progress"
  - "reviewing", "testing", "QA" → status: "review"
  - "ready to start", "ready" → status: "ready"
  - "haven't started", "not started yet" → status: "draft"
- Any relevant notes or progress details
- Confidence level (high: explicit story ID mentioned, medium: clear description match, low: uncertain match)

2. BLOCKERS AND RISKS
Identify anything preventing progress. Look for phrases like:
- "blocked by...", "waiting for...", "can't proceed until..."
- "issue with...", "problem with...", "stuck on..."
- "need from client...", "waiting on approval..."

For each blocker, extract:
- What story is blocked (or null if general blocker)
- Clear description of the blocker
- Severity assessment:
  - critical: Blocks multiple stories, affects sprint goal
  - high: Blocks current work, affects 1-2 stories
  - medium: Slowing progress but not completely blocked
  - low: Minor inconvenience, workaround available
- How long it's been blocked (if mentioned)
- Who can unblock it (stakeholders involved)
- Whether this needs a meeting to resolve

3. NEW WORK MENTIONED
Identify any new requirements, features, or scope additions discussed.
Look for:
- "Client asked for...", "They also want...", "We need to add..."
- "New requirement...", "Change request...", "Additional feature..."

For each new work item:
- Description of what's being requested
- Context (where it came from, why it's being discussed)
- Rough estimate of story points if you can infer
- Whether it should be created as a story immediately or needs review

4. TIMELINE IMPACT ASSESSMENT
Based on progress and blockers:
- Is the sprint on track to meet its goals?
- Estimate any delay in days (be conservative)
- Which milestones or stories are at risk
- Provide reasoning for your assessment
- Give a specific recommendation (e.g., "Schedule SSO config meeting with client IT this week")

IMPORTANT:
- Match stories by ID (e.g., "STORY-015") when explicitly mentioned
- Match by title/description when ID not mentioned but description is clear
- Set confidence to "low" if you're not certain about a match
- Don't hallucinate story IDs - use null if you can't match confidently
- Be specific about blockers - vague concerns are not blockers
- Only flag new work if it's clearly outside current scope

OUTPUT FORMAT: Respond with ONLY valid JSON, no markdown code blocks, no explanation:

{
  "storyUpdates": [
    {
      "storyId": "uuid-here-or-null",
      "storyKey": "STORY-001",
      "oldStatus": "in_progress",
      "newStatus": "done",
      "notes": "Completed and tested with sample data",
      "confidence": "high"
    }
  ],
  "blockers": [
    {
      "storyId": "uuid-here-or-null",
      "storyKey": "STORY-003",
      "description": "Waiting for client to provide SSO configuration details",
      "severity": "high",
      "blockedSince": "3 days",
      "needsMeeting": true,
      "stakeholders": ["client IT team", "Adam"]
    }
  ],
  "newWorkMentioned": [
    {
      "description": "Client wants to add mobile push notifications",
      "context": "Mentioned in email yesterday, not in original scope",
      "likelyStoryPoints": 8,
      "shouldCreateStory": false
    }
  ],
  "timelineAssessment": {
    "sprintOnTrack": false,
    "estimatedDelay": 2,
    "confidence": "medium",
    "reasoning": "SSO blocker affects STORY-003 (8 pts) which is critical path. If not resolved by tomorrow, will slip to next sprint.",
    "recommendation": "Schedule urgent meeting with client IT team to get SSO configuration. Consider de-scoping STORY-007 if delay confirmed."
  }
}

Analyze the transcript now and provide the JSON response.`;
}

/**
 * Process a daily scrum transcript and extract actionable intelligence
 */
export async function analyzeDailyScrum(
  transcript: string,
  context: ExecutionContext
): Promise<DailyScrumAnalysis> {
  // Build the prompt with full context
  const prompt = buildDailyScrumPrompt(transcript, context);

  // Call Claude with execution agent system prompt
  const response = await callClaude(prompt, EXECUTION_SYSTEM_PROMPT);

  // Parse the JSON response
  const analysis = parseClaudeJSON<DailyScrumAnalysis>(response);

  // Validate the response structure
  validateAnalysis(analysis);

  return analysis;
}

/**
 * Validate the AI-generated analysis
 */
function validateAnalysis(analysis: DailyScrumAnalysis): void {
  if (!analysis.storyUpdates || !Array.isArray(analysis.storyUpdates)) {
    throw new Error('Invalid analysis: missing storyUpdates array');
  }

  if (!analysis.blockers || !Array.isArray(analysis.blockers)) {
    throw new Error('Invalid analysis: missing blockers array');
  }

  if (!analysis.newWorkMentioned || !Array.isArray(analysis.newWorkMentioned)) {
    throw new Error('Invalid analysis: missing newWorkMentioned array');
  }

  if (!analysis.timelineAssessment) {
    throw new Error('Invalid analysis: missing timelineAssessment');
  }

  // Validate each story update
  analysis.storyUpdates.forEach((update, idx) => {
    if (!update.storyKey) {
      throw new Error(`Story update ${idx} missing storyKey`);
    }
    if (!update.newStatus) {
      throw new Error(`Story update ${idx} missing newStatus`);
    }
    if (!['high', 'medium', 'low'].includes(update.confidence)) {
      throw new Error(`Story update ${idx} has invalid confidence: ${update.confidence}`);
    }
  });

  // Validate blockers
  analysis.blockers.forEach((blocker, idx) => {
    if (!blocker.description) {
      throw new Error(`Blocker ${idx} missing description`);
    }
    if (!['critical', 'high', 'medium', 'low'].includes(blocker.severity)) {
      throw new Error(`Blocker ${idx} has invalid severity: ${blocker.severity}`);
    }
  });

  // Validate timeline assessment
  const ta = analysis.timelineAssessment;
  if (typeof ta.sprintOnTrack !== 'boolean') {
    throw new Error('Timeline assessment missing sprintOnTrack boolean');
  }
  if (typeof ta.estimatedDelay !== 'number') {
    throw new Error('Timeline assessment missing estimatedDelay number');
  }
  if (!['high', 'medium', 'low'].includes(ta.confidence)) {
    throw new Error(`Timeline assessment has invalid confidence: ${ta.confidence}`);
  }
}

/**
 * Match a story key to actual story ID from context
 * Helper function for the API endpoint to resolve story IDs
 */
export function matchStoryId(
  storyKey: string,
  stories: Array<{ id: string; key: string }>
): string | null {
  const story = stories.find((s) => s.key === storyKey);
  return story ? story.id : null;
}
