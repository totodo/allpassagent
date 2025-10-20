import os
import io
import json
import base64
import logging
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
import hashlib
import openai
import tempfile
from dotenv import load_dotenv

# 加载环境变量
load_dotenv(dotenv_path='../.env.local')

from pinecone import Pinecone
import openai
from pymongo import MongoClient
import requests
from PIL import Image
import pytesseract
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
import cv2
import speech_recognition as sr
from moviepy.editor import VideoFileClip
import librosa
import soundfile as sf
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MultimediaProcessor:
    def __init__(self):
        # 获取SiliconFlow API密钥
        self.api_key = os.getenv('SILICONFLOW_API_KEY')
        if not self.api_key:
            raise ValueError("SILICONFLOW_API_KEY 环境变量未设置")
        
        # 初始化SiliconFlow客户端
        self.client = openai.OpenAI(
            api_key=self.api_key,
            base_url="https://api.siliconflow.cn/v1"
        )
        
        # 初始化MongoDB
        self.mongo_client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
        self.db = self.mongo_client['allpassagent']
        self.collection = self.db['multimedia_docs']
        self.chunks_collection = self.db['multimedia_chunks']
        
        # 初始化Pinecone (使用新版本API)
        pc = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))
        self.index = pc.Index(os.getenv('PINECONE_INDEX_NAME'))
        
        # 支持的文件类型
        self.supported_types = {
            'ppt': ['.ppt', '.pptx'],
            'image': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'],
            'video': ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv'],
            'audio': ['.mp3', '.wav', '.flac', '.aac', '.ogg']
        }

    def process_multimedia_file(self, file_path: str, filename: str) -> Dict[str, Any]:
        """
        处理多媒体文件的主函数
        """
        try:
            file_ext = os.path.splitext(filename)[1].lower()
            file_type = self.get_file_type(file_ext)
            
            if not file_type:
                raise ValueError(f"不支持的文件类型: {file_ext}")
            
            logger.info(f"开始处理 {file_type} 文件: {filename}")
            
            # 创建文档记录
            doc_record = self.create_document_record(filename, file_path, file_type)
            doc_id = str(doc_record.inserted_id)
            
            # 根据文件类型选择处理方法
            if file_type == 'ppt':
                content_data = self.process_ppt(file_path)
            elif file_type == 'image':
                content_data = self.process_image(file_path)
            elif file_type == 'video':
                content_data = self.process_video(file_path)
            elif file_type == 'audio':
                content_data = self.process_audio(file_path)
            else:
                raise ValueError(f"未实现的文件类型处理: {file_type}")
            
            # 生成嵌入向量并存储
            self.store_multimedia_content(doc_id, filename, content_data, file_type)
            
            # 更新文档状态
            self.collection.update_one(
                {'_id': doc_record.inserted_id},
                {
                    '$set': {
                        'status': 'completed',
                        'processed_at': datetime.now(),
                        'content_count': len(content_data)
                    }
                }
            )
            
            logger.info(f"成功处理文件: {filename}")
            return {
                'success': True,
                'doc_id': doc_id,
                'content_count': len(content_data),
                'file_type': file_type
            }
            
        except Exception as e:
            logger.error(f"处理文件 {filename} 时出错: {str(e)}")
            if 'doc_record' in locals():
                self.collection.update_one(
                    {'_id': doc_record.inserted_id},
                    {'$set': {'status': 'failed', 'error': str(e)}}
                )
            return {'success': False, 'error': str(e)}

    def get_file_type(self, file_ext: str) -> Optional[str]:
        """
        根据文件扩展名确定文件类型
        """
        for file_type, extensions in self.supported_types.items():
            if file_ext in extensions:
                return file_type
        return None

    def create_document_record(self, filename: str, file_path: str, file_type: str) -> Any:
        """
        创建文档记录
        """
        file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
        
        doc_data = {
            'filename': filename,
            'original_name': filename,
            'file_type': file_type,
            'file_size': file_size,
            'uploaded_at': datetime.now(),
            'status': 'processing',
            'processed_at': None,
            'content_count': 0,
            'metadata': {}
        }
        
        return self.collection.insert_one(doc_data)

    def process_ppt(self, file_path: str) -> List[Dict[str, Any]]:
        """
        处理PPT文件，提取文本和图片信息
        """
        content_data = []
        
        try:
            prs = Presentation(file_path)
            
            for slide_idx, slide in enumerate(prs.slides):
                slide_content = {
                    'type': 'slide',
                    'slide_number': slide_idx + 1,
                    'text_content': '',
                    'images': [],
                    'shapes_info': []
                }
                
                # 提取文本内容
                text_parts = []
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        text_parts.append(shape.text.strip())
                        
                        # 记录形状信息
                        shape_info = {
                            'type': 'text',
                            'content': shape.text.strip(),
                            'shape_type': str(shape.shape_type)
                        }
                        slide_content['shapes_info'].append(shape_info)
                    
                    # 处理图片
                    if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
                        try:
                            image_info = self.extract_image_from_shape(shape, slide_idx)
                            if image_info:
                                slide_content['images'].append(image_info)
                        except Exception as e:
                            logger.warning(f"提取幻灯片 {slide_idx + 1} 中的图片时出错: {str(e)}")
                
                slide_content['text_content'] = '\n'.join(text_parts)
                
                # 只有当幻灯片有内容时才添加
                if slide_content['text_content'] or slide_content['images']:
                    content_data.append(slide_content)
            
            logger.info(f"PPT处理完成，共提取 {len(content_data)} 张幻灯片")
            return content_data
            
        except Exception as e:
            logger.error(f"处理PPT文件时出错: {str(e)}")
            raise

    def extract_image_from_shape(self, shape, slide_idx: int) -> Optional[Dict[str, Any]]:
        """
        从PPT形状中提取图片信息
        """
        try:
            image = shape.image
            image_bytes = image.blob
            
            # 生成图片哈希
            image_hash = hashlib.md5(image_bytes).hexdigest()
            
            # 使用PIL处理图片
            pil_image = Image.open(io.BytesIO(image_bytes))
            
            # 提取图片中的文字（OCR）
            ocr_text = ""
            try:
                ocr_text = pytesseract.image_to_string(pil_image, lang='chi_sim+eng')
            except Exception as e:
                logger.warning(f"OCR处理失败: {str(e)}")
            
            return {
                'hash': image_hash,
                'format': image.content_type,
                'size': len(image_bytes),
                'dimensions': f"{pil_image.width}x{pil_image.height}",
                'ocr_text': ocr_text.strip(),
                'slide_number': slide_idx + 1
            }
            
        except Exception as e:
            logger.error(f"提取图片信息时出错: {str(e)}")
            return None

    def process_image(self, file_path: str) -> List[Dict[str, Any]]:
        """
        处理图片文件，提取文字和描述信息
        """
        content_data = []
        
        try:
            # 打开图片
            image = Image.open(file_path)
            
            # 基本信息
            image_info = {
                'type': 'image',
                'format': image.format,
                'size': image.size,
                'mode': image.mode,
                'ocr_text': '',
                'description': ''
            }
            
            # OCR文字识别
            try:
                ocr_text = pytesseract.image_to_string(image, lang='chi_sim+eng')
                image_info['ocr_text'] = ocr_text.strip()
            except Exception as e:
                logger.warning(f"OCR处理失败: {str(e)}")
            
            # 生成图片描述（这里可以集成图像识别API）
            image_info['description'] = self.generate_image_description(image)
            
            content_data.append(image_info)
            
            logger.info(f"图片处理完成，提取文字长度: {len(image_info['ocr_text'])}")
            return content_data
            
        except Exception as e:
            logger.error(f"处理图片文件时出错: {str(e)}")
            raise

    def generate_image_description(self, image: Image.Image) -> str:
        """
        生成图片描述（简单实现，可以扩展为调用视觉AI API）
        """
        try:
            # 这里可以集成如百度、腾讯、阿里等的图像识别API
            # 目前返回基本信息
            width, height = image.size
            aspect_ratio = width / height
            
            if aspect_ratio > 1.5:
                orientation = "横向"
            elif aspect_ratio < 0.67:
                orientation = "纵向"
            else:
                orientation = "方形"
            
            return f"这是一张{orientation}图片，尺寸为{width}x{height}像素"
            
        except Exception as e:
            logger.warning(f"生成图片描述时出错: {str(e)}")
            return "图片描述生成失败"

    def process_video(self, file_path: str) -> List[Dict[str, Any]]:
        """
        处理视频文件，提取音频转文字和关键帧
        """
        content_data = []
        
        try:
            # 使用moviepy处理视频
            video = VideoFileClip(file_path)
            duration = video.duration
            fps = video.fps
            
            video_info = {
                'type': 'video',
                'duration': duration,
                'fps': fps,
                'size': video.size,
                'audio_transcript': '',
                'keyframes': []
            }
            
            # 提取音频并转换为文字
            if video.audio:
                audio_transcript = self.extract_audio_transcript(video)
                video_info['audio_transcript'] = audio_transcript
            
            # 提取关键帧
            keyframes = self.extract_keyframes(video, max_frames=10)
            video_info['keyframes'] = keyframes
            
            video.close()
            content_data.append(video_info)
            
            logger.info(f"视频处理完成，时长: {duration:.2f}秒，提取关键帧: {len(keyframes)}个")
            return content_data
            
        except Exception as e:
            logger.error(f"处理视频文件时出错: {str(e)}")
            raise

    def extract_audio_transcript(self, video: VideoFileClip) -> str:
        """
        从视频中提取音频并转换为文字
        """
        try:
            # 提取音频
            audio = video.audio
            temp_audio_path = "/tmp/temp_audio.wav"
            audio.write_audiofile(temp_audio_path, verbose=False, logger=None)
            
            # 使用语音识别
            r = sr.Recognizer()
            with sr.AudioFile(temp_audio_path) as source:
                audio_data = r.record(source)
                try:
                    # 使用Google语音识别（需要网络）
                    transcript = r.recognize_google(audio_data, language='zh-CN')
                    return transcript
                except sr.UnknownValueError:
                    return "无法识别音频内容"
                except sr.RequestError as e:
                    logger.warning(f"语音识别服务出错: {str(e)}")
                    return "语音识别服务不可用"
            
        except Exception as e:
            logger.warning(f"音频转文字失败: {str(e)}")
            return "音频转文字失败"
        finally:
            # 清理临时文件
            if os.path.exists("/tmp/temp_audio.wav"):
                os.remove("/tmp/temp_audio.wav")

    def extract_keyframes(self, video: VideoFileClip, max_frames: int = 10) -> List[Dict[str, Any]]:
        """
        从视频中提取关键帧
        """
        keyframes = []
        duration = video.duration
        
        try:
            # 均匀分布提取关键帧
            frame_times = np.linspace(0, duration - 1, max_frames)
            
            for i, time_point in enumerate(frame_times):
                try:
                    frame = video.get_frame(time_point)
                    
                    # 转换为PIL图片
                    pil_image = Image.fromarray(frame.astype('uint8'))
                    
                    # 生成缩略图
                    pil_image.thumbnail((200, 200))
                    
                    # 转换为base64
                    buffer = io.BytesIO()
                    pil_image.save(buffer, format='JPEG')
                    img_base64 = base64.b64encode(buffer.getvalue()).decode()
                    
                    keyframe_info = {
                        'frame_number': i + 1,
                        'timestamp': time_point,
                        'thumbnail_base64': img_base64,
                        'description': f"视频第{time_point:.1f}秒的关键帧"
                    }
                    
                    keyframes.append(keyframe_info)
                    
                except Exception as e:
                    logger.warning(f"提取第{i+1}个关键帧时出错: {str(e)}")
                    continue
            
            return keyframes
            
        except Exception as e:
            logger.error(f"提取关键帧时出错: {str(e)}")
            return []

    def process_audio(self, file_path: str) -> List[Dict[str, Any]]:
        """
        处理音频文件，转换为文字
        """
        content_data = []
        
        try:
            # 使用librosa加载音频
            y, sr = librosa.load(file_path)
            duration = librosa.get_duration(y=y, sr=sr)
            
            audio_info = {
                'type': 'audio',
                'duration': duration,
                'sample_rate': sr,
                'transcript': ''
            }
            
            # 转换音频格式用于语音识别
            temp_wav_path = "/tmp/temp_audio_for_recognition.wav"
            sf.write(temp_wav_path, y, sr)
            
            # 语音识别
            r = sr.Recognizer()
            with sr.AudioFile(temp_wav_path) as source:
                audio_data = r.record(source)
                try:
                    transcript = r.recognize_google(audio_data, language='zh-CN')
                    audio_info['transcript'] = transcript
                except sr.UnknownValueError:
                    audio_info['transcript'] = "无法识别音频内容"
                except sr.RequestError as e:
                    logger.warning(f"语音识别服务出错: {str(e)}")
                    audio_info['transcript'] = "语音识别服务不可用"
            
            content_data.append(audio_info)
            
            logger.info(f"音频处理完成，时长: {duration:.2f}秒")
            return content_data
            
        except Exception as e:
            logger.error(f"处理音频文件时出错: {str(e)}")
            raise
        finally:
            # 清理临时文件
            if os.path.exists("/tmp/temp_audio_for_recognition.wav"):
                os.remove("/tmp/temp_audio_for_recognition.wav")

    def store_multimedia_content(self, doc_id: str, filename: str, content_data: List[Dict[str, Any]], file_type: str):
        """
        存储多媒体内容到向量数据库
        """
        try:
            vectors_to_upsert = []
            chunks_to_store = []
            
            for idx, content in enumerate(content_data):
                # 构建文本内容用于向量化
                text_for_embedding = self.build_text_for_embedding(content, file_type)
                
                if text_for_embedding.strip():
                    # 生成嵌入向量
                    embedding = self.generate_embeddings(text_for_embedding)
                    
                    # 准备向量数据
                    vector_id = f"{doc_id}_{idx}"
                    
                    # 构建metadata，包含页码信息
                    metadata = {
                        'doc_id': doc_id,
                        'document_id': doc_id,  # 保持向后兼容
                        'filename': filename,
                        'file_type': 'multimedia',
                        'media_type': file_type,
                        'content_type': content.get('type', 'unknown'),
                        'chunk_index': idx,
                        'full_content': text_for_embedding[:1000],  # 限制长度
                        'content_summary': text_for_embedding[:200] + '...' if len(text_for_embedding) > 200 else text_for_embedding
                    }
                    
                    # 添加页码信息（如果存在）
                    if file_type == 'ppt' and content.get('slide_number'):
                        metadata['page'] = content['slide_number']
                        metadata['page_type'] = 'slide'
                    elif content.get('page_number'):
                        metadata['page'] = content['page_number']
                        metadata['page_type'] = 'page'
                    
                    vector_data = {
                        'id': vector_id,
                        'values': embedding,
                        'metadata': metadata
                    }
                    vectors_to_upsert.append(vector_data)
                    
                    # 准备MongoDB数据
                    chunk_data = {
                        'doc_id': doc_id,
                        'filename': filename,
                        'file_type': file_type,
                        'chunk_index': idx,
                        'content': content,
                        'text_content': text_for_embedding,
                        'created_at': datetime.now()
                    }
                    chunks_to_store.append(chunk_data)
            
            # 批量上传到Pinecone
            if vectors_to_upsert:
                self.index.upsert(vectors=vectors_to_upsert)
                logger.info(f"成功上传 {len(vectors_to_upsert)} 个向量到Pinecone")
            
            # 批量存储到MongoDB
            if chunks_to_store:
                self.chunks_collection.insert_many(chunks_to_store)
                logger.info(f"成功存储 {len(chunks_to_store)} 个内容块到MongoDB")
                
        except Exception as e:
            logger.error(f"存储多媒体内容时出错: {str(e)}")
            raise

    def build_text_for_embedding(self, content: Dict[str, Any], file_type: str) -> str:
        """
        根据内容类型构建用于向量化的文本
        """
        text_parts = []
        
        if file_type == 'ppt':
            if content.get('text_content'):
                text_parts.append(f"幻灯片内容: {content['text_content']}")
            
            # 添加图片OCR文字
            for img in content.get('images', []):
                if img.get('ocr_text'):
                    text_parts.append(f"图片文字: {img['ocr_text']}")
                    
        elif file_type == 'image':
            if content.get('ocr_text'):
                text_parts.append(f"图片文字: {content['ocr_text']}")
            if content.get('description'):
                text_parts.append(f"图片描述: {content['description']}")
                
        elif file_type == 'video':
            if content.get('audio_transcript'):
                text_parts.append(f"视频音频内容: {content['audio_transcript']}")
            
            # 添加关键帧描述
            for frame in content.get('keyframes', []):
                if frame.get('description'):
                    text_parts.append(f"关键帧: {frame['description']}")
                    
        elif file_type == 'audio':
            if content.get('transcript'):
                text_parts.append(f"音频内容: {content['transcript']}")
        
        return '\n'.join(text_parts)

    def generate_embeddings(self, text: str) -> List[float]:
        """
        生成文本嵌入向量
        """
        try:
            # 截断文本以适应token限制
            if len(text) > 400:
                text = text[:400]
            
            response = self.client.embeddings.create(
                model="BAAI/bge-large-zh-v1.5",
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"生成嵌入向量时出错: {str(e)}")
            raise

    def search_multimedia_content(self, query: str, file_types: Optional[List[str]] = None, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        搜索多媒体内容
        """
        try:
            # 生成查询向量
            query_embedding = self.generate_embeddings(query)
            
            # 构建过滤条件
            filter_conditions = {}
            if file_types:
                filter_conditions['file_type'] = {'$in': file_types}
            
            # 在Pinecone中搜索
            search_results = self.index.query(
                vector=query_embedding,
                top_k=top_k,
                include_metadata=True,
                filter=filter_conditions if filter_conditions else None
            )
            
            results = []
            for match in search_results.matches:
                result = {
                    'score': match.score,
                    'filename': match.metadata.get('filename', ''),
                    'file_type': match.metadata.get('media_type', match.metadata.get('file_type', '')),
                    'content_type': match.metadata.get('content_type', ''),
                    'content': match.metadata.get('full_content', ''),
                    'summary': match.metadata.get('content_summary', '')
                }
                results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"搜索多媒体内容时出错: {str(e)}")
            return []

    def get_supported_types(self) -> Dict[str, List[str]]:
        """
        获取支持的文件类型
        """
        return self.supported_types

if __name__ == "__main__":
    # 测试代码
    processor = MultimediaProcessor()
    print("多媒体处理器初始化成功")
    print("支持的文件类型:", processor.get_supported_types())