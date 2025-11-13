import express, { Request, Response } from 'express';
import { getExecutor } from '../services/codeExecutorSimple';

const router = express.Router();

/**
 * Execute TypeScript code in a sandboxed environment
 * POST /api/code/execute
 *
 * Body:
 * {
 *   code: string,
 *   projectId: string,
 *   meetingId?: string
 * }
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { code, projectId, meetingId } = req.body;

    if (!code || !projectId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: code, projectId'
      });
    }

    const executor = getExecutor();
    const result = await executor.execute(code, {
      projectId,
      meetingId
    });

    res.json(result);

  } catch (error) {
    console.error('Error executing code:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
