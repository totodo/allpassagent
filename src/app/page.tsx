'use client';

import React, { useState } from 'react';
import { FileText, MessageSquare, Network, Upload, Activity, Monitor, HelpCircle, Search } from 'lucide-react';
import ChatInterface from '@/components/ChatInterface';
import KnowledgeGraph from '@/components/KnowledgeGraph';

import MultimediaUpload from '@/components/MultimediaUpload';
import MultimediaManager from '@/components/MultimediaManager';
import SearchInterface from '@/components/SearchInterface';
import HelpMenu from '@/components/HelpMenu';

type ActiveTab = 'multimedia' | 'manage_multimedia' | 'chat' | 'graph' | 'search';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('multimedia');
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const tabs = [
    {
      id: 'multimedia' as const,
      name: '文件上传',
      icon: Upload,
      description: '上传PPT、图片、视频等',
    },
    {
      id: 'manage_multimedia' as const,
      name: '文件管理',
      icon: FileText,
      description: '管理已上传的文件',
    },
    {
      id: 'chat' as const,
      name: 'AI 助手',
      icon: MessageSquare,
      description: '智能问答',
    },
    {
      id: 'search' as const,
      name: '语义检索',
      icon: Search,
      description: '根据关键词搜索相关文档',
    },
    {
      id: 'graph' as const,
      name: '知识图谱',
      icon: Network,
      description: '可视化知识关系',
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'multimedia':
        return <MultimediaUpload />;
      case 'manage_multimedia':
        return <MultimediaManager />;
      case 'chat':
        return <ChatInterface />;
      case 'search':
        return <SearchInterface />;
      case 'graph':
        return <KnowledgeGraph />;
      default:
        return <MultimediaUpload />;
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
                  企业级知识库  —— DEMO
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
          {activeTab !== 'multimedia' && (
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {tabs.find(tab => tab.id === activeTab)?.name}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {tabs.find(tab => tab.id === activeTab)?.description}
              </p>
            </div>
          )}
          
          <div className={`${activeTab === 'multimedia' ? 'p-0' : 'h-full'}`}>
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
