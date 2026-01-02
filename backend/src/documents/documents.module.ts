import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { PythonServiceClient } from './python-service.client';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AiModule, PrismaModule, ConfigModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, PythonServiceClient],
  exports: [DocumentsService],
})
export class DocumentsModule {}


