import { IsEnum, IsString, IsNumber, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Difficulty, QuestionType } from '@prisma/client';

export class CreateQuestionDto {
  @ApiProperty()
  @IsString()
  subjectId: string;

  @ApiProperty()
  @IsNumber()
  grade: number;

  @ApiProperty({ enum: Difficulty })
  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  type: QuestionType;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  options?: string[];

  @ApiProperty()
  @IsString()
  correctAnswer: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  explanation?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sourceDocumentId?: string;
}

export class UpdateQuestionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  options?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  correctAnswer?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  explanation?: string;

  @ApiProperty({ required: false, enum: Difficulty })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;
}

