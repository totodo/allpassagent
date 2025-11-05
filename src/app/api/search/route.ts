import { NextRequest, NextResponse } from 'next/server';
import { pineconeIndex } from '@/lib/pinecone';
import { createEmbedding } from '@/lib/siliconflow-embedding';

export async function GET(request: NextRequest) {
  try {
    console.log('PINECONE_API_KEY:', process.env.PINECONE_API_KEY ? 'Loaded' : 'Missing');
    console.log('PINECONE_INDEX_NAME:', process.env.PINECONE_INDEX_NAME ? 'Loaded' : 'Missing');

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const topK = parseInt(searchParams.get('topK') || '5', 10);

    if (!query) {
      return NextResponse.json({ detail: 'Query is required' }, { status: 400 });
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
      _id: match.id,
      score: match.score,
      content: match.metadata?.full_content || match.metadata?.content || '',
      filename: match.metadata?.filename || '',
    })) || [];

    return NextResponse.json(results);

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}