#!/usr/bin/env python3
"""
重新处理现有的PDF文档，为其生成chunks和向量
"""

import os
import sys
from dotenv import load_dotenv
from document_processor import DocumentProcessor

# 加载环境变量
load_dotenv('../.env.local')

def reprocess_pdf_documents():
    """重新处理所有缺少chunks的PDF文档"""
    try:
        processor = DocumentProcessor()
        
        # 查找所有缺少chunks字段的PDF文档
        pdf_docs = processor.documents_collection.find({
            'filename': {'$regex': r'\.pdf$', '$options': 'i'},
            '$or': [
                {'chunks': {'$exists': False}},
                {'chunks': {'$size': 0}}
            ]
        })
        
        pdf_docs_list = list(pdf_docs)
        print(f"找到 {len(pdf_docs_list)} 个需要重新处理的PDF文档")
        
        for doc in pdf_docs_list:
            print(f"\n正在处理: {doc['filename']}")
            
            # 获取文件URL
            file_url = doc.get('fileUrl')
            if not file_url:
                print(f"  错误: 文档 {doc['filename']} 缺少fileUrl")
                continue
            
            # 使用新的PDF处理方法
            chunks = processor.download_and_parse_pdf(file_url)
            
            if chunks:
                print(f"  成功提取 {len(chunks)} 个文本块")
                
                # 更新MongoDB中的文档记录
                processor.documents_collection.update_one(
                    {'_id': doc['_id']},
                    {
                        '$set': {
                            'chunks': chunks,
                            'chunkCount': len(chunks),
                            'fileType': 'pdf',
                            'processed': False,  # 标记为未处理，以便后续生成向量
                            'vectorized': False
                        }
                    }
                )
                
                print(f"  已更新MongoDB记录")
                
                # 现在处理文档以生成向量
                document_id = str(doc['_id'])
                result = processor.process_document(document_id)
                
                if 'error' in result:
                    print(f"  向量化失败: {result['error']}")
                else:
                    print(f"  向量化成功: 已处理 {result.get('processed_chunks', 0)} 个块")
                    
            else:
                print(f"  错误: 无法从PDF中提取文本")
        
        print(f"\n重新处理完成!")
        
    except Exception as e:
        print(f"重新处理过程中出错: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = reprocess_pdf_documents()
    sys.exit(0 if success else 1)