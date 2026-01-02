import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionType } from '@prisma/client';

@Injectable()
export class GradingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Grade MCQ submission
   */
  async gradeMCQ(examId: string, answers: Record<string, string>, studentName?: string) {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: {
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

    let totalScore = 0;
    let maxScore = 0;
    const results = [];

    for (const examQuestion of exam.questions) {
      const question = examQuestion.question;
      maxScore += examQuestion.points;

      if (question.type === QuestionType.MCQ) {
        const studentAnswer = answers[question.id] || '';
        const correctAnswer = question.correctAnswer;
        const isCorrect = studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();

        if (isCorrect) {
          totalScore += examQuestion.points;
        }

        results.push({
          questionId: question.id,
          questionContent: question.content,
          studentAnswer,
          correctAnswer,
          isCorrect,
          points: isCorrect ? examQuestion.points : 0,
          maxPoints: examQuestion.points,
        });
      }
    }

    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    // Save submission
    const submission = await this.prisma.studentSubmission.create({
      data: {
        examId,
        studentName: studentName || 'Anonymous',
        answers: answers as any,
        score: totalScore,
        feedback: `Điểm: ${totalScore}/${maxScore} (${percentage.toFixed(1)}%)`,
      },
    });

    return {
      submissionId: submission.id,
      score: totalScore,
      maxScore,
      percentage: percentage.toFixed(1),
      results,
      feedback: submission.feedback,
    };
  }

  /**
   * Get grading results
   */
  async getGradingResults(examId: string) {
    return this.prisma.studentSubmission.findMany({
      where: { examId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get submission by ID
   */
  async getSubmissionById(id: string) {
    return this.prisma.studentSubmission.findUnique({
      where: { id },
      include: {
        exam: {
          include: {
            questions: {
              include: {
                question: true,
              },
            },
          },
        },
      },
    });
  }
}


