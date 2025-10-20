import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const documents = await db.collection('documents').find({})
      .sort({ uploadedAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      success: true,
      documents: documents.map(doc => ({
        id: doc._id.toString(),
        filename: doc.filename,
        originalName: doc.originalName,
        size: doc.size,
        type: doc.type,
        uploadedAt: doc.uploadedAt,
        processed: doc.processed || false,
        chunkCount: doc.chunkCount || 0
      }))
    });
  } catch (error) {
    console.error('获取文档列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取文档列表失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: '缺少文档ID' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    
    // 删除文档记录
    await db.collection('documents').deleteOne({ 
      _id: new (require('mongodb')).ObjectId(documentId) 
    });
    
    // 删除相关的文档块
    await db.collection('document_chunks').deleteMany({ 
      documentId: documentId 
    });

    return NextResponse.json({
      success: true,
      message: '文档删除成功'
    });
  } catch (error) {
    console.error('删除文档失败:', error);
    return NextResponse.json(
      { success: false, error: '删除文档失败' },
      { status: 500 }
    );
  }
}