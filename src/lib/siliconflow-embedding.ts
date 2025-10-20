// SiliconFlow Embedding Service
const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/embeddings';
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY;

if (!SILICONFLOW_API_KEY) {
  throw new Error('Missing SILICONFLOW_API_KEY environment variable');
}

export interface EmbeddingResponse {
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export async function createEmbedding(input: string): Promise<number[]> {
  try {
    const response = await fetch(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'BAAI/bge-large-zh-v1.5', // 使用中文优化的 embedding 模型
        input: input,
      }),
    });

    if (!response.ok) {
      throw new Error(`SiliconFlow API error: ${response.status} ${response.statusText}`);
    }

    const data: EmbeddingResponse = await response.json();
    
    if (!data.data || data.data.length === 0) {
      throw new Error('No embedding data returned from SiliconFlow API');
    }

    return data.data[0].embedding;
  } catch (error) {
    console.error('Error creating embedding with SiliconFlow:', error);
    throw error;
  }
}

export default {
  createEmbedding,
};