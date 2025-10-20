#!/usr/bin/env node

// 加载环境变量
require('dotenv').config({ path: '.env.local' });

// 检查必需的环境变量
const requiredEnvVars = [
  'PINECONE_API_KEY',
  'PINECONE_INDEX_NAME',
  'SILICONFLOW_API_KEY',
  'MONGODB_URI'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

console.log('Environment variables loaded successfully');
console.log('Starting file processor worker...');

// 使用 tsx 运行 TypeScript 文件
const { spawn } = require('child_process');
const worker = spawn('npx', ['tsx', 'src/workers/file-processor.ts'], {
  stdio: 'inherit',
  env: process.env
});

worker.on('close', (code) => {
  console.log(`Worker process exited with code ${code}`);
});

worker.on('error', (error) => {
  console.error('Failed to start worker:', error);
});