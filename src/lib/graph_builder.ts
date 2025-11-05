import { getDatabase } from './mongodb';
import { ObjectId } from 'mongodb';

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

// 简单的关键词提取函数
function extractKeywords(text: string): string[] {
  const cleanText = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ');
  const words = cleanText.split(/\s+/).filter(word => word.length > 1);
  const stopWords = new Set(['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);
  return words.filter(word => !stopWords.has(word.toLowerCase()) && word.length >= 2);
}

// 简单的概念提取函数
function extractConcepts(text: string): string[] {
  const concepts: string[] = [];
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
  return [...new Set(concepts)];
}

export async function buildGraph(documentId?: string) {
  try {
    console.log(documentId ? `增量更新知识图谱: ${documentId}` : '开始全量构建知识图谱...');
    const db = await getDatabase();

    if (documentId) {
      // 增量更新：删除与该文档相关的旧节点和链接
      const docNodeId = documentId.toString();
      
      // 1. 删除文档节点
      await db.collection('graph_nodes').deleteOne({ id: docNodeId });

      // 2. 删除与该文档相关的链接
      await db.collection('graph_links').deleteMany({ $or: [{ source: docNodeId }, { target: docNodeId }] });

      // 注意：关键词和概念节点的更新会更复杂，暂时先只处理删除
      // 后面需要重新计算相关关键词/概念的size
    }

    const documentsQuery = documentId ? { _id: new ObjectId(documentId), processed: true } : { processed: true };
    const documents = await db.collection('documents').find(documentsQuery).toArray();

    const chunksQuery = documentId ? { documentId: new ObjectId(documentId) } : {};
    const chunks = await db.collection('document_chunks').find(chunksQuery).toArray();

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeMap = new Map<string, GraphNode>();

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

    const keywordCounts = new Map<string, number>();
    const conceptCounts = new Map<string, number>();
    const documentKeywords = new Map<string, Set<string>>();
    const documentConcepts = new Map<string, Set<string>>();

    chunks.forEach(chunk => {
      const docId = chunk.documentId.toString();
      const content = chunk.content.toLowerCase();
      
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

    // 根据是全量还是增量，选择写入方式
    if (!documentId) {
      // 全量构建：清空并写入
      await db.collection('graph_nodes').deleteMany({});
      await db.collection('graph_nodes').insertMany(nodes);

      await db.collection('graph_links').deleteMany({});
      await db.collection('graph_links').insertMany(links);
    } else {
      // 增量构建：使用 upsert 更新节点和链接
      const nodeOps = nodes.map(node => ({
        updateOne: {
          filter: { id: node.id },
          update: { $set: node },
          upsert: true
        }
      }));
      if (nodeOps.length > 0) {
        await db.collection('graph_nodes').bulkWrite(nodeOps);
      }

      const linkOps = links.map(link => ({
        insertOne: {
          document: link
        }
      }));
      if (linkOps.length > 0) {
        await db.collection('graph_links').bulkWrite(linkOps);
      }
    }

    console.log(`知识图谱构建完成: ${nodes.length} 个节点, ${links.length} 条链接`);

  } catch (error) {
    console.error('构建知识图谱失败:', error);
  }
}