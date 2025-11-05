import { getIndex, isPineconeConfigured } from '../config/pinecone';
import { query } from '../config/database';
import { chunkText } from './documentProcessor';

/**
 * Embedding service
 * Generates and stores vector embeddings for semantic search
 */

interface EmbeddingMetadata {
  projectId: string;
  sourceType: 'document' | 'meeting' | 'email' | 'other';
  sourceId: string;
  chunkIndex: number;
  content: string;
}

/**
 * Generate embeddings using OpenAI API
 * Note: Requires OPENAI_API_KEY in environment
 */
async function generateEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠ OpenAI API key not set - embeddings disabled');
    throw new Error('OpenAI API key not configured');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[] }>;
    };
    return data.data[0].embedding;
  } catch (error: any) {
    console.error('Embedding generation error:', error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Generate embeddings for document and store in vector database
 */
export async function embedDocument(
  projectId: string,
  documentId: string,
  content: string,
  sourceType: 'document' | 'meeting' | 'email' | 'other' = 'document'
): Promise<void> {
  if (!isPineconeConfigured()) {
    console.warn('⚠ Pinecone not configured - skipping embeddings');
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠ OpenAI not configured - skipping embeddings');
    return;
  }

  try {
    // Chunk the content
    const chunks = chunkText(content, 500, 50);
    console.log(`Generating embeddings for ${chunks.length} chunks...`);

    const index = await getIndex();
    const vectors: any[] = [];

    // Generate embeddings for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await generateEmbedding(chunk);

      const vectorId = `${projectId}-${documentId}-${i}`;
      const metadata: EmbeddingMetadata = {
        projectId,
        sourceType,
        sourceId: documentId,
        chunkIndex: i,
        content: chunk,
      };

      vectors.push({
        id: vectorId,
        values: embedding,
        metadata,
      });

      // Store embedding reference in PostgreSQL
      await query(
        `INSERT INTO knowledge_embeddings
         (project_id, source_type, source_id, content_chunk, chunk_index, embedding_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [projectId, sourceType, documentId, chunk, i, vectorId]
      );

      console.log(`✓ Generated embedding ${i + 1}/${chunks.length}`);
    }

    // Upsert vectors to Pinecone
    await index.upsert(vectors);
    console.log(`✓ Stored ${vectors.length} embeddings in Pinecone`);
  } catch (error: any) {
    console.error('Embedding error:', error);
    throw new Error(`Failed to embed document: ${error.message}`);
  }
}

/**
 * Search for relevant content using semantic search
 */
export async function searchRelevantContent(
  projectId: string,
  query: string,
  topK: number = 5
): Promise<string[]> {
  if (!isPineconeConfigured() || !process.env.OPENAI_API_KEY) {
    console.warn('⚠ Vector search not available - returning empty results');
    return [];
  }

  try {
    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    // Search Pinecone
    const index = await getIndex();
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK,
      filter: { projectId: { $eq: projectId } },
      includeMetadata: true,
    });

    // Extract content from results
    const relevantContent: string[] = [];
    for (const match of searchResults.matches) {
      if (match.metadata && typeof match.metadata.content === 'string') {
        relevantContent.push(match.metadata.content);
      }
    }

    return relevantContent;
  } catch (error: any) {
    console.error('Semantic search error:', error);
    throw new Error(`Failed to search content: ${error.message}`);
  }
}

/**
 * Delete all embeddings for a project
 */
export async function deleteProjectEmbeddings(projectId: string): Promise<void> {
  if (!isPineconeConfigured()) {
    return;
  }

  try {
    // Get all embedding IDs for this project
    const result = await query<{ embedding_id: string }>(
      'SELECT embedding_id FROM knowledge_embeddings WHERE project_id = $1',
      [projectId]
    );

    if (result.rows.length === 0) {
      return;
    }

    // Delete from Pinecone
    const index = await getIndex();
    const ids = result.rows.map((row) => row.embedding_id);
    await index.deleteMany(ids);

    // Delete from PostgreSQL
    await query('DELETE FROM knowledge_embeddings WHERE project_id = $1', [projectId]);

    console.log(`✓ Deleted ${ids.length} embeddings for project ${projectId}`);
  } catch (error: any) {
    console.error('Delete embeddings error:', error);
    throw new Error(`Failed to delete embeddings: ${error.message}`);
  }
}

/**
 * Check if embeddings are configured and available
 */
export function isEmbeddingEnabled(): boolean {
  return isPineconeConfigured() && !!process.env.OPENAI_API_KEY;
}

export default {
  embedDocument,
  searchRelevantContent,
  deleteProjectEmbeddings,
  isEmbeddingEnabled,
};
