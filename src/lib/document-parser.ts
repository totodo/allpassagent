import mammoth from 'mammoth';

// 动态导入 pdf-parse 以避免 SSR 问题
let pdfParse: any = null;

async function getPdfParse() {
  if (!pdfParse) {
    try {
      // 直接使用require导入，现在调试模式已被禁用
      const pdfParseModule = require('pdf-parse');
      pdfParse = pdfParseModule;
      
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
  pages?: Array<{
    pageNumber: number;
    content: string;
    startChar: number;
    endChar: number;
  }>;
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
  let pages: Array<{
    pageNumber: number;
    content: string;
    startChar: number;
    endChar: number;
  }> | undefined;

  try {
    switch (fileType) {
      case 'pdf':
        try {
          const pdfParser = await getPdfParse();
          const pdfData = await pdfParser(buffer, {
            // 启用页面级别的文本提取
            pagerender: async (pageData: any) => {
              // 获取页面文本内容
              const textContent = await pageData.getTextContent();
              return textContent.items.map((item: any) => item.str).join(' ');
            }
          });
          
          content = pdfData.text;
          pageCount = pdfData.numpages;
          
          // 尝试按页分割内容
          if (pdfData.text && pageCount && pageCount > 1) {
            pages = [];
            // 简单的页面分割策略：按页数平均分割文本
            const avgCharsPerPage = Math.ceil(pdfData.text.length / pageCount);
            let currentPos = 0;
            
            for (let i = 1; i <= pageCount; i++) {
              const startChar = currentPos;
              let endChar = Math.min(currentPos + avgCharsPerPage, pdfData.text.length);
              
              // 尝试在句号或段落结束处分割
              if (i < pageCount && endChar < pdfData.text.length) {
                const nextPeriod = pdfData.text.indexOf('.', endChar);
                const nextNewline = pdfData.text.indexOf('\n', endChar);
                const breakPoint = Math.min(
                  nextPeriod > -1 ? nextPeriod + 1 : pdfData.text.length,
                  nextNewline > -1 ? nextNewline + 1 : pdfData.text.length
                );
                if (breakPoint > endChar && breakPoint - endChar < avgCharsPerPage * 0.3) {
                  endChar = breakPoint;
                }
              }
              
              const pageContent = pdfData.text.slice(startChar, endChar).trim();
              if (pageContent) {
                pages.push({
                  pageNumber: i,
                  content: pageContent,
                  startChar,
                  endChar: endChar - 1
                });
              }
              
              currentPos = endChar;
            }
          }
        } catch (pdfError) {
          console.error('PDF parsing error:', pdfError);
          // 如果PDF解析失败，返回错误信息而不是抛出异常
          throw new Error(`PDF parsing failed: ${pdfError instanceof Error ? pdfError.message : 'Unknown PDF error'}`);
        }
        break;

      case 'docx':
        const docxResult = await mammoth.extractRawText({ buffer });
        content = docxResult.value;
        // 对于Word文档，我们可以按段落或页面分割，这里简化处理
        if (content.length > 2000) {
          pages = [];
          const paragraphs = content.split('\n\n').filter(p => p.trim());
          let currentPage = 1;
          let currentPageContent = '';
          let currentPos = 0;
          
          for (const paragraph of paragraphs) {
            if (currentPageContent.length + paragraph.length > 2000 && currentPageContent) {
              pages.push({
                pageNumber: currentPage,
                content: currentPageContent.trim(),
                startChar: currentPos - currentPageContent.length,
                endChar: currentPos - 1
              });
              currentPage++;
              currentPageContent = paragraph + '\n\n';
            } else {
              currentPageContent += paragraph + '\n\n';
            }
            currentPos += paragraph.length + 2;
          }
          
          if (currentPageContent.trim()) {
            pages.push({
              pageNumber: currentPage,
              content: currentPageContent.trim(),
              startChar: currentPos - currentPageContent.length,
              endChar: currentPos - 1
            });
          }
        }
        break;

      case 'txt':
        content = buffer.toString('utf-8');
        // 对于文本文件，按行数分页
        if (content.length > 1000) {
          pages = [];
          const lines = content.split('\n');
          const linesPerPage = Math.max(50, Math.ceil(lines.length / Math.ceil(content.length / 1000)));
          let currentPos = 0;
          
          for (let i = 0; i < lines.length; i += linesPerPage) {
            const pageLines = lines.slice(i, i + linesPerPage);
            const pageContent = pageLines.join('\n');
            const startChar = currentPos;
            const endChar = currentPos + pageContent.length - 1;
            
            pages.push({
              pageNumber: Math.floor(i / linesPerPage) + 1,
              content: pageContent,
              startChar,
              endChar
            });
            
            currentPos += pageContent.length + 1; // +1 for newline
          }
        }
        break;

      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    if (!content.trim()) {
      throw new Error('No text content found in document');
    }

    return {
      content: content.trim(),
      pages,
      metadata: {
        filename,
        fileType,
        size: buffer.length,
        pageCount: pages ? pages.length : pageCount,
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

export interface ChunkWithPage {
  content: string;
  pageNumber: number | null;
  startChar: number;
  endChar: number;
  chunkIndex: number;
}

export function chunkText(
  text: string, 
  chunkSize: number = 1000, 
  overlap: number = 200,
  pages?: Array<{
    pageNumber: number;
    content: string;
    startChar: number;
    endChar: number;
  }>
): ChunkWithPage[] {
  const chunks: ChunkWithPage[] = [];
  
  // 如果有页面信息，基于页面进行分块
  if (pages && pages.length > 0) {
    let chunkIndex = 0;
    
    for (const page of pages) {
      const pageText = page.content;
      
      // 如果页面内容小于chunk大小，直接作为一个chunk
      if (pageText.length <= chunkSize) {
        chunks.push({
          content: pageText,
          pageNumber: page.pageNumber,
          startChar: page.startChar,
          endChar: page.endChar,
          chunkIndex: chunkIndex++
        });
      } else {
        // 页面内容较大，需要进一步分块
        const sentences = pageText.split(/[.!?]+/).filter(s => s.trim().length > 0);
        let currentChunk = '';
        let chunkStartChar = page.startChar;
        
        for (let i = 0; i < sentences.length; i++) {
          const sentence = sentences[i].trim();
          
          if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
            // 计算当前chunk在页面中的结束位置
            const chunkEndChar = chunkStartChar + currentChunk.length - 1;
            
            chunks.push({
              content: currentChunk.trim(),
              pageNumber: page.pageNumber,
              startChar: chunkStartChar,
              endChar: chunkEndChar,
              chunkIndex: chunkIndex++
            });
            
            // 创建重叠
            const words = currentChunk.split(' ');
            const overlapWords = words.slice(-Math.floor(overlap / 10));
            currentChunk = overlapWords.join(' ') + ' ' + sentence;
            chunkStartChar = chunkEndChar - (overlapWords.join(' ').length);
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          }
        }
        
        // 添加最后一个chunk
        if (currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            pageNumber: page.pageNumber,
            startChar: chunkStartChar,
            endChar: page.endChar,
            chunkIndex: chunkIndex++
          });
        }
      }
    }
  } else {
    // 没有页面信息，使用原来的分块方法
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let currentChunk = '';
    let chunkIndex = 0;
    let currentPos = 0;
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      if (currentChunk.length + trimmedSentence.length > chunkSize && currentChunk.length > 0) {
        const chunkStartPos = currentPos - currentChunk.length;
        chunks.push({
          content: currentChunk.trim(),
          pageNumber: null,
          startChar: chunkStartPos,
          endChar: currentPos - 1,
          chunkIndex: chunkIndex++
        });
        
        // Create overlap by keeping the last part of the current chunk
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(overlap / 10));
        currentChunk = overlapWords.join(' ') + ' ' + trimmedSentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
      }
      
      currentPos += trimmedSentence.length + 1; // +1 for delimiter
    }
    
    if (currentChunk.trim()) {
      const chunkStartPos = currentPos - currentChunk.length;
      chunks.push({
        content: currentChunk.trim(),
        pageNumber: null,
        startChar: chunkStartPos,
        endChar: currentPos - 1,
        chunkIndex: chunkIndex++
      });
    }
  }
  
  return chunks;
}

// 保持向后兼容的简单版本
export function chunkTextSimple(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks = chunkText(text, chunkSize, overlap);
  return chunks.map(chunk => chunk.content);
}