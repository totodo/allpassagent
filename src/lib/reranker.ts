import { createEmbedding } from './siliconflow-embedding';

export interface RerankResult {
  content: string;
  filename: string;
  document_id?: string;
  page?: number | null;
  page_type?: string;
  score: number;
  originalScore: number;
  rerankScore: number;
}

export interface SearchMatch {
  content: string;
  filename: string;
  document_id?: string;
  page?: number | null;
  page_type?: string;
  score: number;
}

/**
 * 使用BGE重排序模型对搜索结果进行重新排序
 * @param query 用户查询
 * @param matches 初始搜索结果
 * @param topK 返回的top-k结果数量
 * @returns 重排序后的结果
 */
export async function rerankWithBGE(
  query: string,
  matches: SearchMatch[],
  topK: number = 5
): Promise<RerankResult[]> {
  try {
    // 如果没有匹配结果，直接返回空数组
    if (!matches || matches.length === 0) {
      return [];
    }

    // 使用SiliconFlow的BGE重排序API
    const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/rerank';
    const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY;

    if (!SILICONFLOW_API_KEY) {
      console.warn('SILICONFLOW_API_KEY not found, falling back to similarity reranking');
      return await rerankBySimilarity(query, matches, topK);
    }

    // 准备重排序请求
    const documents = matches.map(match => match.content);
    
    const response = await fetch(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'BAAI/bge-reranker-v2-m3',
        query: query,
        documents: documents,
        top_k: Math.min(topK, matches.length), // 确保不超过可用文档数量
      }),
    });

    if (!response.ok) {
      console.warn(`Rerank API error: ${response.status}, falling back to similarity reranking`);
      return await rerankBySimilarity(query, matches, topK);
    }

    const result = await response.json();
    
    // 处理重排序结果
    const rerankedResults: RerankResult[] = [];
    
    if (result.results && Array.isArray(result.results)) {
      for (const item of result.results) {
        const originalMatch = matches[item.index];
        if (originalMatch) {
          // 结合原始分数和重排序分数，给重排序分数更高权重
          const combinedScore = (originalMatch.score * 0.3) + (item.relevance_score * 0.7);
          
          rerankedResults.push({
            content: originalMatch.content,
            filename: originalMatch.filename,
            document_id: originalMatch.document_id,
            page: originalMatch.page,
            page_type: originalMatch.page_type,
            score: combinedScore,
            originalScore: originalMatch.score,
            rerankScore: item.relevance_score || originalMatch.score,
          });
        }
      }
    }

    // 如果重排序失败，使用相似度重排序作为备选
    if (rerankedResults.length === 0) {
      return await rerankBySimilarity(query, matches, topK);
    }

    // 按综合分数排序
    return rerankedResults.sort((a, b) => b.score - a.score);

  } catch (error) {
    console.error('Rerank error:', error);
    // 发生错误时，使用相似度重排序作为备选
    return await rerankBySimilarity(query, matches, topK);
  }
}

/**
 * 基于余弦相似度的重排序备选方案
 * @param query 用户查询
 * @param matches 初始搜索结果
 * @param topK 返回的top-k结果数量
 * @returns 重排序后的结果
 */
export async function rerankBySimilarity(
  query: string,
  matches: SearchMatch[],
  topK: number = 5
): Promise<RerankResult[]> {
  try {
    // 计算查询词与文档内容的相似度
    const queryWords = query.toLowerCase().split(/\s+/);
    
    const scoredMatches = matches.map(match => {
      const content = match.content.toLowerCase();
      
      // 计算关键词匹配度
      const keywordScore = queryWords.reduce((score, word) => {
        const occurrences = (content.match(new RegExp(word, 'g')) || []).length;
        return score + occurrences;
      }, 0) / queryWords.length;
      
      // 计算文档长度权重（适中长度的文档可能更相关）
      const lengthScore = Math.min(1, match.content.length / 1000);
      
      // 结合原始分数、关键词匹配度和长度权重
      const combinedScore = (match.score * 0.5) + (keywordScore * 0.3) + (lengthScore * 0.2);
      
      return {
        content: match.content,
        filename: match.filename,
        document_id: match.document_id,
        page: match.page,
        page_type: match.page_type,
        score: combinedScore,
        originalScore: match.score,
        rerankScore: combinedScore,
      };
    });
    
    // 按分数排序并返回top-k结果
    return scoredMatches
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
      
  } catch (error) {
    console.error('Similarity rerank error:', error);
    // 最后的备选方案：返回原始结果
    return matches.slice(0, topK).map(match => ({
      content: match.content,
      filename: match.filename,
      document_id: match.document_id,
      page: match.page,
      page_type: match.page_type,
      score: match.score,
      originalScore: match.score,
      rerankScore: match.score,
    }));
  }
}

/**
 * 计算两个向量的余弦相似度
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}