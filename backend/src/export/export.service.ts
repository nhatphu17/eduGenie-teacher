import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { QuestionType } from '@prisma/client';

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  /**
   * Export exam to Word
   */
  async exportExamToWord(examId: string): Promise<Buffer> {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        subject: true,
        questions: {
          include: {
            question: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!exam) {
      throw new BadRequestException('Exam not found');
    }

    const children: any[] = [
      new Paragraph({
        text: exam.title || `Đề thi ${exam.subject.name} lớp ${exam.grade}`,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      }),
    ];

    if (exam.description) {
      children.push(
        new Paragraph({
          text: exam.description,
          alignment: AlignmentType.CENTER,
        }),
      );
    }

    children.push(
      new Paragraph({
        text: `Thời gian: ${exam.duration} phút`,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ text: '' }),
    );

    // Questions
    exam.questions.forEach((eq, index) => {
      const question = eq.question;
      children.push(
        new Paragraph({
          text: `Câu ${index + 1} (${eq.points} điểm):`,
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          text: question.content,
        }),
      );

      if (question.type === QuestionType.MCQ && question.options) {
        const options = question.options as string[];
        options.forEach((option, optIndex) => {
          children.push(
            new Paragraph({
              text: `${String.fromCharCode(65 + optIndex)}. ${option}`,
              indent: { left: 400 },
            }),
          );
        });
      }

      children.push(new Paragraph({ text: '' }));
    });

    const doc = new Document({
      sections: [
        {
          children,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  /**
   * Export exam to PDF
   */
  async exportExamToPDF(examId: string): Promise<Buffer> {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        subject: true,
        questions: {
          include: {
            question: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!exam) {
      throw new BadRequestException('Exam not found');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(18).text(exam.title || `Đề thi ${exam.subject.name} lớp ${exam.grade}`, { align: 'center' });
      doc.moveDown();

      if (exam.description) {
        doc.fontSize(12).text(exam.description, { align: 'center' });
        doc.moveDown();
      }

      doc.fontSize(12).text(`Thời gian: ${exam.duration} phút`, { align: 'center' });
      doc.moveDown(2);

      // Questions
      exam.questions.forEach((eq, index) => {
        const question = eq.question;
        doc.fontSize(14).text(`Câu ${index + 1} (${eq.points} điểm):`, { continued: false });
        doc.fontSize(12).text(question.content);
        doc.moveDown(0.5);

        if (question.type === QuestionType.MCQ && question.options) {
          const options = question.options as string[];
          options.forEach((option, optIndex) => {
            doc.text(`${String.fromCharCode(65 + optIndex)}. ${option}`, { indent: 20 });
          });
        }

        doc.moveDown();
      });

      doc.end();
    });
  }

  /**
   * Export exam to Excel
   */
  async exportExamToExcel(examId: string): Promise<Buffer> {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
        subject: true,
        questions: {
          include: {
            question: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!exam) {
      throw new BadRequestException('Exam not found');
    }

    const workbook = XLSX.utils.book_new();

    // Exam info sheet
    const examInfo = [
      ['Tiêu đề', exam.title || `Đề thi ${exam.subject.name} lớp ${exam.grade}`],
      ['Môn học', exam.subject.name],
      ['Lớp', exam.grade],
      ['Thời gian', `${exam.duration} phút`],
      ['Mô tả', exam.description || ''],
    ];
    const infoSheet = XLSX.utils.aoa_to_sheet(examInfo);
    XLSX.utils.book_append_sheet(workbook, infoSheet, 'Thông tin đề thi');

    // Questions sheet
    const questionsData = [
      ['STT', 'Nội dung câu hỏi', 'Loại', 'Độ khó', 'Điểm', 'Đáp án đúng'],
    ];

    exam.questions.forEach((eq, index) => {
      const question = eq.question;
      questionsData.push([
        String(index + 1),
        question.content,
        question.type,
        question.difficulty,
        String(eq.points),
        question.correctAnswer,
      ]);
    });

    const questionsSheet = XLSX.utils.aoa_to_sheet(questionsData);
    XLSX.utils.book_append_sheet(workbook, questionsSheet, 'Câu hỏi');

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }

  /**
   * Export lesson plan to Word
   */
  async exportLessonPlanToWord(lessonPlanId: string): Promise<Buffer> {
    const lessonPlan = await this.prisma.lessonPlan.findUnique({
      where: { id: lessonPlanId },
      include: {
        subject: true,
      },
    });

    if (!lessonPlan) {
      throw new BadRequestException('Lesson plan not found');
    }

    const objectives = lessonPlan.objectives as any;
    const activities = lessonPlan.activities as any;
    const assessment = lessonPlan.assessment as any;

    const children: any[] = [
      new Paragraph({
        text: lessonPlan.title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({ text: '' }),
    ];

    // Objectives
    children.push(
      new Paragraph({
        text: 'I. MỤC TIÊU',
        heading: HeadingLevel.HEADING_2,
      }),
    );

    if (objectives?.knowledge) {
      children.push(
        new Paragraph({
          text: '1. Kiến thức:',
          heading: HeadingLevel.HEADING_3,
        }),
      );
      objectives.knowledge.forEach((obj: string) => {
        children.push(new Paragraph({ text: `- ${obj}` }));
      });
    }

    if (objectives?.skills) {
      children.push(
        new Paragraph({
          text: '2. Kỹ năng:',
          heading: HeadingLevel.HEADING_3,
        }),
      );
      objectives.skills.forEach((skill: string) => {
        children.push(new Paragraph({ text: `- ${skill}` }));
      });
    }

    if (objectives?.attitude) {
      children.push(
        new Paragraph({
          text: '3. Thái độ:',
          heading: HeadingLevel.HEADING_3,
        }),
      );
      objectives.attitude.forEach((att: string) => {
        children.push(new Paragraph({ text: `- ${att}` }));
      });
    }

    children.push(new Paragraph({ text: '' }));

    // Activities
    children.push(
      new Paragraph({
        text: 'II. HOẠT ĐỘNG DẠY HỌC',
        heading: HeadingLevel.HEADING_2,
      }),
    );

    if (activities?.teacher) {
      children.push(
        new Paragraph({
          text: 'Hoạt động của giáo viên:',
          heading: HeadingLevel.HEADING_3,
        }),
      );
      activities.teacher.forEach((activity: any) => {
        children.push(
          new Paragraph({
            text: `Bước ${activity.step}: ${activity.activity} (${activity.time})`,
          }),
        );
      });
    }

    if (activities?.student) {
      children.push(
        new Paragraph({
          text: 'Hoạt động của học sinh:',
          heading: HeadingLevel.HEADING_3,
        }),
      );
      activities.student.forEach((activity: any) => {
        children.push(
          new Paragraph({
            text: `Bước ${activity.step}: ${activity.activity} (${activity.time})`,
          }),
        );
      });
    }

    children.push(new Paragraph({ text: '' }));

    // Assessment
    children.push(
      new Paragraph({
        text: 'III. ĐÁNH GIÁ',
        heading: HeadingLevel.HEADING_2,
      }),
    );

    if (assessment?.criteria) {
      children.push(new Paragraph({ text: 'Tiêu chí đánh giá:' }));
      assessment.criteria.forEach((criterion: string) => {
        children.push(new Paragraph({ text: `- ${criterion}` }));
      });
    }

    if (assessment?.methods) {
      children.push(new Paragraph({ text: 'Phương pháp đánh giá:' }));
      assessment.methods.forEach((method: string) => {
        children.push(new Paragraph({ text: `- ${method}` }));
      });
    }

    if (lessonPlan.content) {
      children.push(
        new Paragraph({
          text: 'IV. NỘI DUNG CHI TIẾT',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: lessonPlan.content }),
      );
    }

    const doc = new Document({
      sections: [
        {
          children,
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }
}

