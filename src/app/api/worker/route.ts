import { NextRequest, NextResponse } from 'next/server'
import { startWorker } from '@/workers/file-processor'

// Worker进程状态
let workerRunning = false
let workerProcess: Promise<void> | null = null

export async function POST(request: NextRequest) {
  try {
    if (workerRunning) {
      return NextResponse.json({
        success: false,
        message: 'Worker已经在运行中'
      }, { status: 400 })
    }

    // 启动Worker
    workerRunning = true
    workerProcess = startWorker().catch((error) => {
      console.error('Worker运行出错:', error)
      workerRunning = false
      workerProcess = null
    })

    return NextResponse.json({
      success: true,
      message: 'Worker已启动'
    })

  } catch (error) {
    console.error('启动Worker失败:', error)
    workerRunning = false
    workerProcess = null
    
    return NextResponse.json({
      success: false,
      message: '启动Worker失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    running: workerRunning,
    message: workerRunning ? 'Worker正在运行' : 'Worker未运行'
  })
}