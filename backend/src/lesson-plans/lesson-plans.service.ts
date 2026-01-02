import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { DocumentsService } from '../documents/documents.service';
import { ActionType } from '@prisma/client';
import { GenerateLessonPlanDto } from './dto/generate-lesson-plan.dto';

@Injectable()
export class LessonPlansService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private documentsService: DocumentsService,
  ) {}

  /**
   * Generate lesson plan using RAG
   */
  async generateLessonPlan(userId: string, generateDto: GenerateLessonPlanDto) {
    const { subjectId, grade, title, topic, description } = generateDto;

    // 1. Search for relevant documents
    const searchQuery = topic
      ? `Giáo án ${title} - ${topic} lớp ${grade}`
      : `Giáo án ${title} lớp ${grade}`;
    const relevantChunks = await this.documentsService.searchDocuments(searchQuery, subjectId, grade, 20);

    if (relevantChunks.length === 0) {
      throw new BadRequestException(
        'Không tìm thấy tài liệu phù hợp. Vui lòng tải lên sách giáo khoa hoặc tài liệu giảng dạy trước.',
      );
    }

    // 2. Build prompt for lesson plan generation
    const prompt = `Tạo giáo án theo chuẩn Bộ Giáo dục và Đào tạo Việt Nam với các yêu cầu sau:
- Tiêu đề: ${title}
${topic ? `- Chủ đề: ${topic}` : ''}
- Lớp: ${grade}
${description ? `- Mô tả: ${description}` : ''}

Cấu trúc giáo án phải tuân thủ quy định của Bộ GD&ĐT:
1. MỤC TIÊU (Objectives):
   - Kiến thức (Knowledge)
   - Kỹ năng (Skills)
   - Thái độ (Attitude)

2. HOẠT ĐỘNG DẠY HỌC (Teaching Activities):
   - Hoạt động của giáo viên
   - Hoạt động của học sinh
   - Phương pháp và kỹ thuật dạy học

3. ĐÁNH GIÁ (Assessment):
   - Tiêu chí đánh giá
   - Phương pháp đánh giá
   - Công cụ đánh giá

Yêu cầu:
- Tất cả nội dung PHẢI dựa trên tài liệu nguồn được cung cấp
- Không được sử dụng kiến thức bên ngoài
- Phù hợp với chương trình THCS Việt Nam`;

    // 3. Define JSON schema
    const jsonSchema = `{
      "title": "string",
      "objectives": {
        "knowledge": ["string"],
        "skills": ["string"],
        "attitude": ["string"]
      },
      "activities": {
        "teacher": [
          {
            "step": "number",
            "activity": "string",
            "time": "string"
          }
        ],
        "student": [
          {
            "step": "number",
            "activity": "string",
            "time": "string"
          }
        ]
      },
      "assessment": {
        "criteria": ["string"],
        "methods": ["string"],
        "tools": ["string"]
      },
      "content": "string (full lesson plan text)"
    }`;

    // 4. Generate lesson plan using AI with RAG
    const lessonPlanData = await this.aiService.generateStructuredJSON(
      userId,
      ActionType.LESSON_PLAN_GENERATION,
      prompt,
      relevantChunks.map((chunk) => ({
        content: chunk.content,
        source: chunk.source,
      })),
      jsonSchema,
    );

    // 5. Create lesson plan in database
    const lessonPlan = await this.prisma.lessonPlan.create({
      data: {
        subjectId,
        grade,
        title: lessonPlanData.title || title,
        objectives: lessonPlanData.objectives as any,
        activities: lessonPlanData.activities as any,
        assessment: lessonPlanData.assessment as any,
        content: lessonPlanData.content || '',
        createdBy: userId,
      },
    });

    return lessonPlan;
  }

  /**
   * Get lesson plan by ID
   */
  async getLessonPlanById(id: string) {
    return this.prisma.lessonPlan.findUnique({
      where: { id },
      include: {
        subject: true,
      },
    });
  }

  /**
   * Get all lesson plans for a user
   */
  async getLessonPlans(userId: string, subjectId?: string, grade?: number) {
    return this.prisma.lessonPlan.findMany({
      where: {
        createdBy: userId,
        ...(subjectId && { subjectId }),
        ...(grade && { grade }),
      },
      include: {
        subject: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Update lesson plan
   */
  async updateLessonPlan(id: string, data: Partial<{
    title: string;
    objectives: any;
    activities: any;
    assessment: any;
    content: string;
  }>) {
    return this.prisma.lessonPlan.update({
      where: { id },
      data,
    });
  }
}


