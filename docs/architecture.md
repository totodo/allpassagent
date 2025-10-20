# 电商教育培训智能体 - 系统架构文档

## 项目概述

电商教育培训智能体是一个基于AI驱动的智能培训教育系统，专门针对电子商务教学领域。系统集成了文档处理、多媒体分析、智能问答、知识图谱等功能，为电商教育提供全方位的智能化支持。

## 技术架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层 (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│  文档上传  │  多媒体上传  │  文档管理  │  AI助手  │  知识图谱  │
│  DocumentUpload │ MultimediaUpload │ DocumentManager │ ChatInterface │ KnowledgeGraph │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      API网关层 (Next.js API)                 │
├─────────────────────────────────────────────────────────────┤
│  /api/upload  │  /api/chat  │  /api/graph  │  /api/files  │  /api/multimedia  │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      业务逻辑层                              │
├─────────────────────────────────────────────────────────────┤
│  文档处理服务  │  AI对话服务  │  向量检索服务  │  多媒体处理服务  │
│  (Python)     │  (SiliconFlow) │  (Pinecone)   │  (Python)      │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                        数据存储层                            │
├─────────────────────────────────────────────────────────────┤
│    MongoDB     │    Pinecone    │    本地文件系统    │    Redis队列    │
│   (文档元数据)   │   (向量数据库)   │   (文件存储)      │   (任务队列)    │
└─────────────────────────────────────────────────────────────┘
```

## 核心模块

### 1. 前端层 (Next.js + React + TypeScript)

#### 主要组件
- **主页面** (`src/app/page.tsx`)
  - 统一的导航界面
  - 标签页切换管理
  - 响应式布局设计

- **文档上传** (`src/components/DocumentUpload.tsx`)
  - 支持多种文档格式 (PDF, DOC, TXT等)
  - 拖拽上传功能
  - 上传进度显示

- **多媒体上传** (`src/components/MultimediaUpload.tsx`)
  - 支持PPT、图片、视频等格式
  - 多媒体内容预处理
  - 批量上传管理

- **AI聊天界面** (`src/components/ChatInterface.tsx`)
  - 流式对话显示
  - 参考文档展示
  - 文件链接功能
  - 智能推荐显示

- **知识图谱** (`src/components/KnowledgeGraph.tsx`)
  - 可视化知识关系
  - 交互式图谱操作
  - 节点详情展示

- **文档管理** (`src/components/DocumentManager.tsx`)
  - 文档列表管理
  - 搜索和筛选
  - 文档状态监控

### 2. API网关层 (Next.js API Routes)

#### 核心API接口

- **聊天API** (`src/app/api/chat/route.ts`)
  - 处理用户对话请求
  - 集成SiliconFlow AI服务
  - 向量检索和上下文匹配
  - 流式响应处理
  - 参考文档去重和排序

- **文件上传API** (`src/app/api/upload/route.ts`)
  - 文件接收和验证
  - 文档预处理调度
  - 元数据存储

- **文件访问API** (`src/app/api/files/route.ts`)
  - 文件下载服务
  - 文件预览功能
  - 访问权限控制

- **知识图谱API** (`src/app/api/graph/route.ts`)
  - 图谱数据查询
  - 关系数据构建
  - 图谱可视化数据

- **多媒体API** (`src/app/api/multimedia/route.ts`)
  - 多媒体文件处理
  - 内容提取和分析
  - 向量化存储

### 3. 业务逻辑层

#### Python服务模块

- **文档处理器** (`python/document_processor.py`)
  - 多格式文档解析
  - 文本提取和清理
  - 分块处理和向量化
  - Pinecone向量存储

- **多媒体处理** (`python/multimedia_api.py`)
  - PPT内容提取
  - 图片OCR识别
  - 视频转录处理
  - 多模态向量化

- **队列管理** (`python/queue_manager.py`)
  - Redis任务队列
  - 异步任务处理
  - 进度跟踪和状态更新

#### AI服务集成

- **SiliconFlow API**
  - 大语言模型对话
  - 流式响应处理
  - 上下文理解和生成

- **Pinecone向量数据库**
  - 高维向量存储
  - 相似度检索
  - 实时索引更新

### 4. 数据存储层

#### MongoDB数据库
```javascript
// 文档集合结构
{
  _id: ObjectId,
  filename: String,
  originalName: String,
  fileType: String,
  fileSize: Number,
  uploadDate: Date,
  processedDate: Date,
  status: String, // 'pending', 'processing', 'completed', 'failed'
  metadata: {
    pageCount: Number,
    wordCount: Number,
    language: String
  },
  pineconeId: String,
  tags: [String],
  userId: String
}
```

#### Pinecone向量数据库
```javascript
// 向量记录结构
{
  id: String,
  values: [Number], // 1536维向量
  metadata: {
    filename: String,
    content: String,
    page: Number,
    chunk_id: String,
    file_type: String,
    upload_date: String
  }
}
```

#### Redis队列
```javascript
// 任务队列结构
{
  task_id: String,
  task_type: String, // 'document', 'multimedia'
  file_path: String,
  status: String, // 'pending', 'processing', 'completed', 'failed'
  created_at: Timestamp,
  updated_at: Timestamp,
  progress: Number,
  error_message: String
}
```

## 数据流程

### 1. 文档上传流程
```
用户上传文档 → 前端验证 → API接收 → 文件存储 → 
Python处理器 → 文本提取 → 向量化 → Pinecone存储 → 
MongoDB元数据更新 → 状态通知
```

### 2. AI对话流程
```
用户提问 → 向量检索 → 相关文档匹配 → 上下文构建 → 
SiliconFlow API → 流式响应 → 参考文档整理 → 前端展示
```

### 3. 多媒体处理流程
```
多媒体上传 → 格式识别 → 内容提取 → 文本转换 → 
向量化处理 → 存储索引 → 状态更新
```

## 核心特性

### 1. 智能文档处理
- 支持多种文档格式
- 自动文本提取和清理
- 智能分块和向量化
- 实时处理状态监控

### 2. 多模态内容支持
- PPT演示文稿处理
- 图片OCR文字识别
- 视频内容转录
- 统一向量化存储

### 3. 智能问答系统
- 基于RAG的上下文检索
- 流式对话体验
- 参考文档展示
- 智能去重和排序

### 4. 知识图谱可视化
- 文档关系挖掘
- 交互式图谱展示
- 知识点关联分析

### 5. 实时监控管理
- 文件处理队列监控
- 系统状态实时更新
- 错误处理和重试机制

## 技术栈详情

### 前端技术
- **Next.js 14**: React全栈框架
- **TypeScript**: 类型安全开发
- **Tailwind CSS**: 原子化CSS框架
- **Lucide React**: 图标库
- **React Hooks**: 状态管理

### 后端技术
- **Next.js API Routes**: 服务端API
- **Python FastAPI**: 文档处理服务
- **MongoDB**: 文档数据库
- **Pinecone**: 向量数据库
- **Redis**: 缓存和队列

### AI和机器学习
- **SiliconFlow**: 大语言模型服务
- **OpenAI Embeddings**: 文本向量化
- **Sentence Transformers**: 多语言向量模型

### 部署和运维
- **Docker**: 容器化部署
- **Vercel**: 前端部署平台
- **云服务**: 弹性计算资源

## 安全和性能

### 安全措施
- 文件类型验证
- 上传大小限制
- API访问控制
- 数据加密存储

### 性能优化
- 向量检索优化
- 流式响应处理
- 缓存策略
- 异步任务处理

## 扩展性设计

### 水平扩展
- 微服务架构
- 负载均衡
- 数据库分片
- 缓存集群

### 功能扩展
- 插件化架构
- API标准化
- 模块化设计
- 配置化管理

## 监控和日志

### 系统监控
- 应用性能监控
- 数据库性能跟踪
- API响应时间统计
- 错误率监控

### 日志管理
- 结构化日志
- 日志聚合分析
- 错误追踪
- 审计日志

---

*本文档描述了电商教育培训智能体的完整技术架构，涵盖了从前端用户界面到后端数据存储的各个层面，为系统的开发、部署和维护提供了全面的技术指导。*