#!/usr/bin/env python3
"""
RAGAnything环境验证脚本
检查依赖安装、配置和基本功能
"""

import os
import sys
import json
import subprocess
import importlib.util
from pathlib import Path
from typing import Dict, List, Tuple
from dotenv import load_dotenv, find_dotenv


class RAGAnythingValidator:
    """RAGAnything环境验证器"""
    
    def __init__(self):
        self.results = []
        self.errors = []
        self.warnings = []
    
    def log_result(self, test_name: str, status: str, message: str = ""):
        """记录测试结果"""
        self.results.append({
            'test': test_name,
            'status': status,
            'message': message
        })
        
        status_icon = {
            'PASS': '✅',
            'FAIL': '❌', 
            'WARN': '⚠️',
            'INFO': 'ℹ️'
        }.get(status, '?')
        
        print(f"{status_icon} {test_name}: {message}")
    
    def check_python_version(self) -> bool:
        """检查Python版本"""
        version = sys.version_info
        if version.major == 3 and version.minor >= 8:
            self.log_result("Python版本", "PASS", f"Python {version.major}.{version.minor}.{version.micro}")
            return True
        else:
            self.log_result("Python版本", "FAIL", f"需要Python 3.8+，当前: {version.major}.{version.minor}")
            return False
    
    def check_package_installation(self) -> Dict[str, bool]:
        """检查包安装状态"""
        packages = [
            {'display': 'raganything', 'module': 'raganything', 'description': 'RAGAnything框架'},
            {'display': 'pinecone', 'module': 'pinecone', 'description': 'Pinecone向量数据库'},
            {'display': 'pymongo', 'module': 'pymongo', 'description': 'MongoDB客户端'},
            {'display': 'openai', 'module': 'openai', 'description': 'OpenAI API'},
            {'display': 'Pillow', 'module': 'PIL', 'description': '图像处理'},
            {'display': 'opencv-python', 'module': 'cv2', 'description': '计算机视觉'},
            {'display': 'easyocr', 'module': 'easyocr', 'description': 'OCR文字识别'},
            {'display': 'PyMuPDF', 'module': 'fitz', 'description': 'PDF处理 (SiliconFlow解析需要)'},
        ]
        
        results = {}
        for pkg in packages:
            try:
                spec = importlib.util.find_spec(pkg['module'])
                if spec is not None:
                    self.log_result(f"包安装: {pkg['display']}", "PASS", pkg['description'])
                    results[pkg['display']] = True
                else:
                    self.log_result(f"包安装: {pkg['display']}", "FAIL", f"未安装 {pkg['description']}")
                    results[pkg['display']] = False
            except Exception as e:
                self.log_result(f"包安装: {pkg['display']}", "FAIL", f"检查失败: {str(e)}")
                results[pkg['display']] = False
        
        return results
    
    def check_environment_variables(self) -> Dict[str, bool]:
        """检查环境变量"""
        # 特殊检查：OpenAI 或 SiliconFlow API 密钥
        results = {}
        openai_key = os.getenv('OPENAI_API_KEY')
        silicon_key = os.getenv('SILICONFLOW_API_KEY')
        if openai_key or silicon_key:
            self.log_result("环境变量: OPENAI/SILICONFLOW_API_KEY", "PASS", "OpenAI或SiliconFlow API密钥 (已设置)")
            results['OPENAI/SILICONFLOW_API_KEY'] = True
        else:
            self.log_result("环境变量: OPENAI/SILICONFLOW_API_KEY", "FAIL", "未设置 OpenAI或SiliconFlow API密钥")
            results['OPENAI/SILICONFLOW_API_KEY'] = False

        required_vars = {
            'PINECONE_API_KEY': 'Pinecone API密钥',
            'PINECONE_ENVIRONMENT': 'Pinecone环境'
        }
        
        optional_vars = {
            'MONGODB_CONNECTION_STRING': 'MongoDB连接字符串',
        }
        
        # 检查必需变量
        for var, description in required_vars.items():
            value = os.getenv(var)
            if value:
                masked_value = value[:8] + '...' if len(value) > 8 else value
                self.log_result(f"环境变量: {var}", "PASS", f"{description} (已设置)")
                results[var] = True
            else:
                self.log_result(f"环境变量: {var}", "FAIL", f"未设置 {description}")
                results[var] = False
        
        # 检查可选变量
        for var, description in optional_vars.items():
            value = os.getenv(var)
            if value:
                self.log_result(f"环境变量: {var}", "INFO", f"{description} (已设置)")
                results[var] = True
            else:
                self.log_result(f"环境变量: {var}", "WARN", f"未设置 {description} (可选)")
                results[var] = False
        
        return results
    
    def test_raganything_import(self) -> bool:
        """测试RAGAnything导入"""
        try:
            import raganything
            self.log_result("RAGAnything导入", "PASS", "成功导入RAGAnything")
            
            # 尝试获取版本信息
            try:
                version = getattr(raganything, '__version__', 'unknown')
                self.log_result("RAGAnything版本", "INFO", f"版本: {version}")
            except:
                self.log_result("RAGAnything版本", "WARN", "无法获取版本信息")
            
            return True
        except ImportError as e:
            msg = str(e)
            if 'lightrag' in msg.lower():
                self.log_result("RAGAnything导入", "WARN", "缺少依赖 lightrag；建议安装或升级Python>=3.10")
                return False
            else:
                self.log_result("RAGAnything导入", "FAIL", f"导入失败: {msg}")
                return False
        except Exception as e:
            self.log_result("RAGAnything导入", "FAIL", f"未知错误: {str(e)}")
            return False
    
    def test_basic_functionality(self) -> bool:
        """测试基本功能"""
        try:
            # 测试文件类型检测
            sys.path.append(os.path.dirname(os.path.abspath(__file__)))
            from multimedia_processor import MultimediaProcessor
            
            # 设置测试环境变量
            os.environ['SILICONFLOW_API_KEY'] = 'test_key'
            
            # 模拟依赖
            from unittest.mock import patch
            with patch('multimedia_processor.Pinecone'), \
                 patch('multimedia_processor.MongoClient'), \
                 patch('openai.OpenAI'):
                
                processor = MultimediaProcessor()
                
                # 测试文件类型检测
                test_files = [
                    ('test.pdf', 'document'),
                    ('test.pptx', 'ppt'),
                    ('test.jpg', 'image')
                ]
                
                for filename, expected_type in test_files:
                    ext = '.' + filename.split('.')[-1] if '.' in filename else filename
                    detected_type = processor.get_file_type(ext)
                    if detected_type == expected_type:
                        self.log_result(f"文件类型检测: {filename}", "PASS", f"检测为: {detected_type}")
                    else:
                        self.log_result(f"文件类型检测: {filename}", "FAIL", 
                                      f"期望: {expected_type}, 实际: {detected_type}")
                        return False
                
                # 测试解析器检测
                parsers = processor._get_available_parsers()
                self.log_result("解析器检测", "INFO", f"可用解析器: {', '.join(parsers)}")
                
                return True
                
        except Exception as e:
            self.log_result("基本功能测试", "FAIL", f"测试失败: {str(e)}")
            return False
    
    def check_disk_space(self) -> bool:
        """检查磁盘空间"""
        try:
            import shutil
            total, used, free = shutil.disk_usage('/')
            free_gb = free // (1024**3)
            
            if free_gb >= 5:
                self.log_result("磁盘空间", "PASS", f"可用空间: {free_gb}GB")
                return True
            else:
                self.log_result("磁盘空间", "WARN", f"可用空间较少: {free_gb}GB")
                return False
        except Exception as e:
            self.log_result("磁盘空间", "WARN", f"检查失败: {str(e)}")
            return False
    
    def generate_report(self) -> Dict:
        """生成验证报告"""
        passed = sum(1 for r in self.results if r['status'] == 'PASS')
        failed = sum(1 for r in self.results if r['status'] == 'FAIL')
        warnings = sum(1 for r in self.results if r['status'] == 'WARN')
        
        report = {
            'summary': {
                'total_tests': len(self.results),
                'passed': passed,
                'failed': failed,
                'warnings': warnings,
                'success_rate': f"{(passed / len(self.results) * 100):.1f}%" if self.results else "0%"
            },
            'results': self.results,
            'recommendations': self._generate_recommendations()
        }
        
        return report
    
    def _generate_recommendations(self) -> List[str]:
        """生成改进建议"""
        recommendations: List[str] = []
        seen = set()
        
        # 检查失败的测试
        failed_tests = [r for r in self.results if r['status'] == 'FAIL']
        
        for test in failed_tests:
            name = test['test']
            lname = name.lower()
            rec = None
            if 'python版本' in name:
                rec = "升级Python到3.8或更高版本"
            elif 'raganything' in lname or 'RAGAnything' in name:
                rec = "安装/修复RAGAnything依赖: pip install raganything[all] && pip install lightrag"
            elif 'pymupdf' in lname or 'fitz' in lname:
                rec = "安装PyMuPDF用于SiliconFlow PDF解析: pip install PyMuPDF"
            elif 'openai/siliconflow_api_key' in lname or 'OPENAI/SILICONFLOW_API_KEY' in name:
                rec = "设置OpenAI或SiliconFlow API密钥环境变量"
            elif 'pinecone' in lname:
                rec = "设置Pinecone相关环境变量"
            
            if rec and rec not in seen:
                recommendations.append(rec)
                seen.add(rec)
        
        # 通用建议
        if not recommendations:
            recommendations.append("环境配置良好，可以开始使用RAGAnything")
        
        return recommendations
    
    def run_all_checks(self) -> Dict:
        """运行所有检查"""
        print("🔍 开始RAGAnything环境验证...\n")
        
        # 基础环境检查
        print("📋 基础环境检查:")
        self.check_python_version()
        self.check_disk_space()
        
        print("\n📦 包安装检查:")
        self.check_package_installation()
        
        print("\n🌍 环境变量检查:")
        self.check_environment_variables()
        
        print("\n🧪 功能测试:")
        self.test_raganything_import()
        self.test_basic_functionality()
        
        print("\n📊 生成报告...")
        report = self.generate_report()
        
        return report


def main():
    """主函数"""
    # 加载 .env 与 .env.local（如果存在）
    try:
        env_path = find_dotenv(usecwd=True)
        if env_path:
            load_dotenv(env_path)
        local_env = Path.cwd() / '.env.local'
        if local_env.exists():
            load_dotenv(local_env, override=True)
    except Exception as e:
        print(f"⚠️ 环境变量加载: 读取 .env 失败: {e}")
    
    validator = RAGAnythingValidator()
    report = validator.run_all_checks()
    
    print("\n" + "="*60)
    print("📋 验证报告摘要")
    print("="*60)
    
    summary = report['summary']
    print(f"总测试数: {summary['total_tests']}")
    print(f"通过: {summary['passed']} ✅")
    print(f"失败: {summary['failed']} ❌")
    print(f"警告: {summary['warnings']} ⚠️")
    print(f"成功率: {summary['success_rate']}")
    
    if report['recommendations']:
        print("\n💡 改进建议:")
        for i, rec in enumerate(report['recommendations'], 1):
            print(f"{i}. {rec}")
    
    # 保存详细报告
    report_file = 'raganything_validation_report.json'
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print(f"\n📄 详细报告已保存到: {report_file}")
    
    # 返回状态码
    if summary['failed'] == 0:
        print("\n🎉 环境验证通过！可以开始使用RAGAnything")
        return 0
    else:
        print(f"\n⚠️  发现 {summary['failed']} 个问题，请根据建议进行修复")
        return 1


if __name__ == '__main__':
    sys.exit(main())