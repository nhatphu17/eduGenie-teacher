"""PDF Parser using PyMuPDF"""
import fitz  # PyMuPDF
from typing import Dict, List, Optional
from loguru import logger


class PDFParser:
    """Parse PDF documents and extract structure"""
    
    def __init__(self):
        self.chapter_patterns = [
            r'^CHƯƠNG\s+(\d+)',  # CHƯƠNG 1
            r'^Chương\s+(\d+)',   # Chương 1
            r'^CHƯƠNG\s+(\d+):', # CHƯƠNG 1:
            r'^Chương\s+(\d+):',  # Chương 1:
            r'^CHƯƠNG\s+([IVX]+)',  # CHƯƠNG I, II, III
            r'^BÀI\s+(\d+)',      # BÀI 1
            r'^Bài\s+(\d+)',      # Bài 1
        ]
        import re
        self.chapter_regex = [re.compile(pattern, re.IGNORECASE) for pattern in self.chapter_patterns]
    
    def parse(self, file_path: str) -> Dict:
        """
        Parse PDF and extract:
        - Text content
        - Chapters with page numbers
        - Metadata (title, author, etc.)
        """
        try:
            doc = fitz.open(file_path)
            logger.info(f"Opened PDF: {file_path}, {len(doc)} pages")
            
            # Extract metadata
            metadata = doc.metadata
            title = metadata.get('title', '')
            author = metadata.get('author', '')
            
            # Extract text page by page
            pages_text = []
            for page_num, page in enumerate(doc, start=1):
                text = page.get_text()
                pages_text.append({
                    'page': page_num,
                    'text': text,
                })
            
            # Detect chapters
            chapters = self._detect_chapters(pages_text)
            
            # If no chapters detected, treat entire document as one chapter
            if not chapters:
                logger.warning("No chapters detected, treating as single document")
                full_text = '\n\n'.join([p['text'] for p in pages_text])
                chapters = [{
                    'number': None,
                    'title': title or 'Nội dung chính',
                    'start_page': 1,
                    'end_page': len(pages_text),
                    'content': full_text,
                }]
            
            doc.close()
            
            return {
                'total_pages': len(pages_text),
                'chapters': chapters,
                'metadata': {
                    'title': title,
                    'author': author,
                    'subject': metadata.get('subject', ''),
                    'creator': metadata.get('creator', ''),
                },
                'file_type': 'pdf',
            }
            
        except Exception as e:
            logger.error(f"Error parsing PDF {file_path}: {e}")
            raise
    
    def _detect_chapters(self, pages_text: List[Dict]) -> List[Dict]:
        """Detect chapter headers in PDF pages"""
        chapters = []
        current_chapter = None
        
        for page_data in pages_text:
            page_num = page_data['page']
            text = page_data['text']
            
            # Check first few lines for chapter header
            lines = text.split('\n')[:10]  # Check first 10 lines
            for line in lines:
                line_clean = line.strip()
                if not line_clean:
                    continue
                
                # Try to match chapter patterns
                for regex in self.chapter_regex:
                    match = regex.match(line_clean)
                    if match:
                        chapter_num = match.group(1)
                        
                        # Save previous chapter if exists
                        if current_chapter:
                            current_chapter['end_page'] = page_num - 1
                            chapters.append(current_chapter)
                        
                        # Extract chapter title (next line or same line)
                        title = line_clean
                        if len(lines) > lines.index(line) + 1:
                            next_line = lines[lines.index(line) + 1].strip()
                            if next_line and not any(r.match(next_line) for r in self.chapter_regex):
                                title = f"{line_clean} {next_line}"
                        
                        # Start new chapter
                        current_chapter = {
                            'number': self._parse_chapter_number(chapter_num),
                            'title': title,
                            'start_page': page_num,
                            'end_page': page_num,  # Will be updated
                            'content': '',
                        }
                        break
            
            # Add page text to current chapter
            if current_chapter:
                current_chapter['content'] += '\n\n' + text
            elif chapters:  # If we have chapters but no current, add to last chapter
                if chapters:
                    chapters[-1]['content'] += '\n\n' + text
        
        # Add final chapter
        if current_chapter:
            current_chapter['end_page'] = pages_text[-1]['page']
            chapters.append(current_chapter)
        
        return chapters
    
    def _parse_chapter_number(self, num_str: str) -> Optional[int]:
        """Convert chapter number string to int"""
        try:
            # Try direct conversion
            return int(num_str)
        except ValueError:
            # Handle Roman numerals
            roman_map = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10}
            return roman_map.get(num_str.upper())
        return None


