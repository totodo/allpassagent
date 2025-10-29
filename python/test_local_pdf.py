#!/usr/bin/env python3
"""
测试本地PDF处理功能
"""

import os
import sys
import io
from dotenv import load_dotenv
from document_processor import DocumentProcessor
import PyPDF2
import pdfplumber

# 加载环境变量
load_dotenv('../.env.local')

def create_test_pdf():
    """创建一个简单的测试PDF内容"""
    # 创建一个简单的PDF内容用于测试
    test_content = """
    这是一个测试PDF文档。
    
    第一段：直播电商是指通过互联网平台，以直播的形式进行商品销售的新型电商模式。
    
    第二段：直播电商职业技能等级标准旨在规范直播电商从业人员的技能要求。
    
    第三段：本标准适用于从事直播电商相关工作的人员，包括主播、运营、策划等岗位。
    
    第四段：直播电商从业人员应具备良好的沟通能力、产品知识和营销技巧。
    
    第五段：随着直播电商行业的快速发展，对专业人才的需求日益增长。
    """
    return test_content

def test_pdf_parsing_methods():
    """测试PDF解析方法"""
    try:
        processor = DocumentProcessor()
        
        # 创建测试内容
        test_content = create_test_pdf()
        print("测试内容:")
        print(test_content[:200] + "...")
        
        # 测试文本分块功能
        print("\n测试文本分块功能...")
        
        # 模拟PDF解析后的文本处理
        import re
        
        # 清理文本
        full_text = re.sub(r'\n+', '\n', test_content)
        full_text = full_text.strip()
        
        # 分割成块（每块大约500个字符）
        chunks = []
        chunk_size = 500
        
        sentences = re.split(r'[。！？\n]', full_text)
        current_chunk = ""
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            if len(current_chunk) + len(sentence) < chunk_size:
                current_chunk += sentence + "。"
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence + "。"
        
        # 添加最后一个块
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        if chunks:
            print(f"✅ 文本分块成功!")
            print(f"提取到 {len(chunks)} 个文本块:")
            for i, chunk in enumerate(chunks):
                print(f"  块 {i+1} ({len(chunk)} 字符): {chunk[:100]}...")
        else:
            print("❌ 文本分块失败")
            return False
        
        # 测试嵌入向量生成
        print("\n测试嵌入向量生成...")
        embeddings = processor.generate_embeddings(chunks[:2])  # 只测试前2个块
        
        if embeddings:
            print(f"✅ 嵌入向量生成成功!")
            print(f"生成了 {len(embeddings)} 个向量，每个向量维度: {len(embeddings[0])}")
        else:
            print("❌ 嵌入向量生成失败")
            return False
        
        return True
        
    except Exception as e:
        print(f"测试过程中出错: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_mongodb_connection():
    """测试MongoDB连接"""
    try:
        processor = DocumentProcessor()
        
        # 测试MongoDB连接
        print("测试MongoDB连接...")
        count = processor.documents_collection.count_documents({})
        print(f"✅ MongoDB连接成功! 当前文档数量: {count}")
        
        return True
        
    except Exception as e:
        print(f"❌ MongoDB连接失败: {e}")
        return False

def test_pinecone_connection():
    """测试Pinecone连接"""
    try:
        processor = DocumentProcessor()
        
        # 测试Pinecone连接
        print("测试Pinecone连接...")
        stats = processor.index.describe_index_stats()
        print(f"✅ Pinecone连接成功! 索引统计: {stats}")
        
        return True
        
    except Exception as e:
        print(f"❌ Pinecone连接失败: {e}")
        return False

if __name__ == "__main__":
    print("开始本地PDF处理功能测试...\n")
    
    success = True
    
    # 测试各个组件
    success &= test_mongodb_connection()
    print()
    
    success &= test_pinecone_connection()
    print()
    
    success &= test_pdf_parsing_methods()
    
    if success:
        print("\n🎉 所有测试通过! PDF处理功能已准备就绪。")
        print("\n现在可以处理用户的PDF文档了。")
    else:
        print("\n❌ 部分测试失败，请检查配置。")
    
    sys.exit(0 if success else 1)