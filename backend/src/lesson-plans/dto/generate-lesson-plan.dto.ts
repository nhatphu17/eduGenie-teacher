import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateLessonPlanDto {
  @ApiProperty()
  @IsString()
  subjectId: string;

  @ApiProperty()
  @IsNumber()
  grade: number;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}



