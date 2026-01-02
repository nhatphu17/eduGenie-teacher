"""OpenAI Embedding Generator"""
from openai import OpenAI
from typing import List
from loguru import logger
from app.config import settings


class OpenAIEmbedder:
    """Generate embeddings using OpenAI API"""
    
    def __init__(self):
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not set in environment")
        
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_EMBEDDING_MODEL
        self.dimensions = settings.OPENAI_EMBEDDING_DIMENSIONS
    
    async def embed(self, text: str) -> List[float]:
        """
        Generate embedding for a single text
        
        Args:
            text: Text to embed
        
        Returns:
            List of floats (embedding vector)
        """
        try:
            # text-embedding-3-large supports dimensions parameter
            # But check if model supports it first
            params = {
                'model': self.model,
                'input': text,
            }
            
            # Only add dimensions if model supports it (text-embedding-3-*)
            if 'text-embedding-3' in self.model:
                params['dimensions'] = self.dimensions
            
            response = self.client.embeddings.create(**params)
            
            embedding = response.data[0].embedding
            logger.debug(f"Generated embedding: {len(embedding)} dimensions")
            
            return embedding
            
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            raise
    
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts (more efficient)
        
        Args:
            texts: List of texts to embed
        
        Returns:
            List of embedding vectors
        """
        try:
            # OpenAI supports batch embedding
            params = {
                'model': self.model,
                'input': texts,
            }
            
            # Only add dimensions if model supports it (text-embedding-3-*)
            if 'text-embedding-3' in self.model:
                params['dimensions'] = self.dimensions
            
            response = self.client.embeddings.create(**params)
            
            embeddings = [item.embedding for item in response.data]
            logger.info(f"Generated {len(embeddings)} embeddings in batch")
            
            return embeddings
            
        except Exception as e:
            logger.error(f"Error generating batch embeddings: {e}")
            raise

