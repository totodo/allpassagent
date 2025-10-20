import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    const action = searchParams.get('action') || 'download'; // download 或 view

    if (!filename) {
      return NextResponse.json(
        { success: false, error: '缺少文件名参数' },
        { status: 400 }
      );
    }

    // 从数据库获取文件信息
    const db = await getDatabase();
    const document = await db.collection('documents').findOne({ filename });

    if (!document) {
      return NextResponse.json(
        { success: false, error: '文件不存在' },
        { status: 404 }
      );
    }

    // 构建文件路径 - 假设文件存储在 uploads 目录
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, filename);

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: '文件不存在于服务器' },
        { status: 404 }
      );
    }

    // 读取文件
    const fileBuffer = fs.readFileSync(filePath);
    
    // 获取文件类型
    const fileExtension = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (fileExtension) {
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.docx':
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      case '.doc':
        contentType = 'application/msword';
        break;
      case '.pptx':
        contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        break;
      case '.ppt':
        contentType = 'application/vnd.ms-powerpoint';
        break;
      case '.xlsx':
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case '.xls':
        contentType = 'application/vnd.ms-excel';
        break;
      case '.txt':
        contentType = 'text/plain';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
    }

    // 设置响应头
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', fileBuffer.length.toString());
    
    if (action === 'download') {
      // 下载模式：设置下载文件名
      headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(document.originalName || filename)}"`);
    } else if (action === 'view') {
      // 预览模式：在浏览器中打开
      headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(document.originalName || filename)}"`);
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('文件访问失败:', error);
    return NextResponse.json(
      { success: false, error: '文件访问失败' },
      { status: 500 }
    );
  }
}

// 获取文件信息的端点
export async function POST(request: NextRequest) {
  try {
    const { filename } = await request.json();

    if (!filename) {
      return NextResponse.json(
        { success: false, error: '缺少文件名参数' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const document = await db.collection('documents').findOne({ filename });

    if (!document) {
      return NextResponse.json(
        { success: false, error: '文件不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      file: {
        id: document._id.toString(),
        filename: document.filename,
        originalName: document.originalName,
        size: document.size,
        type: document.type,
        uploadedAt: document.uploadedAt,
        downloadUrl: `/api/files?filename=${encodeURIComponent(filename)}&action=download`,
        viewUrl: `/api/files?filename=${encodeURIComponent(filename)}&action=view`
      }
    });

  } catch (error) {
    console.error('获取文件信息失败:', error);
    return NextResponse.json(
      { success: false, error: '获取文件信息失败' },
      { status: 500 }
    );
  }
}