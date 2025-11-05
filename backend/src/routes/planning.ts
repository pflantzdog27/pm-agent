import { Router, Request, Response } from 'express';
import { query, transaction } from '../config/database';
import { generateProjectPlan } from '../services/planningAgent';
import { Project, Document, Story, Sprint } from '../types';
import { toCamelCase, toSnakeCase } from '../utils/caseConverter';

const router = Router();

/**
 * POST /api/projects/:projectId/generate-plan
 * Generate a comprehensive project plan using Claude AI
 */
router.post('/:projectId/generate-plan', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    console.log(`🚀 Starting plan generation for project ${projectId}`);

    // Get project details
    const projectResult = await query<Project>(
      `SELECT * FROM projects WHERE id = $1`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    const project = projectResult.rows[0];

    // Get all documents for this project
    const documentsResult = await query<Document>(
      `SELECT id, title, document_type, content_text
       FROM documents
       WHERE project_id = $1`,
      [projectId]
    );

    if (documentsResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No documents found for this project. Please upload documents first.',
      });
    }

    const documents = documentsResult.rows.map((doc) => ({
      title: doc.title,
      content: doc.content_text || '',
      type: doc.document_type || 'unknown',
    }));

    console.log(`📚 Found ${documents.length} documents`);

    // Build planning context
    const planningContext = {
      projectName: project.name,
      clientName: project.client_name,
      projectType: project.project_type,
      documents,
    };

    // Generate plan using Claude AI
    const generatedPlan = await generateProjectPlan(planningContext);

    // Save plan to database in a transaction
    await transaction(async (client) => {
      // First, delete any existing stories and sprints for this project
      await client.query(`DELETE FROM stories WHERE project_id = $1`, [projectId]);
      await client.query(`DELETE FROM sprints WHERE project_id = $1`, [projectId]);

      // Create sprints first (stories reference sprints)
      const sprintIdMap = new Map<number, string>();

      for (const sprint of generatedPlan.sprints) {
        const result = await client.query(
          `INSERT INTO sprints
           (project_id, name, sprint_number, start_date, end_date, sprint_goal, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            projectId,
            sprint.name,
            sprint.sprintNumber,
            sprint.startDate,
            sprint.endDate,
            sprint.goal,
            'planned',
          ]
        );
        sprintIdMap.set(sprint.sprintNumber, result.rows[0].id);
      }

      console.log(`✓ Created ${generatedPlan.sprints.length} sprints`);

      // Create stories
      const storyIdMap = new Map<string, string>();

      for (const story of generatedPlan.stories) {
        // Find which sprint this story belongs to
        let sprintId = null;
        for (const sprint of generatedPlan.sprints) {
          if (sprint.storyIds.includes(story.id)) {
            sprintId = sprintIdMap.get(sprint.sprintNumber);
            break;
          }
        }

        const result = await client.query(
          `INSERT INTO stories
           (project_id, story_key, title, description, acceptance_criteria,
            story_points, priority, story_type, status, sprint_id, source,
            estimated_hours, dependencies)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING id`,
          [
            projectId,
            story.id, // Use generated ID as story_key
            story.title,
            story.description,
            story.acceptanceCriteria,
            story.storyPoints,
            story.priority,
            story.type,
            'draft',
            sprintId,
            'ai_generated',
            story.estimatedHours,
            JSON.stringify(story.dependencies || []),
          ]
        );

        storyIdMap.set(story.id, result.rows[0].id);
      }

      console.log(`✓ Created ${generatedPlan.stories.length} stories`);

      // Update project with timeline and plan metadata
      const planMetadata = {
        timeline: generatedPlan.timeline,
        meetings: generatedPlan.meetings || [],
        risks: generatedPlan.risks || [],
      };

      await client.query(
        `UPDATE projects
         SET start_date = $1,
             target_end_date = $2,
             status = 'active',
             plan_metadata = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [
          generatedPlan.timeline.startDate,
          generatedPlan.timeline.endDate,
          JSON.stringify(planMetadata),
          projectId,
        ]
      );

      console.log(`✓ Updated project timeline and plan metadata`);
    });

    res.json({
      success: true,
      plan: generatedPlan,
      message: `Generated ${generatedPlan.stories.length} stories across ${generatedPlan.sprints.length} sprints`,
    });
  } catch (error: any) {
    console.error('Generate plan error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/projects/:projectId/plan
 * Get the current project plan (stories and sprints)
 */
router.get('/:projectId/plan', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    // Get project
    const projectResult = await query<Project>(
      `SELECT * FROM projects WHERE id = $1`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    // Get all stories
    const storiesResult = await query<Story>(
      `SELECT * FROM stories
       WHERE project_id = $1
       ORDER BY priority, story_key`,
      [projectId]
    );

    // Get all sprints
    const sprintsResult = await query<Sprint>(
      `SELECT * FROM sprints
       WHERE project_id = $1
       ORDER BY sprint_number`,
      [projectId]
    );

    // Get stories grouped by sprint
    const storyMap = new Map<string | null, Story[]>();
    for (const story of storiesResult.rows) {
      const sprintKey = story.sprint_id || 'backlog';
      if (!storyMap.has(sprintKey)) {
        storyMap.set(sprintKey, []);
      }
      storyMap.get(sprintKey)!.push(story);
    }

    // Build sprint data with stories (convert to camelCase)
    const sprints = sprintsResult.rows.map((sprint) => toCamelCase({
      ...sprint,
      stories: (storyMap.get(sprint.id) || []).map(toCamelCase),
    }));

    // Calculate stats
    const totalPoints = storiesResult.rows.reduce(
      (sum, story) => sum + (story.story_points || 0),
      0
    );
    const completedPoints = storiesResult.rows
      .filter((s) => s.status === 'done')
      .reduce((sum, story) => sum + (story.story_points || 0), 0);

    const project = projectResult.rows[0];
    const planMetadata = project.plan_metadata || null;

    res.json({
      success: true,
      project: toCamelCase(project),
      stories: storiesResult.rows.map(toCamelCase),
      sprints,
      backlog: (storyMap.get('backlog') || []).map(toCamelCase),
      plan: planMetadata,
      stats: {
        totalStories: storiesResult.rows.length,
        totalPoints,
        completedPoints,
        progress: totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0,
      },
    });
  } catch (error: any) {
    console.error('Get plan error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/stories/:storyId
 * Update a story (move between sprints, change status, etc.)
 */
router.put('/stories/:storyId', async (req: Request, res: Response) => {
  try {
    const { storyId } = req.params;
    // Convert camelCase to snake_case
    const updates = toSnakeCase(req.body);

    const allowedFields = [
      'title',
      'description',
      'acceptance_criteria',
      'story_points',
      'priority',
      'story_type',
      'status',
      'sprint_id',
      'estimated_hours',
      'assigned_to',
      'assignment_group',
      'notes',
    ];

    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClause.push(`${field} = $${paramIndex}`);
        values.push(updates[field]);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
      });
    }

    values.push(storyId);

    const result = await query<Story>(
      `UPDATE stories
       SET ${setClause.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Story not found',
      });
    }

    res.json({
      success: true,
      story: toCamelCase(result.rows[0]),
    });
  } catch (error: any) {
    console.error('Update story error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/stories/:storyId/notes
 * Add a journal note to a story
 */
router.post('/stories/:storyId/notes', async (req: Request, res: Response) => {
  try {
    const { storyId } = req.params;
    const { content, author } = req.body;

    if (!content || !author) {
      return res.status(400).json({
        success: false,
        error: 'Content and author are required',
      });
    }

    // Get current story to retrieve existing notes
    const storyResult = await query<Story>(
      `SELECT notes FROM stories WHERE id = $1`,
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Story not found',
      });
    }

    // Parse existing notes
    let notes: any[] = [];
    const currentNotes = storyResult.rows[0].notes;

    if (typeof currentNotes === 'string') {
      try {
        notes = JSON.parse(currentNotes);
      } catch {
        notes = [];
      }
    } else if (Array.isArray(currentNotes)) {
      notes = currentNotes;
    }

    // Add new note
    const newNote = {
      timestamp: new Date().toISOString(),
      author,
      content,
    };
    notes.push(newNote);

    // Update story with new notes
    const result = await query<Story>(
      `UPDATE stories
       SET notes = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(notes), storyId]
    );

    res.json({
      success: true,
      story: toCamelCase(result.rows[0]),
    });
  } catch (error: any) {
    console.error('Add note error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/sprints/:sprintId
 * Update a sprint
 */
router.put('/sprints/:sprintId', async (req: Request, res: Response) => {
  try {
    const { sprintId } = req.params;
    // Convert camelCase to snake_case
    const updates = toSnakeCase(req.body);

    const allowedFields = [
      'name',
      'start_date',
      'end_date',
      'sprint_goal',
      'status',
    ];

    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClause.push(`${field} = $${paramIndex}`);
        values.push(updates[field]);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
      });
    }

    values.push(sprintId);

    const result = await query<Sprint>(
      `UPDATE sprints
       SET ${setClause.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Sprint not found',
      });
    }

    res.json({
      success: true,
      sprint: toCamelCase(result.rows[0]),
    });
  } catch (error: any) {
    console.error('Update sprint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
