'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

// 动态导入 ForceGraph2D，禁用 SSR
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96">
    <div className="text-gray-500">加载知识图谱中...</div>
  </div>
});

interface GraphNode {
  id: string;
  name: string;
  type: 'document' | 'concept' | 'keyword';
  size: number;
  color: string;
  x?: number;
  y?: number;
  metadata?: any;
}

interface GraphLink {
  source: string;
  target: string;
  value: number;
  type: 'similarity' | 'contains' | 'related';
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export default function KnowledgeGraph() {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({
    nodes: [],
    links: []
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchGraphData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/graph');
      const data = await response.json();
      
      if (data.success) {
        setGraphData(data.data);
      } else {
        console.error('获取图谱数据失败:', data.error);
        // 如果API失败，使用模拟数据
        setGraphData(generateMockData());
      }
    } catch (error) {
      console.error('获取图谱数据失败:', error);
      // 如果API失败，使用模拟数据
      setGraphData(generateMockData());
    } finally {
      setLoading(false);
    }
  };
  const graphRef = useRef<any>(null);

  // Mock data generation for demonstration
  const generateMockData = (): GraphData => {
    const documents = [
      { id: 'doc1', name: '电商基础教程', type: 'document' as const },
      { id: 'doc2', name: '营销策略指南', type: 'document' as const },
      { id: 'doc3', name: '客户服务手册', type: 'document' as const },
      { id: 'doc4', name: '数据分析方法', type: 'document' as const },
    ];

    const concepts = [
      { id: 'concept1', name: '电子商务', type: 'concept' as const },
      { id: 'concept2', name: '数字营销', type: 'concept' as const },
      { id: 'concept3', name: '用户体验', type: 'concept' as const },
      { id: 'concept4', name: '数据驱动', type: 'concept' as const },
      { id: 'concept5', name: '客户关系', type: 'concept' as const },
    ];

    const keywords = [
      { id: 'kw1', name: '转化率', type: 'keyword' as const },
      { id: 'kw2', name: 'SEO优化', type: 'keyword' as const },
      { id: 'kw3', name: '社交媒体', type: 'keyword' as const },
      { id: 'kw4', name: '用户画像', type: 'keyword' as const },
      { id: 'kw5', name: '销售漏斗', type: 'keyword' as const },
    ];

    const getNodeColor = (type: string) => {
      switch (type) {
        case 'document': return '#3b82f6';
        case 'concept': return '#10b981';
        case 'keyword': return '#f59e0b';
        default: return '#6b7280';
      }
    };

    const getNodeSize = (type: string) => {
      switch (type) {
        case 'document': return 8;
        case 'concept': return 6;
        case 'keyword': return 4;
        default: return 4;
      }
    };

    const nodes: GraphNode[] = [
      ...documents.map(d => ({
        ...d,
        size: getNodeSize(d.type),
        color: getNodeColor(d.type),
      })),
      ...concepts.map(c => ({
        ...c,
        size: getNodeSize(c.type),
        color: getNodeColor(c.type),
      })),
      ...keywords.map(k => ({
        ...k,
        size: getNodeSize(k.type),
        color: getNodeColor(k.type),
      })),
    ];

    const links: GraphLink[] = [
      // Document to concept relationships
      { source: 'doc1', target: 'concept1', value: 0.9, type: 'contains' },
      { source: 'doc2', target: 'concept2', value: 0.8, type: 'contains' },
      { source: 'doc3', target: 'concept5', value: 0.7, type: 'contains' },
      { source: 'doc4', target: 'concept4', value: 0.9, type: 'contains' },
      
      // Concept to keyword relationships
      { source: 'concept1', target: 'kw1', value: 0.6, type: 'related' },
      { source: 'concept2', target: 'kw2', value: 0.8, type: 'related' },
      { source: 'concept2', target: 'kw3', value: 0.7, type: 'related' },
      { source: 'concept4', target: 'kw4', value: 0.9, type: 'related' },
      { source: 'concept1', target: 'kw5', value: 0.5, type: 'related' },
      
      // Cross-document similarities
      { source: 'doc1', target: 'doc2', value: 0.4, type: 'similarity' },
      { source: 'doc2', target: 'doc4', value: 0.3, type: 'similarity' },
      { source: 'concept1', target: 'concept2', value: 0.6, type: 'similarity' },
    ];

    return { nodes, links };
  };

  useEffect(() => {
    fetchGraphData();
  }, []);

  const handleNodeClick = (node: any) => {
    console.log('Node clicked:', node);
    // You can implement node details modal or navigation here
  };

  const handleSearch = () => {
    if (!searchTerm.trim()) return;
    
    const matchingNode = graphData.nodes.find(node => 
      node.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (matchingNode && graphRef.current) {
      graphRef.current.centerAt(matchingNode.x, matchingNode.y, 1000);
      graphRef.current.zoom(2, 1000);
    }
  };

  const filteredData = searchTerm.trim() 
    ? {
        nodes: graphData.nodes.filter(node => 
          node.name.toLowerCase().includes(searchTerm.toLowerCase())
        ),
        links: graphData.links.filter(link => {
          const sourceNode = graphData.nodes.find(n => n.id === link.source);
          const targetNode = graphData.nodes.find(n => n.id === link.target);
          return sourceNode?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 targetNode?.name.toLowerCase().includes(searchTerm.toLowerCase());
        })
      }
    : graphData;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">知识图谱</h2>
          <Button
            onClick={fetchGraphData}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
        
        {/* Search */}
        <div className="flex space-x-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索节点..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} size="sm">
            <Search className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Legend */}
        <div className="flex items-center space-x-6 mt-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-gray-600">文档</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-600">概念</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-gray-600">关键词</span>
          </div>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">加载知识图谱...</p>
            </div>
          </div>
        ) : (
          <ForceGraph2D
            ref={graphRef}
            graphData={filteredData}
            nodeLabel="name"
            nodeColor="color"
            nodeVal="size"
            linkColor={() => '#94a3b8'}
            linkWidth={(link: any) => Math.sqrt(link.value) * 2}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={2}
            onNodeClick={handleNodeClick}
            nodeCanvasObject={(node: any, ctx: any, globalScale: any) => {
              const label = node.name;
              const fontSize = 12 / globalScale;
              ctx.font = `${fontSize}px Sans-Serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = node.color;
              ctx.fillText(label, node.x!, node.y! + node.size! + fontSize);
            }}
            cooldownTicks={100}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />
        )}
      </div>

      {/* Stats */}
      <div className="bg-gray-50 border-t border-gray-200 p-4">
        <div className="flex justify-between text-sm text-gray-600">
          <span>节点数: {filteredData.nodes.length}</span>
          <span>连接数: {filteredData.links.length}</span>
          <span>文档数: {filteredData.nodes.filter(n => n.type === 'document').length}</span>
        </div>
      </div>
    </div>
  );
}