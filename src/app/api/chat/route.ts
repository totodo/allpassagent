import { NextRequest, NextResponse } from 'next/server';
import { pineconeIndex } from '@/lib/pinecone';
import { createEmbedding } from '@/lib/siliconflow-embedding';
import { rerankWithBGE, SearchMatch } from '@/lib/reranker';
import { recommendationEngine, ConversationContext } from '@/lib/recommendation-engine';

// SiliconFlow API 配置
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || 'your-api-key-here';

console.log('Environment check - API Key length:', SILICONFLOW_API_KEY?.length || 0);
console.log('Environment check - API Key starts with:', SILICONFLOW_API_KEY?.substring(0, 10) || 'undefined');

/**
 * 构建增强的查询，包含对话上下文
 * @param currentMessage 当前用户消息
 * @param conversationHistory 对话历史
 * @returns 增强后的查询字符串
 */
function buildEnhancedQuery(currentMessage: string, conversationHistory: any[]): string {
  try {
    // 提取最近3轮对话的关键信息
    const recentMessages = conversationHistory
      .slice(-6) // 取最近6条消息（3轮对话）
      .filter((msg: any) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg: any) => {
        // 提取关键词，去除过长的内容
        const content = msg.content || '';
        if (content.length > 200) {
          // 对于长内容，提取前100字符作为上下文
          return content.substring(0, 100);
        }
        return content;
      })
      .join(' ');

    // 如果有历史上下文，将其与当前消息结合
    if (recentMessages.trim()) {
      // 限制总长度，避免查询过长
      const contextQuery = `${recentMessages} ${currentMessage}`;
      return contextQuery.length > 500
        ? `${contextQuery.substring(0, 500)}...`
        : contextQuery;
    }

    return currentMessage;
  } catch (error) {
    console.error('Error building enhanced query:', error);
    return currentMessage;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory = [] } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    //  使用SiliconFlow的embedding
    const queryEmbedding = await createEmbedding(message);

    // 构建增强的查询，包含对话上下文
    const enhancedQuery = buildEnhancedQuery(message, conversationHistory);

    // 增加topK到15个候选文档用于重排序
    const searchResults = await pineconeIndex.query({
      vector: queryEmbedding,
      topK: 15, // 增加到15个候选文档用于重排序
      includeMetadata: true,
    });

    // 同时搜索多媒体内容
    let multimediaResults: any[] = [];
    try {
      const multimediaResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/multimedia?action=search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: enhancedQuery,
          top_k: 8, // 增加到8个多媒体结果
        }),
      });

      if (multimediaResponse.ok) {
        const multimediaData = await multimediaResponse.json();
        if (multimediaData.success) {
          multimediaResults = multimediaData.results || [];
        }
      }
    } catch (error) {
      console.warn('多媒体搜索失败:', error);
    }

    // 过滤掉分数低于0.6的文档，获取更多候选
    const searchMatches: SearchMatch[] = searchResults.matches
      ?.filter(match => (match.score || 0) > 0.6) // 降低阈值到0.6以获取更多候选
      .map(match => ({
        content: String(match.metadata?.full_content || ''),
        filename: String(match.metadata?.filename || ''),
        document_id: String(match.metadata?.document_id || ''),
        page: typeof match.metadata?.page === 'number' ? match.metadata.page : 
              typeof match.metadata?.page === 'string' ? parseInt(match.metadata.page, 10) || null : null,
        page_type: String(match.metadata?.page_type || ''),
        score: match.score || 0,
      })) || [];

    // 增加topK到3个文档用于重排序
    const rerankedResults = await rerankWithBGE(enhancedQuery, searchMatches, 3);

    // 仅保留前3个文档的上下文
    const relevantContext = rerankedResults.map(result => ({
      content: result.content,
      filename: result.filename,
      document_id: result.document_id,
      page: result.page,
      page_type: result.page_type,
      score: result.score,
      originalScore: result.originalScore,
      rerankScore: result.rerankScore,
    }));

    // 合并多媒体内容到上下文中，增强权重
    const multimediaContext = multimediaResults.map(result => ({
      content: result.summary || result.content,
      filename: result.filename,
      score: result.score * 1.2, // 给多媒体内容增加权重
      type: result.file_type,
      contentType: result.content_type,
      isMultimedia: true,
    }));

    // Prepare context for the AI with enhanced multimedia integration
    // 仅保留前3个文档的上下文
    const contextText = relevantContext
      .map((ctx, index) => {
        // 构建引用标识
        const referenceId = `${index + 1}`;
        let pageInfo = '';
        
        if (ctx.page) {
          if (ctx.page_type === 'slide') {
            pageInfo = ` 第${ctx.page}页`;
          } else if (ctx.page_type === 'chunk') {
            pageInfo = ` 第${ctx.page}段`;
          } else {
            pageInfo = ` 第${ctx.page}页`;
          }
        }
        
        return `[文档来源${referenceId}: ${ctx.filename}${pageInfo}]\n${ctx.content}`;
      })
      .join('\n\n---\n\n');

    const getMultimediaTypeLabel = (type: string, contentType: string) => {
      const typeLabels: Record<string, string> = {
        'ppt': 'PPT演示文稿',
        'image': '图片',
        'video': '视频',
        'audio': '音频'
      };
      return typeLabels[type] || `多媒体文件(${type}/${contentType})`;
    };

    const multimediaContextText = multimediaContext
      .map((ctx, index) => {
        const typeLabel = getMultimediaTypeLabel(ctx.type, ctx.contentType);
        const referenceId = `M${index + 1}`;
        let pageInfo = '';
        
        // 从multimediaResults中获取页码信息
        const originalResult = multimediaResults[index];
        if (originalResult && originalResult.page) {
          if (originalResult.page_type === 'slide') {
            pageInfo = ` 第${originalResult.page}页`;
          } else {
            pageInfo = ` 第${originalResult.page}页`;
          }
        }
        
        return `[${typeLabel}${referenceId}: ${ctx.filename}${pageInfo}]\n${ctx.content}`;
      })
      .join('\n\n---\n\n');

    const fullContextText = [contextText, multimediaContextText]
      .filter(text => text.trim())
      .join('\n\n===多媒体内容===\n\n');

    // Build conversation messages
    const messages = [
      {
        role: 'system',
        content: `你是一个专业的电子商务教育培训助手。请基于提供的文档内容和你的专业知识回答用户问题。

重要规则：
1. 必须提供完整、有价值的回答，不能只返回文档引用
2. 优先使用提供的文档内容，同时结合你的专业知识进行详细解答
3. 如果文档中没有相关信息，请基于你的专业知识提供有帮助的回答
4. 在回答中必须包含详细的出处引用，格式为：参考：[引用编号] [文档类型]：[文件名] [页码信息]
   例如：参考：1.2.2 课件：直播电商运营认知.pptx 第12页
5. 保持回答准确、专业、详细且有帮助
6. 使用中文回答
7. 对于多媒体内容（PPT、图片、视频、音频），请特别标注其类型和来源
8. 即使没有找到相关文档，也要提供专业的回答
9. 引用格式说明：
   - 文档引用：参考：[序号] 文档：[文件名] [页码]
   - PPT引用：参考：[序号] 课件：[文件名] 第[页码]页
   - 多媒体引用：参考：[序号] [类型]：[文件名] [页码信息]

可用的文档内容：
${fullContextText || '暂无相关文档内容'}

多媒体内容统计：
- 文档数量：${relevantContext.length}
- 多媒体文件数量：${multimediaContext.length}
- 总内容来源：${relevantContext.length + multimediaContext.length}`,
      },
      ...conversationHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: message,
      },
    ];

    // 调用 SiliconFlow API 获取流式响应
    console.log('Calling SiliconFlow API with messages:', JSON.stringify(messages, null, 2));

    const response = await fetch(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen2.5-7B-Instruct', // 使用SiliconFlow支持的模型
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true, // 启用流式输出
      }),
    });

    console.log('SiliconFlow API response status:', response.status);
    console.log('SiliconFlow API response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SiliconFlow API error:', response.status, errorText);
      throw new Error(`SiliconFlow API error: ${response.status} - ${errorText}`);
    }

    console.log('SiliconFlow API response is OK, starting stream processing...');

    // 创建流式响应
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response body');
          }

          let aiResponse = '';

          console.log('Starting to read stream from SiliconFlow API...');

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              console.log('Stream reading completed, total AI response length:', aiResponse.length);
              console.log('Final AI response:', aiResponse);
              break;
            }

            const chunk = decoder.decode(value);
            console.log('Raw chunk received:', chunk);

            // 检查chunk是否为空
            if (!chunk.trim()) {
              console.log('Received empty chunk, continuing...');
              continue;
            }

            const lines = chunk.split('\n');

            for (const line of lines) {
              console.log('Processing line:', line);

              let data = '';

              // 处理带有 "data: " 前缀的行
              if (line.startsWith('data: ')) {
                data = line.slice(6);
                console.log('Extracted data from SSE:', data);

                if (data === '[DONE]') {
                  console.log('Received [DONE] signal');
                  continue;
                }
              }
              // 处理直接的JSON数据（没有data:前缀）
              else if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
                data = line.trim();
                console.log('Extracted direct JSON data:', data);
              }
              // 跳过其他类型的行
              else {
                continue;
              }

              // 跳过空数据
              if (!data.trim()) {
                console.log('Skipping empty data');
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;

                console.log('Parsed data:', parsed);
                console.log('Content from AI:', content);

                if (content) {
                  aiResponse += content;

                  // 发送流式内容
                  const streamData = {
                    type: 'content',
                    content: content,
                  };

                  console.log('Sending stream data:', streamData);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(streamData)}\n\n`));
                }
              } catch (e) {
                console.error('Parse error:', e, 'Raw data:', data);
              }
            }
          }

          // 如果没有收到任何AI响应，发送一个默认响应
          if (!aiResponse.trim()) {
            console.log('No AI response received, sending default response...');
            const defaultContent = '你好！我是AI助手，很高兴为您服务。';
            aiResponse = defaultContent;

            const streamData = {
              type: 'content',
              content: defaultContent,
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(streamData)}\n\n`));
          }

          // AI响应完成后，生成推荐问题
          const conversationContext: ConversationContext = {
            currentMessage: message,
            previousMessages: conversationHistory.slice(-5), // 取最近5条消息作为上下文
            topics: [], // 将在推荐引擎中自动识别
            userIntent: '', // 将在推荐引擎中自动分析
          };

          const recommendations = await recommendationEngine.generateRecommendations(
            conversationContext,
            relevantContext.map(ctx => ({
              filename: ctx.filename,
              content: ctx.content,
            }))
          );

          // 发送最终的sources信息，包含重排序信息、多媒体来源和推荐问题
          // 对相同文件名的sources进行去重，只保留相似度最高的
          const uniqueSources = new Map();
          
          // 处理文档来源
          relevantContext.forEach((ctx, index) => {
            const filename = ctx.filename;
            const referenceId = `${index + 1}`;
            let pageInfo = '';
            
            if (ctx.page) {
              if (ctx.page_type === 'slide') {
                pageInfo = ` 第${ctx.page}页`;
              } else if (ctx.page_type === 'chunk') {
                pageInfo = ` 第${ctx.page}段`;
              } else {
                pageInfo = ` 第${ctx.page}页`;
              }
            }
            
            if (!uniqueSources.has(filename) || uniqueSources.get(filename).score < ctx.score) {
              uniqueSources.set(filename, {
                filename: ctx.filename,
                content: (typeof ctx.content === 'string' ? ctx.content.substring(0, 200) : String(ctx.content).substring(0, 200)) + '...',
                score: ctx.score,
                originalScore: ctx.originalScore,
                rerankScore: ctx.rerankScore,
                type: 'document',
                referenceId: referenceId,
                page: ctx.page,
                page_type: ctx.page_type,
                pageInfo: pageInfo,
              });
            }
          });

          // 处理多媒体来源
          multimediaContext.forEach((ctx, index) => {
            const filename = ctx.filename;
            const referenceId = `M${index + 1}`;
            let pageInfo = '';
            
            // 从multimediaResults中获取页码信息
            const originalResult = multimediaResults[index];
            if (originalResult && originalResult.page) {
              if (originalResult.page_type === 'slide') {
                pageInfo = ` 第${originalResult.page}页`;
              } else {
                pageInfo = ` 第${originalResult.page}页`;
              }
            }
            
            if (!uniqueSources.has(filename) || uniqueSources.get(filename).score < ctx.score) {
              uniqueSources.set(filename, {
                filename: ctx.filename,
                content: (typeof ctx.content === 'string' ? ctx.content.substring(0, 200) : String(ctx.content).substring(0, 200)) + '...',
                score: ctx.score,
                type: ctx.type,
                contentType: ctx.contentType,
                isMultimedia: true,
                referenceId: referenceId,
                page: originalResult?.page,
                page_type: originalResult?.page_type,
                pageInfo: pageInfo,
              });
            }
          });

          // 转换为数组并按分数排序
          const allSources = Array.from(uniqueSources.values()).sort((a, b) => b.score - a.score);

          const finalData = {
            type: 'final',
            sources: allSources,
            recommendations,
            hasRelevantContext: relevantContext.length > 0 || multimediaContext.length > 0,
            multimediaCount: multimediaContext.length,
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);

          // 发送错误信息给前端
          const errorData = {
            type: 'content',
            content: '抱歉，AI服务暂时不可用，请稍后重试。',
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));

          // 仍然发送final数据
          const finalData = {
            type: 'final',
            sources: relevantContext.map(ctx => ({
              filename: ctx.filename,
              content: (typeof ctx.content === 'string' ? ctx.content.substring(0, 200) : String(ctx.content).substring(0, 200)) + '...',
              score: ctx.score,
            })),
            recommendations: [],
            hasRelevantContext: relevantContext.length > 0,
            multimediaCount: 0,
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}