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
        
        # Remove PostgreSQL-specific parameters (schema=public) for MySQL
        if '?schema=' in db_url:
            db_url = db_url.split('?schema=')[0]
        if '?schema=' in db_url:
            # Handle case where schema is in the middle
            db_url = db_url.split('?schema=')[0]
        
        if db_url.startswith('mysql://'):
            # Replace mysql:// with mysql+pymysql://
            db_url = db_url.replace('mysql://', 'mysql+pymysql://', 1)
        elif not db_url.startswith('mysql+pymysql://'):
            # If already has driver, ensure it's pymysql
            db_url = db_url.replace('mysql+mysqldb://', 'mysql+pymysql://', 1)
        
        logger.info(f"Connecting to database: {db_url.split('@')[1] if '@' in db_url else '***'}")
        
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
        logger.info(f"💾 [DB] Starting save_chunks for document {document_id}")
        logger.info(f"📊 [DB] Total chunks to save: {len(chunks)}")
        logger.info(f"📋 [DB] Subject ID: {subject_id}, Document Type: {document_type}")
        
        if not chunks or len(chunks) == 0:
            logger.warning(f"⚠️ [DB] No chunks to save for document {document_id}")
            self._update_document_status(document_id, 'FAILED', error='No chunks generated')
            return 0
        
        # Test database connection first
        try:
            test_session = self.SessionLocal()
            test_query = text("SELECT 1 as test")
            test_session.execute(test_query)
            test_session.close()
            logger.info(f"✅ [DB] Database connection test successful")
        except Exception as conn_error:
            logger.error(f"❌ [DB] Database connection failed: {conn_error}")
            self._update_document_status(document_id, 'FAILED', error=f'Database connection failed: {str(conn_error)}')
            raise
        
        session = self.SessionLocal()
        saved_count = 0
        
        try:
            logger.info(f"🔄 [DB] Starting to insert {len(chunks)} chunks...")
            for idx, chunk in enumerate(chunks):
                if idx == 0:
                    logger.info(f"📝 [DB] Sample chunk data: content_length={len(chunk.get('content', ''))}, has_embedding={chunk.get('embedding') is not None}")
                    logger.info(f"📝 [DB] Sample chunk keys: {list(chunk.keys())}")
                # Prepare embedding JSON
                embedding = chunk.get('embedding', [])
                if not embedding:
                    logger.warning(f"⚠️ [DB] Chunk {idx} has no embedding, skipping...")
                    continue
                
                embedding_json = json.dumps(embedding)
                
                # Validate required fields
                if not chunk.get('content'):
                    logger.warning(f"⚠️ [DB] Chunk {idx} has no content, skipping...")
                    continue
                
                # Insert chunk into database
                # Note: Prisma uses camelCase, but MySQL might use different naming
                # Check actual column names in database
                try:
                    # Try with camelCase first (Prisma default)
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
                    
                    params = {
                        'document_id': document_id,
                        'chapter_number': chunk.get('chapter_number'),
                        'chapter_title': chunk.get('chapter_title', ''),
                        'page_start': chunk.get('page_start'),
                        'page_end': chunk.get('page_end'),
                        'content': chunk.get('content', ''),
                        'content_length': chunk.get('content_length', len(chunk.get('content', ''))),
                        'token_count': chunk.get('token_count'),
                        'embedding': embedding_json,
                        'embedding_model': 'text-embedding-3-large',
                        'chunk_index': chunk.get('chunk_index', idx),
                        'chunk_type': 'TEXT',
                    }
                    
                    session.execute(query, params)
                    
                    if idx == 0:
                        logger.info(f"✅ [DB] First chunk inserted successfully")
                    
                except Exception as insert_error:
                    logger.error(f"❌ [DB] Error inserting chunk {idx}: {insert_error}")
                    logger.error(f"❌ [DB] Chunk data: content_length={len(chunk.get('content', ''))}, embedding_length={len(embedding)}")
                    raise  # Re-raise to trigger rollback
                
                saved_count += 1
                if saved_count % 10 == 0:
                    logger.info(f"💾 [DB] Saved {saved_count}/{len(chunks)} chunks...")
            
            session.commit()
            logger.info(f"✅ [DB] Successfully saved {saved_count} chunks for document {document_id}")
            logger.info(f"📊 [DB] Chunks saved: {saved_count}/{len(chunks)}")
            
            # Update document status
            self._update_document_status(document_id, 'COMPLETED', saved_count)
            
            return saved_count
            
        except Exception as e:
            session.rollback()
            logger.error(f"❌ [DB] Error saving chunks: {e}")
            logger.error(f"❌ [DB] Error type: {type(e).__name__}")
            logger.exception(e)  # Full stack trace
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
        logger.info(f"🔄 [DB] Updating document {document_id} status to {status}")
        if error:
            logger.error(f"❌ [DB] Error message: {error}")
        if chunks_count:
            logger.info(f"📊 [DB] Chunks count: {chunks_count}")
        
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

