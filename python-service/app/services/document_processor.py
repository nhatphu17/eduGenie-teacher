"""Main document processing service"""
import os
import shutil
from typing import Dict, Optional
from loguru import logger
from app.parsers import PDFParser, DOCXParser, ExcelParser
from app.chunking import SmartChunker
from app.embeddings import OpenAIEmbedder
from app.database.client import DatabaseClient
from app.config import settings


class DocumentProcessor:
    """Main service for processing documents"""
    
    def __init__(self):
        self.pdf_parser = PDFParser()
        self.docx_parser = DOCXParser()
        self.excel_parser = ExcelParser()
        self.chunker = SmartChunker(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
        )
        self.embedder = OpenAIEmbedder()
        self.db = DatabaseClient()
    
    async def process_document(
        self,
        file_path: str,
        document_id: str,
        subject_id: str,
        document_type: str,
        user_id: Optional[str] = None,
        original_filename: Optional[str] = None,
    ) -> Dict:
        """
        Process a document: parse → chunk → embed → save
        
        Args:
            file_path: Path to uploaded file
            document_id: Document ID from NestJS
            subject_id: Subject ID
            document_type: Document type
            user_id: User ID
            original_filename: Original file name
        
        Returns:
            Dict with processing results
        """
        logger.info(f"Starting processing for document {document_id}: {file_path}")
        
        try:
            # 1. Parse document
            parsed_data = await self._parse_document(file_path)
            logger.info(f"Parsed document: {len(parsed_data['chapters'])} chapters")
            
            # 2. Chunk chapters
            all_chunks = []
            for chapter in parsed_data['chapters']:
                chunks = self.chunker.chunk_chapter(chapter)
                all_chunks.extend(chunks)
            
            logger.info(f"Created {len(all_chunks)} chunks")
            
            # Limit chunks if too many
            if len(all_chunks) > settings.MAX_CHUNKS_PER_DOCUMENT:
                logger.warning(
                    f"Limiting chunks from {len(all_chunks)} to {settings.MAX_CHUNKS_PER_DOCUMENT}"
                )
                all_chunks = all_chunks[:settings.MAX_CHUNKS_PER_DOCUMENT]
            
            # 3. Generate embeddings (batch for efficiency)
            logger.info("Generating embeddings...")
            chunk_texts = [chunk['content'] for chunk in all_chunks]
            
            # Process in batches of 10 to avoid rate limits
            batch_size = 10
            embeddings = []
            
            for i in range(0, len(chunk_texts), batch_size):
                batch = chunk_texts[i:i + batch_size]
                batch_embeddings = await self.embedder.embed_batch(batch)
                embeddings.extend(batch_embeddings)
                logger.info(f"Generated embeddings: {i + batch_size}/{len(chunk_texts)}")
            
            # Add embeddings to chunks
            for idx, chunk in enumerate(all_chunks):
                chunk['embedding'] = embeddings[idx]
            
            # 4. Save to database
            logger.info("Saving chunks to database...")
            saved_count = self.db.save_chunks(
                document_id=document_id,
                chunks=all_chunks,
                subject_id=subject_id,
                document_type=document_type,
                user_id=user_id,
                original_filename=original_filename,
            )
            
            logger.info(f"✅ Successfully processed document {document_id}: {saved_count} chunks")
            
            return {
                'status': 'success',
                'document_id': document_id,
                'chunks_count': saved_count,
                'chapters_count': len(parsed_data['chapters']),
                'metadata': parsed_data.get('metadata', {}),
            }
            
        except Exception as e:
            logger.error(f"❌ Error processing document {document_id}: {e}")
            self.db._update_document_status(document_id, 'FAILED', error=str(e))
            raise
    
    async def _parse_document(self, file_path: str) -> Dict:
        """Parse document based on file type"""
        file_ext = os.path.splitext(file_path)[1].lower()
        
        if file_ext == '.pdf':
            return self.pdf_parser.parse(file_path)
        elif file_ext in ['.docx', '.doc']:
            return self.docx_parser.parse(file_path)
        elif file_ext in ['.xlsx', '.xls']:
            return self.excel_parser.parse(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_ext}")

