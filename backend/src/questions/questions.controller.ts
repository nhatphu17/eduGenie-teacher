import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto, UpdateQuestionDto } from './dto/question.dto';
import { Difficulty, QuestionType } from '@prisma/client';

@ApiTags('Questions')
@Controller('questions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new question' })
  async createQuestion(@CurrentUser() user: any, @Body() createDto: CreateQuestionDto) {
    return this.questionsService.createQuestion({
      ...createDto,
      createdBy: user.id,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get questions with filters' })
  async getQuestions(
    @Query('subjectId') subjectId?: string,
    @Query('grade') grade?: number,
    @Query('difficulty') difficulty?: Difficulty,
    @Query('type') type?: QuestionType,
  ) {
    return this.questionsService.getQuestions({
      subjectId,
      grade: grade ? parseInt(grade.toString()) : undefined,
      difficulty,
      type,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get question by ID' })
  async getQuestionById(@Param('id') id: string) {
    return this.questionsService.getQuestionById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a question' })
  async updateQuestion(@Param('id') id: string, @Body() updateDto: UpdateQuestionDto) {
    return this.questionsService.updateQuestion(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a question' })
  async deleteQuestion(@Param('id') id: string) {
    return this.questionsService.deleteQuestion(id);
  }
}

