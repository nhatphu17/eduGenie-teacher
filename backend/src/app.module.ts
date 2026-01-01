import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { DocumentsModule } from './documents/documents.module';
import { AiModule } from './ai/ai.module';
import { QuestionsModule } from './questions/questions.module';
import { ExamsModule } from './exams/exams.module';
import { GradingModule } from './grading/grading.module';
import { LessonPlansModule } from './lesson-plans/lesson-plans.module';
import { ExportModule } from './export/export.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    SubscriptionModule,
    DocumentsModule,
    AiModule,
    QuestionsModule,
    ExamsModule,
    GradingModule,
    LessonPlansModule,
    ExportModule,
  ],
})
export class AppModule {}

