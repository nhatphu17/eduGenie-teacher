import {
  Controller,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
  Query,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentType } from '@prisma/client';

@ApiTags('Documents')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit (matching service limit)
      },
      fileFilter: (req, file, cb) => {
        // Accept all file types - let Python service handle validation
        // Common mime types for documents
        const allowedMimeTypes = [
          'application/pdf',
          'application/msword', // .doc
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
          'application/vnd.ms-excel', // .xls
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
          'text/plain', // .txt
          // Accept any mime type to avoid validation issues
        ];
        
        // Log mime type for debugging
        console.log(`📄 File upload: ${file.originalname}, mimeType: ${file.mimetype}`);
        
        // Accept all files - validation will happen in service
        cb(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload a document (Word, Excel, or text file, max 3MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        type: {
          type: 'string',
          enum: Object.values(DocumentType),
        },
        subjectId: {
          type: 'string',
        },
      },
    },
  })
  async uploadDocument(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded. Please select a file.');
    }

    if (!uploadDto.subjectId) {
      throw new BadRequestException('Subject ID is required');
    }

    if (!uploadDto.type) {
      throw new BadRequestException('Document type is required');
    }

    try {
      return await this.documentsService.uploadDocument(
        user.id,
        uploadDto.subjectId,
        uploadDto.type,
        file,
      );
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get documents for a subject' })
  async getDocuments(
    @Query('subjectId') subjectId: string,
    @Query('type') type?: DocumentType,
  ) {
    return this.documentsService.getDocuments(subjectId, type);
  }

  @Post('upload-folder')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      // Allow up to 20 files, max 10MB each
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        // Accept all file types - let Python service handle validation
        console.log(`📄 Folder upload: ${file.originalname}, mimeType: ${file.mimetype}`);
        cb(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload multiple files (folder) for a subject/grade' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        type: {
          type: 'string',
          enum: Object.values(DocumentType),
        },
        subjectId: {
          type: 'string',
        },
      },
    },
  })
  async uploadFolder(
    @CurrentUser() user: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() uploadDto: UploadDocumentDto,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded. Please select at least one file.');
    }

    if (!uploadDto.subjectId) {
      throw new BadRequestException('Subject ID is required');
    }

    if (!uploadDto.type) {
      throw new BadRequestException('Document type is required');
    }

    try {
      const results = await this.documentsService.uploadMultipleDocuments(
        user.id,
        uploadDto.subjectId,
        uploadDto.type,
        files,
      );
      return {
        message: `Successfully uploaded ${results.successCount} file(s). ${results.failedCount} file(s) failed.`,
        successCount: results.successCount,
        failedCount: results.failedCount,
        documents: results.documents,
      };
    } catch (error) {
      console.error('Upload folder error:', error);
      throw error;
    }
  }

  @Get('search')
  @ApiOperation({ summary: 'Search documents using RAG - searches ALL documents in subject/grade folder' })
  async searchDocuments(
    @Query('query') query: string,
    @Query('subjectId') subjectId: string,
    @Query('grade') grade?: number,
    @Query('limit') limit?: number,
  ) {
    return this.documentsService.searchDocuments(query, subjectId, grade, limit || 10);
  }

  @Get('by-subject')
  @ApiOperation({ summary: 'Get all documents for a subject/grade (folder view)' })
  async getDocumentsBySubject(
    @Query('subjectId') subjectId: string,
    @Query('type') type?: DocumentType,
  ) {
    return this.documentsService.getDocumentsBySubject(subjectId, type);
  }
}

