import { IsString, IsNumber, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Difficulty, QuestionType } from '@prisma/client';

export class DifficultyDistribution {
  @ApiProperty()
  NB: number; // Nhận biết

  @ApiProperty()
  TH: number; // Thông hiểu

  @ApiProperty()
  VD: number; // Vận dụng
}

export class GenerateExamDto {
  @ApiProperty()
  @IsString()
  subjectId: string;

  @ApiProperty()
  @IsNumber()
  grade: number;

  @ApiProperty()
  @IsNumber()
  duration: number; // minutes

  @ApiProperty({ type: DifficultyDistribution })
  @IsObject()
  difficultyDistribution: DifficultyDistribution;

  @ApiProperty({ enum: QuestionType, isArray: true })
  @IsEnum(QuestionType, { each: true })
  questionTypes: QuestionType[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

