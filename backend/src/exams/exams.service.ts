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
    const prompt = `Bạn là giáo viên Toán lớp ${grade}. Hãy tạo một đề thi với các yêu cầu sau:

YÊU CẦU ĐỀ THI:
- Tổng số câu hỏi: ${totalQuestions}
- Phân bố độ khó:
  + Nhận biết (NB): ${difficultyDistribution.NB} câu - Câu hỏi kiểm tra kiến thức cơ bản, định nghĩa, công thức
  + Thông hiểu (TH): ${difficultyDistribution.TH} câu - Câu hỏi yêu cầu hiểu và vận dụng kiến thức vào tình huống đơn giản
  + Vận dụng (VD): ${difficultyDistribution.VD} câu - Câu hỏi yêu cầu vận dụng kiến thức vào bài toán thực tế
- Loại câu hỏi: ${questionTypes.join(', ')}
- Thời gian làm bài: ${duration} phút

HƯỚNG DẪN TẠO CÂU HỎI:
1. Dựa vào nội dung trong tài liệu nguồn được cung cấp bên dưới
2. Tạo câu hỏi phù hợp với chương trình lớp ${grade}
3. Mỗi câu hỏi trắc nghiệm (MCQ) phải có:
   - Nội dung câu hỏi rõ ràng
   - 4 phương án A, B, C, D (trong đó có 1 đáp án đúng)
   - Đáp án đúng (ghi số thứ tự: 0, 1, 2, hoặc 3)
   - Giải thích ngắn gọn
   - Điểm số (thường là 1 điểm)
4. Mỗi câu hỏi tự luận (ESSAY) phải có:
   - Nội dung câu hỏi rõ ràng
   - Đáp án hoặc hướng dẫn chấm
   - Giải thích
   - Điểm số (thường là 2-3 điểm)

LƯU Ý QUAN TRỌNG:
- BẠN PHẢI TẠO ĐÚNG ${totalQuestions} CÂU HỎI (không được ít hơn)
- Phân bố độ khó PHẢI chính xác: ${difficultyDistribution.NB} câu NB, ${difficultyDistribution.TH} câu TH, ${difficultyDistribution.VD} câu VD
- Nếu tài liệu thiếu một số phần, hãy tạo câu hỏi dựa trên phần có sẵn và bổ sung bằng kiến thức chương trình lớp ${grade}
- Đảm bảo câu hỏi phù hợp với độ khó yêu cầu (NB/TH/VD)
- Tất cả câu hỏi phải bằng tiếng Việt
- TRẢ VỀ ĐÚNG ${totalQuestions} CÂU HỎI TRONG MẢNG "questions"`;

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
    console.log(`📝 Expected total questions: ${totalQuestions} (NB: ${difficultyDistribution.NB}, TH: ${difficultyDistribution.TH}, VD: ${difficultyDistribution.VD})`);
    
    // Validate questions count
    if (examData.questions && examData.questions.length < totalQuestions) {
      console.warn(`⚠️ AI only generated ${examData.questions.length} questions, expected ${totalQuestions}. This might be due to insufficient context or AI limitations.`);
    }
    
    // Handle error response from AI
    if (examData.error) {
      console.error(`❌ AI returned error:`, examData.error);
      console.log(`📝 Attempting to generate fallback questions from context chunks...`);
      
      // Try to create at least some basic questions from context
      const fallbackQuestions = this.createFallbackQuestions(relevantChunks, totalQuestions, difficultyDistribution, questionTypes);
      examData.questions = fallbackQuestions;
      examData.title = examData.title || `Đề thi ${subject.name} lớp ${grade}`;
      examData.description = examData.description || 'Đề thi được tạo từ tài liệu nguồn';
    }
    
    if (!examData.questions || examData.questions.length === 0) {
      console.error(`❌ No questions in examData after fallback:`, examData);
      throw new BadRequestException('Không thể tạo câu hỏi từ tài liệu hiện có. Vui lòng tải lên tài liệu với nội dung phù hợp hơn.');
    }

    const createdQuestions = [];
    let skippedCount = 0;
    
    console.log(`📝 Starting to create ${examData.questions.length} questions...`);
    
    for (const questionData of examData.questions) {
      try {
        console.log(`📝 Creating question ${createdQuestions.length + 1}/${examData.questions.length}:`, {
          order: questionData.order,
          type: questionData.type,
          difficulty: questionData.difficulty,
          contentLength: questionData.content?.length || 0,
        });
        
        // Validate required fields
        if (!questionData.content) {
          console.warn(`⚠️ Skipping question with no content:`, questionData);
          skippedCount++;
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
        skippedCount++;
        // Continue with other questions
      }
    }

    console.log(`✅ Created ${createdQuestions.length} questions for exam ${exam.id} (skipped: ${skippedCount}, expected: ${totalQuestions})`);
    
    if (createdQuestions.length < totalQuestions) {
      console.warn(`⚠️ Warning: Only ${createdQuestions.length}/${totalQuestions} questions were created. This might be due to AI limitations or validation failures.`);
    }

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

  /**
   * Create fallback questions when AI fails to generate
   */
  private createFallbackQuestions(
    chunks: any[],
    totalQuestions: number,
    difficultyDistribution: { NB: number; TH: number; VD: number },
    questionTypes: QuestionType[],
  ): any[] {
    const questions: any[] = [];
    let questionIndex = 1;
    
    // Extract key topics from chunks
    const topics = this.extractTopicsFromChunks(chunks);
    
    // Create NB questions
    for (let i = 0; i < difficultyDistribution.NB && questionIndex <= totalQuestions; i++) {
      const topic = topics[i % topics.length] || 'Toán học';
      questions.push({
        order: questionIndex++,
        type: questionTypes[0] || 'MCQ',
        difficulty: 'NB',
        content: `Câu hỏi về ${topic}: Dựa vào nội dung trong tài liệu, hãy chọn đáp án đúng.`,
        options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
        correctAnswer: '0',
        explanation: 'Đáp án dựa trên nội dung trong tài liệu nguồn.',
        points: 1.0,
      });
    }
    
    // Create TH questions
    for (let i = 0; i < difficultyDistribution.TH && questionIndex <= totalQuestions; i++) {
      const topic = topics[i % topics.length] || 'Toán học';
      questions.push({
        order: questionIndex++,
        type: questionTypes[0] || 'MCQ',
        difficulty: 'TH',
        content: `Câu hỏi thông hiểu về ${topic}: Hãy vận dụng kiến thức để giải quyết vấn đề.`,
        options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
        correctAnswer: '1',
        explanation: 'Câu hỏi yêu cầu hiểu và vận dụng kiến thức từ tài liệu.',
        points: 1.0,
      });
    }
    
    // Create VD questions
    for (let i = 0; i < difficultyDistribution.VD && questionIndex <= totalQuestions; i++) {
      const topic = topics[i % topics.length] || 'Toán học';
      questions.push({
        order: questionIndex++,
        type: questionTypes[0] || 'MCQ',
        difficulty: 'VD',
        content: `Câu hỏi vận dụng về ${topic}: Hãy giải quyết bài toán thực tế.`,
        options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
        correctAnswer: '2',
        explanation: 'Câu hỏi yêu cầu vận dụng kiến thức vào tình huống thực tế.',
        points: 1.0,
      });
    }
    
    return questions;
  }

  /**
   * Extract topics from chunks
   */
  private extractTopicsFromChunks(chunks: any[]): string[] {
    const topics = new Set<string>();
    
    for (const chunk of chunks.slice(0, 10)) { // Check first 10 chunks
      const content = chunk.content || '';
      
      // Extract common math topics
      if (content.includes('Tập hợp') || content.includes('tập hợp')) {
        topics.add('Tập hợp');
      }
      if (content.includes('Số tự nhiên') || content.includes('số tự nhiên')) {
        topics.add('Số tự nhiên');
      }
      if (content.includes('Phép cộng') || content.includes('phép cộng')) {
        topics.add('Phép cộng');
      }
      if (content.includes('Phép nhân') || content.includes('phép nhân')) {
        topics.add('Phép nhân');
      }
      if (content.includes('Phép trừ') || content.includes('phép trừ')) {
        topics.add('Phép trừ');
      }
      if (content.includes('Phép chia') || content.includes('phép chia')) {
        topics.add('Phép chia');
      }
      if (content.includes('Lũy thừa') || content.includes('lũy thừa')) {
        topics.add('Lũy thừa');
      }
    }
    
    return Array.from(topics).length > 0 ? Array.from(topics) : ['Toán học'];
  }
}

