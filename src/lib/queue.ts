// 内存队列系统 - 替代Upstash Redis
import { EventEmitter } from 'events'

// 队列名称
const QUEUE_NAMES = {
  FILE_PROCESSING: 'knowledge:file-processing',
  EMBEDDING: 'knowledge:embedding',
  VECTOR_STORAGE: 'knowledge:vector-storage'
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
}

// 内存队列实现
class MemoryQueue<T> extends EventEmitter {
  private queue: T[] = []
  private processing = false

  push(item: T): void {
    this.queue.push(item)
    this.emit('item-added', item)
  }

  pop(): T | null {
    return this.queue.shift() || null
  }

  size(): number {
    return this.queue.length
  }

  isEmpty(): boolean {
    return this.queue.length === 0
  }

  clear(): void {
    this.queue = []
  }

  // 获取队列中的所有项目（用于调试）
  getAll(): T[] {
    return [...this.queue]
  }
}

// 队列实例
const queues = {
  [QUEUE_NAMES.FILE_PROCESSING]: new MemoryQueue<FileProcessingTask>(),
  [QUEUE_NAMES.EMBEDDING]: new MemoryQueue<EmbeddingTask>(),
  [QUEUE_NAMES.VECTOR_STORAGE]: new MemoryQueue<VectorStorageTask>()
}

// 推送文件处理任务到队列
export async function pushFileProcessingTask(task: FileProcessingTask): Promise<void> {
  try {
    queues[QUEUE_NAMES.FILE_PROCESSING].push(task)
    console.log(`文件处理任务已推送到队列: ${task.id}`)
  } catch (error) {
    console.error('推送文件处理任务失败:', error)
    throw error
  }
}

// 推送嵌入任务到队列
export async function pushEmbeddingTask(task: EmbeddingTask): Promise<void> {
  try {
    queues[QUEUE_NAMES.EMBEDDING].push(task)
    console.log(`嵌入任务已推送到队列: ${task.id}`)
  } catch (error) {
    console.error('推送嵌入任务失败:', error)
    throw error
  }
}

// 推送向量存储任务到队列
export async function pushVectorStorageTask(task: VectorStorageTask): Promise<void> {
  try {
    queues[QUEUE_NAMES.VECTOR_STORAGE].push(task)
    console.log(`向量存储任务已推送到队列: ${task.id}`)
  } catch (error) {
    console.error('推送向量存储任务失败:', error)
    throw error
  }
}

// 从队列中获取文件处理任务
export async function popFileProcessingTask(): Promise<FileProcessingTask | null> {
  try {
    const task = queues[QUEUE_NAMES.FILE_PROCESSING].pop()
    if (task) {
      console.log(`从队列中获取文件处理任务: ${task.id}`)
    }
    return task
  } catch (error) {
    console.error('获取文件处理任务失败:', error)
    return null
  }
}

// 从队列中获取嵌入任务
export async function popEmbeddingTask(): Promise<EmbeddingTask | null> {
  try {
    const task = queues[QUEUE_NAMES.EMBEDDING].pop()
    if (task) {
      console.log(`从队列中获取嵌入任务: ${task.id}`)
    }
    return task
  } catch (error) {
    console.error('获取嵌入任务失败:', error)
    return null
  }
}

// 从队列中获取向量存储任务
export async function popVectorStorageTask(): Promise<VectorStorageTask | null> {
  try {
    const task = queues[QUEUE_NAMES.VECTOR_STORAGE].pop()
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
  return {
    fileProcessing: {
      name: QUEUE_NAMES.FILE_PROCESSING,
      length: queues[QUEUE_NAMES.FILE_PROCESSING].size()
    },
    embedding: {
      name: QUEUE_NAMES.EMBEDDING,
      length: queues[QUEUE_NAMES.EMBEDDING].size()
    },
    vectorStorage: {
      name: QUEUE_NAMES.VECTOR_STORAGE,
      length: queues[QUEUE_NAMES.VECTOR_STORAGE].size()
    }
  }
}

// 清空所有队列（用于测试）
export function clearAllQueues(): void {
  Object.values(queues).forEach(queue => queue.clear())
  console.log('所有队列已清空')
}

// 导出队列实例（用于高级操作）
export { queues }