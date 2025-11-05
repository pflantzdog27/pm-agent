import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Document processor service
 * Extracts text content from various file formats
 */

export interface ProcessedDocument {
  title: string;
  content: string;
  type: string;
  wordCount: number;
}

/**
 * Extract text from PDF file
 */
async function extractPDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error: any) {
    console.error('PDF extraction error:', error);
    throw new Error(`Failed to extract PDF: ${error.message}`);
  }
}

/**
 * Extract text from DOCX file
 */
async function extractDOCX(filePath: string): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    if (result.messages.length > 0) {
      console.warn('DOCX extraction warnings:', result.messages);
    }
    return result.value;
  } catch (error: any) {
    console.error('DOCX extraction error:', error);
    throw new Error(`Failed to extract DOCX: ${error.message}`);
  }
}

/**
 * Extract text from plain text file
 */
async function extractText(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error: any) {
    console.error('Text file read error:', error);
    throw new Error(`Failed to read text file: ${error.message}`);
  }
}

/**
 * Process document and extract text based on file type
 */
export async function processDocument(
  filePath: string,
  title?: string
): Promise<ProcessedDocument> {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = title || path.basename(filePath);

  let content: string;
  let type: string;

  try {
    switch (ext) {
      case '.pdf':
        content = await extractPDF(filePath);
        type = 'pdf';
        break;

      case '.docx':
      case '.doc':
        content = await extractDOCX(filePath);
        type = 'docx';
        break;

      case '.txt':
      case '.md':
        content = await extractText(filePath);
        type = 'text';
        break;

      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }

    // Clean up content
    content = cleanText(content);

    return {
      title: fileName,
      content,
      type,
      wordCount: content.split(/\s+/).length,
    };
  } catch (error: any) {
    console.error(`Document processing failed for ${filePath}:`, error);
    throw error;
  }
}

/**
 * Process multiple documents
 */
export async function processDocuments(
  filePaths: string[]
): Promise<ProcessedDocument[]> {
  const results: ProcessedDocument[] = [];

  for (const filePath of filePaths) {
    try {
      const processed = await processDocument(filePath);
      results.push(processed);
      console.log(`✓ Processed: ${processed.title} (${processed.wordCount} words)`);
    } catch (error: any) {
      console.error(`✗ Failed to process: ${filePath}`, error.message);
      // Continue processing other documents
    }
  }

  return results;
}

/**
 * Clean and normalize extracted text
 */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
    .replace(/\t/g, ' ') // Replace tabs with spaces
    .replace(/[^\S\n]+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Chunk text into smaller pieces for embedding
 * @param text The text to chunk
 * @param maxTokens Approximate max tokens per chunk (roughly 4 chars = 1 token)
 * @param overlap Number of characters to overlap between chunks
 */
export function chunkText(
  text: string,
  maxTokens: number = 500,
  overlap: number = 50
): string[] {
  const maxChars = maxTokens * 4; // Rough approximation
  const chunks: string[] = [];

  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length < maxChars) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        // Add overlap from end of previous chunk
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + '\n\n' + paragraph;
      } else {
        // Paragraph is too long, split it
        const words = paragraph.split(/\s+/);
        let tempChunk = '';

        for (const word of words) {
          if (tempChunk.length + word.length < maxChars) {
            tempChunk += (tempChunk ? ' ' : '') + word;
          } else {
            chunks.push(tempChunk);
            tempChunk = word;
          }
        }

        currentChunk = tempChunk;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.filter((chunk) => chunk.trim().length > 0);
}

/**
 * Get supported file extensions
 */
export function getSupportedExtensions(): string[] {
  return ['.pdf', '.docx', '.doc', '.txt', '.md'];
}

/**
 * Check if file type is supported
 */
export function isFileSupported(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return getSupportedExtensions().includes(ext);
}
