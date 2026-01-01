import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';

export class UploadDocumentDto {
  @ApiProperty({ enum: DocumentType, example: DocumentType.TEXTBOOK })
  @IsEnum(DocumentType)
  type: DocumentType;

  @ApiProperty()
  @IsString()
  subjectId: string;
}

