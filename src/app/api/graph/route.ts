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
    
    // 从预计算的集合中获取节点和链接
    const nodes = await db.collection('graph_nodes').find({}).toArray();
    const links = await db.collection('graph_links').find({}).toArray();

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