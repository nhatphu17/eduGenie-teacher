"""FastAPI application"""
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from loguru import logger
import os
import uuid
import aiofiles
from app.config import settings
from app.services.document_processor import DocumentProcessor

# Configure logging
logger.add("logs/app.log", rotation="10 MB", level=settings.LOG_LEVEL)

app = FastAPI(
    title="EduGenie Document Processing Service",
    description="Python service for document parsing, chunking, and embedding generation",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize processor
processor = DocumentProcessor()


@app.get("/")
async def root():
    """Health check"""
    return {
        "service": "EduGenie Document Processing",
        "status": "running",
        "version": "1.0.0",
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.post("/api/v1/process")
async def process_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    document_id: str = Form(...),
    subject_id: str = Form(...),
    document_type: str = Form(...),
    user_id: Optional[str] = Form(None),
    original_filename: Optional[str] = Form(None),
):
    """
    Process a document: parse, chunk, generate embeddings, save to DB
    
    This endpoint accepts a file upload and processes it asynchronously.
    """
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Check file size
    file_content = await file.read()
    if len(file_content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size: {settings.MAX_FILE_SIZE / 1024 / 1024}MB",
        )
    
    # Save file temporarily
    os.makedirs(settings.TEMP_DIR, exist_ok=True)
    temp_file_path = os.path.join(settings.TEMP_DIR, f"{uuid.uuid4()}_{file.filename}")
    
    async with aiofiles.open(temp_file_path, 'wb') as f:
        await f.write(file_content)
    
    logger.info(
        f"📥 [API] Received file: {file.filename}, size: {len(file_content)} bytes"
    )
    logger.info(
        f"📋 [API] Document ID: {document_id}, Subject ID: {subject_id}, Type: {document_type}"
    )
    logger.info(f"💾 [API] Saved temp file: {temp_file_path}")
    
    # Process in background
    logger.info(f"🔄 [API] Queuing background task for document {document_id}")
    background_tasks.add_task(
        _process_document_task,
        temp_file_path,
        document_id,
        subject_id,
        document_type,
        user_id,
        original_filename or file.filename,
    )
    
    logger.info(f"✅ [API] Document {document_id} queued successfully")
    
    return {
        "status": "queued",
        "document_id": document_id,
        "message": "Document queued for processing",
    }


async def _process_document_task(
    file_path: str,
    document_id: str,
    subject_id: str,
    document_type: str,
    user_id: Optional[str],
    original_filename: str,
):
    """Background task for processing document"""
    logger.info(f"🚀 [BACKGROUND TASK] Starting processing for document {document_id}")
    logger.info(f"📄 File: {original_filename}, Path: {file_path}")
    logger.info(f"📋 Subject ID: {subject_id}, Type: {document_type}, User: {user_id}")
    
    try:
        result = await processor.process_document(
            file_path=file_path,
            document_id=document_id,
            subject_id=subject_id,
            document_type=document_type,
            user_id=user_id,
            original_filename=original_filename,
        )
        logger.info(f"✅ [BACKGROUND TASK] Successfully completed: {result}")
    except Exception as e:
        logger.error(f"❌ [BACKGROUND TASK] Processing failed for document {document_id}: {e}")
        logger.exception(e)  # Full stack trace
    finally:
        # Clean up temp file
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"🧹 [BACKGROUND TASK] Cleaned up temp file: {file_path}")


@app.post("/api/v1/process-sync")
async def process_document_sync(
    file: UploadFile = File(...),
    document_id: str = Form(...),
    subject_id: str = Form(...),
    document_type: str = Form(...),
    user_id: Optional[str] = Form(None),
    original_filename: Optional[str] = Form(None),
):
    """
    Process document synchronously (for testing)
    """
    # Save file temporarily
    os.makedirs(settings.TEMP_DIR, exist_ok=True)
    temp_file_path = os.path.join(settings.TEMP_DIR, f"{uuid.uuid4()}_{file.filename}")
    
    file_content = await file.read()
    async with aiofiles.open(temp_file_path, 'wb') as f:
        await f.write(file_content)
    
    try:
        result = await processor.process_document(
            file_path=temp_file_path,
            document_id=document_id,
            subject_id=subject_id,
            document_type=document_type,
            user_id=user_id,
            original_filename=original_filename or file.filename,
        )
        return result
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True,
    )

