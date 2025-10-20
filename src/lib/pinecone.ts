import { Pinecone } from '@pinecone-database/pinecone';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('Missing PINECONE_API_KEY environment variable');
}

if (!process.env.PINECONE_INDEX_NAME) {
  throw new Error('Missing PINECONE_INDEX_NAME environment variable');
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

export const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX_NAME);

export default pinecone;