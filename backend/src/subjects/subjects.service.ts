import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubjectsService {
  constructor(private prisma: PrismaService) {}

  async getAllSubjects() {
    return this.prisma.subject.findMany({
      orderBy: [
        { name: 'asc' },
        { grade: 'asc' },
      ],
    });
  }

  async getSubjectById(id: string) {
    return this.prisma.subject.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            documents: true,
            questions: true,
            exams: true,
          },
        },
      },
    });
  }

  async getSubjectsByGrade(grade: number) {
    return this.prisma.subject.findMany({
      where: { grade },
      orderBy: { name: 'asc' },
    });
  }
}

