// 文件处理Worker服务
import dotenv from 'dotenv'
import path from 'path'

// 加载环境变量，确保从项目根目录加载
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

// 检查必要的环境变量
if (!process.env.PINECONE_API_KEY) {
  console.error('错误: 缺少 PINECONE_API_KEY 环境变量')
  process.exit(1)
}

if (!process.env.SILICONFLOW_API_KEY) {
  console.error('错误: 缺少 SILICONFLOW_API_KEY 环境变量')
  process.exit(1)
}

// 确保环境变量已加载后再导入其他模块
import { 
  popFileProcessingTask, 
  popEmbeddingTask, 
  popVectorStorageTask,
  pushEmbeddingTask,
  pushVectorStorageTask,
  retryFailedTask,
  FileProcessingTask,
  EmbeddingTask,
  VectorStorageTask
} from '../lib/file-queue';
import { pineconeIndex } from '../lib/pinecone';
import { getDatabase } from '@/lib/mongodb'
import { COLLECTIONS } from '@/lib/models'
import { ObjectId } from 'mongodb'

// 文件处理相关导入
import pdfParse from 'pdf-parse'
import * as mammoth from 'mammoth'
import Tesseract from 'tesseract.js'
import sharp from 'sharp'

// SiliconFlow Embedding API配置
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY
const SILICONFLOW_EMBEDDING_URL = 'https://api.siliconflow.cn/v1/embeddings'
const EMBEDDING_MODEL = 'Qwen/Qwen3-Embedding-0.6B'

// 文件下载函数
async function downloadFile(url: string): Promise<Buffer> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`下载文件失败: ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error('文件下载失败:', error)
    throw error
  }
}

// PDF解析
async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer)
    return data.text
  } catch (error) {
    console.error('PDF解析失败:', error)
    throw error
  }
}

// Word文档解析
async function parseWord(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } catch (error) {
    console.error('Word文档解析失败:', error)
    throw error
  }
}

// 图片OCR解析
async function parseImage(buffer: Buffer): Promise<string> {
  try {
    // 使用 sharp 预处理图片以提高 OCR 准确性
    const processedBuffer = await sharp(buffer)
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .grayscale()
      .normalize()
      .toBuffer()

    const { data: { text } } = await Tesseract.recognize(processedBuffer, 'chi_sim+eng')
    return text
  } catch (error) {
    console.error('图片OCR解析失败:', error)
    throw error
  }
}

// 文本分块函数
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): Array<{
  id: string
  content: string
  metadata: Record<string, any>
}> {
  const chunks: Array<{
    id: string
    content: string
    metadata: Record<string, any>
  }> = []
  
  // 清理文本
  const cleanText = text.replace(/\s+/g, ' ').trim()
  
  if (cleanText.length <= chunkSize) {
    chunks.push({
      id: `chunk_0`,
      content: cleanText,
      metadata: {
        chunkIndex: 0,
        totalChunks: 1,
        length: cleanText.length
      }
    })
    return chunks
  }
  
  let start = 0
  let chunkIndex = 0
  
  while (start < cleanText.length) {
    let end = start + chunkSize
    
    // 如果不是最后一块，尝试在句号、换行符或空格处分割
    if (end < cleanText.length) {
      const lastPeriod = cleanText.lastIndexOf('.', end)
      const lastNewline = cleanText.lastIndexOf('\n', end)
      const lastSpace = cleanText.lastIndexOf(' ', end)
      
      const breakPoint = Math.max(lastPeriod, lastNewline, lastSpace)
      if (breakPoint > start + chunkSize * 0.5) {
        end = breakPoint + 1
      }
    }
    
    const chunkContent = cleanText.slice(start, end).trim()
    if (chunkContent.length > 0) {
      chunks.push({
        id: `chunk_${chunkIndex}`,
        content: chunkContent,
        metadata: {
          chunkIndex,
          totalChunks: 0, // 会在最后更新
          length: chunkContent.length,
          startPosition: start,
          endPosition: end
        }
      })
      chunkIndex++
    }
    
    start = Math.max(end - overlap, start + 1)
  }
  
  // 更新总块数
  chunks.forEach(chunk => {
    chunk.metadata.totalChunks = chunks.length
  })
  
  return chunks
}

// SiliconFlow Embedding API调用
async function getEmbeddings(texts: string[]): Promise<number[][]> {
  if (!SILICONFLOW_API_KEY) {
    throw new Error('SILICONFLOW_API_KEY 未配置')
  }

  try {
    const response = await fetch(SILICONFLOW_EMBEDDING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts
      })
    })
    
    if (!response.ok) {
      throw new Error(`嵌入API请求失败: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data.data.map((item: any) => item.embedding)
  } catch (error) {
    console.error('获取嵌入向量失败:', error)
    throw error
  }
}

// 批量处理嵌入（每批最多20个文本）
async function batchEmbeddings(texts: string[]): Promise<number[][]> {
  const batchSize = 20
  const results: number[][] = []
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const embeddings = await getEmbeddings(batch)
    results.push(...embeddings)
    
    // 添加延迟避免API限制
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  return results
}

// 文件处理主函数
export async function processFile(task: FileProcessingTask): Promise<void> {
  try {
    console.log('开始处理文件:', task.fileName)
    
    // 1. 下载文件 - 使用blobUrl
    const fileUrl = task.blobUrl
    if (!fileUrl) {
      throw new Error('文件URL未找到')
    }
    const fileBuffer = await downloadFile(fileUrl)
    
    // 2. 根据文件类型解析内容
    let content: string
    
    if (task.fileType === 'application/pdf') {
      content = await parsePDF(fileBuffer)
    } else if (task.fileType.includes('word') || task.fileType.includes('document')) {
      content = await parseWord(fileBuffer)
    } else if (task.fileType.startsWith('image/')) {
      content = await parseImage(fileBuffer)
    } else if (task.fileType === 'text/plain') {
      content = fileBuffer.toString('utf-8')
    } else {
      throw new Error(`不支持的文件类型: ${task.fileType}`)
    }
    
    console.log(`文件解析完成，内容长度: ${content.length} 字符`)
    
    // 3. 文本分块
    const chunks = chunkText(content)
    console.log(`文本分块完成，共 ${chunks.length} 个块`)
    
    // 4. 更新数据库状态
    const db = await getDatabase()
    const collection = db.collection(COLLECTIONS.KNOWLEDGE_DOCS)
    
    await collection.updateOne(
      { _id: new ObjectId(task.documentId) },
      { 
        $set: { 
          status: 'processing',
          content,
          chunksCount: chunks.length,
          processedAt: new Date()
        } 
      }
    )
    
    // 5. 推送嵌入任务
    const embeddingTask: EmbeddingTask = {
      id: `embedding_${task.documentId}_${Date.now()}`,
      documentId: task.documentId,
      chunks: chunks.map(chunk => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          documentId: task.documentId,
          fileName: task.fileName,
          fileType: task.fileType,
          userId: task.userId
        }
      })),
      createdAt: new Date().toISOString()
    }
    
    await pushEmbeddingTask(embeddingTask)
    console.log('嵌入任务已推送到队列')
    
  } catch (error) {
    console.error('文件处理失败:', error)
    
    // 更新数据库状态为失败
    try {
      const db = await getDatabase()
      const collection = db.collection(COLLECTIONS.KNOWLEDGE_DOCS)
      
      await collection.updateOne(
        { _id: new ObjectId(task.documentId) },
        { 
          $set: { 
            status: 'failed',
            error: error instanceof Error ? error.message : '未知错误',
            processedAt: new Date()
          } 
        }
      )
    } catch (dbError) {
      console.error('更新数据库状态失败:', dbError)
    }
    
    throw error
  }
}

// 嵌入处理主函数
export async function processEmbedding(task: EmbeddingTask): Promise<void> {
  try {
    console.log('开始处理嵌入任务:', task.id)
    
    // 1. 提取文本内容
    const texts = task.chunks.map(chunk => chunk.content)
    
    // 2. 批量获取嵌入向量
    const embeddings = await batchEmbeddings(texts)
    console.log(`嵌入向量生成完成，共 ${embeddings.length} 个向量`)
    
    // 3. 准备向量数据
    const vectors = task.chunks.map((chunk, index) => ({
      id: `${task.documentId}_${chunk.id}`,
      values: embeddings[index],
      metadata: {
        ...chunk.metadata,
        content: chunk.content,
        documentId: task.documentId
      }
    }))
    
    // 4. 推送向量存储任务
    const vectorTask: VectorStorageTask = {
      id: `vector_${task.documentId}_${Date.now()}`,
      documentId: task.documentId,
      vectors,
      createdAt: new Date().toISOString()
    }
    
    await pushVectorStorageTask(vectorTask)
    console.log('向量存储任务已推送到队列')
    
  } catch (error) {
    console.error('嵌入处理失败:', error)
    throw error
  }
}

// 向量存储主函数
export async function processVectorStorage(task: VectorStorageTask): Promise<void> {
  try {
    console.log('开始处理向量存储任务:', task.id)
    
    // 1. 存储向量到Pinecone
    const formattedVectors = task.vectors.map(v => ({
      id: v.id,
      values: v.values,
      metadata: v.metadata
    }))
    await pineconeIndex.upsert(formattedVectors)
    console.log(`向量存储完成，共 ${task.vectors.length} 个向量`)
    
    // 2. 更新数据库状态
    const db = await getDatabase()
    const collection = db.collection(COLLECTIONS.KNOWLEDGE_DOCS)
    
    await collection.updateOne(
      { _id: new ObjectId(task.documentId) },
      { 
        $set: { 
          status: 'completed',
          vectorsCount: task.vectors.length,
          completedAt: new Date()
        } 
      }
    )
    
    console.log('知识库文档处理完成:', task.documentId)
    
  } catch (error) {
    console.error('向量存储失败:', error)
    
    // 更新数据库状态为失败
    try {
      const db = await getDatabase()
      const collection = db.collection(COLLECTIONS.KNOWLEDGE_DOCS)
      
      await collection.updateOne(
        { _id: new ObjectId(task.documentId) },
        { 
          $set: { 
            status: 'failed',
            error: error instanceof Error ? error.message : '向量存储失败',
            processedAt: new Date()
          } 
        }
      )
    } catch (dbError) {
      console.error('更新数据库状态失败:', dbError)
    }
    
    throw error
  }
}

// Worker主循环 - 增强版本，包含错误处理和重试机制
export async function startWorker(): Promise<void> {
  console.log('启动文件处理Worker...')
  
  while (true) {
    try {
      let hasTask = false
      
      // 处理文件处理任务
      console.log('检查文件处理队列...')
      const fileTask = await popFileProcessingTask()
      if (fileTask) {
        hasTask = true
        console.log('发现文件处理任务:', fileTask.id)
        try {
          await processFile(fileTask)
          console.log('文件处理任务完成:', fileTask.id)
        } catch (error) {
          console.error('文件处理任务失败:', fileTask.id, error)
          // 尝试重试任务
          const retried = await retryFailedTask('file-processing', fileTask)
          if (!retried) {
            console.error('文件处理任务达到最大重试次数，放弃处理:', fileTask.id)
          }
        }
        continue
      }
      
      // 处理嵌入任务
      console.log('检查嵌入任务队列...')
      const embeddingTask = await popEmbeddingTask()
      if (embeddingTask) {
        hasTask = true
        console.log('发现嵌入任务:', embeddingTask.id)
        try {
          await processEmbedding(embeddingTask)
          console.log('嵌入任务完成:', embeddingTask.id)
        } catch (error) {
          console.error('嵌入任务失败:', embeddingTask.id, error)
          // 尝试重试任务
          const retried = await retryFailedTask('embedding', embeddingTask)
          if (!retried) {
            console.error('嵌入任务达到最大重试次数，放弃处理:', embeddingTask.id)
          }
        }
        continue
      }
      
      // 处理向量存储任务
      console.log('检查向量存储队列...')
      const vectorTask = await popVectorStorageTask()
      if (vectorTask) {
        hasTask = true
        console.log('发现向量存储任务:', vectorTask.id)
        try {
          await processVectorStorage(vectorTask)
          console.log('向量存储任务完成:', vectorTask.id)
        } catch (error) {
          console.error('向量存储任务失败:', vectorTask.id, error)
          // 尝试重试任务
          const retried = await retryFailedTask('vector-storage', vectorTask)
          if (!retried) {
            console.error('向量存储任务达到最大重试次数，放弃处理:', vectorTask.id)
          }
        }
        continue
      }
      
      // 如果没有任务，等待时间更短以提高响应性
      if (!hasTask) {
        console.log('没有发现任务，等待500ms...')
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
    } catch (error) {
      console.error('Worker主循环发生错误:', error)
      // 等待3秒后继续，避免快速失败循环
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  }
}

// 优雅关闭处理
let isShuttingDown = false

export function gracefulShutdown(): void {
  if (isShuttingDown) return
  
  isShuttingDown = true
  console.log('Worker正在优雅关闭...')
  
  // 给当前任务一些时间完成
  setTimeout(() => {
    console.log('Worker已关闭')
    process.exit(0)
  }, 5000)
}

// 监听关闭信号
process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

// 如果直接运行此文件，启动Worker
if (require.main === module) {
  startWorker().catch(console.error)
}