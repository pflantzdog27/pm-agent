import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { toCamelCase, toSnakeCase } from '../utils/caseConverter';
import { analyzeDailyScrum, matchStoryId } from '../services/executionAgent';
import type {
  CreateMeetingRequest,
  UpdateMeetingRequest,
  UploadTranscriptRequest,
  MeetingRecord,
  MeetingListItem,
  MeetingsListResponse,
  ProcessMeetingResponse,
  ExecutionContext,
  DailyScrumAnalysis,
} from '../types';

const router = Router();

// POST /api/projects/:projectId/meetings - Create a new meeting
router.post('/:projectId/meetings', async (req: Request, res: Response): Promise<any> => {
  try {
    const { projectId } = req.params;
    const body: CreateMeetingRequest = req.body;

    // Validation
    if (!body.title || !body.meetingType || !body.scheduledStart || !body.attendees || body.attendees.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: title, meetingType, scheduledStart, and attendees',
      });
    }

    // Verify project exists
    const projectCheck = await query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Insert meeting
    const result = await query(
      `INSERT INTO meetings (
        project_id, title, meeting_type, scheduled_start, scheduled_end,
        attendees, agenda, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        projectId,
        body.title,
        body.meetingType,
        body.scheduledStart,
        body.scheduledEnd || null,
        JSON.stringify(body.attendees),
        body.agenda || null,
        'scheduled',
      ]
    );

    const meeting = toCamelCase(result.rows[0]) as MeetingRecord;

    return res.status(201).json({
      success: true,
      meeting,
    });
  } catch (error: any) {
    console.error('Error creating meeting:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/meetings/:meetingId/transcript - Upload meeting transcript
router.post('/:meetingId/transcript', async (req: Request, res: Response): Promise<any> => {
  try {
    const { meetingId } = req.params;
    const body: UploadTranscriptRequest = req.body;

    // Validation
    if (!body.transcriptText || body.transcriptText.trim().length < 50) {
      return res.status(400).json({
        success: false,
        error: 'Transcript text must be at least 50 characters',
      });
    }

    // Check meeting exists
    const meetingCheck = await query('SELECT id, status, scheduled_start, scheduled_end, meeting_type FROM meetings WHERE id = $1', [
      meetingId,
    ]);

    if (meetingCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    const meeting = meetingCheck.rows[0];

    // Update meeting with transcript
    // If actual_start/end not set, use scheduled times
    const actualStart = meeting.actual_start || meeting.scheduled_start;
    const actualEnd = meeting.actual_end || meeting.scheduled_end || meeting.scheduled_start;

    await query(
      `UPDATE meetings
       SET transcript_text = $1,
           transcript_source = $2,
           status = $3,
           actual_start = $4,
           actual_end = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [body.transcriptText, body.transcriptSource, 'completed', actualStart, actualEnd, meetingId]
    );

    // Auto-process daily scrum transcripts
    let autoProcessed = false;
    if (meeting.meeting_type === 'daily_scrum') {
      console.log(`Auto-processing daily scrum meeting ${meetingId}...`);
      // Trigger processing in background (don't wait for completion)
      // We'll just set a flag indicating it should be processed
      // The frontend will need to manually trigger the /process endpoint
      // OR we could trigger it here, but that might make the upload slow
      autoProcessed = false; // Keep false for now, manual trigger required
    }

    return res.json({
      success: true,
      message: 'Transcript uploaded successfully',
      autoProcessed,
      meetingType: meeting.meeting_type,
    });
  } catch (error: any) {
    console.error('Error uploading transcript:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/meetings/:meetingId/process - Process meeting transcript with AI
router.post('/:meetingId/process', async (req: Request, res: Response): Promise<any> => {
  try {
    const { meetingId } = req.params;
    const { autoApply = false } = req.body;

    // Get meeting with transcript
    const meetingResult = await query(
      `SELECT m.*, p.id as project_id, p.name as project_name
       FROM meetings m
       JOIN projects p ON m.project_id = p.id
       WHERE m.id = $1`,
      [meetingId]
    );

    if (meetingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    const meeting = meetingResult.rows[0];

    // Validate transcript exists
    if (!meeting.transcript_text || meeting.transcript_text.trim().length < 50) {
      return res.status(400).json({
        success: false,
        error: 'Meeting must have a transcript of at least 50 characters to process',
      });
    }

    // Get current sprint for the project
    const sprintResult = await query(
      `SELECT id, sprint_number, start_date, end_date
       FROM sprints
       WHERE project_id = $1 AND status = 'active'
       ORDER BY sprint_number DESC
       LIMIT 1`,
      [meeting.project_id]
    );

    if (sprintResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No active sprint found for this project. Please activate a sprint first.',
      });
    }

    const sprint = sprintResult.rows[0];

    // Calculate days into sprint
    const startDate = new Date(sprint.start_date);
    const endDate = new Date(sprint.end_date);
    const today = new Date();
    const daysIntoSprint = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Get stories in current sprint
    const storiesResult = await query(
      `SELECT id, story_key, title, status, story_points
       FROM stories
       WHERE sprint_id = $1
       ORDER BY priority, story_key`,
      [sprint.id]
    );

    const stories = storiesResult.rows.map((row) => ({
      id: row.id,
      key: row.story_key,
      title: row.title,
      status: row.status,
      storyPoints: row.story_points || 0,
    }));

    // Build execution context
    const context: ExecutionContext = {
      projectId: meeting.project_id,
      sprintNumber: sprint.sprint_number,
      daysIntoSprint: Math.max(1, daysIntoSprint),
      totalDays: Math.max(1, totalDays),
      stories,
    };

    // Call execution agent to analyze transcript
    console.log(`Processing meeting ${meetingId} with execution agent...`);
    const analysis: DailyScrumAnalysis = await analyzeDailyScrum(meeting.transcript_text, context);

    // Store analysis in meeting record
    await query(
      `UPDATE meetings
       SET transcript_processed = true,
           key_decisions = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(analysis), meetingId]
    );

    let appliedUpdates = {
      storiesUpdated: 0,
      blockersCreated: 0,
      newWorkFlagged: 0,
    };

    // If autoApply is true, apply the updates to the database
    if (autoApply) {
      // Apply story updates
      for (const update of analysis.storyUpdates) {
        // Match story ID if not provided
        const storyId = update.storyId || matchStoryId(update.storyKey, stories);

        if (storyId && update.confidence !== 'low') {
          // Get current status
          const currentStory = await query('SELECT status FROM stories WHERE id = $1', [storyId]);
          const oldStatus = currentStory.rows[0]?.status || 'unknown';

          // Update story status
          await query(
            `UPDATE stories
             SET status = $1, updated_at = NOW()
             WHERE id = $2`,
            [update.newStatus, storyId]
          );

          // Record the update
          await query(
            `INSERT INTO story_updates (
              story_id, field_changed, old_value, new_value,
              source, source_reference, update_notes, updated_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              storyId,
              'status',
              oldStatus,
              update.newStatus,
              'daily_scrum',
              meetingId,
              update.notes,
              'AI Agent',
            ]
          );

          appliedUpdates.storiesUpdated++;
        }
      }

      // Create blocker/risk records
      for (const blocker of analysis.blockers) {
        const storyId = blocker.storyId || (blocker.storyKey ? matchStoryId(blocker.storyKey, stories) : null);

        await query(
          `INSERT INTO risks (
            project_id, story_id, title, description, severity,
            risk_type, source, source_reference, status,
            stakeholders, needs_meeting, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            meeting.project_id,
            storyId,
            blocker.storyKey ? `Blocker on ${blocker.storyKey}` : 'Project Blocker',
            blocker.description,
            blocker.severity,
            'blocker',
            'daily_scrum',
            meetingId,
            'open',
            JSON.stringify(blocker.stakeholders),
            blocker.needsMeeting,
            'AI Agent',
          ]
        );

        appliedUpdates.blockersCreated++;
      }

      // Flag new work (store in key_decisions for now)
      if (analysis.newWorkMentioned.length > 0) {
        appliedUpdates.newWorkFlagged = analysis.newWorkMentioned.length;
      }
    }

    const response: ProcessMeetingResponse = {
      success: true,
      analysis,
      appliedUpdates: autoApply ? appliedUpdates : undefined,
    };

    return res.json(response);
  } catch (error: any) {
    console.error('Error processing meeting:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// PATCH /api/meetings/:meetingId - Update meeting details
router.patch('/:meetingId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { meetingId } = req.params;
    const body: UpdateMeetingRequest = req.body;

    // Check meeting exists
    const meetingCheck = await query('SELECT id FROM meetings WHERE id = $1', [meetingId]);
    if (meetingCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (body.title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(body.title);
    }
    if (body.meetingType !== undefined) {
      updates.push(`meeting_type = $${paramCount++}`);
      values.push(body.meetingType);
    }
    if (body.scheduledStart !== undefined) {
      updates.push(`scheduled_start = $${paramCount++}`);
      values.push(body.scheduledStart);
    }
    if (body.scheduledEnd !== undefined) {
      updates.push(`scheduled_end = $${paramCount++}`);
      values.push(body.scheduledEnd);
    }
    if (body.attendees !== undefined) {
      updates.push(`attendees = $${paramCount++}`);
      values.push(JSON.stringify(body.attendees));
    }
    if (body.agenda !== undefined) {
      updates.push(`agenda = $${paramCount++}`);
      values.push(body.agenda);
    }
    if (body.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(body.status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      });
    }

    // Always update updated_at
    updates.push(`updated_at = NOW()`);
    values.push(meetingId);

    const result = await query(
      `UPDATE meetings
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    const meeting = toCamelCase(result.rows[0]) as MeetingRecord;

    return res.json({
      success: true,
      meeting,
    });
  } catch (error: any) {
    console.error('Error updating meeting:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/projects/:projectId/meetings - List meetings for a project
router.get('/:projectId/meetings', async (req: Request, res: Response): Promise<any> => {
  try {
    const { projectId } = req.params;
    const { type, processed, limit = '50', offset = '0' } = req.query;

    // Verify project exists
    const projectCheck = await query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Build query with filters
    let whereClause = 'WHERE project_id = $1';
    const values: any[] = [projectId];
    let paramCount = 2;

    if (type) {
      whereClause += ` AND meeting_type = $${paramCount++}`;
      values.push(type);
    }

    if (processed !== undefined) {
      whereClause += ` AND transcript_processed = $${paramCount++}`;
      values.push(processed === 'true');
    }

    // Get total count
    const countResult = await query(`SELECT COUNT(*) as count FROM meetings ${whereClause}`, values);
    const total = parseInt(countResult.rows[0].count);

    // Get meetings with pagination
    const offsetValue = parseInt(offset as string);
    const limitValue = parseInt(limit as string);

    values.push(limitValue, offsetValue);

    const result = await query(
      `SELECT
        id,
        title,
        meeting_type,
        scheduled_start,
        transcript_text IS NOT NULL as has_transcript,
        transcript_processed,
        jsonb_array_length(COALESCE(attendees, '[]'::jsonb)) as attendee_count,
        status
       FROM meetings
       ${whereClause}
       ORDER BY scheduled_start DESC
       LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      values
    );

    const meetings = result.rows.map((row) => toCamelCase(row)) as MeetingListItem[];

    const response: MeetingsListResponse = {
      meetings,
      total,
    };

    return res.json(response);
  } catch (error: any) {
    console.error('Error fetching meetings:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /api/meetings/:meetingId - Get meeting details
router.get('/:meetingId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { meetingId } = req.params;

    const result = await query('SELECT * FROM meetings WHERE id = $1', [meetingId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found',
      });
    }

    const meeting = toCamelCase(result.rows[0]) as MeetingRecord;

    return res.json({
      success: true,
      meeting,
    });
  } catch (error: any) {
    console.error('Error fetching meeting:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// DELETE /api/meetings/:meetingId - Delete meeting
router.delete('/:meetingId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { meetingId } = req.params;

    const result = await query('DELETE FROM meetings WHERE id = $1 RETURNING id', [meetingId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found',
      });
    }

    return res.json({
      success: true,
      message: 'Meeting deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting meeting:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
