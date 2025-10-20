import { NextRequest, NextResponse } from 'next/server';
import { pineconeIndex } from '@/lib/pinecone';
import { createEmbedding } from '@/lib/siliconflow-embedding';

export async function POST(request: NextRequest) {
  try {
    const { query, topK = 5 } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Generate embedding for the query
    const queryEmbedding = await createEmbedding(query);

    // Search in Pinecone
    const searchResults = await pineconeIndex.query({
      vector: queryEmbedding,
      topK: topK,
      includeMetadata: true,
    });

    // Format results
    const results = searchResults.matches?.map(match => ({
      id: match.id,
      score: match.score,
      content: match.metadata?.full_content || match.metadata?.content || '',
      filename: match.metadata?.filename || '',
      documentId: match.metadata?.document_id || '',
      chunkIndex: match.metadata?.chunk_index || 0,
    })) || [];

    return NextResponse.json({
      success: true,
      query,
      results,
      totalResults: results.length,
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}