import { parseDocument, chunkText } from '@/lib/document-parser'
import { createEmbedding } from '@/lib/siliconflow-embedding'
import { getDatabase } from '@/lib/mongodb'
import { COLLECTIONS } from '@/lib/constants'
import { FileProcessingTask, DocumentChunk } from '@/types/file-processing'
import { ObjectId } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'

// 处理文件内容并生成向量
export async function processFile(task: FileProcessingTask): Promise<void> {
  console.log(`开始处理文件: ${task.fileName}`)
  
  try {
    const db = await getDatabase()
    const docsCollection = db.collection(COLLECTIONS.DOCUMENTS)
    const chunksCollection = db.collection(COLLECTIONS.DOCUMENT_CHUNKS)

    // 更新文档状态为处理中
    await docsCollection.updateOne(
      { _id: new ObjectId(task.documentId) },
      { 
        $set: { 
          'metadata.processingStatus': 'processing',
          updatedAt: new Date()
        } 
      }
    )

    // 从 Blob URL 下载文件
    const response = await fetch(task.blobUrl)
    if (!response.ok) {
      throw new Error(`下载文件失败: ${response.statusText}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    // 解析文档内容
    const parsedDoc = await parseDocument(buffer, task.fileName, task.fileType)
    
    // 分块处理文本
    const chunks = chunkText(parsedDoc.content)
    
    // 为每个块生成向量
    const documentChunks: DocumentChunk[] = []
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = chunks[i]
      
      try {
        // 生成向量
        const embedding = await createEmbedding(chunkContent)
        
        const documentChunk: DocumentChunk = {
          id: uuidv4(),
          documentId: task.documentId,
          content: chunkContent,
          embedding: embedding,
          metadata: {
            chunkIndex: i,
            startChar: i * 1000, // 估算起始字符位置
            endChar: (i + 1) * 1000 // 估算结束字符位置
          }
        }
        
        documentChunks.push(documentChunk)
        
        // 批量插入，每10个块插入一次
        if (documentChunks.length >= 10) {
          await chunksCollection.insertMany([...documentChunks])
          documentChunks.length = 0 // 清空数组
        }
        
      } catch (embeddingError) {
        console.error(`生成向量失败 (块 ${i}):`, embeddingError)
        // 继续处理其他块
      }
    }
    
    // 插入剩余的块
    if (documentChunks.length > 0) {
      await chunksCollection.insertMany(documentChunks)
    }

    // 计算阅读时间 (假设每分钟250字)
    const wordCount = parsedDoc.content.length
    const readingTime = Math.ceil(wordCount / 250)

    // 更新文档内容和状态
    await docsCollection.updateOne(
      { _id: new ObjectId(task.documentId) },
      { 
        $set: { 
          content: parsedDoc.content,
          'metadata.processingStatus': 'completed',
          'metadata.wordCount': wordCount,
          'metadata.readingTime': readingTime,
          updatedAt: new Date()
        } 
      }
    )

    console.log(`文件处理完成: ${task.fileName}, 生成了 ${chunks.length} 个文档块`)

  } catch (error) {
    console.error(`文件处理失败: ${task.fileName}`, error)
    
    // 更新文档状态为失败
    const db = await getDatabase()
    const docsCollection = db.collection(COLLECTIONS.KNOWLEDGE_DOCS)
    
    await docsCollection.updateOne(
      { _id: new ObjectId(task.documentId) },
      { 
        $set: { 
          'metadata.processingStatus': 'failed',
          updatedAt: new Date()
        } 
      }
    )
    
    throw error
  }
}