// 基于文件系统的持久化队列实现
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// 队列目录
const QUEUE_DIR = path.join(process.cwd(), '.queue')

// 队列名称
const QUEUE_NAMES = {
  FILE_PROCESSING: 'file-processing',
  EMBEDDING: 'embedding',
  VECTOR_STORAGE: 'vector-storage'
} as const

// 任务类型定义
export interface FileProcessingTask {
  id: string
  documentId: string
  userId: string
  fileName: string
  fileType: string
  blobUrl: string
  createdAt: string
  retryCount?: number
  maxRetries?: number
}

export interface EmbeddingTask {
  id: string
  documentId: string
  chunks: Array<{
    id: string
    content: string
    metadata: Record<string, any>
  }>
  createdAt: string
  retryCount?: number
  maxRetries?: number
}

export interface VectorStorageTask {
  id: string
  documentId: string
  vectors: Array<{
    id: string
    values: number[]
    metadata: Record<string, any>
  }>
  createdAt: string
  retryCount?: number
  maxRetries?: number
}

// 确保队列目录存在
async function ensureQueueDir(): Promise<void> {
  try {
    await fs.access(QUEUE_DIR)
  } catch {
    await fs.mkdir(QUEUE_DIR, { recursive: true })
  }
}

// 获取队列文件路径
function getQueuePath(queueName: string): string {
  return path.join(QUEUE_DIR, `${queueName}.json`)
}

// 读取队列
async function readQueue<T>(queueName: string): Promise<T[]> {
  await ensureQueueDir()
  const queuePath = getQueuePath(queueName)
  
  try {
    const data = await fs.readFile(queuePath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

// 写入队列
async function writeQueue<T>(queueName: string, items: T[]): Promise<void> {
  await ensureQueueDir()
  const queuePath = getQueuePath(queueName)
  await fs.writeFile(queuePath, JSON.stringify(items, null, 2))
}

// 推送任务到队列
async function pushToQueue<T>(queueName: string, task: T): Promise<void> {
  const items = await readQueue<T>(queueName)
  items.push(task)
  await writeQueue(queueName, items)
}

// 从队列中弹出任务
async function popFromQueue<T>(queueName: string): Promise<T | null> {
  const items = await readQueue<T>(queueName)
  if (items.length === 0) {
    return null
  }
  
  const task = items.shift()!
  await writeQueue(queueName, items)
  return task
}

// 获取队列长度
async function getQueueLength(queueName: string): Promise<number> {
  const items = await readQueue(queueName)
  return items.length
}

// 文件处理任务队列操作
export async function pushFileProcessingTask(task: FileProcessingTask): Promise<void> {
  try {
    const taskWithDefaults = {
      ...task,
      retryCount: task.retryCount || 0,
      maxRetries: task.maxRetries || 3
    }
    await pushToQueue(QUEUE_NAMES.FILE_PROCESSING, taskWithDefaults)
    console.log(`文件处理任务已推送到队列: ${task.id}`)
  } catch (error) {
    console.error('推送文件处理任务失败:', error)
    throw error
  }
}

export async function popFileProcessingTask(): Promise<FileProcessingTask | null> {
  try {
    const task = await popFromQueue<FileProcessingTask>(QUEUE_NAMES.FILE_PROCESSING)
    if (task) {
      console.log(`从队列中获取文件处理任务: ${task.id}`)
    }
    return task
  } catch (error) {
    console.error('获取文件处理任务失败:', error)
    return null
  }
}

// 嵌入任务队列操作
export async function pushEmbeddingTask(task: EmbeddingTask): Promise<void> {
  try {
    const taskWithDefaults = {
      ...task,
      retryCount: task.retryCount || 0,
      maxRetries: task.maxRetries || 3
    }
    await pushToQueue(QUEUE_NAMES.EMBEDDING, taskWithDefaults)
    console.log(`嵌入任务已推送到队列: ${task.id}`)
  } catch (error) {
    console.error('推送嵌入任务失败:', error)
    throw error
  }
}

export async function popEmbeddingTask(): Promise<EmbeddingTask | null> {
  try {
    const task = await popFromQueue<EmbeddingTask>(QUEUE_NAMES.EMBEDDING)
    if (task) {
      console.log(`从队列中获取嵌入任务: ${task.id}`)
    }
    return task
  } catch (error) {
    console.error('获取嵌入任务失败:', error)
    return null
  }
}

// 向量存储任务队列操作
export async function pushVectorStorageTask(task: VectorStorageTask): Promise<void> {
  try {
    const taskWithDefaults = {
      ...task,
      retryCount: task.retryCount || 0,
      maxRetries: task.maxRetries || 3
    }
    await pushToQueue(QUEUE_NAMES.VECTOR_STORAGE, taskWithDefaults)
    console.log(`向量存储任务已推送到队列: ${task.id}`)
  } catch (error) {
    console.error('推送向量存储任务失败:', error)
    throw error
  }
}

export async function popVectorStorageTask(): Promise<VectorStorageTask | null> {
  try {
    const task = await popFromQueue<VectorStorageTask>(QUEUE_NAMES.VECTOR_STORAGE)
    if (task) {
      console.log(`从队列中获取向量存储任务: ${task.id}`)
    }
    return task
  } catch (error) {
    console.error('获取向量存储任务失败:', error)
    return null
  }
}

// 获取队列状态
export async function getQueueStatus() {
  try {
    const fileProcessingLength = await getQueueLength(QUEUE_NAMES.FILE_PROCESSING)
    const embeddingLength = await getQueueLength(QUEUE_NAMES.EMBEDDING)
    const vectorStorageLength = await getQueueLength(QUEUE_NAMES.VECTOR_STORAGE)
    
    return {
      fileProcessing: {
        name: QUEUE_NAMES.FILE_PROCESSING,
        length: fileProcessingLength
      },
      embedding: {
        name: QUEUE_NAMES.EMBEDDING,
        length: embeddingLength
      },
      vectorStorage: {
        name: QUEUE_NAMES.VECTOR_STORAGE,
        length: vectorStorageLength
      },
      total: fileProcessingLength + embeddingLength + vectorStorageLength
    }
  } catch (error) {
    console.error('获取队列状态失败:', error)
    throw error
  }
}

// 重试失败的任务
export async function retryFailedTask<T extends { retryCount?: number; maxRetries?: number }>(
  queueName: string,
  task: T
): Promise<boolean> {
  const retryCount = (task.retryCount || 0) + 1
  const maxRetries = task.maxRetries || 3
  
  if (retryCount <= maxRetries) {
    const retryTask = { ...task, retryCount }
    await pushToQueue(queueName, retryTask)
    console.log(`任务重试 ${retryCount}/${maxRetries}: ${(task as any).id}`)
    return true
  } else {
    console.log(`任务达到最大重试次数，放弃重试: ${(task as any).id}`)
    return false
  }
}

// 清空队列（用于测试和维护）
export async function clearQueue(queueName: string): Promise<void> {
  await writeQueue(queueName, [])
  console.log(`队列已清空: ${queueName}`)
}

// 清空所有队列
export async function clearAllQueues(): Promise<void> {
  await Promise.all([
    clearQueue(QUEUE_NAMES.FILE_PROCESSING),
    clearQueue(QUEUE_NAMES.EMBEDDING),
    clearQueue(QUEUE_NAMES.VECTOR_STORAGE)
  ])
  console.log('所有队列已清空')
}