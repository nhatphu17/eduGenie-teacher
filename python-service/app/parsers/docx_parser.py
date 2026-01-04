"""DOCX Parser using python-docx"""
from docx import Document
from typing import Dict, List, Optional
from loguru import logger
import re


class DOCXParser:
    """Parse DOCX documents and extract structure"""
    
    def __init__(self):
        self.chapter_patterns = [
            r'^CHƯƠNG\s+(\d+)',
            r'^Chương\s+(\d+)',
            r'^CHƯƠNG\s+(\d+):',
            r'^Chương\s+(\d+):',
            r'^BÀI\s+(\d+)',
            r'^Bài\s+(\d+)',
        ]
        self.chapter_regex = [re.compile(pattern, re.IGNORECASE) for pattern in self.chapter_patterns]
    
    def parse(self, file_path: str) -> Dict:
        """Parse DOCX and extract chapters"""
        try:
            doc = Document(file_path)
            logger.info(f"Opened DOCX: {file_path}")
            
            # Extract metadata
            core_props = doc.core_properties
            metadata = {
                'title': core_props.title or '',
                'author': core_props.author or '',
                'subject': core_props.subject or '',
                'created': str(core_props.created) if core_props.created else '',
            }
            
            # Extract paragraphs
            paragraphs = []
            for para in doc.paragraphs:
                text = para.text.strip()
                if text:
                    paragraphs.append({
                        'text': text,
                        'style': para.style.name if para.style else None,
                    })
            
            # Detect chapters
            chapters = self._detect_chapters(paragraphs)
            
            # If no chapters, treat as single document
            if not chapters:
                logger.warning("No chapters detected in DOCX")
                full_text = '\n\n'.join([p['text'] for p in paragraphs])
                chapters = [{
                    'number': None,
                    'title': metadata.get('title', 'Nội dung chính'),
                    'start_page': 1,
                    'end_page': 1,
                    'content': full_text,
                }]
            
            return {
                'total_pages': len(paragraphs) // 30,  # Estimate: ~30 paragraphs per page
                'chapters': chapters,
                'metadata': metadata,
                'file_type': 'docx',
            }
            
        except Exception as e:
            logger.error(f"Error parsing DOCX {file_path}: {e}")
            raise
    
    def _detect_chapters(self, paragraphs: List[Dict]) -> List[Dict]:
        """Detect chapter headers in DOCX paragraphs"""
        chapters = []
        current_chapter = None
        
        for idx, para in enumerate(paragraphs):
            text = para['text']
            style = para.get('style', '')
            
            # Check if this looks like a chapter header
            is_header = (
                style and ('Heading' in style or 'Title' in style)
            ) or any(regex.match(text) for regex in self.chapter_regex)
            
            if is_header:
                # Try to match chapter pattern
                for regex in self.chapter_regex:
                    match = regex.match(text)
                    if match:
                        chapter_num = match.group(1)
                        
                        # Save previous chapter
                        if current_chapter:
                            chapters.append(current_chapter)
                        
                        # Start new chapter
                        current_chapter = {
                            'number': self._parse_chapter_number(chapter_num),
                            'title': text,
                            'start_page': len(chapters) + 1,  # Estimate
                            'end_page': len(chapters) + 1,
                            'content': '',
                        }
                        break
            
            # Add paragraph to current chapter
            if current_chapter:
                current_chapter['content'] += '\n\n' + text
                current_chapter['end_page'] = len(chapters) + 1
            elif chapters:  # Add to last chapter if exists
                if chapters:
                    chapters[-1]['content'] += '\n\n' + text
        
        # Add final chapter
        if current_chapter:
            chapters.append(current_chapter)
        
        return chapters
    
    def _parse_chapter_number(self, num_str: str) -> Optional[int]:
        """Convert chapter number to int"""
        try:
            return int(num_str)
        except ValueError:
            return None


