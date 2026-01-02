import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Difficulty, QuestionType } from '@prisma/client';

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  async createQuestion(data: {
    subjectId: string;
    grade: number;
    difficulty: Difficulty;
    type: QuestionType;
    content: string;
    options?: string[];
    correctAnswer: string;
    explanation?: string;
    sourceDocumentId?: string;
    createdBy: string;
  }) {
    return this.prisma.question.create({
      data: {
        ...data,
        options: data.options ? (data.options as any) : null,
      },
    });
  }

  async getQuestions(filters: {
    subjectId?: string;
    grade?: number;
    difficulty?: Difficulty;
    type?: QuestionType;
  }) {
    return this.prisma.question.findMany({
      where: filters,
      include: {
        subject: true,
        sourceDocument: {
          select: {
            id: true,
            originalFileName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getQuestionById(id: string) {
    return this.prisma.question.findUnique({
      where: { id },
      include: {
        subject: true,
        sourceDocument: true,
      },
    });
  }

  async updateQuestion(id: string, data: Partial<{
    content: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    difficulty: Difficulty;
  }>) {
    return this.prisma.question.update({
      where: { id },
      data: {
        ...data,
        options: data.options ? (data.options as any) : null,
      },
    });
  }

  async deleteQuestion(id: string) {
    return this.prisma.question.delete({
      where: { id },
    });
  }
}


