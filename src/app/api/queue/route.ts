import { NextRequest, NextResponse } from 'next/server'
import { 
  getQueueStatus, 
  clearQueue, 
  clearAllQueues 
} from '@/lib/file-queue'

// 获取队列状态
export async function GET() {
  try {
    const status = await getQueueStatus()
    
    return NextResponse.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('获取队列状态失败:', error)
    return NextResponse.json(
      { 
        success: false,
        error: '获取队列状态失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}

// 队列管理操作
export async function POST(request: NextRequest) {
  try {
    const { action, queueName } = await request.json()
    
    switch (action) {
      case 'clear':
        if (queueName === 'all') {
          await clearAllQueues()
          return NextResponse.json({
            success: true,
            message: '所有队列已清空'
          })
        } else if (queueName) {
          await clearQueue(queueName)
          return NextResponse.json({
            success: true,
            message: `队列 ${queueName} 已清空`
          })
        } else {
          return NextResponse.json(
            { 
              success: false,
              error: '缺少队列名称参数' 
            },
            { status: 400 }
          )
        }
      
      case 'status':
        const status = await getQueueStatus()
        return NextResponse.json({
          success: true,
          data: status
        })
      
      default:
        return NextResponse.json(
          { 
            success: false,
            error: '不支持的操作类型' 
          },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('队列操作失败:', error)
    return NextResponse.json(
      { 
        success: false,
        error: '队列操作失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}