#!/usr/bin/env python3
"""
独立RAGAnything向量化脚本
- 支持多种文档类型（PDF、Office、HTML、Markdown、TXT）解析
- 优先使用RAGAnything Python API；无则回退到MinerU CLI
- 生成文本向量（默认OpenAI embeddings），输出JSONL

使用示例：
  python raganything_vectorizer.py --input ./docs --output ./vector_output \
    --parser auto --model text-embedding-3-small --batch-size 32

环境变量：
  OPENAI_API_KEY 或 SILICONFLOW_API_KEY（用于OpenAI embeddings）

注意：
  - MinerU CLI需安装并在PATH中（命令：mineru）
  - RAGAnything需安装：pip install raganything[all]
"""

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
from typing import List, Dict, Any, Optional

# ---- 可选：OpenAI embeddings ----
try:
    from openai import OpenAI
except Exception:
    OpenAI = None

SUPPORTED_EXTS = {
    'document': {
        '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx',
        '.md', '.markdown', '.txt', '.html', '.htm', '.epub', '.rtf', '.odt',
        '.ods', '.odp', '.csv', '.tsv'
    },
    'presentation': {'.ppt', '.pptx'}
}


def get_file_type(ext: str) -> Optional[str]:
    ext = ext.lower()
    if ext in SUPPORTED_EXTS['presentation']:
        return 'ppt'
    if ext in SUPPORTED_EXTS['document']:
        return 'document'
    return None


def get_available_parsers() -> List[str]:
    parsers = []
    # MinerU CLI
    if shutil.which('mineru'):
        parsers.append('mineru')
    # RAGAnything Python 包
    try:
        import raganything  # noqa
        parsers.append('raganything')
    except Exception:
        pass
    # Docling（可选）
    try:
        import docling  # noqa
        parsers.append('docling')
    except Exception:
        pass
    return parsers


# ---- 解析实现 ----

def parse_with_mineru(file_path: str) -> List[Dict[str, Any]]:
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


def parse_with_raganything(file_path: str) -> List[Dict[str, Any]]:
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


# ---- 向量化与输出 ----

def preprocess_text(text: str) -> str:
    text = (text or '').replace('\r', ' ').replace('\n', ' ').strip()
    # 去除多余空白
    text = ' '.join(text.split())
    # 限长（避免过长输入）
    if len(text) > 8000:
        text = text[:8000]
    return text


def build_embedding_text(block: Dict[str, Any]) -> str:
    t = block.get('text_content') or ''
    t = preprocess_text(t)
    # 附加位置信息
    page = block.get('page_number')
    prefix = f"[Page {page}] " if page else ""
    return prefix + t


def generate_embeddings(texts: List[str], model: str = 'text-embedding-3-small') -> List[List[float]]:
    if not OpenAI:
        raise RuntimeError('openai 库不可用，无法生成嵌入。请安装 openai 并设置API密钥。')
    api_key = os.getenv('OPENAI_API_KEY') or os.getenv('SILICONFLOW_API_KEY')
    if not api_key:
        raise RuntimeError('未检测到 OPENAI_API_KEY 或 SILICONFLOW_API_KEY 环境变量。')
    client = OpenAI(api_key=api_key)
    vectors: List[List[float]] = []
    # 分批调用，避免超长
    for i in range(0, len(texts), 32):
        batch = texts[i:i+32]
        resp = client.embeddings.create(model=model, input=batch)
        for d in resp.data:
            vectors.append(d.embedding)
    return vectors


def save_jsonl(records: List[Dict[str, Any]], output_path: Path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")


# ---- 主流程 ----

def process_file(file_path: Path, parser: str, model: str, min_chars: int = 20) -> List[Dict[str, Any]]:
    ext = file_path.suffix.lower()
    ftype = get_file_type(ext)
    if ftype not in {'document', 'ppt'}:
        print(f"跳过不支持的文件类型: {file_path.name}")
        return []
    # 选择解析器
    available = get_available_parsers()
    chosen = parser
    if parser == 'auto':
        if 'raganything' in available:
            chosen = 'raganything'
        elif 'mineru' in available:
            chosen = 'mineru'
        elif 'docling' in available:
            chosen = 'docling'
        else:
            raise RuntimeError('未找到任何可用解析器 (raganything/mineru/docling)')
    if chosen not in available:
        raise RuntimeError(f"解析器 {chosen} 不可用，可用: {available}")

    if chosen == 'raganything':
        blocks = parse_with_raganything(str(file_path))
    elif chosen == 'mineru':
        blocks = parse_with_mineru(str(file_path))
    else:
        # 简单Docling解析占位（如果安装了，用户可以自行扩展）
        try:
            import docling
            # 这里仅做占位，返回空
            blocks = []
        except Exception:
            raise RuntimeError('Docling未安装或不可用')

    # 构建嵌入文本与过滤
    texts: List[str] = []
    meta_list: List[Dict[str, Any]] = []
    for b in blocks:
        text = build_embedding_text(b)
        if len(text) >= min_chars:
            texts.append(text)
            meta = {
                'file_name': file_path.name,
                'file_path': str(file_path),
                'file_type': ftype,
                'content_type': b.get('type'),
                'page_number': b.get('page_number'),
                'bbox': b.get('bbox'),
                'source': b.get('source'),
            }
            meta_list.append(meta)
    if not texts:
        return []

    # 生成嵌入
    vectors = generate_embeddings(texts, model=model)

    # 组合记录
    records: List[Dict[str, Any]] = []
    for i, (text, vec, meta) in enumerate(zip(texts, vectors, meta_list)):
        chunk_id = hashlib.sha256((file_path.name + str(i) + text).encode('utf-8')).hexdigest()[:12]
        records.append({
            'id': chunk_id,
            'text': text,
            'embedding': vec,
            'metadata': meta
        })
    return records


def main():
    parser = argparse.ArgumentParser(description='RAGAnything 多文档向量化脚本')
    parser.add_argument('--input', required=True, help='输入文件或目录路径')
    parser.add_argument('--output', default='./vector_output', help='输出目录')
    parser.add_argument('--parser', default='auto', choices=['auto', 'raganything', 'mineru', 'docling'], help='解析器选择')
    parser.add_argument('--model', default='text-embedding-3-small', help='嵌入模型')
    parser.add_argument('--min-chars', type=int, default=20, help='最小文本长度过滤')
    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    if input_path.is_dir():
        files = [p for p in input_path.glob('**/*') if p.is_file()]
    elif input_path.is_file():
        files = [input_path]
    else:
        print(f"输入路径不存在: {input_path}")
        sys.exit(1)

    all_records: List[Dict[str, Any]] = []
    for f in files:
        if get_file_type(f.suffix.lower()) is None:
            # 非文档类型跳过
            continue
        print(f"处理文件: {f}")
        try:
            recs = process_file(f, parser=args.parser, model=args.model, min_chars=args.min_chars)
            all_records.extend(recs)
        except Exception as e:
            print(f"⚠️  处理失败 {f.name}: {e}")

    if not all_records:
        print('未生成任何向量记录。')
        sys.exit(2)

    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    out_file = output_dir / f'vectors_{ts}.jsonl'
    save_jsonl(all_records, out_file)
    print(f"✅ 完成。写入 {len(all_records)} 条记录到: {out_file}")
    print("可用解析器: ", ', '.join(get_available_parsers()))


if __name__ == '__main__':
    main()