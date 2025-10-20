'use client';

import React, { useState } from 'react';
import { X, Book, Building, Zap, Database, Code, Globe, Shield, TrendingUp } from 'lucide-react';

interface HelpMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpMenu: React.FC<HelpMenuProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState('overview');

  if (!isOpen) return null;

  const sections = [
    {
      id: 'overview',
      title: '系统概述',
      icon: Book,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">电商教育培训智能体</h3>
          <p className="text-gray-700">
            基于AI驱动的智能培训教育系统，专门针对电子商务教学领域。系统集成了文档处理、多媒体分析、智能问答、知识图谱等功能，为电商教育提供全方位的智能化支持。
          </p>
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">核心功能</h4>
            <ul className="text-blue-800 space-y-1 text-sm">
              <li>• 智能文档处理和向量化存储</li>
              <li>• 多媒体内容分析和提取</li>
              <li>• 基于RAG的智能问答系统</li>
              <li>• 知识图谱可视化展示</li>
              <li>• 实时处理队列监控</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'architecture',
      title: '系统架构',
      icon: Building,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">技术架构</h3>
          <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm">
            <pre className="whitespace-pre-wrap text-gray-700">
{`┌─────────────────────────────────────────┐
│           前端层 (Next.js)               │
├─────────────────────────────────────────┤
│ 文档上传 │ AI助手 │ 知识图谱 │ 文档管理  │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│         API网关层 (Next.js API)          │
├─────────────────────────────────────────┤
│ /api/chat │ /api/upload │ /api/graph   │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│            业务逻辑层                    │
├─────────────────────────────────────────┤
│ 文档处理 │ AI对话 │ 向量检索 │ 多媒体处理 │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│            数据存储层                    │
├─────────────────────────────────────────┤
│ MongoDB │ Pinecone │ 文件系统 │ Redis   │
└─────────────────────────────────────────┘`}
            </pre>
          </div>
        </div>
      )
    },
    {
      id: 'features',
      title: '功能特性',
      icon: Zap,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">核心特性</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">智能文档处理</h4>
              <ul className="text-green-800 space-y-1 text-sm">
                <li>• 支持PDF、DOC、TXT等格式</li>
                <li>• 自动文本提取和清理</li>
                <li>• 智能分块和向量化</li>
                <li>• 实时处理状态监控</li>
              </ul>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-medium text-purple-900 mb-2">多模态内容支持</h4>
              <ul className="text-purple-800 space-y-1 text-sm">
                <li>• PPT演示文稿处理</li>
                <li>• 图片OCR文字识别</li>
                <li>• 视频内容转录</li>
                <li>• 统一向量化存储</li>
              </ul>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <h4 className="font-medium text-orange-900 mb-2">智能问答系统</h4>
              <ul className="text-orange-800 space-y-1 text-sm">
                <li>• 基于RAG的上下文检索</li>
                <li>• 流式对话体验</li>
                <li>• 参考文档展示</li>
                <li>• 智能去重和排序</li>
              </ul>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg">
              <h4 className="font-medium text-indigo-900 mb-2">知识图谱可视化</h4>
              <ul className="text-indigo-800 space-y-1 text-sm">
                <li>• 文档关系挖掘</li>
                <li>• 交互式图谱展示</li>
                <li>• 知识点关联分析</li>
                <li>• 动态关系更新</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'tech-stack',
      title: '技术栈',
      icon: Code,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">技术栈详情</h3>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-medium text-gray-900">前端技术</h4>
              <p className="text-gray-700 text-sm mt-1">
                Next.js 14, TypeScript, Tailwind CSS, React Hooks, Lucide Icons
              </p>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-medium text-gray-900">后端技术</h4>
              <p className="text-gray-700 text-sm mt-1">
                Next.js API Routes, Python FastAPI, MongoDB, Pinecone, Redis
              </p>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <h4 className="font-medium text-gray-900">AI和机器学习</h4>
              <p className="text-gray-700 text-sm mt-1">
                SiliconFlow API, OpenAI Embeddings, Sentence Transformers
              </p>
            </div>
            <div className="border-l-4 border-orange-500 pl-4">
              <h4 className="font-medium text-gray-900">部署和运维</h4>
              <p className="text-gray-700 text-sm mt-1">
                Docker, Vercel, 云服务, 容器化部署
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'data-flow',
      title: '数据流程',
      icon: TrendingUp,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">核心数据流程</h3>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">文档上传流程</h4>
              <div className="text-blue-800 text-sm">
                用户上传文档 → 前端验证 → API接收 → 文件存储 → Python处理器 → 文本提取 → 向量化 → Pinecone存储 → MongoDB元数据更新 → 状态通知
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">AI对话流程</h4>
              <div className="text-green-800 text-sm">
                用户提问 → 向量检索 → 相关文档匹配 → 上下文构建 → SiliconFlow API → 流式响应 → 参考文档整理 → 前端展示
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-medium text-purple-900 mb-2">多媒体处理流程</h4>
              <div className="text-purple-800 text-sm">
                多媒体上传 → 格式识别 → 内容提取 → 文本转换 → 向量化处理 → 存储索引 → 状态更新
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'security',
      title: '安全性能',
      icon: Shield,
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">安全和性能</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-medium text-red-900 mb-2">安全措施</h4>
              <ul className="text-red-800 space-y-1 text-sm">
                <li>• 文件类型验证</li>
                <li>• 上传大小限制</li>
                <li>• API访问控制</li>
                <li>• 数据加密存储</li>
              </ul>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-medium text-yellow-900 mb-2">性能优化</h4>
              <ul className="text-yellow-800 space-y-1 text-sm">
                <li>• 向量检索优化</li>
                <li>• 流式响应处理</li>
                <li>• 缓存策略</li>
                <li>• 异步任务处理</li>
              </ul>
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">扩展性设计</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <h5 className="font-medium text-gray-800">水平扩展</h5>
                <ul className="text-gray-700 space-y-1">
                  <li>• 微服务架构</li>
                  <li>• 负载均衡</li>
                  <li>• 数据库分片</li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-gray-800">功能扩展</h5>
                <ul className="text-gray-700 space-y-1">
                  <li>• 插件化架构</li>
                  <li>• API标准化</li>
                  <li>• 模块化设计</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex">
        {/* 侧边栏 */}
        <div className="w-64 bg-gray-50 rounded-l-lg border-r border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">系统帮助</h2>
          </div>
          <nav className="p-2">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`
                    w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left text-sm
                    ${activeSection === section.id
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  <span>{section.title}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 flex flex-col">
          {/* 头部 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {sections.find(s => s.id === activeSection)?.title}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-y-auto p-6">
            {sections.find(s => s.id === activeSection)?.content}
          </div>

          {/* 底部 */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-br-lg">
            <p className="text-sm text-gray-600 text-center">
              电商教育培训智能体 - 基于奥派大模型的智能培训教育系统
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpMenu;