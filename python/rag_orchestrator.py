import os
import sys
import json
import argparse
import hashlib
import shutil
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Union

# ---- 可选：OpenAI embeddings ----
try:
    from openai import OpenAI
except Exception:
    OpenAI = None

class RAGOrchestrator:
    def __init__(self, config: Dict[str, Any] = None):
        """
        初始化 RAGOrchestrator。
        - config: 包含所有配置的字典，例如 API 密钥、数据库 URI、Pinecone 索引名等。
        """
        if config is None:
            config = {}

        # 初始化解析器 (Parser)
        self.parser = self._get_parser(config.get('parser', 'auto'))

        # 初始化向量化器 (Vectorizer)
        self.vectorizer = self._get_vectorizer(config.get('vectorizer', 'openai'))

        # 初始化存储器 (Storer)
        self.storer = self._get_storer(config.get('storer', 'pinecone'))

        # 初始化检索器 (Retriever)
        self.retriever = self._get_retriever(config.get('retriever', 'pinecone'))

    def _get_parser(self, parser_type: str):
        if parser_type == 'auto' or parser_type == 'raganything':
            return RagAnythingParser()
        else:
            raise ValueError(f"Unsupported parser type: {parser_type}")

    def _get_vectorizer(self, vectorizer_type: str):
        if vectorizer_type == 'openai':
            return OpenAIVectorizer()
        else:
            raise ValueError(f"Unsupported vectorizer type: {vectorizer_type}")

    def _get_storer(self, storer_type: str):
        if storer_type == 'pinecone':
            return PineconeStorer()
        else:
            raise ValueError(f"Unsupported storer type: {storer_type}")

    def _get_retriever(self, retriever_type: str):
        if retriever_type == 'pinecone':
            return PineconeRetriever()
        else:
            raise ValueError(f"Unsupported retriever type: {retriever_type}")

    def process_document(self, source: Union[str, bytes], metadata: Dict[str, Any]) -> str:
        """
        处理单个文档的主流程。
        1. 使用解析器从 source 提取内容。
        2. 使用分块器将内容分割成块。
        3. 使用向量化器为每个块生成嵌入向量。
        4. 使用存储器将块和向量保存到数据库。
        返回一个唯一的文档 ID。
        """
        # 1. 解析
        content_blocks = self.parser.parse(source, metadata)

        # 2. 分块 (暂时省略，假设解析器已完成分块)
        chunks = content_blocks # self.chunker.chunk(content_blocks)

        # 3. 向量化
        vectors = self.vectorizer.vectorize(chunks)

        # 4. 存储
        doc_id = self.storer.store(chunks, vectors, metadata)

        return doc_id

    def retrieve(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        根据查询检索相关文档块。
        1. 使用向量化器为查询生成嵌入向量。
        2. 使用检索器从数据库中查找最相似的 top_k 个块。
        返回检索到的块列表。
        """
        query_vector = self.vectorizer.vectorize_query(query)
        results = self.retriever.retrieve(query_vector, top_k)
        return results

# --- 子组件接口 (待实现) ---

class Parser:
    def parse(self, source: Union[str, bytes], metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        raise NotImplementedError

class RagAnythingParser(Parser):
    def __init__(self, parser_preference: List[str] = None):
        if parser_preference is None:
            self.parser_preference = self._get_available_parsers()
        else:
            self.parser_preference = parser_preference

    def _get_available_parsers(self) -> List[str]:
        parsers = []
        # RAGAnything Python 包
        try:
            import raganything  # noqa
            parsers.append('raganything')
        except Exception:
            pass
        # MinerU CLI
        if shutil.which('mineru'):
            parsers.append('mineru')
        return parsers

    def parse(self, source: Union[str, bytes], metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        file_path = str(source) # 假设 source 是文件路径
        for parser_type in self.parser_preference:
            try:
                if parser_type == 'raganything':
                    return self._parse_with_raganything(file_path)
                elif parser_type == 'mineru':
                    return self._parse_with_mineru(file_path)
            except Exception as e:
                print(f"Parser {parser_type} failed: {e}")
        raise RuntimeError("All available parsers failed.")

    def _parse_with_raganything(self, file_path: str) -> List[Dict[str, Any]]:
        """尝试使用RAGAnything Python API解析。若API不可用或报错，抛出异常。"""
        try:
            # 注：具体API根据RAGAnything版本可能差异，此处采用兼容性写法
            # 参考项目中multimedia_processor的实现
            from raganything.core.modal_processors import ModalProcessors
            modal_processors = ModalProcessors()
            ext = Path(file_path).suffix.lower()
            if ext == '.pdf':
                result = modal_processors.process_pdf(file_path)
            elif ext in {'.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'}:
                result = modal_processors.process_office_document(file_path)
            elif ext in {'.html', '.htm'}:
                result = modal_processors.process_html(file_path)
            elif ext in {'.md', '.markdown'}:
                result = modal_processors.process_markdown(file_path)
            elif ext == '.txt':
                result = modal_processors.process_text(file_path)
            else:
                raise ValueError(f"RAGAnything不支持的文件类型: {ext}")
            # 标准化
            content_data: List[Dict[str, Any]] = []
            if isinstance(result, dict) and 'content' in result:
                content_list = result['content']
            elif isinstance(result, list):
                content_list = result
            else:
                content_list = [result]
            for idx, item in enumerate(content_list):
                if isinstance(item, dict):
                    block_type = item.get('type', 'text')
                    page_number = item.get('page_number') or item.get('page_idx')
                    text_content = item.get('content') or item.get('text') or str(item)
                    bbox = item.get('bbox')
                else:
                    block_type = 'text'
                    page_number = None
                    text_content = str(item)
                    bbox = None
                if text_content and str(text_content).strip():
                    content_data.append({
                        'type': block_type,
                        'page_number': page_number,
                        'text_content': str(text_content),
                        'bbox': bbox,
                        'source': 'raganything',
                        'index': idx
                    })
            return content_data
        except ImportError as e:
            raise RuntimeError(f"RAGAnything未安装或API不可用: {e}")
        except Exception as e:
            raise RuntimeError(f"RAGAnything解析失败: {e}")

    def _parse_with_mineru(self, file_path: str) -> List[Dict[str, Any]]:
        content_data: List[Dict[str, Any]] = []
        with tempfile.TemporaryDirectory() as tmpdir:
            cmd = ['mineru', '-p', file_path, '-o', tmpdir, '-m', 'auto']
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                raise RuntimeError(f"MinerU解析失败: {result.stderr}")
            # 查找输出
            content_json_path = None
            for root, _, files in os.walk(tmpdir):
                for f in files:
                    if f == 'content_list.json':
                        content_json_path = os.path.join(root, f)
                        break
                if content_json_path:
                    break
            if not content_json_path:
                raise FileNotFoundError('未找到 MinerU 输出的 content_list.json')
            with open(content_json_path, 'r', encoding='utf-8') as jf:
                content_list = json.load(jf)
            for idx, item in enumerate(content_list):
                block_type = item.get('type', 'text')
                page_idx = item.get('page_idx')
                page_number = (page_idx + 1) if isinstance(page_idx, int) else None
                text_content = item.get('content') or ''
                bbox = item.get('bbox')
                if block_type in ['text', 'table', 'equation'] and text_content.strip():
                    content_data.append({
                        'type': block_type,
                        'page_number': page_number,
                        'text_content': text_content,
                        'bbox': bbox,
                        'source': 'mineru',
                        'index': idx
                    })
        return content_data

class Chunker:
    def chunk(self, content: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        raise NotImplementedError

class Vectorizer:
    def vectorize(self, chunks: List[Dict[str, Any]]) -> List[List[float]]:
        raise NotImplementedError
    
    def vectorize_query(self, query: str) -> List[float]:
        raise NotImplementedError

class OpenAIVectorizer(Vectorizer):
    def __init__(self, model: str = 'text-embedding-3-small'):
        if not OpenAI:
            raise RuntimeError('openai 库不可用，无法生成嵌入。请安装 openai 并设置API密钥。')
        api_key = os.getenv('OPENAI_API_KEY') or os.getenv('SILICONFLOW_API_KEY')
        if not api_key:
            raise RuntimeError('未检测到 OPENAI_API_KEY 或 SILICONFLOW_API_KEY 环境变量。')
        self.client = OpenAI(api_key=api_key)
        self.model = model

    def vectorize(self, chunks: List[Dict[str, Any]]) -> List[List[float]]:
        texts = [self._build_embedding_text(chunk) for chunk in chunks]
        response = self.client.embeddings.create(input=texts, model=self.model)
        return [embedding.embedding for embedding in response.data]

    def vectorize_query(self, query: str) -> List[float]:
        response = self.client.embeddings.create(input=[query], model=self.model)
        return response.data[0].embedding

    def _build_embedding_text(self, block: Dict[str, Any]) -> str:
        t = block.get('text_content') or ''
        t = self._preprocess_text(t)
        page = block.get('page_number')
        prefix = f"[Page {page}] " if page else ""
        return prefix + t

    def _preprocess_text(self, text: str) -> str:
        text = (text or '').replace('\r', ' ').replace('\n', ' ').strip()
        text = ' '.join(text.split())
        if len(text) > 8000:
            text = text[:8000]
        return text

class Storer:
    def store(self, chunks: List[Dict[str, Any]], vectors: List[List[float]], doc_metadata: Dict[str, Any]):
        raise NotImplementedError

class PineconeStorer(Storer):
    def __init__(self):
        from pinecone import Pinecone
        self.pinecone = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))
        self.index = self.pinecone.Index(os.getenv('PINECONE_INDEX_NAME'))
        
        from pymongo import MongoClient
        self.mongo_client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
        self.db = self.mongo_client['allpassagent']
        self.collection = self.db['multimedia_docs']
        self.chunks_collection = self.db['multimedia_chunks']

    def store(self, chunks: List[Dict[str, Any]], vectors: List[List[float]], doc_metadata: Dict[str, Any]):
        # 1. 在 MongoDB 中创建主文档记录
        doc_record = self.collection.insert_one({
            'filename': doc_metadata.get('filename'),
            'file_type': doc_metadata.get('file_type'),
            'status': 'processing',
            'created_at': datetime.now(),
            'chunk_count': len(chunks)
        })
        doc_id = str(doc_record.inserted_id)

        # 2. 准备并存储块数据
        pinecone_vectors = []
        for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
            chunk_id = f"{doc_id}_{i}"
            
            # 存储到 MongoDB
            chunk_data = {
                'doc_id': doc_id,
                'chunk_id': chunk_id,
                'text_content': chunk.get('text_content'),
                'page_number': chunk.get('page_number'),
                'type': chunk.get('type'),
                'source': chunk.get('source'),
            }
            self.chunks_collection.insert_one(chunk_data)

            # 准备 Pinecone 向量
            pinecone_vectors.append({
                'id': chunk_id,
                'values': vector,
                'metadata': {
                    'doc_id': doc_id,
                    'filename': doc_metadata.get('filename'),
                    'text': (chunk.get('text_content') or '')[:400] # 截断以避免元数据过大
                }
            })

        # 3. 批量上传到 Pinecone
        if pinecone_vectors:
            self.index.upsert(vectors=pinecone_vectors)
            
        # 4. 更新主文档状态
        self.collection.update_one(
            {'_id': doc_record.inserted_id},
            {'$set': {'status': 'completed', 'processed_at': datetime.now()}}
        )
        
        return doc_id

class Retriever:
    def retrieve(self, query_vector: List[float], top_k: int) -> List[Dict[str, Any]]:
        raise NotImplementedError

class PineconeRetriever(Retriever):
    def __init__(self):
        from pinecone import Pinecone
        self.pinecone = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))
        self.index = self.pinecone.Index(os.getenv('PINECONE_INDEX_NAME'))
        
        from pymongo import MongoClient
        self.mongo_client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
        self.db = self.mongo_client['allpassagent']
        self.chunks_collection = self.db['multimedia_chunks']

    def retrieve(self, query_vector: List[float], top_k: int) -> List[Dict[str, Any]]:
        # 1. 从 Pinecone 检索
        results = self.index.query(
            vector=query_vector,
            top_k=top_k,
            include_metadata=True
        )

        # 2. 从 MongoDB 获取完整的块内容
        chunk_ids = [match['id'] for match in results['matches']]
        retrieved_chunks = []
        if chunk_ids:
            mongo_results = self.chunks_collection.find({'chunk_id': {'$in': chunk_ids}})
            
            # 为了保持 Pinecone 的排序
            mongo_chunks_map = {chunk['chunk_id']: chunk for chunk in mongo_results}
            
            for match in results['matches']:
                chunk_id = match['id']
                if chunk_id in mongo_chunks_map:
                    chunk_data = mongo_chunks_map[chunk_id]
                    chunk_data['score'] = match['score']
                    retrieved_chunks.append(chunk_data)
                    
        return retrieved_chunks