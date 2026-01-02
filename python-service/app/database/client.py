"""Database client for saving chunks"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from typing import Dict, List, Optional
from loguru import logger
from app.config import settings
import json
import pymysql

# Use PyMySQL instead of MySQLdb (pure Python, no system library needed)
pymysql.install_as_MySQLdb()


class DatabaseClient:
    """MySQL database client for saving processed documents"""
    
    def __init__(self):
        # Ensure DATABASE_URL uses pymysql driver
        db_url = settings.DATABASE_URL
        if db_url.startswith('mysql://'):
            # Replace mysql:// with mysql+pymysql://
            db_url = db_url.replace('mysql://', 'mysql+pymysql://', 1)
        elif not db_url.startswith('mysql+pymysql://'):
            # If already has driver, ensure it's pymysql
            db_url = db_url.replace('mysql+mysqldb://', 'mysql+pymysql://', 1)
        
        self.engine = create_engine(
            db_url,
            pool_size=settings.DATABASE_POOL_SIZE,
            max_overflow=settings.DATABASE_MAX_OVERFLOW,
            pool_pre_ping=True,
            echo=False,  # Set to True for SQL debugging
        )
        self.SessionLocal = sessionmaker(bind=self.engine)
    
    def save_chunks(
        self,
        document_id: str,
        chunks: List[Dict],
        subject_id: str,
        document_type: str,
        user_id: Optional[str] = None,
        original_filename: Optional[str] = None,
    ) -> int:
        """
        Save chunks to database
        
        Args:
            document_id: Document ID from NestJS
            chunks: List of chunk dicts with content, embedding, metadata
            subject_id: Subject ID
            document_type: Document type (TEXTBOOK, etc.)
            user_id: User ID who uploaded
            original_filename: Original file name
        
        Returns:
            Number of chunks saved
        """
        session = self.SessionLocal()
        saved_count = 0
        
        try:
            for idx, chunk in enumerate(chunks):
                # Prepare embedding JSON
                embedding_json = json.dumps(chunk.get('embedding', []))
                
                # Insert chunk into database
                # Note: Adjust table/column names to match your Prisma schema
                query = text("""
                    INSERT INTO chunks (
                        id,
                        documentId,
                        chapterNumber,
                        chapterTitle,
                        pageStart,
                        pageEnd,
                        content,
                        contentLength,
                        tokenCount,
                        embedding,
                        embeddingModel,
                        chunkIndex,
                        chunkType,
                        createdAt,
                        updatedAt
                    ) VALUES (
                        UUID(),
                        :document_id,
                        :chapter_number,
                        :chapter_title,
                        :page_start,
                        :page_end,
                        :content,
                        :content_length,
                        :token_count,
                        :embedding,
                        :embedding_model,
                        :chunk_index,
                        :chunk_type,
                        NOW(),
                        NOW()
                    )
                """)
                
                session.execute(query, {
                    'document_id': document_id,
                    'chapter_number': chunk.get('chapter_number'),
                    'chapter_title': chunk.get('chapter_title', ''),
                    'page_start': chunk.get('page_start'),
                    'page_end': chunk.get('page_end'),
                    'content': chunk.get('content', ''),
                    'content_length': chunk.get('content_length', 0),
                    'token_count': chunk.get('token_count'),
                    'embedding': embedding_json,
                    'embedding_model': 'text-embedding-3-large',
                    'chunk_index': chunk.get('chunk_index', idx),
                    'chunk_type': 'TEXT',
                })
                
                saved_count += 1
            
            session.commit()
            logger.info(f"Saved {saved_count} chunks for document {document_id}")
            
            # Update document status
            self._update_document_status(document_id, 'COMPLETED', saved_count)
            
            return saved_count
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error saving chunks: {e}")
            self._update_document_status(document_id, 'FAILED', error=str(e))
            raise
        
        finally:
            session.close()
    
    def _update_document_status(
        self,
        document_id: str,
        status: str,
        chunks_count: Optional[int] = None,
        error: Optional[str] = None,
    ):
        """Update document processing status"""
        session = self.SessionLocal()
        
        try:
            if error:
                query = text("""
                    UPDATE documents
                    SET status = :status,
                        errorMessage = :error,
                        updatedAt = NOW()
                    WHERE id = :document_id
                """)
                session.execute(query, {
                    'status': status,
                    'error': error,
                    'document_id': document_id,
                })
            else:
                query = text("""
                    UPDATE documents
                    SET status = :status,
                        processedAt = NOW(),
                        updatedAt = NOW()
                    WHERE id = :document_id
                """)
                session.execute(query, {
                    'status': status,
                    'document_id': document_id,
                })
            
            session.commit()
            logger.info(f"Updated document {document_id} status to {status}")
            
        except Exception as e:
            logger.error(f"Error updating document status: {e}")
            session.rollback()
        
        finally:
            session.close()

