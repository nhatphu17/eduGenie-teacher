import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { PythonServiceClient } from './python-service.client';
import { DocumentType, ProcessingStatus } from '@prisma/client';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private pythonService: PythonServiceClient, // NEW
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
   * Upload document - Try Python service first, fallback to local processing
   */
  async uploadDocument(
    userId: string,
    subjectId: string,
    type: DocumentType,
    file: Express.Multer.File,
  ) {
    this.logger.log(`📥 Upload request: ${file.originalname}, size: ${file.size}, mimeType: ${file.mimetype}`);
    
    // Check file size (max 10MB for Python service)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size exceeds limit of ${maxSize / 1024 / 1024}MB. Please upload a smaller file.`,
      );
    }
    
    // Validate file type (accept common document types)
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      this.logger.warn(`⚠️ Unsupported file type: ${fileExtension} for file ${file.originalname}`);
      // Don't reject - let Python service handle it
    }

    // 1. Create document record with PENDING status
    const document = await this.prisma.document.create({
      data: {
        subjectId,
        type,
        originalFileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        status: ProcessingStatus.PENDING,
        uploadedBy: userId,
      },
    });

    this.logger.log(`✅ Created document record: ${document.id}`);

    // 2. Try Python service first
    this.logger.log(`🔍 Checking Python service health...`);
    const isPythonServiceAvailable = await this.pythonService.checkHealth();
    this.logger.log(`Python service available: ${isPythonServiceAvailable}`);

    if (isPythonServiceAvailable) {
      try {
        this.logger.log(`📤 Sending document ${document.id} to Python service`);
        this.logger.log(`📋 Document details: subjectId=${subjectId}, type=${type}, fileName=${file.originalname}`);
        
        await this.pythonService.processDocument(
          file,
          document.id,
          subjectId,
          type,
          userId,
          file.originalname,
        );

        // Update status to PROCESSING
        await this.prisma.document.update({
          where: { id: document.id },
          data: { status: ProcessingStatus.PROCESSING },
        });

        this.logger.log(`✅ Document ${document.id} queued for Python processing`);

        return {
          message: 'Document uploaded and queued for processing by Python service',
          documentId: document.id,
          status: 'processing',
        };
      } catch (error) {
        this.logger.error(
          `❌ Python service failed for document ${document.id}: ${error.message}`,
        );
        this.logger.error(`Stack trace: ${error.stack}`);
        
        // Fallback to local processing
        this.logger.log(`🔄 Falling back to local processing for document ${document.id}`);
        return this.processDocumentLocally(document.id, file, subjectId, type, userId);
      }
    } else {
      this.logger.warn('⚠️ Python service unavailable, using local processing');
      return this.processDocumentLocally(document.id, file, subjectId, type, userId);
    }
  }

  /**
   * Local processing (fallback when Python service unavailable)
   */
  private async processDocumentLocally(
    documentId: string,
    file: Express.Multer.File,
    subjectId: string,
    type: DocumentType,
    userId: string,
  ) {
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
      (file as any).buffer = null;
    }

    if (!textContent || textContent.trim().length === 0) {
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: ProcessingStatus.FAILED,
          errorMessage: 'Document appears to be empty',
        },
      });
      throw new BadRequestException('Document appears to be empty');
    }

    // Limit text content
    const maxTextLength = 500 * 1024; // 500KB
    if (textContent.length > maxTextLength) {
      textContent = textContent.substring(0, maxTextLength);
      this.logger.warn(`Text content truncated to ${maxTextLength} characters`);
    }

    // Update document with content
    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        content: textContent,
        status: ProcessingStatus.PROCESSING,
      },
    });

    // Process embeddings in background
    this.processEmbeddingsAsync(documentId, textContent).catch((error) => {
      this.logger.error(`Failed to process embeddings for document ${documentId}:`, error);
      this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: ProcessingStatus.FAILED,
          errorMessage: error.message,
        },
      });
    });

    return {
      message: 'Document uploaded successfully. Processing locally in background.',
      documentId,
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
   * Now uses Chunk model for better structure
   */
  async getDocumentsBySubject(subjectId: string, type?: DocumentType) {
    // Get documents with their chunks
    const documents = await this.prisma.document.findMany({
      where: {
        subjectId,
        ...(type && { type }),
      },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
        },
      },
      orderBy: {
        originalFileName: 'asc',
      },
    });

    // Group by file name
    const grouped = documents.reduce((acc: any, doc) => {
      const fileName = doc.originalFileName || 'Unknown';
      
      if (!acc[fileName]) {
        acc[fileName] = {
          fileName,
          type: doc.type,
          documentId: doc.id,
          status: doc.status,
          chunks: [],
          createdAt: doc.createdAt,
          isProcessed: doc.status === 'COMPLETED',
        };
      }

      // Add chunks from Chunk model (preferred)
      if (doc.chunks && doc.chunks.length > 0) {
        doc.chunks.forEach((chunk) => {
          acc[fileName].chunks.push({
            id: chunk.id,
            chunkIndex: chunk.chunkIndex,
            chapterNumber: chunk.chapterNumber,
            chapterTitle: chunk.chapterTitle,
            isProcessed: chunk.embedding !== null,
          });
        });
      } else {
        // Fallback: Legacy document-based chunks
        acc[fileName].chunks.push({
          id: doc.id,
          chunkIndex: doc.chunkIndex || 0,
          isProcessed: doc.embedding !== null,
        });
      }

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
    this.logger.log(`Searching documents: query="${query}", subjectId=${subjectId}, grade=${grade}, limit=${limit}`);
    
    // Generate embedding for query
    const queryEmbedding = await this.aiService.generateEmbedding(query);
    this.logger.log(`Generated query embedding: ${queryEmbedding.length} dimensions`);

    // Retrieve relevant chunks
    const relevantChunks = await this.aiService.retrieveRelevantChunks(
      queryEmbedding,
      subjectId,
      grade || 0,
      limit,
    );

    this.logger.log(`Found ${relevantChunks.length} relevant chunks`);

    return relevantChunks.map((doc) => ({
      id: doc.id,
      content: doc.content,
      type: doc.type,
      source: doc.originalFileName || 'Unknown',
      chunkIndex: doc.chunkIndex,
    }));
  }
}
