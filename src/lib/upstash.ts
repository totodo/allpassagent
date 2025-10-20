// 导出队列操作函数
export {
  pushFileProcessingTask,
  popFileProcessingTask,
  pushEmbeddingTask,
  popEmbeddingTask,
  pushVectorStorageTask,
  popVectorStorageTask,
  getQueueStatus,
  retryFailedTask,
  clearQueue,
  clearAllQueues
} from './file-queue'

// 导出向量操作函数
export { pineconeIndex } from './pinecone'

// 导入需要的函数用于别名
import { 
  pushFileProcessingTask,
  popFileProcessingTask,
  getQueueStatus
} from './file-queue'
import { pineconeIndex } from './pinecone'

// 为了向后兼容性，提供别名
export const vectorClient = pineconeIndex

// 为了向后兼容性，提供 redis 别名
export const redis = {
  push: pushFileProcessingTask,
  pop: popFileProcessingTask,
  status: getQueueStatus
}