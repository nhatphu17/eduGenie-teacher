import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GradingService } from './grading.service';
import { GradeMCQDto } from './dto/grade-mcq.dto';

@ApiTags('Grading')
@Controller('grading')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  @Post('mcq')
  @ApiOperation({ summary: 'Grade MCQ submission' })
  async gradeMCQ(@Body() gradeDto: GradeMCQDto) {
    return this.gradingService.gradeMCQ(gradeDto.examId, gradeDto.answers, gradeDto.studentName);
  }

  @Get('results/:examId')
  @ApiOperation({ summary: 'Get grading results for an exam' })
  async getGradingResults(@Param('examId') examId: string) {
    return this.gradingService.getGradingResults(examId);
  }

  @Get('submission/:id')
  @ApiOperation({ summary: 'Get submission by ID' })
  async getSubmissionById(@Param('id') id: string) {
    return this.gradingService.getSubmissionById(id);
  }
}

