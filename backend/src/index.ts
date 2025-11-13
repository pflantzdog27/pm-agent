import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/database';
import { isPineconeConfigured } from './config/pinecone';
import { isEmbeddingEnabled } from './services/embeddingService';

// Import routes
import projectsRouter from './routes/projects';
import documentsRouter from './routes/documents';
import planningRouter from './routes/planning';
import meetingsRouter from './routes/meetings';
import codeRouter from './routes/code';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const dbConnected = await testConnection();
    const pineconeConfigured = isPineconeConfigured();
    const embeddingEnabled = isEmbeddingEnabled();
    const anthropicConfigured = !!process.env.ANTHROPIC_API_KEY;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: dbConnected ? 'connected' : 'disconnected',
        anthropic: anthropicConfigured ? 'configured' : 'not configured',
        pinecone: pineconeConfigured ? 'configured' : 'not configured',
        embeddings: embeddingEnabled ? 'enabled' : 'disabled',
      },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
});

// API Routes
app.use('/api/projects', projectsRouter);
app.use('/api/projects', documentsRouter); // Mounted under /api/projects/:projectId/documents
app.use('/api/projects', planningRouter); // Mounted under /api/projects/:projectId/generate-plan
app.use('/api/projects', meetingsRouter); // Mounted under /api/projects/:projectId/meetings

// Documents routes (also accessible directly)
app.use('/api/documents', documentsRouter);

// Sprints and stories routes (from planning router)
app.use('/api', planningRouter);

// Meetings routes (also accessible directly)
app.use('/api/meetings', meetingsRouter);

// Code execution routes
app.use('/api/code', codeRouter);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'PM Agent API',
    version: '1.0.0',
    description: 'AI-powered project management system for ServiceNow consulting',
    endpoints: {
      health: 'GET /health',
      projects: {
        list: 'GET /api/projects',
        create: 'POST /api/projects',
        get: 'GET /api/projects/:id',
        update: 'PUT /api/projects/:id',
        delete: 'DELETE /api/projects/:id',
        stats: 'GET /api/projects/:id/stats',
      },
      documents: {
        list: 'GET /api/projects/:projectId/documents',
        upload: 'POST /api/projects/:projectId/documents',
        bulkUpload: 'POST /api/projects/:projectId/documents/bulk',
        get: 'GET /api/documents/:id',
        delete: 'DELETE /api/documents/:id',
      },
      planning: {
        generate: 'POST /api/projects/:projectId/generate-plan',
        getPlan: 'GET /api/projects/:projectId/plan',
        updateStory: 'PUT /api/stories/:storyId',
        updateSprint: 'PUT /api/sprints/:sprintId',
      },
      meetings: {
        list: 'GET /api/projects/:projectId/meetings',
        create: 'POST /api/projects/:projectId/meetings',
        get: 'GET /api/meetings/:meetingId',
        update: 'PATCH /api/meetings/:meetingId',
        delete: 'DELETE /api/meetings/:meetingId',
        uploadTranscript: 'POST /api/meetings/:meetingId/transcript',
      },
      code: {
        execute: 'POST /api/code/execute',
      },
    },
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    console.log('🔍 Testing database connection...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database');
      console.error('Make sure PostgreSQL is running and DATABASE_URL is set correctly');
      process.exit(1);
    }

    // Check required environment variables
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️  ANTHROPIC_API_KEY not set - AI planning will not work');
    } else {
      console.log('✓ Anthropic API configured');
    }

    if (!isPineconeConfigured()) {
      console.warn('⚠️  Pinecone not configured - vector search disabled');
    } else {
      console.log('✓ Pinecone configured');
    }

    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY not set - embeddings disabled');
    } else {
      console.log('✓ OpenAI API configured');
    }

    // Start listening
    app.listen(PORT, () => {
      console.log('');
      console.log('═══════════════════════════════════════════');
      console.log(`🚀 PM Agent API Server Running`);
      console.log(`📍 http://localhost:${PORT}`);
      console.log(`💡 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API docs: http://localhost:${PORT}/`);
      console.log('═══════════════════════════════════════════');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();

export default app;
