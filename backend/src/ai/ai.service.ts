import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { ActionType } from '@prisma/client';

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private subscriptionService: SubscriptionService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Generate embeddings for text using OpenAI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new BadRequestException('Failed to generate embedding');
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Retrieve relevant document chunks using vector similarity
   */
  async retrieveRelevantChunks(
    queryEmbedding: number[],
    subjectId: string,
    grade: number,
    limit: number = 10,
  ) {
    // Get all documents for the subject and grade
    const documents = await this.prisma.document.findMany({
      where: {
        subjectId,
        // Note: We'd need to add grade to Document model or filter differently
      },
    });

    // Calculate similarity scores
    const scoredChunks = documents
      .map((doc) => {
        if (!doc.embedding || typeof doc.embedding !== 'object') {
          return null;
        }
        const embedding = doc.embedding as number[];
        const similarity = this.cosineSimilarity(queryEmbedding, embedding);
        return {
          document: doc,
          similarity,
        };
      })
      .filter((item) => item !== null && item.similarity > 0.7) // Threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return scoredChunks.map((item) => item.document);
  }

  /**
   * Main AI call with RAG - enforces quota and uses retrieved context
   */
  async generateWithRAG(
    userId: string,
    actionType: ActionType,
    prompt: string,
    contextChunks: Array<{ content: string; source?: string }>,
    systemPrompt?: string,
  ): Promise<{ content: string; tokensUsed: number; confidence?: number }> {
    // 1. Check quota BEFORE making AI call
    const quotaCheck = await this.subscriptionService.checkQuota(userId);
    if (!quotaCheck.canProceed) {
      throw new BadRequestException(quotaCheck.reason);
    }

    // 2. Build context from retrieved chunks
    if (contextChunks.length === 0) {
      throw new BadRequestException(
        'No relevant source material found. Please upload documents first or adjust your search criteria.',
      );
    }

    const contextText = contextChunks
      .map((chunk, idx) => `[Source ${idx + 1}${chunk.source ? `: ${chunk.source}` : ''}]\n${chunk.content}`)
      .join('\n\n---\n\n');

    // 3. Build strict prompt that forbids external knowledge
    const strictSystemPrompt = systemPrompt || `You are an AI assistant helping Vietnamese THCS teachers.
CRITICAL RULES:
1. You MUST ONLY use information from the provided source materials below.
2. You MUST NOT use any external knowledge or general information.
3. If the source materials don't contain enough information, you MUST state that clearly.
4. You MUST cite which source you used for each part of your response.
5. All outputs must be in Vietnamese unless specified otherwise.
6. For exam questions, ensure they match Vietnamese curriculum standards for THCS.`;

    const fullPrompt = `${strictSystemPrompt}

SOURCE MATERIALS:
${contextText}

USER REQUEST:
${prompt}

Remember: ONLY use information from the source materials above. If information is missing, say so explicitly.`;

    try {
      // 4. Call OpenAI
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: strictSystemPrompt },
          { role: 'user', content: fullPrompt },
        ],
        temperature: 0.3, // Lower temperature for more consistent, factual outputs
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens || 0;

      // 5. Log usage and increment quota
      await this.prisma.aiUsageLog.create({
        data: {
          userId,
          actionType,
          tokenUsed: tokensUsed,
        },
      });

      await this.subscriptionService.incrementUsage(userId);

      // 6. Calculate confidence (simplified - based on context relevance)
      const confidence = contextChunks.length > 0 ? 0.85 : 0.5;

      return {
        content,
        tokensUsed,
        confidence,
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new BadRequestException('AI generation failed. Please try again.');
    }
  }

  /**
   * Generate structured JSON output (for exams, lesson plans, etc.)
   */
  async generateStructuredJSON(
    userId: string,
    actionType: ActionType,
    prompt: string,
    contextChunks: Array<{ content: string; source?: string }>,
    jsonSchema: string,
  ): Promise<any> {
    const systemPrompt = `You are an AI assistant helping Vietnamese THCS teachers.
CRITICAL RULES:
1. You MUST ONLY use information from the provided source materials.
2. You MUST NOT use any external knowledge.
3. You MUST return valid JSON matching this schema: ${jsonSchema}
4. If source materials don't contain enough information, return an error in the JSON.
5. All text must be in Vietnamese.`;

    const result = await this.generateWithRAG(userId, actionType, prompt, contextChunks, systemPrompt);

    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = result.content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }

      return JSON.parse(jsonStr);
    } catch (error) {
      throw new BadRequestException(
        `Failed to parse AI response as JSON. Response: ${result.content.substring(0, 200)}`,
      );
    }
  }
}

