'use client';

import React, { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UploadResult {
  success: boolean;
  documentId?: string;
  filename?: string;
  chunkCount?: number;
  message?: string;
  error?: string;
}

export default function DocumentUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      setUploadResult(result);

      if (result.success) {
        // Automatically process the document
        await processDocument(result.documentId);
      }
    } catch (error) {
      setUploadResult({
        success: false,
        error: error instanceof Error ? error.message : '上传失败',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const processDocument = async (documentId: string) => {
    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId }),
      });

      const result = await response.json();
      console.log('Processing result:', result);
    } catch (error) {
      console.error('Processing error:', error);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">文档上传</h2>
        <p className="text-gray-600">
          支持 PDF、Word 文档、文本文件、PPT、图片、视频和音频文件
        </p>
      </div>

      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${isUploading ? 'pointer-events-none opacity-50' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".pdf,.docx,.txt,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.mp4,.avi,.mov,.wmv,.flv,.mkv,.mp3,.wav,.flac,.aac,.ogg"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />

        <div className="flex flex-col items-center space-y-4">
          {isUploading ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="text-lg font-medium text-gray-700">正在上传和处理...</p>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-gray-400" />
              <div>
                <p className="text-lg font-medium text-gray-700">
                  拖拽文件到此处或点击选择
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  支持 PDF、DOCX、TXT、PPT、图片、视频、音频格式
                </p>
              </div>
              <Button variant="outline" className="mt-4">
                选择文件
              </Button>
            </>
          )}
        </div>
      </div>

      {uploadResult && (
        <div className={`
          mt-6 p-4 rounded-lg border
          ${uploadResult.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
          }
        `}>
          <div className="flex items-start space-x-3">
            {uploadResult.success ? (
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            )}
            <div className="flex-1">
              {uploadResult.success ? (
                <div>
                  <p className="font-medium text-green-800">上传成功！</p>
                  <p className="text-sm text-green-700 mt-1">
                    文件：{uploadResult.filename}
                  </p>
                  <p className="text-sm text-green-700">
                    已分割为 {uploadResult.chunkCount} 个文本块
                  </p>
                  <p className="text-sm text-green-700">
                    正在生成向量嵌入，请稍候...
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-medium text-red-800">上传失败</p>
                  <p className="text-sm text-red-700 mt-1">
                    {uploadResult.error}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}