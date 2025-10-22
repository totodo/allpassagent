#!/usr/bin/env python3
"""
RAGAnything集成测试脚本
测试多种文档类型的解析和向量化处理
"""

import os
import sys
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

# 添加项目路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from multimedia_processor import MultimediaProcessor


class TestRAGAnythingIntegration(unittest.TestCase):
    """RAGAnything集成测试类"""
    
    def setUp(self):
        """测试初始化"""
        # 设置测试环境变量
        os.environ['SILICONFLOW_API_KEY'] = 'test_key'
        
        # 模拟依赖
        from unittest.mock import patch
        with patch('multimedia_processor.Pinecone'), \
             patch('multimedia_processor.MongoClient'), \
             patch('openai.OpenAI'):
            
            self.processor = MultimediaProcessor()
            
        # 模拟向量数据库
        self.processor.index = Mock()
        self.processor.vectors_collection = Mock()
    
    def test_file_type_detection(self):
        """测试文件类型检测"""
        test_cases = [
            ('document.pdf', 'document'),
            ('presentation.pptx', 'ppt'),
            ('image.jpg', 'image'),
            ('video.mp4', 'video'),
            ('audio.wav', 'audio'),
            ('unknown.xyz', 'unknown')
        ]
        
        for filename, expected_type in test_cases:
            with self.subTest(filename=filename):
                # 提取文件扩展名
                ext = '.' + filename.split('.')[-1] if '.' in filename else filename
                file_type = self.processor.get_file_type(ext)
                # 对于unknown类型，期望返回None
                if expected_type == 'unknown':
                    expected_type = None
                self.assertEqual(file_type, expected_type)
    
    def test_document_type_support(self):
        """测试文档类型支持"""
        document_extensions = [
            '.pdf', '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls',
            '.md', '.txt', '.html', '.htm', '.epub', '.rtf', '.odt'
        ]
        
        for ext in document_extensions:
            with self.subTest(extension=ext):
                file_type = self.processor.get_file_type(ext)
                # PPT文件应该返回'ppt'类型
                if ext in ['.ppt', '.pptx']:
                    self.assertEqual(file_type, 'ppt')
                else:
                    self.assertEqual(file_type, 'document')
    
    def test_parser_availability_detection(self):
        """测试解析器可用性检测"""
        # 测试MinerU CLI检测
        with patch('shutil.which', return_value='/usr/bin/mineru'):
            parsers = self.processor._get_available_parsers()
            self.assertIn('mineru', parsers)
        
        # 测试RAGAnything包检测
        with patch('builtins.__import__', side_effect=lambda name, *args: Mock() if name == 'raganything' else __import__(name, *args)):
            parsers = self.processor._get_available_parsers()
            self.assertIn('raganything', parsers)
    
    def test_text_preprocessing(self):
        """测试文本预处理"""
        test_cases = [
            # (输入文本, 期望结果特征)
            ("  多余的   空格  ", "多余的 空格"),  # 空格规范化
            ("包含\x00控制字符", "包含控制字符"),  # 控制字符移除
            ("a" * 1500, 1000),  # 长度限制（检查长度）
            ("", ""),  # 空文本处理
        ]
        
        for input_text, expected in test_cases:
            with self.subTest(input_text=input_text[:20] + "..."):
                result = self.processor._preprocess_text_for_embedding(input_text)
                
                if isinstance(expected, str):
                    self.assertEqual(result, expected)
                elif isinstance(expected, int):
                    self.assertLessEqual(len(result), expected)
    
    def test_enhanced_metadata_creation(self):
        """测试增强元数据创建"""
        # 测试文档内容元数据
        document_content = {
            'type': 'table',
            'text_content': 'Table data',
            'page_number': 5,
            'bbox': [100, 200, 300, 400]
        }
        
        metadata = self.processor._create_enhanced_metadata(
            document_content, 'document', 'test.pdf'
        )
        
        self.assertEqual(metadata['file_type'], 'document')
        self.assertEqual(metadata['content_type'], 'table')
        self.assertEqual(metadata['page'], 5)
        self.assertEqual(metadata['page_type'], 'page')
        self.assertTrue(metadata['is_table'])
        self.assertTrue(metadata['has_bbox'])
    
    def test_embedding_text_building(self):
        """测试向量化文本构建"""
        # 测试文档内容
        document_content = {
            'type': 'text',
            'text_content': '这是一段测试文本',
            'page_number': 3
        }
        
        result = self.processor.build_text_for_embedding(document_content, 'document')
        self.assertIn('[第3页]', result)
        self.assertIn('这是一段测试文本', result)
        
        # 测试表格内容
        table_content = {
            'type': 'table',
            'text_content': '<table><tr><td>数据</td></tr></table>',
            'page_number': 2
        }
        
        result = self.processor.build_text_for_embedding(table_content, 'document')
        self.assertIn('[HTML表格]', result)
        self.assertIn('[第2页]', result)
        
        # 测试公式内容
        equation_content = {
            'type': 'equation',
            'text_content': '\\sum_{i=1}^{n} x_i',
            'page_number': 1
        }
        
        result = self.processor.build_text_for_embedding(equation_content, 'document')
        self.assertIn('[LaTeX公式]', result)
        self.assertIn('[第1页]', result)
    
    @patch('multimedia_processor.subprocess.run')
    def test_mineru_cli_parsing(self, mock_subprocess):
        """测试MinerU CLI解析"""
        # 模拟成功的CLI调用
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = ""
        mock_subprocess.return_value = mock_result
        
        # 模拟输出文件
        test_output = {
            "pages": [
                {
                    "page_number": 1,
                    "blocks": [
                        {
                            "type": "text",
                            "text": "测试文本内容",
                            "bbox": [100, 200, 300, 400]
                        }
                    ]
                }
            ]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(test_output, f)
            output_file = f.name
        
        try:
            with patch('tempfile.mkdtemp', return_value='/tmp/test'), \
                 patch('os.path.exists', return_value=True), \
                 patch('builtins.open', mock_open_json(test_output)):
                
                result = self.processor._parse_with_mineru('/test/file.pdf')
                
                self.assertIsInstance(result, list)
                self.assertEqual(len(result), 1)
                self.assertEqual(result[0]['type'], 'text')
                self.assertEqual(result[0]['text_content'], '测试文本内容')
                self.assertEqual(result[0]['page_number'], 1)
        finally:
            os.unlink(output_file)
    
    def test_batch_embedding_generation(self):
        """测试批量嵌入向量生成"""
        # 模拟嵌入生成
        def mock_generate_embeddings(text):
            return [0.1] * 1024  # 模拟1024维向量
        
        self.processor.generate_embeddings = mock_generate_embeddings
        
        texts = ['文本1', '文本2', '文本3']
        embeddings = self.processor._batch_generate_embeddings(texts)
        
        self.assertEqual(len(embeddings), 3)
        self.assertEqual(len(embeddings[0]), 1024)
    
    def test_content_storage(self):
        """测试内容存储"""
        # 准备测试数据
        content_data = [
            {
                'type': 'text',
                'text_content': '这是测试内容',
                'page_number': 1
            },
            {
                'type': 'table',
                'text_content': '表格数据',
                'page_number': 2
            }
        ]
        
        # 模拟嵌入生成
        self.processor.generate_embeddings = Mock(return_value=[0.1] * 1024)
        
        # 执行存储
        self.processor.store_multimedia_content(
            'test_doc_id', 'test.pdf', content_data, 'document'
        )
        
        # 验证调用
        self.processor.index.upsert.assert_called()
        self.processor.vectors_collection.insert_many.assert_called()
    
    def test_file_validation(self):
        """测试文件验证"""
        # 测试文件大小限制
        with patch('os.path.getsize', return_value=200 * 1024 * 1024):  # 200MB
            with self.assertRaises(ValueError):
                self.processor._validate_file('/test/large_file.pdf')
        
        # 测试正常文件
        with patch('os.path.getsize', return_value=50 * 1024 * 1024):  # 50MB
            try:
                self.processor._validate_file('/test/normal_file.pdf')
            except ValueError:
                self.fail("正常大小的文件不应该抛出异常")


def mock_open_json(json_data):
    """模拟JSON文件读取"""
    from unittest.mock import mock_open
    return mock_open(read_data=json.dumps(json_data))


class TestRAGAnythingPerformance(unittest.TestCase):
    """RAGAnything性能测试类"""
    
    def setUp(self):
        """性能测试初始化"""
        # 设置测试环境变量
        os.environ['SILICONFLOW_API_KEY'] = 'test_key'
        
        with patch('multimedia_processor.Pinecone'), \
             patch('multimedia_processor.MongoClient'), \
             patch('openai.OpenAI'):
            self.processor = MultimediaProcessor()
    
    def test_batch_processing_performance(self):
        """测试批量处理性能"""
        import time
        
        # 生成大量测试数据
        large_content_data = []
        for i in range(100):
            large_content_data.append({
                'type': 'text',
                'text_content': f'测试内容 {i}' * 10,
                'page_number': i + 1
            })
        
        # 模拟快速嵌入生成
        self.processor.generate_embeddings = Mock(return_value=[0.1] * 1024)
        self.processor.index = Mock()
        self.processor.vectors_collection = Mock()
        
        # 测量处理时间
        start_time = time.time()
        self.processor.store_multimedia_content(
            'perf_test', 'test.pdf', large_content_data, 'document'
        )
        end_time = time.time()
        
        processing_time = end_time - start_time
        print(f"批量处理100个内容块耗时: {processing_time:.2f}秒")
        
        # 性能断言（应该在合理时间内完成）
        self.assertLess(processing_time, 10.0, "批量处理时间过长")


def run_integration_tests():
    """运行集成测试"""
    print("开始RAGAnything集成测试...")
    
    # 创建测试套件
    test_suite = unittest.TestSuite()
    
    # 添加功能测试
    test_suite.addTest(unittest.makeSuite(TestRAGAnythingIntegration))
    
    # 添加性能测试
    test_suite.addTest(unittest.makeSuite(TestRAGAnythingPerformance))
    
    # 运行测试
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(test_suite)
    
    # 输出结果
    if result.wasSuccessful():
        print("\n✅ 所有测试通过！")
        return True
    else:
        print(f"\n❌ 测试失败: {len(result.failures)} 个失败, {len(result.errors)} 个错误")
        return False


if __name__ == '__main__':
    success = run_integration_tests()
    sys.exit(0 if success else 1)