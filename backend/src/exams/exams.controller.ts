import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExamsService } from './exams.service';
import { GenerateExamDto } from './dto/generate-exam.dto';
import { MixExamDto } from './dto/mix-exam.dto';

@ApiTags('Exams')
@Controller('exams')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate an exam using AI with RAG' })
  async generateExam(@CurrentUser() user: any, @Body() generateDto: GenerateExamDto) {
    return this.examsService.generateExam(user.id, generateDto);
  }

  @Post(':id/mix')
  @ApiOperation({ summary: 'Generate multiple exam versions with shuffled questions' })
  async mixExam(@Param('id') examId: string, @Body() mixDto: MixExamDto) {
    return this.examsService.mixExam(examId, mixDto.numberOfVersions);
  }

  @Get()
  @ApiOperation({ summary: 'Get all exams for current user' })
  async getExams(
    @CurrentUser() user: any,
    @Query('subjectId') subjectId?: string,
    @Query('grade') grade?: number,
  ) {
    return this.examsService.getExams(user.id, subjectId, grade ? parseInt(grade.toString()) : undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get exam by ID' })
  async getExamById(@Param('id') id: string) {
    return this.examsService.getExamById(id);
  }
}



