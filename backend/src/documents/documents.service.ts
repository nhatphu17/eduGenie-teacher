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
   * Upload document - ONLY save file, process embeddings later
   * This prevents memory issues by not processing everything in one request
   */
  async uploadDocument(
    userId: string,
    subjectId: string,
    type: DocumentType,
    file: Express.Multer.File,
  ) {
    // Check file size (max 3MB)
    const maxSize = 3 * 1024 * 1024; // 3MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds limit of ${maxSize / 1024 / 1024}MB. Please upload a smaller file.`,
      );
    }

    // Extract text
    let textContent: string;
    const fileBuffer = file.buffer;

    try {
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        textContent = await this.extractTextFromWord(fileBuffer);
      } else if (
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel'
      ) {
        textContent = await this.extractTextFromExcel(fileBuffer);
      } else if (file.mimetype === 'text/plain') {
        textContent = fileBuffer.toString('utf-8');
      } else {
        throw new BadRequestException('Unsupported file type. Please upload Word, Excel, or text files.');
      }
    } finally {
      // Clear file buffer
      (file as any).buffer = null;
    }

    if (!textContent || textContent.trim().length === 0) {
      throw new BadRequestException('Document appears to be empty');
    }

    // Limit text content to prevent issues (500KB max for LONGTEXT)
    // But we'll chunk it anyway, so this is just a safety limit
    const maxTextLength = 500 * 1024; // 500KB - LONGTEXT can handle up to 4GB
    if (textContent.length > maxTextLength) {
      textContent = textContent.substring(0, maxTextLength);
      console.log(`Text content truncated to ${maxTextLength} characters`);
    }

    // OPTION 1: Save document WITHOUT embeddings first (fast, no memory issue)
    // Process embeddings in background or on-demand
    const document = await this.prisma.document.create({
      data: {
        subjectId,
        type,
        content: textContent, // Save full content
        embedding: null, // Embedding will be generated later
        chunkIndex: 0,
        originalFileName: file.originalname,
        uploadedBy: userId,
      },
    });

    // OPTION 2: Process embeddings in background (async, non-blocking)
    // This prevents blocking the request and memory issues
    this.processEmbeddingsAsync(document.id, textContent).catch((error) => {
      console.error(`Failed to process embeddings for document ${document.id}:`, error);
      // Don't throw - document is already saved
    });

    return {
      message: 'Document uploaded successfully. Embeddings are being processed in the background.',
      documentId: document.id,
      status: 'processing',
    };
  }

  /**
   * Process embeddings asynchronously - this runs in background
   * This prevents memory issues by processing outside the request handler
   */
  private async processEmbeddingsAsync(documentId: string, textContent: string): Promise<void> {
    // Chunk the text
    const chunkSize = 3000;
    const overlap = 400;
    const maxChunks = 30;

    let processedChunks = 0;
    let start = 0;
    const chunks: Array<{ index: number; content: string }> = [];

    // First, create all chunks (this is fast, just string operations)
    while (start < textContent.length && processedChunks < maxChunks) {
      const end = Math.min(start + chunkSize, textContent.length);
      const chunk = textContent.substring(start, end);

      if (chunk.trim().length > 0) {
        chunks.push({ index: processedChunks, content: chunk });
        processedChunks++;
      }

      start = end - overlap;
      if (start >= end) break;
    }

    // Process embeddings ONE AT A TIME to minimize memory usage
    for (const chunkData of chunks) {
      try {
        console.log(`Processing embedding for chunk ${chunkData.index + 1}/${chunks.length}...`);

        // Generate embedding
        const embedding = await this.aiService.generateEmbedding(chunkData.content);

        // Update or create document chunk
        if (chunkData.index === 0) {
          // Update main document with first chunk's embedding
          await this.prisma.document.update({
            where: { id: documentId },
            data: { embedding: embedding },
          });
        } else {
          // Create additional chunks as separate documents
          await this.prisma.document.create({
            data: {
              subjectId: (await this.prisma.document.findUnique({ where: { id: documentId } }))?.subjectId || '',
              type: (await this.prisma.document.findUnique({ where: { id: documentId } }))?.type || DocumentType.TEXTBOOK,
              content: chunkData.content,
              embedding: embedding,
              chunkIndex: chunkData.index,
              originalFileName: (await this.prisma.document.findUnique({ where: { id: documentId } }))?.originalFileName || '',
              uploadedBy: (await this.prisma.document.findUnique({ where: { id: documentId } }))?.uploadedBy || '',
            },
          });
        }

        // Delay between chunks to allow GC
        if (chunkData.index < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Error processing chunk ${chunkData.index}:`, error);
      }
    }

    console.log(`Completed processing embeddings for document ${documentId}`);
  }

  /**
   * Upload multiple documents (folder upload)
   */
  async uploadMultipleDocuments(
    userId: string,
    subjectId: string,
    type: DocumentType,
    files: Express.Multer.File[],
  ) {
    const results = {
      successCount: 0,
      failedCount: 0,
      documents: [] as any[],
    };

    // Process files sequentially to avoid memory issues
    for (const file of files) {
      try {
        const result = await this.uploadDocument(userId, subjectId, type, file);
        results.successCount++;
        results.documents.push({
          fileName: file.originalname,
          documentId: result.documentId,
          status: 'success',
        });
      } catch (error) {
        results.failedCount++;
        results.documents.push({
          fileName: file.originalname,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        console.error(`Failed to upload ${file.originalname}:`, error);
      }

      // Small delay between files
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return results;
  }

  /**
   * Get documents for a subject (folder view - groups by file)
   * Returns grouped structure showing all files in the folder
   */
  async getDocuments(subjectId: string, type?: DocumentType) {
    const documents = await this.prisma.document.findMany({
      where: {
        subjectId,
        ...(type && { type }),
      },
      orderBy: [
        { originalFileName: 'asc' },
        { chunkIndex: 'asc' },
      ],
      select: {
        id: true,
        type: true,
        originalFileName: true,
        chunkIndex: true,
        createdAt: true,
        embedding: true, // To check processing status
      },
    });

    // Group by filename to show folder structure
    const grouped = documents.reduce((acc: any, doc: any) => {
      const fileName = doc.originalFileName || 'Unknown';
      if (!acc[fileName]) {
        acc[fileName] = {
          fileName,
          type: doc.type,
          chunks: [],
          createdAt: doc.createdAt,
          isProcessed: false,
        };
      }
      acc[fileName].chunks.push({
        id: doc.id,
        chunkIndex: doc.chunkIndex,
        isProcessed: doc.embedding !== null,
      });
      // Update isProcessed if any chunk is processed
      if (doc.embedding !== null) {
        acc[fileName].isProcessed = true;
      }
      return acc;
    }, {});

    return {
      grouped: Object.values(grouped),
      total: documents.length,
    };
  }

  /**
   * Get all documents for a subject/grade (including all chunks)
   * Used for folder view and RAG search
   */
  async getDocumentsBySubject(subjectId: string, type?: DocumentType) {
    const documents = await this.prisma.document.findMany({
      where: {
        subjectId,
        ...(type && { type }),
      },
      orderBy: {
        originalFileName: 'asc',
        chunkIndex: 'asc',
      },
      select: {
        id: true,
        type: true,
        originalFileName: true,
        chunkIndex: true,
        createdAt: true,
      },
    });

    // Group by file name
    const grouped = documents.reduce((acc: any, doc) => {
      const fileName = doc.originalFileName || 'Unknown';
      if (!acc[fileName]) {
        acc[fileName] = {
          fileName,
          type: doc.type,
          chunks: [],
          createdAt: doc.createdAt,
        };
      }
      acc[fileName].chunks.push({
        id: doc.id,
        chunkIndex: doc.chunkIndex,
      });
      return acc;
    }, {});

    return Object.values(grouped);
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
