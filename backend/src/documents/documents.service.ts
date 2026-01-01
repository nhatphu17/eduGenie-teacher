import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { DocumentType } from '@prisma/client';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  /**
   * Chunk text into smaller pieces for embedding
   */
  private chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.substring(start, end);
      chunks.push(chunk);
      start = end - overlap;
    }

    return chunks;
  }

  /**
   * Extract text from Word document
   */
  private async extractTextFromWord(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new BadRequestException('Failed to extract text from Word document');
    }
  }

  /**
   * Extract text from Excel document
   */
  private async extractTextFromExcel(buffer: Buffer): Promise<string> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let text = '';

      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        const sheetText = XLSX.utils.sheet_to_txt(sheet);
        text += `Sheet: ${sheetName}\n${sheetText}\n\n`;
      });

      return text;
    } catch (error) {
      throw new BadRequestException('Failed to extract text from Excel document');
    }
  }

  /**
   * Process and store document with embeddings
   */
  async uploadDocument(
    userId: string,
    subjectId: string,
    type: DocumentType,
    file: Express.Multer.File,
  ) {
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds limit of ${maxSize / 1024 / 1024}MB. Please upload a smaller file.`,
      );
    }

    let textContent: string;

    // Extract text based on file type
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      textContent = await this.extractTextFromWord(file.buffer);
    } else if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel'
    ) {
      textContent = await this.extractTextFromExcel(file.buffer);
    } else if (file.mimetype === 'text/plain') {
      textContent = file.buffer.toString('utf-8');
    } else {
      throw new BadRequestException('Unsupported file type. Please upload Word, Excel, or text files.');
    }

    if (!textContent || textContent.trim().length === 0) {
      throw new BadRequestException('Document appears to be empty');
    }

    // Limit text content to prevent memory issues (max 500KB of text)
    const maxTextLength = 500 * 1024; // 500KB
    if (textContent.length > maxTextLength) {
      textContent = textContent.substring(0, maxTextLength);
    }

    // Chunk the document with larger chunks to reduce total number
    const chunks = this.chunkText(textContent, 2000, 300); // Larger chunks: 2000 chars, 300 overlap

    // Process chunks in batches to avoid memory issues
    const batchSize = 3; // Process 3 chunks at a time
    const documents = [];
    let firstDocumentId: string | null = null;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      // Process batch in parallel but limit concurrency
      const batchPromises = batch.map(async (chunk, batchIndex) => {
        const chunkIndex = i + batchIndex;
        try {
          // Generate embedding
          const embedding = await this.aiService.generateEmbedding(chunk);

          // Store document
          const document = await this.prisma.document.create({
            data: {
              subjectId,
              type,
              content: chunk,
              embedding: embedding,
              chunkIndex: chunkIndex,
              originalFileName: file.originalname,
              uploadedBy: userId,
            },
          });

          if (chunkIndex === 0) {
            firstDocumentId = document.id;
          }

          return document;
        } catch (error) {
          console.error(`Error processing chunk ${chunkIndex}:`, error);
          // Continue with other chunks even if one fails
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      documents.push(...batchResults.filter((doc) => doc !== null));

      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < chunks.length) {
        await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms delay
      }
    }

    return {
      message: 'Document uploaded and processed successfully',
      chunksCount: documents.length,
      documentId: firstDocumentId,
    };
  }

  /**
   * Get documents for a subject
   */
  async getDocuments(subjectId: string, type?: DocumentType) {
    return this.prisma.document.findMany({
      where: {
        subjectId,
        ...(type && { type }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        type: true,
        originalFileName: true,
        chunkIndex: true,
        createdAt: true,
      },
    });
  }

  /**
   * Search documents using RAG
   */
  async searchDocuments(
    query: string,
    subjectId: string,
    grade?: number,
    limit: number = 10,
  ) {
    // Generate embedding for query
    const queryEmbedding = await this.aiService.generateEmbedding(query);

    // Retrieve relevant chunks
    const relevantChunks = await this.aiService.retrieveRelevantChunks(
      queryEmbedding,
      subjectId,
      grade || 0,
      limit,
    );

    return relevantChunks.map((doc) => ({
      id: doc.id,
      content: doc.content,
      type: doc.type,
      source: doc.originalFileName || 'Unknown',
      chunkIndex: doc.chunkIndex,
    }));
  }
}

