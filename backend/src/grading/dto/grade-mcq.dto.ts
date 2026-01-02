import { IsString, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GradeMCQDto {
  @ApiProperty()
  @IsString()
  examId: string;

  @ApiProperty({ example: { 'questionId1': 'A', 'questionId2': 'B' } })
  @IsObject()
  answers: Record<string, string>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  studentName?: string;
}


