from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import tempfile
import shutil
from multimedia_processor import MultimediaProcessor
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="多媒体处理API", version="1.0.0")

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js开发服务器
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化多媒体处理器
try:
    multimedia_processor = MultimediaProcessor()
    logger.info("多媒体处理器初始化成功")
except Exception as e:
    logger.error(f"多媒体处理器初始化失败: {str(e)}")
    multimedia_processor = None

# Pydantic模型
class ProcessResponse(BaseModel):
    success: bool
    message: str
    doc_id: Optional[str] = None
    content_count: Optional[int] = None
    file_type: Optional[str] = None
    error: Optional[str] = None

class SearchRequest(BaseModel):
    query: str
    file_types: Optional[List[str]] = None
    top_k: int = 5

class SearchResult(BaseModel):
    score: float
    filename: str
    file_type: str
    content_type: Optional[str] = ""
    content: str
    summary: Optional[str] = ""

class SearchResponse(BaseModel):
    success: bool
    results: List[SearchResult]
    total_count: int
    error: Optional[str] = None

@app.get("/")
async def root():
    return {"message": "多媒体处理API服务正在运行"}

@app.get("/health")
async def health_check():
    """健康检查接口"""
    if multimedia_processor is None:
        raise HTTPException(status_code=503, detail="多媒体处理器未初始化")
    
    return {
        "status": "healthy",
        "supported_types": multimedia_processor.get_supported_types()
    }

@app.post("/upload", response_model=ProcessResponse)
async def upload_multimedia_file(file: UploadFile = File(...)):
    """
    上传并处理多媒体文件
    """
    if multimedia_processor is None:
        raise HTTPException(status_code=503, detail="多媒体处理器未初始化")
    
    try:
        # 检查文件类型
        file_ext = os.path.splitext(file.filename)[1].lower()
        file_type = multimedia_processor.get_file_type(file_ext)
        
        if not file_type:
            return ProcessResponse(
                success=False,
                message="不支持的文件类型",
                error=f"文件类型 {file_ext} 不受支持"
            )
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
            # 保存上传的文件
            shutil.copyfileobj(file.file, temp_file)
            temp_file_path = temp_file.name
        
        try:
            # 处理文件
            result = multimedia_processor.process_multimedia_file(temp_file_path, file.filename)
            
            if result['success']:
                return ProcessResponse(
                    success=True,
                    message="文件处理成功",
                    doc_id=result['doc_id'],
                    content_count=result['content_count'],
                    file_type=result['file_type']
                )   
            else:
                return ProcessResponse(
                    success=False,
                    message="文件处理失败",
                    error=result['error']
                )
                
        finally:
            # 清理临时文件
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
    except Exception as e:
        logger.error(f"上传文件处理出错: {str(e)}")
        return ProcessResponse(
            success=False,
            message="服务器内部错误",
            error=str(e)
        )

@app.post("/search", response_model=SearchResponse)
async def search_multimedia_content(request: SearchRequest):
    """
    搜索多媒体内容
    """
    if multimedia_processor is None:
        raise HTTPException(status_code=503, detail="多媒体处理器未初始化")
    
    try:
        results = multimedia_processor.search_multimedia_content(
            query=request.query,
            file_types=request.file_types,
            top_k=request.top_k
        )
        
        search_results = [
            SearchResult(
                score=result['score'],
                filename=result['filename'],
                file_type=result['file_type'],
                content_type=result['content_type'],
                content=result['content'],
                summary=result['summary']
            )
            for result in results
        ]
        
        return SearchResponse(
            success=True,
            results=search_results,
            total_count=len(search_results)
        )
        
    except Exception as e:
        logger.error(f"搜索多媒体内容出错: {str(e)}")
        return SearchResponse(
            success=False,
            results=[],
            total_count=0,
            error=str(e)
        )

@app.get("/search", response_model=SearchResponse)
async def search_multimedia_content_get(
    query: str = Query(..., description="搜索查询"),
    file_types: Optional[str] = Query(None, description="文件类型，用逗号分隔"),
    top_k: int = Query(5, description="返回结果数量")
):
    """
    GET方式搜索多媒体内容
    """
    file_types_list = None
    if file_types:
        file_types_list = [ft.strip() for ft in file_types.split(',')]
    
    request = SearchRequest(
        query=query,
        file_types=file_types_list,
        top_k=top_k
    )
    
    return await search_multimedia_content(request)

@app.get("/supported-types")
async def get_supported_types():
    """
    获取支持的文件类型
    """
    if multimedia_processor is None:
        raise HTTPException(status_code=503, detail="多媒体处理器未初始化")
    
    return {
        "supported_types": multimedia_processor.get_supported_types(),
        "description": {
            "ppt": "PowerPoint演示文稿，支持文本提取和图片OCR",
            "image": "图片文件，支持OCR文字识别和内容描述",
            "video": "视频文件，支持音频转文字和关键帧提取",
            "audio": "音频文件，支持语音转文字"
        }
    }

@app.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    """
    删除文档及其相关内容
    """
    if multimedia_processor is None:
        raise HTTPException(status_code=503, detail="多媒体处理器未初始化")
    
    try:
        # 从MongoDB删除文档记录
        doc_result = multimedia_processor.collection.delete_one({'_id': doc_id})
        chunks_result = multimedia_processor.chunks_collection.delete_many({'doc_id': doc_id})
        
        # 从Pinecone删除向量（需要实现批量删除逻辑）
        # 这里简化处理，实际应该根据doc_id查询所有相关向量ID并删除
        
        return {
            "success": True,
            "message": f"成功删除文档 {doc_id}",
            "deleted_chunks": chunks_result.deleted_count
        }
        
    except Exception as e:
        logger.error(f"删除文档出错: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除文档失败: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)