import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Pinecone client
let pinecone: Pinecone | null = null;

export function initPinecone(): Pinecone {
  if (!process.env.PINECONE_API_KEY) {
    console.warn('⚠ PINECONE_API_KEY not set - vector search will be disabled');
    throw new Error('Pinecone API key not configured');
  }

  if (!pinecone) {
    pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    console.log('✓ Pinecone initialized');
  }

  return pinecone;
}

// Get or create index
export async function getIndex() {
  const pc = initPinecone();
  const indexName = process.env.PINECONE_INDEX_NAME || 'pm-agent-knowledge';

  try {
    // Check if index exists
    const indexes = await pc.listIndexes();
    const indexExists = indexes.indexes?.some((idx) => idx.name === indexName);

    if (!indexExists) {
      console.log(`Creating Pinecone index: ${indexName}`);
      await pc.createIndex({
        name: indexName,
        dimension: 1536, // OpenAI text-embedding-ada-002 dimension
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-west-2',
          },
        },
      });
      console.log(`✓ Created Pinecone index: ${indexName}`);
    }

    return pc.index(indexName);
  } catch (error: any) {
    console.error('Pinecone index error:', error);
    throw new Error(`Failed to get/create Pinecone index: ${error.message}`);
  }
}

// Helper to check if Pinecone is configured
export function isPineconeConfigured(): boolean {
  return !!process.env.PINECONE_API_KEY;
}

export default { initPinecone, getIndex, isPineconeConfigured };
