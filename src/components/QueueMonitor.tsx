'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface QueueStatus {
  fileProcessing: {
    name: string
    length: number
  }
  embedding: {
    name: string
    length: number
  }
  vectorStorage: {
    name: string
    length: number
  }
  total: number
}

export default function QueueMonitor() {
  const [status, setStatus] = useState<QueueStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // 获取队列状态
  const fetchStatus = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/queue')
      const result = await response.json()
      
      if (result.success) {
        setStatus(result.data)
      } else {
        setError(result.error || '获取队列状态失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误')
    } finally {
      setLoading(false)
    }
  }

  // 清空队列
  const clearQueue = async (queueName: string) => {
    try {
      setLoading(true)
      
      const response = await fetch('/api/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'clear',
          queueName
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        await fetchStatus() // 刷新状态
      } else {
        setError(result.error || '清空队列失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误')
    } finally {
      setLoading(false)
    }
  }

  // 自动刷新
  useEffect(() => {
    fetchStatus()
    
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 5000) // 每5秒刷新
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">队列监控</h2>
        <div className="flex gap-2">
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
          >
            {autoRefresh ? '停止自动刷新' : '开启自动刷新'}
          </Button>
          <Button
            onClick={fetchStatus}
            disabled={loading}
            size="sm"
          >
            {loading ? '刷新中...' : '手动刷新'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          错误: {error}
        </div>
      )}

      {status && (
        <div className="space-y-4">
          {/* 总览 */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">总览</h3>
            <p className="text-blue-600">
              总任务数: <span className="font-bold">{status.total}</span>
            </p>
          </div>

          {/* 各队列状态 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 文件处理队列 */}
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-green-800">文件处理队列</h4>
                <Button
                  onClick={() => clearQueue('file-processing')}
                  variant="outline"
                  size="sm"
                  disabled={loading || status.fileProcessing.length === 0}
                >
                  清空
                </Button>
              </div>
              <p className="text-green-600">
                待处理: <span className="font-bold">{status.fileProcessing.length}</span> 个任务
              </p>
            </div>

            {/* 嵌入队列 */}
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-yellow-800">嵌入队列</h4>
                <Button
                  onClick={() => clearQueue('embedding')}
                  variant="outline"
                  size="sm"
                  disabled={loading || status.embedding.length === 0}
                >
                  清空
                </Button>
              </div>
              <p className="text-yellow-600">
                待处理: <span className="font-bold">{status.embedding.length}</span> 个任务
              </p>
            </div>

            {/* 向量存储队列 */}
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-purple-800">向量存储队列</h4>
                <Button
                  onClick={() => clearQueue('vector-storage')}
                  variant="outline"
                  size="sm"
                  disabled={loading || status.vectorStorage.length === 0}
                >
                  清空
                </Button>
              </div>
              <p className="text-purple-600">
                待处理: <span className="font-bold">{status.vectorStorage.length}</span> 个任务
              </p>
            </div>
          </div>

          {/* 批量操作 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-800 mb-2">批量操作</h4>
            <Button
              onClick={() => clearQueue('all')}
              variant="destructive"
              size="sm"
              disabled={loading || status.total === 0}
            >
              清空所有队列
            </Button>
          </div>

          {/* 状态指示器 */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className={`w-3 h-3 rounded-full ${autoRefresh ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <span>{autoRefresh ? '自动刷新已开启' : '自动刷新已关闭'}</span>
            {autoRefresh && (
              <span className="text-gray-500">• 每5秒更新一次</span>
            )}
          </div>
        </div>
      )}

      {!status && !loading && !error && (
        <div className="text-center text-gray-500 py-8">
          点击刷新按钮获取队列状态
        </div>
      )}
    </div>
  )
}