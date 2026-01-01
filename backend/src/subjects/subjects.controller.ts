import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubjectsService } from './subjects.service';

@ApiTags('Subjects')
@Controller('subjects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all subjects' })
  async getAllSubjects() {
    return this.subjectsService.getAllSubjects();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subject by ID' })
  async getSubjectById(@Param('id') id: string) {
    return this.subjectsService.getSubjectById(id);
  }

  @Get('grade/:grade')
  @ApiOperation({ summary: 'Get subjects by grade' })
  async getSubjectsByGrade(@Param('grade') grade: number) {
    return this.subjectsService.getSubjectsByGrade(parseInt(grade.toString()));
  }
}

