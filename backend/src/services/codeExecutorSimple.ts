import * as vm from 'vm';
import * as db from '../config/database';

interface ExecutionContext {
  projectId: string;
  meetingId?: string;
  userId?: string;
}

interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
}

export class CodeExecutor {
  async execute(
    code: string,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const output: string[] = [];

    try {
      // Create sandbox with API access
      const sandbox = {
        // Context variables
        projectId: context.projectId,
        meetingId: context.meetingId,

        // Console
        console: {
          log: (...args: any[]) => {
            output.push(args.map(a => String(a)).join(' '));
          }
        },

        // Stories API
        stories: {
          async find(projectId: string) {
            const result = await db.query(
              'SELECT * FROM stories WHERE project_id = $1 AND status != $2 ORDER BY story_key',
              [projectId, 'done']
            );
            return result.rows;
          },
          async findAll(projectId: string) {
            const result = await db.query(
              'SELECT * FROM stories WHERE project_id = $1 ORDER BY story_key',
              [projectId]
            );
            return result.rows;
          },
          async update(storyId: string, changes: any) {
            const setClauses: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            if (changes.status) {
              setClauses.push(`status = $${paramIndex++}`);
              values.push(changes.status);
            }
            if (changes.assigned_to) {
              setClauses.push(`assigned_to = $${paramIndex++}`);
              values.push(changes.assigned_to);
            }
            if (changes.notes) {
              setClauses.push(`notes = $${paramIndex++}`);
              values.push(changes.notes);
            }

            setClauses.push(`updated_at = NOW()`);
            values.push(storyId);

            const result = await db.query(
              `UPDATE stories SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
              values
            );
            return result.rows[0];
          },
          async findByKey(storyKey: string, projectId: string) {
            const result = await db.query(
              'SELECT * FROM stories WHERE story_key = $1 AND project_id = $2',
              [storyKey, projectId]
            );
            return result.rows[0] || null;
          }
        },

        // Meetings API
        meetings: {
          async get(meetingId: string) {
            const result = await db.query(
              'SELECT * FROM meetings WHERE id = $1',
              [meetingId]
            );
            return result.rows[0];
          }
        },

        // Risks API
        risks: {
          async create(data: any) {
            const result = await db.query(
              `INSERT INTO risks (project_id, title, description, risk_type,
               severity, status, stakeholders, needs_meeting, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
              [
                context.projectId,
                data.title,
                data.description,
                data.riskType || 'blocker',
                data.severity || 'high',
                'open',
                JSON.stringify(data.stakeholders || []),
                data.needsMeeting || false
              ]
            );
            return result.rows[0];
          }
        },

        // Story Updates API
        storyUpdates: {
          async create(data: any) {
            const result = await db.query(
              `INSERT INTO story_updates (story_id, field_changed,
               old_value, new_value, source, source_reference, update_notes, created_at)
               VALUES ($1, $2, $3, $4, $5, $6::uuid, $7, NOW()) RETURNING *`,
              [
                data.storyId,
                data.fieldChanged,
                data.oldValue,
                data.newValue,
                'meeting',
                context.meetingId || null,
                data.notes || null
              ]
            );
            return result.rows[0];
          }
        },

        // Utilities
        setTimeout: undefined, // Block setTimeout
        setInterval: undefined, // Block setInterval
        require: undefined, // Block require
        process: undefined, // Block process
        global: undefined // Block global
      };

      // Create VM context
      const vmContext = vm.createContext(sandbox);

      // Wrap code in async function
      const wrappedCode = `
        (async () => {
          ${code}
        })();
      `;

      // Run code with timeout
      const script = new vm.Script(wrappedCode);
      const promise = script.runInContext(vmContext, {
        timeout: 30000 // 30 second timeout
      });

      // Wait for completion
      await promise;

      return {
        success: true,
        output: output.join('\n'),
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        output: output.join('\n'),
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  dispose() {
    // No cleanup needed for vm module
  }
}

// Singleton instance
let executorInstance: CodeExecutor | null = null;

export function getExecutor(): CodeExecutor {
  if (!executorInstance) {
    executorInstance = new CodeExecutor();
  }
  return executorInstance;
}
