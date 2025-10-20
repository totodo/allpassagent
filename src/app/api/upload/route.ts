import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { put } from '@vercel/blob'
import { v4 as uuidv4 } from 'uuid'

import { parseDocument, chunkText, chunkTextSimple } from '@/lib/document-parser';
import { pushFileProcessingTask } from '@/lib/queue'
import { COLLECTIONS, ALLOWED_TYPES, MAX_FILE_SIZE } from '@/lib/constants'
import { FileProcessingTask, KnowledgeDocument } from '@/types/file-processing'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (max 100MB for multimedia files, 10MB for documents)
    const maxSize = file.type.startsWith('video/') || file.type.startsWith('audio/') ? 100 * 1024 * 1024 : 30 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      return NextResponse.json({ error: `File too large. Max size is ${maxSizeMB}MB` }, { status: 400 });
    }

    // Validate file type - 支持文档和多媒体文件
    const allowedTypes = [
      // 文档类型
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      // PPT类型
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // 图片类型
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/bmp',
      'image/tiff',
      // 视频类型
      'video/mp4',
      'video/avi',
      'video/mov',
      'video/quicktime',
      'video/wmv',
      'video/x-flv',
      'video/x-matroska',
      // 音频类型
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/flac',
      'audio/aac',
      'audio/ogg'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Unsupported file type. Please upload PDF, DOCX, TXT, PPT, images, videos, or audio files.' 
      }, { status: 400 });
    }

    // 检查文件类型，决定处理方式
    const isMultimedia = file.type.startsWith('image/') || 
                        file.type.startsWith('video/') || 
                        file.type.startsWith('audio/') ||
                        file.type === 'application/vnd.ms-powerpoint' ||
                        file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

    if (isMultimedia) {
      // 多媒体文件转发到Python API处理
      const formData = new FormData();
      formData.append('file', file);

      const MULTIMEDIA_API_BASE = process.env.MULTIMEDIA_API_BASE || 'http://localhost:8001';
      
      try {
        const response = await fetch(`${MULTIMEDIA_API_BASE}/upload`, {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();
        
        if (result.success) {
          return NextResponse.json({
            success: true,
            documentId: result.doc_id,
            filename: file.name,
            contentCount: result.content_count,
            fileType: result.file_type,
            message: 'Multimedia file uploaded and processed successfully'
          });
        } else {
          return NextResponse.json({
            success: false,
            error: result.error || 'Multimedia processing failed'
          }, { status: 500 });
        }
      } catch (error) {
        console.error('Multimedia API error:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to process multimedia file'
        }, { status: 500 });
      }
    }

    // 文档文件继续使用原有处理逻辑
    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

  // 生成唯一文件名
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop() || 'bin'
    const fileName = `knowledge/${timestamp}-${randomString}.${fileExtension}`

    // 上传到 Vercel Blob
    const blob = await put(fileName, file, {
      access: 'public',
      addRandomSuffix: false,
    })

    // Parse document
    const parsedDoc = await parseDocument(buffer, file.name, file.type);

    // Chunk the text for better vector processing - use simple version for compatibility
    const chunks = chunkTextSimple(parsedDoc.content);

    // Save to MongoDB
    const db = await getDatabase();
    const documentsCollection = db.collection('documents');

    const document = {
      filename: parsedDoc.metadata.filename,
      fileType: parsedDoc.metadata.fileType,
      size: parsedDoc.metadata.size,
      pageCount: parsedDoc.metadata.pageCount,
      content: parsedDoc.content,
      chunks: chunks,
      fileUrl:blob.url,
      uploadedAt: new Date(),
      processed: false,
      vectorized: false,
    };

    const result = await documentsCollection.insertOne(document);

// 推送任务到Upstash队列进行文件处理
    const processingTask: FileProcessingTask = {
      id: uuidv4(),
      documentId: result.insertedId.toString(),
      userId: "default-userId",
      fileName: file.name,
      fileType: file.type,
      blobUrl: blob.url,
      createdAt: new Date().toISOString()
    }

    try {
      await pushFileProcessingTask(processingTask)
      console.log('文件处理任务已推送到队列:', processingTask.id)
    } catch (queueError) {
      console.error('推送队列任务失败:', queueError)
      // 即使队列推送失败，文件上传仍然成功，只是不会自动处理
    }


    return NextResponse.json({
      success: true,
      documentId: result.insertedId,
      filename: parsedDoc.metadata.filename,
      chunkCount: chunks.length,
      message: 'Document uploaded and parsed successfully'
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
