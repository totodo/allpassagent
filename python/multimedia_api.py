from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import tempfile
import shutil
from datetime import datetime
from multimedia_processor import MultimediaProcessor
import logging
from fastapi.responses import JSONResponse
import json
from bson import ObjectId
from bson.errors import InvalidId

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

@app.get("/openapi.json", include_in_schema=False)
async def get_openapi_schema():
    with open("openapi.json") as f:
        return JSONResponse(json.load(f))

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

    temp_file_path = None
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
            shutil.copyfileobj(file.file, temp_file)
            temp_file_path = temp_file.name

        # 1. 创建文档记录并获取doc_id
        doc_id = multimedia_processor.create_document_record(file.filename, temp_file_path, file_type)

        # 2. 根据文件类型调用不同的处理方法
        content_data = []
        if file_type == 'video':
            content_data = multimedia_processor.process_video(temp_file_path)
        elif file_type == 'image':
            content_data = multimedia_processor.process_image(temp_file_path)
        elif file_type == 'audio':
            content_data = multimedia_processor.process_audio(temp_file_path)
        elif file_type == 'ppt':
            content_data = multimedia_processor.process_ppt(temp_file_path, doc_id)
        elif file_type in ['document', 'pdf', 'word', 'excel', 'text', 'markdown', 'html']:
            content_data = multimedia_processor.process_document_with_raganything(temp_file_path)
        else:
            # 作为备用，对于未明确处理的类型，也尝试通用文档解析
            logger.warning(f"未找到针对 '{file_type}' 的特定处理器，将使用通用文档解析器。")
            content_data = multimedia_processor.process_document_with_raganything(temp_file_path)

        if not content_data:
            # 如果没有提取到内容，也更新文档状态
            multimedia_processor.collection.update_one(
                {'_id': doc_id},
                {'$set': {'status': 'failed', 'error': '未能从文件中提取任何内容', 'updatedAt': datetime.now()}}
            )
            return ProcessResponse(
                success=False,
                message="未能从文件中提取任何内容。",
                doc_id=str(doc_id)
            )

        # 3. 存储提取的内容
        multimedia_processor.store_multimedia_content(
            doc_id=doc_id,
            filename=file.filename,
            content_data=content_data,
            file_type=file_type
        )
        
        # 4. 更新文档状态为成功
        multimedia_processor.collection.update_one(
            {'_id': doc_id},
            {'$set': {'status': 'completed', 'updatedAt': datetime.now()}}
        )

        return ProcessResponse(
            success=True,
            message="文件处理成功",
            doc_id=str(doc_id),
            content_count=len(content_data),
            file_type=file_type
        )

    except Exception as e:
        logger.error(f"上传文件处理出错: {str(e)}")
        # 如果发生异常，也尝试更新文档状态
        doc_id_val = locals().get('doc_id')
        if doc_id_val:
            multimedia_processor.collection.update_one(
                {'_id': doc_id_val},
                {'$set': {'status': 'failed', 'error': str(e), 'updatedAt': datetime.now()}}
            )
        return ProcessResponse(
            success=False,
            message="服务器内部错误",
            doc_id=str(doc_id_val) if doc_id_val else None,
            error=str(e)
        )
    finally:
        # 清理临时文件
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

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
                score=result.get('score', 0.0),
                filename=result.get('metadata', {}).get('filename', ''),
                file_type=result.get('metadata', {}).get('file_type', ''),
                content_type=result.get('metadata', {}).get('content_type', ''),
                content=result.get('metadata', {}).get('text', ''),
                summary=result.get('metadata', {}).get('summary', '')
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

@app.get("/documents")
async def get_all_documents():
    """
    获取所有文档的列表
    """
    if multimedia_processor is None:
        raise HTTPException(status_code=503, detail="多媒体处理器未初始化")
    
    try:
        documents = list(multimedia_processor.collection.find({}).sort("uploadedAt", -1))
        
        for doc in documents:
            doc["_id"] = str(doc["_id"])
            
        return {
            "success": True,
            "documents": documents
        }
    except Exception as e:
        logger.error(f"获取文档列表出错: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取文档列表失败: {str(e)}")

@app.delete("/documents")
async def delete_document(doc_id: str = Query(..., description="要删除的文档ID")):
    """
    删除文档及其相关内容
    """
    if multimedia_processor is None:
        raise HTTPException(status_code=503, detail="多媒体处理器未初始化")
    
    try:
        # 验证doc_id是否为有效的ObjectId
        try:
            obj_id = ObjectId(doc_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail=f"无效的文档ID格式: {doc_id}")

        # 从MongoDB删除文档记录
        doc_result = multimedia_processor.collection.delete_one({'_id': obj_id})
        
        if doc_result.deleted_count == 0:
            raise HTTPException(status_code=404, detail=f"未找到文档 {doc_id}")

        chunks_result = multimedia_processor.chunks_collection.delete_many({'doc_id': doc_id})
        
        # Pinecone中的向量将通过doc_id进行元数据过滤，无需手动删除
        
        return {
            "success": True,
            "message": f"成功删除文档 {doc_id}",
            "deleted_chunks": chunks_result.deleted_count
        }
        
    except Exception as e:
        logger.error(f"删除文档出错: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除文档失败: {str(e)}")

if __name__ == "__main__":
    if multimedia_processor is None:
        logger.error("多媒体处理器初始化失败，FastAPI应用无法启动。")
    else:
        import uvicorn
        uvicorn.run(app, host="0.0.0.0", port=8001)