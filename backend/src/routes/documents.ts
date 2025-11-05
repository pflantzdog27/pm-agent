import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { query } from '../config/database';
import { processDocument } from '../services/documentProcessor';
import { embedDocument } from '../services/embeddingService';
import { Document } from '../types';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error: any) {
      cb(error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.doc', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported: ${ext}`));
    }
  },
});

/**
 * GET /api/projects/:projectId/documents
 * List all documents for a project
 */
router.get('/:projectId/documents', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    const result = await query<Document>(
      `SELECT id, project_id, title, document_type, file_path,
              LENGTH(content_text) as content_length,
              content_summary, created_at
       FROM documents
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId]
    );

    res.json({
      success: true,
      documents: result.rows,
    });
  } catch (error: any) {
    console.error('List documents error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/documents/:id
 * Get a single document by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query<Document>(
      `SELECT * FROM documents WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    res.json({
      success: true,
      document: result.rows[0],
    });
  } catch (error: any) {
    console.error('Get document error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/projects/:projectId/documents
 * Upload a document to a project
 */
router.post(
  '/:projectId/documents',
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { document_type } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      console.log(`📄 Processing document: ${req.file.originalname}`);

      // Process the document to extract text
      const processed = await processDocument(
        req.file.path,
        req.file.originalname
      );

      console.log(`✓ Extracted ${processed.wordCount} words`);

      // Save document to database
      const result = await query<Document>(
        `INSERT INTO documents
         (project_id, title, document_type, file_path, content_text)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          projectId,
          processed.title,
          document_type || processed.type,
          req.file.path,
          processed.content,
        ]
      );

      const document = result.rows[0];
      console.log(`✓ Saved document: ${document.id}`);

      // Generate embeddings in background (non-blocking)
      embedDocument(projectId, document.id, processed.content, 'document')
        .then(() => console.log(`✓ Generated embeddings for ${document.id}`))
        .catch((err) => console.warn(`⚠ Embedding failed: ${err.message}`));

      res.status(201).json({
        success: true,
        document: {
          ...document,
          content_text: undefined, // Don't send full content in response
          content_length: processed.content.length,
        },
      });
    } catch (error: any) {
      console.error('Upload document error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/projects/:projectId/documents/bulk
 * Upload multiple documents at once
 */
router.post(
  '/:projectId/documents/bulk',
  upload.array('files', 10), // Max 10 files
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded',
        });
      }

      console.log(`📄 Processing ${files.length} documents...`);

      const documents: any[] = [];

      for (const file of files) {
        try {
          // Process document
          const processed = await processDocument(file.path, file.originalname);

          // Save to database
          const result = await query<Document>(
            `INSERT INTO documents
             (project_id, title, document_type, file_path, content_text)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [projectId, processed.title, processed.type, file.path, processed.content]
          );

          const document = result.rows[0];
          documents.push({
            ...document,
            content_text: undefined,
            content_length: processed.content.length,
          });

          // Generate embeddings in background
          embedDocument(projectId, document.id, processed.content, 'document').catch(
            (err) => console.warn(`⚠ Embedding failed for ${document.id}: ${err.message}`)
          );

          console.log(`✓ Processed: ${processed.title}`);
        } catch (error: any) {
          console.error(`✗ Failed to process ${file.originalname}:`, error.message);
        }
      }

      res.status(201).json({
        success: true,
        documents,
        count: documents.length,
      });
    } catch (error: any) {
      console.error('Bulk upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * DELETE /api/documents/:id
 * Delete a document
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get document to find file path
    const docResult = await query<Document>(
      `SELECT file_path FROM documents WHERE id = $1`,
      [id]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Document not found',
      });
    }

    // Delete file from disk
    const filePath = docResult.rows[0].file_path;
    if (filePath) {
      try {
        await fs.unlink(filePath);
        console.log(`✓ Deleted file: ${filePath}`);
      } catch (error) {
        console.warn(`⚠ Could not delete file: ${filePath}`);
      }
    }

    // Delete from database (embeddings will cascade)
    await query(`DELETE FROM documents WHERE id = $1`, [id]);

    res.json({
      success: true,
      message: 'Document deleted',
    });
  } catch (error: any) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
