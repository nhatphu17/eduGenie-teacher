import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as FormData from 'form-data';

@Injectable()
export class PythonServiceClient {
  private readonly logger = new Logger(PythonServiceClient.name);
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(private configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('PYTHON_SERVICE_URL') ||
      'http://localhost:8000';

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 300000, // 5 minutes for processing
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    this.logger.log(`Python Service Client initialized: ${this.baseUrl}`);
  }

  /**
   * Check if Python service is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.data?.status === 'healthy';
    } catch (error) {
      this.logger.warn(`Python service health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Process document via Python service
   * This sends the file to Python service for parsing, chunking, and embedding
   */
  async processDocument(
    file: Express.Multer.File,
    documentId: string,
    subjectId: string,
    documentType: string,
    userId: string,
    originalFilename: string,
  ): Promise<{ status: string; document_id: string }> {
    try {
      // Create FormData
      const formData = new FormData();
      
      // Add file
      formData.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
      
      // Add metadata
      formData.append('document_id', documentId);
      formData.append('subject_id', subjectId);
      formData.append('document_type', documentType);
      formData.append('user_id', userId);
      formData.append('original_filename', originalFilename);

      this.logger.log(
        `Sending document ${documentId} to Python service for processing`,
      );

      const response = await this.client.post('/api/v1/process', formData, {
        headers: formData.getHeaders(),
      });

      this.logger.log(
        `Document ${documentId} queued successfully: ${response.data.message}`,
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to process document via Python service: ${error.message}`,
      );
      
      if (error.response) {
        this.logger.error(`Response: ${JSON.stringify(error.response.data)}`);
      }
      
      throw new Error(
        `Python service error: ${error.response?.data?.detail || error.message}`,
      );
    }
  }

  /**
   * Process document synchronously (for testing)
   */
  async processDocumentSync(
    file: Express.Multer.File,
    documentId: string,
    subjectId: string,
    documentType: string,
    userId: string,
    originalFilename: string,
  ): Promise<any> {
    try {
      const formData = new FormData();
      
      formData.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
      
      formData.append('document_id', documentId);
      formData.append('subject_id', subjectId);
      formData.append('document_type', documentType);
      formData.append('user_id', userId);
      formData.append('original_filename', originalFilename);

      const response = await this.client.post(
        '/api/v1/process-sync',
        formData,
        {
          headers: formData.getHeaders(),
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Sync processing failed: ${error.message}`);
      throw error;
    }
  }
}


