import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExportService } from './export.service';

@ApiTags('Export')
@Controller('export')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('exam/:id/word')
  @ApiOperation({ summary: 'Export exam to Word (.docx)' })
  async exportExamToWord(@Param('id') examId: string, @Res() res: Response) {
    const buffer = await this.exportService.exportExamToWord(examId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="exam-${examId}.docx"`);
    res.send(buffer);
  }

  @Get('exam/:id/pdf')
  @ApiOperation({ summary: 'Export exam to PDF' })
  async exportExamToPDF(@Param('id') examId: string, @Res() res: Response) {
    const buffer = await this.exportService.exportExamToPDF(examId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="exam-${examId}.pdf"`);
    res.send(buffer);
  }

  @Get('exam/:id/excel')
  @ApiOperation({ summary: 'Export exam to Excel (.xlsx)' })
  async exportExamToExcel(@Param('id') examId: string, @Res() res: Response) {
    const buffer = await this.exportService.exportExamToExcel(examId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="exam-${examId}.xlsx"`);
    res.send(buffer);
  }

  @Get('lesson-plan/:id/word')
  @ApiOperation({ summary: 'Export lesson plan to Word (.docx)' })
  async exportLessonPlanToWord(@Param('id') lessonPlanId: string, @Res() res: Response) {
    const buffer = await this.exportService.exportLessonPlanToWord(lessonPlanId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="lesson-plan-${lessonPlanId}.docx"`);
    res.send(buffer);
  }
}

