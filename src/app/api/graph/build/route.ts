import { NextRequest, NextResponse } from 'next/server';
import { buildGraph } from '@/lib/graph_builder';

export async function POST(request: NextRequest) {
  try {
    // 不等待构建完成，立即返回
    buildGraph();
    return NextResponse.json({ success: true, message: '知识图谱构建任务已启动' });
  } catch (error) {
    console.error('启动知识图谱构建失败:', error);
    return NextResponse.json(
      { success: false, error: '启动知识图谱构建失败' },
      { status: 500 }
    );
  }
}