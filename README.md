# 电商教育智能助手

一个基于 AI 的电商教育培训平台，支持文档上传、智能问答、知识图谱可视化和文档管理功能。

## 功能特性

### 🚀 核心功能
- **文档上传与处理**: 支持 PDF、Word、TXT 等多种格式文档上传
- **智能问答**: 基于上传文档内容的 AI 智能问答，支持流式输出
- **知识图谱**: 可视化展示文档间的关系和知识结构
- **文档管理**: 查看、删除已上传的文档

### 🔧 技术特色
- **向量语义搜索**: 使用 Pinecone 向量数据库实现高精度文档检索
- **流式AI回答**: 集成 SiliconFlow API，支持实时流式响应
- **现代化UI**: 基于 Tailwind CSS 的响应式设计
- **高性能数据处理**: Python + FastAPI 后端处理文档解析和向量化

## 技术架构

### 前端技术栈
- **Next.js 15**: React 全栈框架
- **TypeScript**: 类型安全的 JavaScript
- **Tailwind CSS**: 原子化 CSS 框架
- **Lucide React**: 现代图标库
- **React Force Graph**: 知识图谱可视化

### 后端技术栈
- **Next.js API Routes**: 服务端 API
- **MongoDB**: 文档数据存储
- **Pinecone**: 向量数据库
- **SiliconFlow API**: AI 模型服务
- **Python FastAPI**: 文档处理服务

## 快速开始

### 环境要求
- Node.js 18+
- Python 3.8+
- MongoDB
- Pinecone 账户
- SiliconFlow API Key

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd allpassagent
```

2. **安装依赖**
```bash
# 安装 Node.js 依赖
npm install

# 安装 Python 依赖
cd python
pip install -r requirements.txt
cd ..
```

3. **环境配置**
复制 `.env.local.example` 到 `.env.local` 并配置：

```env
# OpenAI API Key (用于文档嵌入)
OPENAI_API_KEY=your-openai-api-key-here

# Pinecone Configuration
PINECONE_API_KEY=your-pinecone-api-key-here
PINECONE_INDEX_NAME=your-pinecone-index-name

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/allpassagent

# SiliconFlow API Key (用于AI对话)
SILICONFLOW_API_KEY=your-siliconflow-api-key-here
```

4. **启动服务**
```bash
# 启动开发服务器
npm run dev
```

访问 http://localhost:3000 查看应用。

## SiliconFlow API 配置

### 获取 API Key
1. 访问 [SiliconFlow 官网](https://siliconflow.cn/)
2. 注册账户并登录
3. 在控制台中创建 API Key
4. 将 API Key 配置到 `.env.local` 文件中

### 支持的模型
- `Qwen/Qwen2.5-7B-Instruct`: 默认使用的对话模型
- 其他 SiliconFlow 支持的模型可在代码中配置

### 流式输出特性
- 实时显示 AI 回答过程
- 支持长文本逐步展示
- 优化用户体验

## 使用指南

### 1. 文档上传
- 点击"文档上传"标签页
- 拖拽或选择文件上传
- 支持格式：PDF、DOC、DOCX、TXT
- 自动处理并向量化存储

### 2. AI 问答
- 点击"AI 助手"标签页
- 输入问题并发送
- AI 基于上传的文档内容回答
- 显示相关文档来源

### 3. 知识图谱
- 点击"知识图谱"标签页
- 查看文档间的关系网络
- 支持搜索和筛选功能

### 4. 文档管理
- 点击"文档管理"标签页
- 查看所有已上传文档
- 支持删除不需要的文档

## API 接口

### 文档相关
- `POST /api/upload` - 文档上传
- `POST /api/process` - 文档处理
- `GET /api/documents` - 获取文档列表
- `DELETE /api/documents` - 删除文档

### AI 对话
- `POST /api/chat` - AI 对话接口（支持流式输出）

### 知识图谱
- `GET /api/graph` - 获取知识图谱数据

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── chat/         # AI 对话接口
│   │   ├── documents/    # 文档管理接口
│   │   ├── graph/        # 知识图谱接口
│   │   ├── process/      # 文档处理接口
│   │   └── upload/       # 文档上传接口
│   ├── globals.css       # 全局样式
│   ├── layout.tsx        # 根布局
│   └── page.tsx          # 主页面
├── components/            # React 组件
│   ├── ChatInterface.tsx # AI 对话界面
│   ├── DocumentManager.tsx # 文档管理
│   ├── DocumentUpload.tsx # 文档上传
│   └── KnowledgeGraph.tsx # 知识图谱
├── lib/                  # 工具库
│   ├── mongodb.ts       # MongoDB 连接
│   ├── openai.ts        # OpenAI 配置
│   ├── pinecone.ts      # Pinecone 配置
│   └── utils.ts         # 工具函数
└── types/               # TypeScript 类型定义
```

## 开发说明

### 本地开发
```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器
npm run lint         # 代码检查
```

### 代码规范
- 使用 TypeScript 进行类型检查
- 遵循 ESLint 代码规范
- 使用 Prettier 格式化代码

## 部署指南

### Vercel 部署
1. 连接 GitHub 仓库到 Vercel
2. 配置环境变量
3. 自动部署

### 环境变量配置
确保在部署平台配置所有必要的环境变量：
- `OPENAI_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME`
- `MONGODB_URI`
- `SILICONFLOW_API_KEY`

## 故障排除

### 常见问题

1. **文档上传失败**
   - 检查文件格式是否支持
   - 确认文件大小不超过限制

2. **AI 回答异常**
   - 检查 SiliconFlow API Key 是否正确
   - 确认网络连接正常

3. **知识图谱不显示**
   - 检查是否有上传的文档
   - 确认 MongoDB 连接正常

### 日志查看
```bash
# 查看应用日志
npm run dev

# 查看构建日志
npm run build
```

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请通过以下方式联系：
- 邮箱：your-email@example.com
- GitHub Issues：[项目 Issues 页面]

---

**注意**: 请确保在生产环境中妥善保管 API Keys 和数据库连接信息。
