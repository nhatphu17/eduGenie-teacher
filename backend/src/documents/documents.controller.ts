import {
  Controller,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Query,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a document (Word, Excel, or text file)' })
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
      throw new Error('No file uploaded');
    }
    return this.documentsService.uploadDocument(user.id, uploadDto.subjectId, uploadDto.type, file);
  }

  @Get()
  @ApiOperation({ summary: 'Get documents for a subject' })
  async getDocuments(
    @Query('subjectId') subjectId: string,
    @Query('type') type?: DocumentType,
  ) {
    return this.documentsService.getDocuments(subjectId, type);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search documents using RAG' })
  async searchDocuments(
    @Query('query') query: string,
    @Query('subjectId') subjectId: string,
    @Query('grade') grade?: number,
    @Query('limit') limit?: number,
  ) {
    return this.documentsService.searchDocuments(query, subjectId, grade, limit || 10);
  }
}

