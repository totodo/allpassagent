import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { documentId, action = 'process' } = await request.json();

    if (!documentId && action === 'process') {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const pythonScriptPath = path.join(process.cwd(), 'python', 'document_processor.py');
    const args = action === 'process_all' ? ['process_all'] : ['process', documentId];

    return new Promise<NextResponse>((resolve) => {
      const pythonProcess = spawn('python3', [pythonScriptPath, ...args], {
        env: {
          ...process.env,
          PYTHONPATH: path.join(process.cwd(), 'python'),
        },
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve(NextResponse.json(result));
          } catch (e) {
            resolve(NextResponse.json({ 
              success: true, 
              output: output.trim(),
              message: 'Processing completed' 
            }));
          }
        } else {
          resolve(NextResponse.json(
            { 
              error: 'Python script failed', 
              details: errorOutput || output,
              code 
            },
            { status: 500 }
          ));
        }
      });

      pythonProcess.on('error', (error) => {
        resolve(NextResponse.json(
          { error: 'Failed to start Python process', details: error.message },
          { status: 500 }
        ));
      });
    });

  } catch (error) {
    console.error('Process error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    );
  }
}