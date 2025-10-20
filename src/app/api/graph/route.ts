import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

interface GraphNode {
  id: string;
  name: string;
  type: 'document' | 'concept' | 'keyword';
  size: number;
  color: string;
}

interface GraphLink {
  source: string;
  target: string;
  value: number;
  type: 'contains' | 'relates' | 'mentions';
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    
    // 获取文档数据
    const documents = await db.collection('documents').find({
      processed: true
    }).toArray();

    // 获取文档块数据
    const chunks = await db.collection('document_chunks').find({}).toArray();

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeMap = new Map<string, GraphNode>();

    // 创建文档节点
    documents.forEach(doc => {
      const node: GraphNode = {
        id: doc._id.toString(),
        name: doc.originalName,
        type: 'document',
        size: Math.min(Math.max(doc.chunkCount || 1, 10), 50),
        color: '#3B82F6'
      };
      nodes.push(node);
      nodeMap.set(node.id, node);
    });

    // 从文档块中提取关键词和概念
    const keywordCounts = new Map<string, number>();
    const conceptCounts = new Map<string, number>();
    const documentKeywords = new Map<string, Set<string>>();
    const documentConcepts = new Map<string, Set<string>>();

    chunks.forEach(chunk => {
      const docId = chunk.documentId;
      const content = chunk.content.toLowerCase();
      
      // 简单的关键词提取（实际项目中可以使用更复杂的NLP算法）
      const keywords = extractKeywords(content);
      const concepts = extractConcepts(content);

      if (!documentKeywords.has(docId)) {
        documentKeywords.set(docId, new Set());
      }
      if (!documentConcepts.has(docId)) {
        documentConcepts.set(docId, new Set());
      }

      keywords.forEach(keyword => {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
        documentKeywords.get(docId)!.add(keyword);
      });

      concepts.forEach(concept => {
        conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
        documentConcepts.get(docId)!.add(concept);
      });
    });

    // 创建关键词节点（只保留出现频率较高的）
    Array.from(keywordCounts.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .forEach(([keyword, count]) => {
        const node: GraphNode = {
          id: `keyword_${keyword}`,
          name: keyword,
          type: 'keyword',
          size: Math.min(count * 3 + 5, 30),
          color: '#10B981'
        };
        nodes.push(node);
        nodeMap.set(node.id, node);
      });

    // 创建概念节点
    Array.from(conceptCounts.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([concept, count]) => {
        const node: GraphNode = {
          id: `concept_${concept}`,
          name: concept,
          type: 'concept',
          size: Math.min(count * 4 + 8, 40),
          color: '#F59E0B'
        };
        nodes.push(node);
        nodeMap.set(node.id, node);
      });

    // 创建文档-关键词链接
    documentKeywords.forEach((keywords, docId) => {
      keywords.forEach(keyword => {
        const keywordNodeId = `keyword_${keyword}`;
        if (nodeMap.has(keywordNodeId)) {
          links.push({
            source: docId,
            target: keywordNodeId,
            value: keywordCounts.get(keyword) || 1,
            type: 'contains'
          });
        }
      });
    });

    // 创建文档-概念链接
    documentConcepts.forEach((concepts, docId) => {
      concepts.forEach(concept => {
        const conceptNodeId = `concept_${concept}`;
        if (nodeMap.has(conceptNodeId)) {
          links.push({
            source: docId,
            target: conceptNodeId,
            value: conceptCounts.get(concept) || 1,
            type: 'relates'
          });
        }
      });
    });

    // 创建文档间的关联（基于共同关键词）
    const docIds = Array.from(documentKeywords.keys());
    for (let i = 0; i < docIds.length; i++) {
      for (let j = i + 1; j < docIds.length; j++) {
        const doc1Keywords = documentKeywords.get(docIds[i])!;
        const doc2Keywords = documentKeywords.get(docIds[j])!;
        
        const commonKeywords = new Set([...doc1Keywords].filter(k => doc2Keywords.has(k)));
        
        if (commonKeywords.size >= 2) {
          links.push({
            source: docIds[i],
            target: docIds[j],
            value: commonKeywords.size,
            type: 'relates'
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        nodes,
        links
      }
    });
  } catch (error) {
    console.error('获取图谱数据失败:', error);
    return NextResponse.json(
      { success: false, error: '获取图谱数据失败' },
      { status: 500 }
    );
  }
}

// 简单的关键词提取函数
function extractKeywords(text: string): string[] {
  // 移除标点符号和特殊字符
  const cleanText = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ');
  
  // 分词（简单按空格分割，实际项目中应使用专业的中文分词工具）
  const words = cleanText.split(/\s+/).filter(word => word.length > 1);
  
  // 过滤停用词
  const stopWords = new Set(['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);
  
  return words.filter(word => !stopWords.has(word.toLowerCase()) && word.length >= 2);
}

// 简单的概念提取函数
function extractConcepts(text: string): string[] {
  const concepts: string[] = [];
  
  // 电商相关概念
  const ecommercePatterns = [
    /电商|电子商务|网购|在线购物/g,
    /营销|推广|广告|宣传/g,
    /用户体验|UX|UI|界面/g,
    /数据分析|大数据|分析/g,
    /供应链|物流|配送/g,
    /支付|付款|结算/g,
    /客服|服务|售后/g,
    /品牌|商标|品牌建设/g,
    /转化率|ROI|KPI/g,
    /移动端|手机|APP/g
  ];
  
  ecommercePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      concepts.push(...matches);
    }
  });
  
  return [...new Set(concepts)]; // 去重
}