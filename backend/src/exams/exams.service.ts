import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { DocumentsService } from '../documents/documents.service';
import { ActionType, Difficulty, QuestionType } from '@prisma/client';
import { GenerateExamDto } from './dto/generate-exam.dto';

@Injectable()
export class ExamsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private documentsService: DocumentsService,
  ) {}

  /**
   * Generate exam using RAG
   */
  async generateExam(userId: string, generateDto: GenerateExamDto) {
    const { subjectId, grade, duration, difficultyDistribution, questionTypes, title, description } = generateDto;

    // 1. Search for relevant documents from ALL files in the subject/grade folder
    const searchQuery = `Đề thi môn học lớp ${grade}, phân bố độ khó: Nhận biết ${difficultyDistribution.NB}, Thông hiểu ${difficultyDistribution.TH}, Vận dụng ${difficultyDistribution.VD}`;
    // Search in ALL documents in the folder (increased limit to get more context)
    const relevantChunks = await this.documentsService.searchDocuments(searchQuery, subjectId, grade, 30);

    // Debug: Log available chunks
    const availableChunks = await this.prisma.chunk.findMany({
      where: {
        document: {
          subjectId,
          status: 'COMPLETED',
        },
        embedding: { not: null },
      },
      select: {
        id: true,
        document: {
          select: {
            originalFileName: true,
            status: true,
          },
        },
      },
      take: 5,
    });

    if (relevantChunks.length === 0) {
      const errorMessage = availableChunks.length === 0
        ? 'Không tìm thấy tài liệu phù hợp. Vui lòng tải lên sách giáo khoa hoặc tài liệu giảng dạy trước. (Không có chunks trong database)'
        : `Không tìm thấy tài liệu phù hợp với query. Có ${availableChunks.length} chunks trong database nhưng không match với query. Vui lòng thử lại với query khác hoặc kiểm tra tài liệu đã được xử lý chưa.`;
      
      throw new BadRequestException(errorMessage);
    }

    // 2. Build prompt for exam generation
    const totalQuestions = difficultyDistribution.NB + difficultyDistribution.TH + difficultyDistribution.VD;
    const prompt = `Tạo đề thi với các yêu cầu sau:
- Tổng số câu: ${totalQuestions}
- Phân bố độ khó: Nhận biết (${difficultyDistribution.NB} câu), Thông hiểu (${difficultyDistribution.TH} câu), Vận dụng (${difficultyDistribution.VD} câu)
- Loại câu hỏi: ${questionTypes.join(', ')}
- Thời gian: ${duration} phút
- Lớp: ${grade}

Yêu cầu:
1. Tất cả câu hỏi PHẢI dựa trên nội dung trong tài liệu nguồn được cung cấp
2. Không được sử dụng kiến thức bên ngoài
3. Mỗi câu hỏi phải có đáp án đúng và giải thích
4. Đối với câu hỏi trắc nghiệm, cung cấp 4 phương án A, B, C, D`;

    // 3. Define JSON schema for structured output
    const jsonSchema = `{
      "title": "string",
      "description": "string",
      "questions": [
        {
          "order": "number",
          "type": "MCQ | ESSAY",
          "difficulty": "NB | TH | VD",
          "content": "string",
          "options": ["string"] (only for MCQ),
          "correctAnswer": "string",
          "explanation": "string",
          "points": "number"
        }
      ],
      "answerKey": {
        "summary": "string",
        "totalPoints": "number"
      }
    }`;

    // 4. Generate exam using AI with RAG
    console.log(`🤖 Generating exam with ${relevantChunks.length} context chunks...`);
    const examData = await this.aiService.generateStructuredJSON(
      userId,
      ActionType.EXAM_GENERATION,
      prompt,
      relevantChunks.map((chunk) => ({
        content: chunk.content,
        source: chunk.source,
      })),
      jsonSchema,
    );
    
    console.log(`✅ AI response received:`, JSON.stringify(examData, null, 2));
    console.log(`📝 Questions in response:`, examData.questions?.length || 0);

    // 5. Get subject
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      throw new BadRequestException('Subject not found');
    }

    // 6. Create exam in database
    const exam = await this.prisma.exam.create({
      data: {
        subjectId,
        grade,
        duration,
        title: examData.title || title || `Đề thi ${subject.name} lớp ${grade}`,
        description: examData.description || description,
        createdBy: userId,
      },
    });

    // 7. Create questions and link to exam
    console.log(`📝 Exam data received:`, JSON.stringify(examData, null, 2));
    console.log(`📝 Questions array:`, examData.questions);
    console.log(`📝 Questions count:`, examData.questions?.length || 0);
    
    if (!examData.questions || examData.questions.length === 0) {
      console.error(`❌ No questions in examData:`, examData);
      throw new BadRequestException('AI did not generate any questions. Please try again.');
    }

    const createdQuestions = [];
    for (const questionData of examData.questions) {
      try {
        console.log(`📝 Creating question:`, questionData);
        
        // Validate required fields
        if (!questionData.content) {
          console.warn(`⚠️ Skipping question with no content:`, questionData);
          continue;
        }

        // First, try to find existing question or create new one
        const question = await this.prisma.question.create({
          data: {
            subjectId,
            grade,
            difficulty: (questionData.difficulty as Difficulty) || Difficulty.NB,
            type: (questionData.type as QuestionType) || QuestionType.MCQ,
            content: questionData.content,
            options: questionData.options ? (questionData.options as any) : null,
            correctAnswer: questionData.correctAnswer || '',
            explanation: questionData.explanation || '',
            createdBy: userId,
          },
        });

        console.log(`✅ Created question: ${question.id}`);

        // Link to exam
        await this.prisma.examQuestion.create({
          data: {
            examId: exam.id,
            questionId: question.id,
            order: questionData.order || createdQuestions.length + 1,
            points: questionData.points || 1.0,
          },
        });

        createdQuestions.push(question.id);
        console.log(`✅ Linked question ${question.id} to exam ${exam.id}`);
      } catch (error) {
        console.error(`❌ Error creating question:`, error);
        console.error(`❌ Question data:`, questionData);
        // Continue with other questions
      }
    }

    console.log(`✅ Created ${createdQuestions.length} questions for exam ${exam.id}`);

    return {
      exam: await this.getExamById(exam.id),
      answerKey: examData.answerKey,
    };
  }

  /**
   * Get exam by ID
   */
  async getExamById(id: string) {
    return this.prisma.exam.findUnique({
      where: { id },
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
  }

  /**
   * Get all exams for a user
   */
  async getExams(userId: string, subjectId?: string, grade?: number) {
    return this.prisma.exam.findMany({
      where: {
        createdBy: userId,
        ...(subjectId && { subjectId }),
        ...(grade && { grade }),
      },
      include: {
        subject: true,
        questions: {
          include: {
            question: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Mix exam - generate multiple versions with shuffled questions and options
   */
  async mixExam(examId: string, numberOfVersions: number = 4) {
    const exam = await this.getExamById(examId);
    if (!exam) {
      throw new BadRequestException('Exam not found');
    }

    const versions = [];

    for (let version = 1; version <= numberOfVersions; version++) {
      // Shuffle questions
      const shuffledQuestions = [...exam.questions].sort(() => Math.random() - 0.5);

      // For each question, shuffle options if MCQ
      const processedQuestions = shuffledQuestions.map((eq, index) => {
        const question = eq.question;
        let shuffledOptions = null;
        let correctAnswer = question.correctAnswer;

        if (question.type === QuestionType.MCQ && question.options) {
          const options = question.options as string[];
          const correctIndex = parseInt(correctAnswer) || 0;

          // Create mapping for option shuffling
          const indices = [0, 1, 2, 3];
          const shuffledIndices = [...indices].sort(() => Math.random() - 0.5);
          const newCorrectIndex = shuffledIndices.indexOf(correctIndex);

          shuffledOptions = shuffledIndices.map((idx) => options[idx]);
          correctAnswer = newCorrectIndex.toString();
        }

        return {
          order: index + 1,
          question: {
            ...question,
            options: shuffledOptions || question.options,
          },
          correctAnswer,
          points: eq.points,
        };
      });

      versions.push({
        versionCode: `MÃ ${String.fromCharCode(64 + version)}`, // A, B, C, D
        questions: processedQuestions,
      });
    }

    return {
      originalExam: {
        id: exam.id,
        title: exam.title,
        subject: exam.subject.name,
        grade: exam.grade,
      },
      versions,
    };
  }
}

