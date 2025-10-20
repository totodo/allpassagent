// 数据库集合名称常量
export const COLLECTIONS = {
  KNOWLEDGE_DOCS: 'knowledge_docs',
  DOCUMENT_CHUNKS: 'document_chunks',
  CHAT_SESSIONS: 'chat_sessions',
  CHAT_MESSAGES: 'chat_messages',
  USERS: 'users'
} as const

// 文档状态枚举
export enum DocumentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing', 
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// 处理状态枚举
export enum ProcessingStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// 知识库文档接口
export interface KnowledgeDoc {
  _id?: string
  filename: string
  originalName: string
  fileSize: number
  mimeType: string
  uploadedAt: Date
  status: DocumentStatus
  processingStatus: ProcessingStatus
  chunks?: number
  vectors?: number
  error?: string
  metadata?: {
    title?: string
    author?: string
    subject?: string
    keywords?: string[]
    pages?: number
    wordCount?: number
  }
}

// 文档块接口
export interface DocumentChunk {
  _id?: string
  docId: string
  chunkIndex: number
  content: string
  embedding?: number[]
  metadata?: {
    page?: number
    section?: string
    title?: string
  }
  createdAt: Date
}

// 聊天会话接口
export interface ChatSession {
  _id?: string
  userId?: string
  title: string
  createdAt: Date
  updatedAt: Date
  messageCount: number
}

// 聊天消息接口
export interface ChatMessage {
  _id?: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: {
    sources?: string[]
    tokens?: number
    model?: string
  }
}

// 用户接口
export interface User {
  _id?: string
  email: string
  name: string
  avatar?: string
  createdAt: Date
  lastLoginAt?: Date
  preferences?: {
    theme?: 'light' | 'dark'
    language?: string
  }
}