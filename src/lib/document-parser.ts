import mammoth from 'mammoth';

// 动态导入 pdf-parse 以避免 SSR 问题
let pdfParse: any = null;

async function getPdfParse() {
  if (!pdfParse) {
    try {
      // 使用 require 方式导入，避免 ES module 的问题
      if (typeof window === 'undefined') {
        // 服务器端使用 require
        const pdfParseModule = require('pdf-parse');
        pdfParse = pdfParseModule;
      } else {
        // 客户端使用动态导入
        const pdfParseModule = await import('pdf-parse');
        pdfParse = pdfParseModule.default || pdfParseModule;
      }
      
      // 验证导入是否成功
      if (typeof pdfParse !== 'function') {
        throw new Error('pdf-parse module did not export a function');
      }
      
    } catch (error) {
      console.error('Failed to load pdf-parse:', error);
      // 提供更详细的错误信息
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        cwd: process.cwd()
      });
      throw new Error('PDF parsing is not available');
    }
  }
  return pdfParse;
}

export interface ParsedDocument {
  content: string;
  metadata: {
    filename: string;
    fileType: string;
    size: number;
    pageCount?: number;
  };
}

export async function parseDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ParsedDocument> {
  const fileType = getFileType(mimeType, filename);
  let content = '';
  let pageCount: number | undefined;

  try {
    switch (fileType) {
      case 'pdf':
        try {
          const pdfParser = await getPdfParse();
          const pdfData = await pdfParser(buffer);
          content = pdfData.text;
          pageCount = pdfData.numpages;
        } catch (pdfError) {
          console.error('PDF parsing error:', pdfError);
          // 如果PDF解析失败，返回错误信息而不是抛出异常
          throw new Error(`PDF parsing failed: ${pdfError instanceof Error ? pdfError.message : 'Unknown PDF error'}`);
        }
        break;

      case 'docx':
        const docxResult = await mammoth.extractRawText({ buffer });
        content = docxResult.value;
        break;

      case 'txt':
        content = buffer.toString('utf-8');
        break;

      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    if (!content.trim()) {
      throw new Error('No text content found in document');
    }

    return {
      content: content.trim(),
      metadata: {
        filename,
        fileType,
        size: buffer.length,
        pageCount,
      },
    };
  } catch (error) {
    console.error('Document parsing error:', error);
    throw new Error(`Failed to parse document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function getFileType(mimeType: string, filename: string): string {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (mimeType === 'text/plain') return 'txt';
  
  // Fallback to file extension
  const extension = filename.toLowerCase().split('.').pop();
  if (extension === 'pdf') return 'pdf';
  if (extension === 'docx') return 'docx';
  if (extension === 'txt') return 'txt';
  
  throw new Error(`Unsupported file type: ${mimeType}`);
}

export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (currentChunk.length + trimmedSentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      
      // Create overlap by keeping the last part of the current chunk
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(overlap / 10)); // Approximate word count for overlap
      currentChunk = overlapWords.join(' ') + ' ' + trimmedSentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}