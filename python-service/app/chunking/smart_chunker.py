"""Smart chunking with context preservation"""
from typing import Dict, List
from loguru import logger
import re


class SmartChunker:
    """Intelligent text chunking that preserves structure"""
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        """
        Args:
            chunk_size: Target chunk size in tokens (~3x in characters)
            chunk_overlap: Overlap between chunks in tokens
        """
        self.chunk_size = chunk_size * 3  # Convert tokens to chars (rough estimate)
        self.chunk_overlap = chunk_overlap * 3
        self.separators = ["\n\n\n", "\n\n", "\n", ". ", " ", ""]
    
    def _split_text(self, text: str) -> List[str]:
        """
        Recursive text splitting similar to LangChain's RecursiveCharacterTextSplitter
        """
        chunks = []
        
        # Try splitting by each separator
        for separator in self.separators:
            if separator == "":
                # Last resort: split by character
                if len(text) <= self.chunk_size:
                    chunks.append(text)
                    return chunks
                
                # Split into chunks with overlap
                start = 0
                while start < len(text):
                    end = min(start + self.chunk_size, len(text))
                    chunk = text[start:end]
                    if chunk.strip():
                        chunks.append(chunk)
                    start = end - self.chunk_overlap
                    if start >= end:
                        break
                return chunks
            
            # Try splitting by this separator
            parts = text.split(separator)
            
            # If splitting produces reasonable chunks, use them
            if len(parts) > 1:
                current_chunk = ""
                for part in parts:
                    part_with_sep = part + separator if part != parts[-1] else part
                    
                    # If adding this part would exceed chunk size
                    if len(current_chunk) + len(part_with_sep) > self.chunk_size and current_chunk:
                        # Save current chunk
                        chunks.append(current_chunk)
                        # Start new chunk with overlap
                        if self.chunk_overlap > 0 and len(current_chunk) > self.chunk_overlap:
                            overlap_text = current_chunk[-self.chunk_overlap:]
                            current_chunk = overlap_text + part_with_sep
                        else:
                            current_chunk = part_with_sep
                    else:
                        current_chunk += part_with_sep
                
                # Add remaining chunk
                if current_chunk.strip():
                    chunks.append(current_chunk)
                
                # If we got reasonable chunks, return them
                if chunks and all(len(c) <= self.chunk_size * 1.5 for c in chunks):
                    return chunks
        
        # Fallback: simple splitting
        if not chunks:
            start = 0
            while start < len(text):
                end = min(start + self.chunk_size, len(text))
                chunk = text[start:end]
                if chunk.strip():
                    chunks.append(chunk)
                start = end - self.chunk_overlap
                if start >= end:
                    break
        
        return chunks
    
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
        
        # Split into chunks using our custom splitter
        chunks = self._split_text(content)
        
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

