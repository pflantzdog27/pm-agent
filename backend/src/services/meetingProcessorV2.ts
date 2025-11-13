import Anthropic from '@anthropic-ai/sdk';
import { getExecutor } from './codeExecutorSimple';
import * as db from '../config/database';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

interface ProcessingResult {
  success: boolean;
  summary: string;
  codeGenerated?: string;
  executionTime: number;
  error?: string;
}

export async function processMeetingWithCode(
  meetingId: string
): Promise<ProcessingResult> {
  const startTime = Date.now();

  try {
    // 1. Get meeting details
    const meeting = await db.query(
      'SELECT * FROM meetings WHERE id = $1',
      [meetingId]
    );

    if (meeting.rows.length === 0) {
      throw new Error('Meeting not found');
    }

    const meetingData = meeting.rows[0];

    if (!meetingData.transcript_text) {
      throw new Error('Meeting has no transcript');
    }

    // 2. Get project context (stories for reference)
    const stories = await db.query(
      `SELECT story_key, title, status, story_points, assigned_to, description
       FROM stories
       WHERE project_id = $1 AND status != 'done'
       ORDER BY story_key`,
      [meetingData.project_id]
    );

    const sprint = await db.query(
      `SELECT * FROM sprints
       WHERE project_id = $1 AND status = 'active'
       LIMIT 1`,
      [meetingData.project_id]
    );

    // 3. Build prompt for Claude to write code
    const prompt = buildCodeGenerationPrompt(
      meetingData.transcript_text,
      meetingData.project_id,
      meetingData.id,
      meetingData.meeting_type,
      stories.rows,
      sprint.rows[0]
    );

    // 4. Ask Claude to write code
    console.log('🤖 Asking Claude to generate code for meeting processing...');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      system: getSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    // 5. Extract code from response
    const code = extractCodeBlock(responseText);

    if (!code) {
      throw new Error('No code block found in Claude response');
    }

    console.log('✓ Code generated, executing in sandbox...');
    console.log('Generated code length:', code.length, 'characters');

    // 6. Execute code in sandbox
    const executor = getExecutor();
    const executionResult = await executor.execute(code, {
      projectId: meetingData.project_id,
      meetingId: meetingData.id
    });

    if (!executionResult.success) {
      throw new Error(`Code execution failed: ${executionResult.error}`);
    }

    console.log('✓ Code executed successfully');
    console.log('Output:', executionResult.output);

    // 7. Mark meeting as processed
    const analysisData = {
      processed_at: new Date().toISOString(),
      summary: executionResult.output,
      code_generated: code
    };

    await db.query(
      `UPDATE meetings
       SET transcript_processed = true,
           key_decisions = $2
       WHERE id = $1`,
      [meetingId, JSON.stringify(analysisData)]
    );

    return {
      success: true,
      summary: executionResult.output,
      codeGenerated: code,
      executionTime: Date.now() - startTime
    };

  } catch (error) {
    console.error('Error processing meeting:', error);
    return {
      success: false,
      summary: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: Date.now() - startTime
    };
  }
}

function getSystemPrompt(): string {
  return `You are an AI Project Manager that writes code to process meeting transcripts.

You have access to a code execution environment with these APIs:

**stories API:**
- stories.find(projectId): Get all active stories (non-done) for a project
- stories.findAll(projectId): Get ALL stories including completed ones
- stories.findByKey(storyKey, projectId): Find a specific story by its key (e.g., "STORY-15")
- stories.update(storyId, changes): Update a story
  Example: stories.update(story.id, { status: 'done' })
  Supported changes: status, assignee, notes

**meetings API:**
- meetings.get(meetingId): Get meeting details

**risks API:**
- risks.create(data): Create a risk/blocker
  Example: risks.create({
    title: 'Blocker: SSO Configuration',
    description: 'Waiting for client to provide SSO details',
    riskType: 'blocker',
    severity: 'high',  // critical, high, medium, low
    stakeholders: ['client IT team', 'Adam'],
    needsMeeting: true
  })

**storyUpdates API:**
- storyUpdates.create(data): Record a story change
  Example: storyUpdates.create({
    storyId: story.id,
    fieldChanged: 'status',
    oldValue: 'in_progress',
    newValue: 'done'
  })

**Your Task:**
Write TypeScript code that:
1. Analyzes the transcript to identify story updates
2. Updates story statuses in the database
3. Creates risk records for any blockers mentioned
4. Logs a clear summary using console.log()

**Important Guidelines:**
- Match stories by their key (STORY-001) or by description
- Only update stories that are clearly mentioned as completed or in-progress
- Be conservative - if unsure, don't update (better to miss than to incorrectly update)
- Use console.log() to report what you did with emojis for clarity
- The transcript stays in the code - don't pass it back to me
- Use this format for output:
  ✅ for successful updates
  ⚠️ for blockers/risks
  🆕 for new work mentioned
  📊 for summary statistics

**Example Code:**
\`\`\`typescript
const allStories = await stories.find(projectId);

// Find STORY-15 mentioned as completed
const story15 = await stories.findByKey('STORY-15', projectId);
if (story15 && story15.status !== 'done') {
  const oldStatus = story15.status;
  await stories.update(story15.id, { status: 'done' });
  await storyUpdates.create({
    storyId: story15.id,
    fieldChanged: 'status',
    oldValue: oldStatus,
    newValue: 'done'
  });
  console.log('✅ Marked STORY-15 as done');
}

// Create blocker
await risks.create({
  title: 'Blocker: Client SSO Config',
  description: 'Waiting for SSO configuration from client IT team for 3 days',
  riskType: 'blocker',
  severity: 'high',
  stakeholders: ['client IT team'],
  needsMeeting: true
});
console.log('⚠️ Created blocker for SSO configuration');

console.log('📊 Summary: Updated 1 story, identified 1 blocker');
\`\`\`

Write clean, well-commented code that processes the transcript accurately.`;
}

function buildCodeGenerationPrompt(
  transcript: string,
  projectId: string,
  meetingId: string,
  meetingType: string,
  stories: any[],
  sprint: any
): string {
  return `Process this ${meetingType} transcript and write code to update the project.

**TRANSCRIPT:**
\`\`\`
${transcript}
\`\`\`

**CONTEXT (for reference only - don't include in your code):**
Project ID: ${projectId}
Meeting ID: ${meetingId}
Current Sprint: ${sprint?.name || 'N/A'} (${sprint?.status || 'N/A'})
Sprint Dates: ${sprint?.start_date ? new Date(sprint.start_date).toLocaleDateString() : 'N/A'} - ${sprint?.end_date ? new Date(sprint.end_date).toLocaleDateString() : 'N/A'}

Active Stories (non-done):
${stories.length > 0 ? stories.map(s =>
  `${s.story_key}: ${s.title} (${s.status}, ${s.story_points} pts${s.assigned_to ? `, assigned to ${s.assigned_to}` : ''})`
).join('\n') : 'No active stories'}

**WRITE CODE** to:
1. Identify which stories were mentioned in the transcript
2. Update their statuses based on what was said (be conservative!)
3. Create risk records for blockers mentioned
4. Track story updates using storyUpdates.create()
5. Log a summary of changes with emojis

Remember:
- projectId and meetingId variables are available
- Use console.log() to report results
- Be specific about what changed
- Output clear summaries with emojis

Write the TypeScript code now inside a code block:`;
}

function extractCodeBlock(text: string): string | null {
  // Extract code from markdown code blocks
  const codeBlockRegex = /```(?:typescript|ts|javascript|js)?\n([\s\S]*?)```/;
  const match = text.match(codeBlockRegex);

  if (match && match[1]) {
    return match[1].trim();
  }

  // If no code block, maybe Claude returned code without markers
  if (text.includes('await stories.') || text.includes('await meetings.')) {
    return text.trim();
  }

  return null;
}
