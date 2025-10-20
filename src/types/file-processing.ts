// 文件处理任务类型定义
export interface FileProcessingTask {
  id: string
  documentId: string
  userId: string
  fileName: string
  fileType: string
  blobUrl: string
  createdAt: string
}

// 文件处理状态
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'

// 知识库文档类型
export interface KnowledgeDocument {
  _id?: string
  userId: string
  title: string
  content: string
  summary: string
  category: string
  tags: string[]
  isPublic: boolean
  views: number
  likes: number
  createdAt: Date
  updatedAt: Date
  metadata: {
    fileName: string
    fileType: string
    fileSize: number
    blobUrl: string
    blobFileName: string
    processingStatus: ProcessingStatus
    wordCount: number
    readingTime: number
    difficulty: 'beginner' | 'intermediate' | 'advanced'
  }
}

// 文档块类型
export interface DocumentChunk {
  id: string
  documentId: string
  content: string
  embedding?: number[]
  metadata: {
    chunkIndex: number
    startChar: number
    endChar: number
  }
}