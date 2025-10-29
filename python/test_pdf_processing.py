#!/usr/bin/env python3
"""
测试PDF处理功能
"""

import os
import sys
from dotenv import load_dotenv
from document_processor import DocumentProcessor

# 加载环境变量
load_dotenv('../.env.local')

def test_pdf_processing():
    """测试PDF处理功能"""
    try:
        processor = DocumentProcessor()
        
        # 测试PDF URL（使用一个公开的PDF文件）
        test_pdf_url = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
        
        print("开始测试PDF处理功能...")
        print(f"测试URL: {test_pdf_url}")
        
        # 测试PDF解析
        chunks = processor.download_and_parse_pdf(test_pdf_url)
        
        if chunks:
            print(f"✅ PDF解析成功!")
            print(f"提取到 {len(chunks)} 个文本块:")
            for i, chunk in enumerate(chunks[:3]):  # 只显示前3个块
                print(f"  块 {i+1}: {chunk[:100]}...")
        else:
            print("❌ PDF解析失败，未提取到文本块")
            return False
        
        # 测试完整的文档处理流程
        print("\n开始测试完整的文档处理流程...")
        result = processor.process_url_document(test_pdf_url, "test_document.pdf")
        
        if 'error' in result:
            print(f"❌ 文档处理失败: {result['error']}")
            return False
        else:
            print("✅ 文档处理成功!")
            print(f"文档ID: {result.get('document_id', 'N/A')}")
            print(f"处理的块数: {result.get('processed_chunks', 'N/A')}")
            print(f"向量化状态: {result.get('vectorized', 'N/A')}")
        
        return True
        
    except Exception as e:
        print(f"测试过程中出错: {e}")
        return False

if __name__ == "__main__":
    success = test_pdf_processing()
    if success:
        print("\n🎉 PDF处理功能测试通过!")
    else:
        print("\n❌ PDF处理功能测试失败!")
    
    sys.exit(0 if success else 1)