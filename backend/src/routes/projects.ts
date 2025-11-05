import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { Project, CreateProjectRequest } from '../types';
import { toCamelCase, toSnakeCase } from '../utils/caseConverter';

const router = Router();

/**
 * GET /api/projects
 * List all projects
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query<Project>(
      `SELECT * FROM projects ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      projects: result.rows.map(toCamelCase),
    });
  } catch (error: any) {
    console.error('List projects error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/projects/:id
 * Get a single project by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query<Project>(
      `SELECT * FROM projects WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    res.json({
      success: true,
      project: toCamelCase(result.rows[0]),
    });
  } catch (error: any) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Accept both camelCase and snake_case
    const projectData = toSnakeCase(req.body);

    // Validate required fields (checking snake_case since we converted)
    if (!projectData.name || !projectData.client_name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, clientName',
      });
    }

    const result = await query<Project>(
      `INSERT INTO projects
       (name, client_name, client_email, project_type, budget_hours, sprint_length_weeks)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        projectData.name,
        projectData.client_name,
        projectData.client_email || null,
        projectData.project_type || null,
        projectData.budget_hours || null,
        projectData.sprint_length_weeks || 2,
      ]
    );

    console.log('✓ Created project:', result.rows[0].id);

    res.status(201).json({
      success: true,
      project: toCamelCase(result.rows[0]),
    });
  } catch (error: any) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/projects/:id
 * Update a project
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Convert camelCase to snake_case
    const updates = toSnakeCase(req.body);

    // Build dynamic update query
    const allowedFields = [
      'name',
      'client_name',
      'client_email',
      'project_type',
      'status',
      'start_date',
      'target_end_date',
      'budget_hours',
      'sprint_length_weeks',
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

    values.push(id);

    const result = await query<Project>(
      `UPDATE projects
       SET ${setClause.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    res.json({
      success: true,
      project: toCamelCase(result.rows[0]),
    });
  } catch (error: any) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project (cascades to all related data)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `DELETE FROM projects WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    console.log('✓ Deleted project:', id);

    res.json({
      success: true,
      message: 'Project deleted',
    });
  } catch (error: any) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/projects/:id/stats
 * Get project statistics
 */
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get story counts by status
    const storyStats = await query(
      `SELECT status, COUNT(*) as count, SUM(story_points) as points
       FROM stories
       WHERE project_id = $1
       GROUP BY status`,
      [id]
    );

    // Get sprint counts
    const sprintStats = await query(
      `SELECT status, COUNT(*) as count
       FROM sprints
       WHERE project_id = $1
       GROUP BY status`,
      [id]
    );

    // Get document count
    const documentStats = await query(
      `SELECT COUNT(*) as count FROM documents WHERE project_id = $1`,
      [id]
    );

    res.json({
      success: true,
      stats: {
        stories: storyStats.rows.map(toCamelCase),
        sprints: sprintStats.rows.map(toCamelCase),
        documents: documentStats.rows[0]?.count || 0,
      },
    });
  } catch (error: any) {
    console.error('Get project stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
