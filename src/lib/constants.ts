// 数据库集合名称常量
export const COLLECTIONS = {
  KNOWLEDGE_DOCS: 'knowledge_docs',
  DOCUMENTS: 'documents',
  DOCUMENT_CHUNKS: 'document_chunks',
  USERS: 'users'
} as const

// 支持的文件类型
export const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'audio/mpeg'
] as const

// 文件大小限制 (50MB)
export const MAX_FILE_SIZE = 50 * 1024 * 1024