import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LessonPlansService } from './lesson-plans.service';
import { GenerateLessonPlanDto } from './dto/generate-lesson-plan.dto';

@ApiTags('Lesson Plans')
@Controller('lesson-plans')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LessonPlansController {
  constructor(private readonly lessonPlansService: LessonPlansService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a lesson plan using AI with RAG' })
  async generateLessonPlan(@CurrentUser() user: any, @Body() generateDto: GenerateLessonPlanDto) {
    return this.lessonPlansService.generateLessonPlan(user.id, generateDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all lesson plans for current user' })
  async getLessonPlans(
    @CurrentUser() user: any,
    @Query('subjectId') subjectId?: string,
    @Query('grade') grade?: number,
  ) {
    return this.lessonPlansService.getLessonPlans(user.id, subjectId, grade ? parseInt(grade.toString()) : undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lesson plan by ID' })
  async getLessonPlanById(@Param('id') id: string) {
    return this.lessonPlansService.getLessonPlanById(id);
  }
}


