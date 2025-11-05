import { NextRequest, NextResponse } from 'next/server';

const MULTIMEDIA_API_BASE = process.env.MULTIMEDIA_API_BASE || 'http://localhost:8001';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'upload';

    if (action === 'upload') {
      // 处理文件上传
      const formData = await request.formData();
      
      // 转发到Python API
      const response = await fetch(`${MULTIMEDIA_API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      return NextResponse.json(result);

    } else if (action === 'search') {
      // 处理搜索请求
      const body = await request.json();
      
      const response = await fetch(`${MULTIMEDIA_API_BASE}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Multimedia API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'health';

    if (action === 'health') {
      // 健康检查
      const response = await fetch(`${MULTIMEDIA_API_BASE}/health`);
      const result = await response.json();
      return NextResponse.json(result);

    } else if (action === 'supported-types') {
      // 获取支持的文件类型
      const response = await fetch(`${MULTIMEDIA_API_BASE}/supported-types`);
      const result = await response.json();
      return NextResponse.json(result);

    } else if (action === 'search') {
      // GET方式搜索
      const query = searchParams.get('query');
      const fileTypes = searchParams.get('file_types');
      const topK = searchParams.get('top_k') || '5';

      if (!query) {
        return NextResponse.json(
          { success: false, error: 'Query parameter is required' },
          { status: 400 }
        );
      }

      const params = new URLSearchParams({
        query,
        top_k: topK,
      });

      if (fileTypes) {
        params.append('file_types', fileTypes);
      }

      const response = await fetch(`${MULTIMEDIA_API_BASE}/search?${params}`);
      const result = await response.json();
      return NextResponse.json(result);
    } else if (action === 'list') {
      // 获取文档列表
      const response = await fetch(`${MULTIMEDIA_API_BASE}/documents`);
      const result = await response.json();
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Multimedia API GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get('doc_id');

    if (!docId) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${MULTIMEDIA_API_BASE}/documents?doc_id=${docId}`, {
      method: 'DELETE',
    });

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Multimedia API DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}