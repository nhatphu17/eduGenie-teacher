"""Smart chunking with context preservation"""
from typing import Dict, List
from langchain_text_splitters import RecursiveCharacterTextSplitter
from loguru import logger


class SmartChunker:
    """Intelligent text chunking that preserves structure"""
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        """
        Args:
            chunk_size: Target chunk size in tokens (~3x in characters)
            chunk_overlap: Overlap between chunks in tokens
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
        # Use LangChain's recursive splitter
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size * 3,  # Convert tokens to chars (rough estimate)
            chunk_overlap=chunk_overlap * 3,
            separators=["\n\n\n", "\n\n", "\n", ". ", " ", ""],
            length_function=len,
        )
    
    def chunk_chapter(self, chapter: Dict) -> List[Dict]:
        """
        Chunk a chapter into smaller pieces with metadata
        
        Args:
            chapter: Dict with 'content', 'number', 'title', 'start_page', 'end_page'
        
        Returns:
            List of chunk dicts with metadata
        """
        content = chapter.get('content', '')
        if not content or len(content.strip()) < 100:
            logger.warning(f"Chapter {chapter.get('number')} has insufficient content")
            return []
        
        # Split into chunks
        chunks = self.splitter.split_text(content)
        
        logger.info(
            f"Chunked chapter {chapter.get('number')} into {len(chunks)} chunks "
            f"(avg {sum(len(c) for c in chunks) / len(chunks) if chunks else 0:.0f} chars)"
        )
        
        # Add metadata to each chunk
        chunked_data = []
        for idx, chunk_text in enumerate(chunks):
            if not chunk_text.strip():
                continue
            
            # Estimate page range for this chunk
            total_chars = len(content)
            chunk_start_char = content.find(chunk_text)
            chunk_end_char = chunk_start_char + len(chunk_text)
            
            # Estimate pages (assuming ~2000 chars per page)
            chars_per_page = 2000
            start_page = chapter.get('start_page', 1)
            estimated_start = start_page + (chunk_start_char // chars_per_page)
            estimated_end = start_page + (chunk_end_char // chars_per_page)
            
            chunk_data = {
                'content': chunk_text,
                'chapter_number': chapter.get('number'),
                'chapter_title': chapter.get('title', ''),
                'page_start': max(estimated_start, chapter.get('start_page', 1)),
                'page_end': min(estimated_end, chapter.get('end_page', 1)),
                'chunk_index': idx,
                'content_length': len(chunk_text),
                'token_count': self._estimate_tokens(chunk_text),
            }
            
            chunked_data.append(chunk_data)
        
        return chunked_data
    
    def _estimate_tokens(self, text: str) -> int:
        """Rough token estimation: ~4 chars per token"""
        return len(text) // 4

