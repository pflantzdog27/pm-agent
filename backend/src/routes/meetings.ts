import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { toCamelCase, toSnakeCase } from '../utils/caseConverter';
import type {
  CreateMeetingRequest,
  UpdateMeetingRequest,
  UploadTranscriptRequest,
  MeetingRecord,
  MeetingListItem,
  MeetingsListResponse,
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
    const meetingCheck = await query('SELECT id, status, scheduled_start, scheduled_end FROM meetings WHERE id = $1', [
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

    return res.json({
      success: true,
      message: 'Transcript uploaded successfully',
    });
  } catch (error: any) {
    console.error('Error uploading transcript:', error);
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
