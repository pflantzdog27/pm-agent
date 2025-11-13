import ivm from 'isolated-vm';
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
  private isolate: ivm.Isolate;

  constructor() {
    // Create isolated VM with resource limits
    this.isolate = new ivm.Isolate({
      memoryLimit: 512, // MB
    });
  }

  async execute(
    code: string,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Create new context for this execution
      const vmContext = await this.isolate.createContext();
      const jail = vmContext.global;

      // Set up console.log capture
      let output = '';
      await jail.set('_log', new ivm.Reference((msg: string) => {
        output += msg + '\n';
      }), { reference: true });

      // Set up context variables
      await jail.set('projectId', new ivm.ExternalCopy(context.projectId).copyInto());
      if (context.meetingId) {
        await jail.set('meetingId', new ivm.ExternalCopy(context.meetingId).copyInto());
      }

      // Set up completion flags
      let executionCompleted = false;
      let executionError: string | null = null;

      await jail.set('_done', new ivm.Reference(() => {
        executionCompleted = true;
      }), { reference: true });

      await jail.set('_error', new ivm.Reference((msg: string) => {
        executionError = msg;
        executionCompleted = true;
      }), { reference: true });

      // Set up API access through references
      await this.setupAPIAccess(vmContext, jail, context);

      // Wrap user code with API wrappers included
      const wrappedCode = `
        const console = { log: (...args) => _log(args.join(' ')) };

        // API wrapper definitions
        const stories = {
          async find(projectId) {
            const result = await _stories_find.apply(undefined, [projectId]);
            return JSON.parse(result);
          },
          async findAll(projectId) {
            const result = await _stories_findAll.apply(undefined, [projectId]);
            return JSON.parse(result);
          },
          async update(storyId, changes) {
            const result = await _stories_update.apply(undefined, [
              storyId,
              JSON.stringify(changes)
            ]);
            return JSON.parse(result);
          },
          async findByKey(storyKey, projectId) {
            const result = await _stories_findByKey.apply(undefined, [
              storyKey,
              projectId
            ]);
            return JSON.parse(result);
          }
        };

        const meetings = {
          async get(meetingId) {
            const result = await _meetings_get.apply(undefined, [meetingId]);
            return JSON.parse(result);
          }
        };

        const risks = {
          async create(data) {
            const result = await _risks_create.apply(undefined, [
              JSON.stringify(data)
            ]);
            return JSON.parse(result);
          }
        };

        const storyUpdates = {
          async create(data) {
            const result = await _storyUpdates_create.apply(undefined, [
              JSON.stringify(data)
            ]);
            return JSON.parse(result);
          }
        };

        (async () => {
          ${code}
        })().then(() => {
          _done();
        }).catch((err) => {
          _error(err.message + '\\n' + err.stack);
        });
      `;

      // Execute with timeout
      const script = await this.isolate.compileScript(wrappedCode);

      // Run script
      await script.run(vmContext, { timeout: 30000 }); // 30 second timeout

      // Wait for completion
      const maxWait = 35000;
      const checkInterval = 100;
      let waited = 0;

      while (!executionCompleted && waited < maxWait) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waited += checkInterval;
      }

      if (!executionCompleted) {
        throw new Error('Execution timeout');
      }

      if (executionError) {
        throw new Error(executionError);
      }

      return {
        success: true,
        output: output.trim(),
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }

  private async setupAPIAccess(
    vmContext: ivm.Context,
    jail: ivm.Reference<any>,
    context: ExecutionContext
  ) {
    // Create API wrapper functions that execute in host context

    // Stories API
    await jail.set('_stories_find', new ivm.Reference(async (projectId: string) => {
      const stories = await db.query(
        'SELECT * FROM stories WHERE project_id = $1 AND status != $2 ORDER BY story_key',
        [projectId, 'done']
      );
      return new ivm.ExternalCopy(JSON.stringify(stories.rows)).copyInto();
    }));

    await jail.set('_stories_update', new ivm.Reference(async (
      storyId: string,
      changes: string
    ) => {
      const parsedChanges = JSON.parse(changes);
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Build dynamic UPDATE query
      if (parsedChanges.status) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(parsedChanges.status);
      }
      if (parsedChanges.assignee) {
        setClauses.push(`assignee = $${paramIndex++}`);
        values.push(parsedChanges.assignee);
      }
      if (parsedChanges.notes) {
        setClauses.push(`notes = $${paramIndex++}`);
        values.push(parsedChanges.notes);
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(storyId);

      const result = await db.query(
        `UPDATE stories SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );
      return new ivm.ExternalCopy(JSON.stringify(result.rows[0])).copyInto();
    }));

    await jail.set('_stories_findByKey', new ivm.Reference(async (
      storyKey: string,
      projectId: string
    ) => {
      const result = await db.query(
        'SELECT * FROM stories WHERE story_key = $1 AND project_id = $2',
        [storyKey, projectId]
      );
      return new ivm.ExternalCopy(JSON.stringify(result.rows[0] || null)).copyInto();
    }));

    await jail.set('_stories_findAll', new ivm.Reference(async (projectId: string) => {
      const stories = await db.query(
        'SELECT * FROM stories WHERE project_id = $1 ORDER BY story_key',
        [projectId]
      );
      return new ivm.ExternalCopy(JSON.stringify(stories.rows)).copyInto();
    }));

    // Meetings API
    await jail.set('_meetings_get', new ivm.Reference(async (meetingId: string) => {
      const result = await db.query(
        'SELECT * FROM meetings WHERE id = $1',
        [meetingId]
      );
      return new ivm.ExternalCopy(JSON.stringify(result.rows[0])).copyInto();
    }));

    // Risks API
    await jail.set('_risks_create', new ivm.Reference(async (data: string) => {
      const parsed = JSON.parse(data);
      const result = await db.query(
        `INSERT INTO risks (project_id, title, description, risk_type,
         probability, impact, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
        [
          context.projectId,
          parsed.title,
          parsed.description,
          parsed.riskType || 'blocker',
          parsed.probability || 'high',
          parsed.impact || 'medium',
          'identified'
        ]
      );
      return new ivm.ExternalCopy(JSON.stringify(result.rows[0])).copyInto();
    }));

    // Story Updates API (for tracking changes)
    await jail.set('_storyUpdates_create', new ivm.Reference(async (data: string) => {
      const parsed = JSON.parse(data);
      const result = await db.query(
        `INSERT INTO story_updates (story_id, meeting_id, field_changed,
         old_value, new_value, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
        [
          parsed.storyId,
          context.meetingId || null,
          parsed.fieldChanged,
          parsed.oldValue,
          parsed.newValue
        ]
      );
      return new ivm.ExternalCopy(JSON.stringify(result.rows[0])).copyInto();
    }));

    // API wrappers are now included directly in the wrappedCode
    // so we don't need to inject them separately
  }

  dispose() {
    this.isolate.dispose();
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
