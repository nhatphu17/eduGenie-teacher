import { IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MixExamDto {
  @ApiProperty({ default: 4, minimum: 2, maximum: 10 })
  @IsNumber()
  @Min(2)
  @Max(10)
  numberOfVersions: number = 4;
}



