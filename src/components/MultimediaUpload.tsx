import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Upload, 
  FileText, 
  Image, 
  Video, 
  Music, 
  CheckCircle, 
  XCircle, 
  Loader2,
  FileType,
  AlertCircle
} from 'lucide-react';

interface UploadResult {
  success: boolean;
  message: string;
  doc_id?: string;
  content_count?: number;
  file_type?: string;
  error?: string;
}

interface SupportedTypes {
  [key: string]: string[];
}

const MultimediaUpload: React.FC = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [supportedTypes, setSupportedTypes] = useState<SupportedTypes>({});
  const [dragOver, setDragOver] = useState(false);

  // 获取支持的文件类型
  React.useEffect(() => {
    const fetchSupportedTypes = async () => {
      try {
        const response = await fetch('/api/multimedia?action=supported-types');
        if (response.ok) {
          const data = await response.json();
          setSupportedTypes(data.supported_types || {});
        }
      } catch (error) {
        console.error('获取支持的文件类型失败:', error);
      }
    };

    fetchSupportedTypes();
  }, []);

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'ppt':
        return <FileText className="h-8 w-8 text-orange-500" />;
      case 'pptx':
        return <FileText className="h-8 w-8 text-orange-500" />;
      case 'image':
        return <Image className="h-8 w-8 text-green-500" />;
      case 'video':
        return <Video className="h-8 w-8 text-blue-500" />;
      case 'audio':
        return <Music className="h-8 w-8 text-purple-500" />;
      default:
        return <FileType className="h-8 w-8 text-gray-500" />;
    }
  };

  const getFileTypeFromExtension = (filename: string): string | null => {
    const ext = filename.toLowerCase().split('.').pop();
    if (!ext) return null;

    for (const [type, extensions] of Object.entries(supportedTypes)) {
      if (extensions.includes(`.${ext}`)) {
        return type;
      }
    }
    return null;
  };

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // 如果支持的文件类型还没有加载完成，先允许通过
    if (Object.keys(supportedTypes).length === 0) {
      console.log('支持的文件类型还在加载中，暂时允许文件通过验证');
      return { valid: true };
    }

    const fileType = getFileTypeFromExtension(file.name);
    
    if (!fileType) {
      return {
        valid: false,
        error: `不支持的文件类型: ${file.name.split('.').pop()}`
      };
    }

    // 检查文件大小 (100MB限制)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        valid: false,
        error: '文件大小不能超过100MB'
      };
    }

    return { valid: true };
  };

  const uploadFile = async (file: File) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      setUploadResult({
        success: false,
        message: '文件验证失败',
        error: validation.error
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('/api/multimedia?action=upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result: UploadResult = await response.json();
      setUploadResult(result);

      if (result.success) {
        // 可以在这里触发刷新文档列表的回调
        console.log('文件上传成功:', result);
      }

    } catch (error) {
      console.error('上传失败:', error);
      setUploadResult({
        success: false,
        message: '上传失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setUploading(false);
      setTimeout(() => {
        setUploadProgress(0);
      }, 2000);
    }
  };

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    uploadFile(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const getSupportedExtensions = () => {
    const allExtensions: string[] = [];
    Object.values(supportedTypes).forEach(extensions => {
      allExtensions.push(...extensions);
    });
    return allExtensions.join(', ');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Upload className="h-5 w-5" />
            多媒体文件上传
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            支持PPT、图片、视频、音频等多种格式的文件上传和智能处理
          </p>
        </div>
        <div className="p-6">
          {/* 拖拽上传区域 */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="flex flex-col items-center gap-4">
              <Upload className={`h-12 w-12 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} />
              <div>
                <p className="text-lg font-medium">
                  拖拽文件到此处或点击选择文件
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  支持的格式: {getSupportedExtensions()}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  最大文件大小: 100MB
                </p>
              </div>
              <Button
                variant="outline"
                disabled={uploading}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = getSupportedExtensions();
                  input.onchange = (e) => {
                    const target = e.target as HTMLInputElement;
                    handleFileSelect(target.files);
                  };
                  input.click();
                }}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    处理中...
                  </>
                ) : (
                  '选择文件'
                )}
              </Button>
            </div>
          </div>

          {/* 上传进度 */}
          {uploading && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">上传进度</span>
                <span className="text-sm text-gray-500">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* 上传结果 */}
          {uploadResult && (
            <div className={`mt-4 p-4 rounded-lg border ${uploadResult.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
              <div className="flex items-center gap-2">
                {uploadResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <div>
                  <p className="font-medium">{uploadResult.message}</p>
                  {uploadResult.success && uploadResult.content_count && (
                    <p className="text-sm text-gray-600 mt-1">
                      成功处理 {uploadResult.content_count} 个内容块
                      {uploadResult.file_type && (
                        <span className="ml-2 px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded">
                          {uploadResult.file_type}
                        </span>
                      )}
                    </p>
                  )}
                  {uploadResult.error && (
                    <p className="text-sm text-red-600 mt-1">{uploadResult.error}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 支持的文件类型说明 */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">支持的文件类型</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(supportedTypes).map(([type, extensions]) => (
              <div key={type} className="flex items-center gap-3 p-3 border rounded-lg">
                {getFileIcon(type)}
                <div>
                  <p className="font-medium capitalize">{type}</p>
                  <p className="text-xs text-gray-500">
                    {extensions.join(', ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900">处理说明</p>
                <ul className="mt-2 space-y-1 text-blue-800">
                  <li>• <strong>PPT文件</strong>: 提取文本内容和图片，支持OCR文字识别</li>
                  <li>• <strong>图片文件</strong>: OCR文字识别和智能内容描述</li>
                  <li>• <strong>视频文件</strong>: 音频转文字和关键帧提取</li>
                  <li>• <strong>音频文件</strong>: 语音转文字处理</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultimediaUpload;