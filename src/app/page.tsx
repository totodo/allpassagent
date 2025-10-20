'use client';

import React, { useState } from 'react';
import { FileText, MessageSquare, Network, Upload, Activity, Monitor, HelpCircle } from 'lucide-react';
import DocumentUpload from '@/components/DocumentUpload';
import DocumentManager from '@/components/DocumentManager';
import ChatInterface from '@/components/ChatInterface';
import KnowledgeGraph from '@/components/KnowledgeGraph';
import QueueMonitor from '@/components/QueueMonitor';
import MultimediaUpload from '@/components/MultimediaUpload';
import HelpMenu from '@/components/HelpMenu';

type ActiveTab = 'upload' | 'manage' | 'chat' | 'graph' | 'queue' | 'multimedia';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('upload');
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const tabs = [
    {
      id: 'upload' as const,
      name: '文档上传',
      icon: Upload,
      description: '上传和处理文档',
    },
    {
      id: 'multimedia' as const,
      name: '多媒体上传',
      icon: Monitor,
      description: '上传PPT、图片、视频等',
    },
    {
      id: 'manage' as const,
      name: '文档管理',
      icon: FileText,
      description: '管理已上传的文档',
    },
    {
      id: 'chat' as const,
      name: 'AI 助手',
      icon: MessageSquare,
      description: '智能问答',
    },
    {
      id: 'graph' as const,
      name: '知识图谱',
      icon: Network,
      description: '可视化知识关系',
    },
    {
      id: 'queue' as const,
      name: '队列监控',
      icon: Activity,
      description: '监控文件处理队列状态',
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'upload':
        return <DocumentUpload />;
      case 'multimedia':
        return <MultimediaUpload />;
      case 'manage':
        return <DocumentManager />;
      case 'chat':
        return <ChatInterface />;
      case 'graph':
        return <KnowledgeGraph />;
      case 'queue':
        return <QueueMonitor />;
      default:
        return <DocumentUpload />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  奥派科技--企业级知识库 智能体 —— DEV-DEMO
                </h1>
                <p className="text-sm text-gray-600">
                   RAG 精准化（Optiomer）
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsHelpOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <HelpCircle className="h-5 w-5" />
              <span className="text-sm font-medium">帮助</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm min-h-[calc(100vh-200px)]">
          {activeTab !== 'upload' && (
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {tabs.find(tab => tab.id === activeTab)?.name}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {tabs.find(tab => tab.id === activeTab)?.description}
              </p>
            </div>
          )}
          
          <div className={`${activeTab === 'upload' ? 'p-0' : 'h-full'}`}>
            {renderContent()}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600">
            <p>电商教育智能助手 - 基于 Next.js、MongoDB、Pinecone 构建</p>
            <p className="mt-1">支持文档上传、向量检索、智能问答和知识图谱可视化</p>
          </div>
        </div>
      </footer>

      {/* Help Menu */}
      <HelpMenu isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
