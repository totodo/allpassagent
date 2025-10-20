'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, FileText, MessageCircle, Lightbulb, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Array<{
    filename: string;
    content: string;
    fileurl: string;
    score: number;
    type?: string;
    contentType?: string;
    isMultimedia?: boolean;
    referenceId?: string;
    page?: number;
    page_type?: string;
    pageInfo?: string;
  }>;
  recommendations?: Array<{
    id: string;
    question: string;
    category: string;
    relevanceScore: number;
    context: string;
    source?: string;
  }>;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '您好！我是您的电子商务教育培训助手。我可以基于您上传的文档来回答问题。请问有什么可以帮助您的吗？',
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 解析消息中的文档链接
  const parseMessageContent = (content: string) => {
    // 匹配 [📖 查看](链接) 和 [📥 下载](链接) 格式
    const linkRegex = /\[([📖📥])\s*([^)]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      // 添加链接前的文本
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.slice(lastIndex, match.index)
        });
      }
      
      // 添加链接
      parts.push({
        type: 'link',
        emoji: match[1],
        text: match[2],
        url: match[3],
        isDownload: match[1] === '📥'
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // 添加剩余文本
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex)
      });
    }
    
    return parts.length > 0 ? parts : [{ type: 'text', content }];
  };
  
  const handleFileAction = (url: string, isDownload: boolean) => {
    if (isDownload) {
      // 下载文件
      const link = document.createElement('a');
      link.href = url;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // 在新窗口中查看文件
      window.open(url, '_blank');
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const messageToSend = messageText || inputMessage.trim();
    if (!messageToSend || isLoading) return;

    if (!messageText) {
      setInputMessage('');
    }
    
    // Add user message to chat
    const newUserMessage: Message = {
      id: uuidv4(),
      content: messageToSend,
      role: 'user',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    // Create placeholder AI message for streaming
    const aiMessageId = uuidv4();
    const aiMessage: Message = {
      id: aiMessageId,
      content: '',
      role: 'assistant',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, aiMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageToSend,
          conversationHistory: messages.slice(-10), // Keep last 10 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'content') {
                accumulatedContent += parsed.content;
                
                console.log('Received content:', parsed.content);
                console.log('Accumulated content:', accumulatedContent);
                
                // 更新消息内容
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, content: accumulatedContent }
                    : msg
                ));
              } else if (parsed.type === 'final') {
                console.log('Received final data:', parsed);
                
                // 添加sources和recommendations信息
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { 
                        ...msg, 
                        sources: parsed.sources,
                        recommendations: parsed.recommendations 
                      }
                    : msg
                ));
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // 更新错误消息
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { ...msg, content: '抱歉，发生了错误，请稍后重试。' }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecommendationClick = (question: string) => {
    handleSendMessage(question);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <Bot className="h-6 w-6 mr-2 text-blue-600" />
          AI 教育助手
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          基于您的文档内容提供专业回答
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`
                max-w-3xl rounded-lg p-4 shadow-sm
                ${message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
                }
              `}
            >
              <div className="flex items-start space-x-3">
                <div className={`
                  flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                  ${message.role === 'user' ? 'bg-blue-500' : 'bg-gray-300'}
                `}>
                  {message.role === 'user' ? (
                    <User className="h-4 w-4 text-white" />
                  ) : (
                    <Bot className="h-4 w-4 text-gray-600" />
                  )}
                </div>
                <div className="flex-1">
                  {/* AI回答内容 - 主要内容区域 */}
                  <div className="mb-4">
                    <div className="whitespace-pre-wrap text-base leading-relaxed">
                      {parseMessageContent(message.content).map((part: any, index: number) => {
                        if (part.type === 'text') {
                          return <span key={index}>{part.content}</span>;
                        } else {
                          return (
                            <button
                              key={index}
                              onClick={() => handleFileAction(part.url, part.isDownload)}
                              className={`
                                inline-flex items-center space-x-1 mx-1 px-2 py-1 rounded text-sm
                                ${part.isDownload 
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }
                                transition-colors duration-200
                              `}
                            >
                              {part.isDownload ? (
                                <Download className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                              <span>{part.text}</span>
                            </button>
                          );
                        }
                      })}
                    </div>
                  </div>
                  
                  {/* Sources - 参考文档区域 */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 bg-gray-50 rounded-lg p-3">
                      <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-gray-600" />
                        参考文档
                      </p>
                      <div className="space-y-2">
                        {message.sources.map((source, index) => {
                          // 确定文档类型图标和标签
                          const getDocumentTypeInfo = (source: any) => {
                            if (source.isMultimedia) {
                              if (source.type === 'ppt') {
                                return { icon: '📊', label: '课件' };
                              } else if (source.type === 'image') {
                                return { icon: '🖼️', label: '图片' };
                              } else if (source.type === 'video') {
                                return { icon: '🎥', label: '视频' };
                              } else if (source.type === 'audio') {
                                return { icon: '🎵', label: '音频' };
                              }
                              return { icon: '📎', label: '多媒体' };
                            }
                            return { icon: '📄', label: '文档' };
                          };

                          const typeInfo = getDocumentTypeInfo(source);
                          
                          return (
                            <div
                              key={index}
                              className="bg-white rounded-md p-3 border border-gray-200 shadow-sm"
                            >
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="text-lg">{typeInfo.icon}</span>
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-gray-800">
                                      {source.referenceId && (
                                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs mr-2">
                                          {source.referenceId}
                                        </span>
                                      )}
                                      {typeInfo.label}：{source.filename}
                                      {source.pageInfo && (
                                        <span className="text-blue-600 font-medium">
                                          {source.pageInfo}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-2 mt-1">
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                      相似度: {(source.score * 100).toFixed(1)}%
                                    </span>
                                    {source.isMultimedia && (
                                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                                        多媒体内容
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <p className="text-sm text-gray-600 leading-relaxed">
                                {source.content}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Recommendations */}
                  {message.recommendations && message.recommendations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <p className="text-sm font-medium text-gray-600 mb-2 flex items-center">
                        <Lightbulb className="h-4 w-4 mr-1 text-yellow-500" />
                        推荐问题：
                      </p>
                      <div className="space-y-2">
                        {message.recommendations.map((rec) => (
                          <button
                            key={rec.id}
                            onClick={() => handleRecommendationClick(rec.question)}
                            className="w-full text-left bg-blue-50 hover:bg-blue-100 rounded-lg p-3 border border-blue-200 transition-colors duration-200"
                          >
                            <div className="flex items-start space-x-2">
                              <MessageCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-blue-800 mb-1">
                                  {rec.question}
                                </p>
                                <div className="flex items-center space-x-2 text-xs text-blue-600">
                                  <span className="bg-blue-200 px-2 py-1 rounded">
                                    {rec.category}
                                  </span>
                                  {rec.source && (
                                    <span className="text-blue-500">
                                      来源: {rec.source}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xs mt-2 opacity-70">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-4 shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-gray-600" />
                </div>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex space-x-4">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入您的问题..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-2 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={1}
            disabled={isLoading}
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            className="px-6"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}