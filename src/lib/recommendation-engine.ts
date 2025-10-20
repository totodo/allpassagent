import { createEmbedding } from './siliconflow-embedding';
import { pineconeIndex } from './pinecone';
import { v4 as uuidv4 } from 'uuid';

// 推荐问题接口
export interface RecommendedQuestion {
  id: string;
  question: string;
  category: string;
  relevanceScore: number;
  context: string;
  source?: string;
}

// 对话上下文接口
export interface ConversationContext {
  currentMessage: string;
  previousMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  topics: string[];
  userIntent: string;
}

// 推荐策略配置
export interface RecommendationConfig {
  maxRecommendations: number;
  diversityThreshold: number;
  relevanceThreshold: number;
  categories: string[];
}

export class RecommendationEngine {
  private config: RecommendationConfig;

  constructor(config?: Partial<RecommendationConfig>) {
    this.config = {
      maxRecommendations: 3,
      diversityThreshold: 0.7,
      relevanceThreshold: 0.6,
      categories: ['基础概念', '实践操作', '案例分析', '深入学习', '相关主题'],
      ...config,
    };
  }

  /**
   * 生成推荐问题
   */
  async generateRecommendations(
    context: ConversationContext,
    sources?: Array<{ filename: string; content: string }>
  ): Promise<RecommendedQuestion[]> {
    try {
      // 1. 分析对话上下文，提取关键信息
      const contextAnalysis = await this.analyzeContext(context);
      
      // 2. 基于上下文生成候选问题
      const candidateQuestions = await this.generateCandidateQuestions(
        contextAnalysis,
        sources
      );
      
      // 3. 对候选问题进行评分和排序
      const scoredQuestions = await this.scoreQuestions(
        candidateQuestions,
        contextAnalysis
      );
      
      // 4. 应用多样性过滤，确保推荐问题的多样性
      const diverseQuestions = this.applyDiversityFilter(scoredQuestions);
      
      // 5. 返回最终推荐结果
      return diverseQuestions.slice(0, this.config.maxRecommendations);
    } catch (error) {
      console.error('生成推荐问题失败:', error);
      return this.getFallbackRecommendations();
    }
  }

  /**
   * 分析对话上下文
   */
  private async analyzeContext(context: ConversationContext) {
    // 提取关键词和主题
    const keywords = this.extractKeywords(context.currentMessage);
    const topics = await this.identifyTopics(context);
    const intent = this.analyzeUserIntent(context);
    
    return {
      keywords,
      topics,
      intent,
      conversationDepth: context.previousMessages.length,
      lastUserMessage: context.currentMessage,
    };
  }

  /**
   * 生成候选问题
   */
  private async generateCandidateQuestions(
    analysis: any,
    sources?: Array<{ filename: string; content: string }>
  ): Promise<RecommendedQuestion[]> {
    const candidates: RecommendedQuestion[] = [];
    
    // 基于关键词生成问题
    const keywordQuestions = await this.generateKeywordBasedQuestions(analysis.keywords);
    candidates.push(...keywordQuestions);
    
    // 基于主题生成问题
    const topicQuestions = await this.generateTopicBasedQuestions(analysis.topics);
    candidates.push(...topicQuestions);
    
    // 基于用户意图生成问题
    const intentQuestions = await this.generateIntentBasedQuestions(analysis.intent);
    candidates.push(...intentQuestions);
    
    // 基于文档内容生成问题
    if (sources && sources.length > 0) {
      const sourceQuestions = await this.generateSourceBasedQuestions(sources);
      candidates.push(...sourceQuestions);
    }
    
    return candidates;
  }

  /**
   * 基于关键词生成问题
   */
  private async generateKeywordBasedQuestions(keywords: string[]): Promise<RecommendedQuestion[]> {
    const questions: RecommendedQuestion[] = [];
    
    for (const keyword of keywords.slice(0, 3)) {
      // 使用向量搜索找到相关内容
      try {
        const embedding = await createEmbedding(keyword);
        const searchResults = await pineconeIndex.query({
          vector: embedding,
          topK: 5,
          includeMetadata: true,
        });

        // 基于搜索结果生成问题
        for (const match of searchResults.matches || []) {
          if (match.score && match.score > 0.7) {
            const content = match.metadata?.full_content as string;
            const filename = match.metadata?.filename as string;
            
            questions.push({
              id: `keyword-${keyword}-${Math.random().toString(36).substr(2, 9)}`,
              question: `关于${keyword}，还有哪些需要了解的要点？`,
              category: '深入学习',
              relevanceScore: match.score,
              context: content?.substring(0, 100) + '...',
              source: filename,
            });
          }
        }
      } catch (error) {
        console.error(`为关键词 ${keyword} 生成问题失败:`, error);
      }
    }
    
    return questions;
  }

  /**
   * 基于主题生成问题
   */
  private async generateTopicBasedQuestions(topics: string[]): Promise<RecommendedQuestion[]> {
    const questions: RecommendedQuestion[] = [];
    
    const topicQuestionTemplates = {
      '电子商务': [
        '电子商务的发展趋势是什么？',
        '如何选择合适的电商平台？',
        '电商运营的核心指标有哪些？',
      ],
      '直播电商': [
        '直播电商的关键成功因素是什么？',
        '如何提高直播间的转化率？',
        '直播电商与传统电商的区别在哪里？',
      ],
      '运营': [
        '电商运营的日常工作包括哪些？',
        '如何制定有效的运营策略？',
        '运营数据分析的重点是什么？',
      ],
    };

    for (const topic of topics) {
      const templates = topicQuestionTemplates[topic as keyof typeof topicQuestionTemplates];
      if (templates) {
        templates.forEach((template, index) => {
          questions.push({
            id: uuidv4(),
            question: template,
            category: '相关主题',
            relevanceScore: 0.8,
            context: `基于${topic}主题生成的推荐问题`,
          });
        });
      }
    }
    
    return questions;
  }

  /**
   * 基于用户意图生成问题
   */
  private async generateIntentBasedQuestions(intent: string): Promise<RecommendedQuestion[]> {
    const questions: RecommendedQuestion[] = [];
    
    const intentQuestionMap = {
      'learning': [
        '想了解更多基础概念吗？',
        '需要看一些实际案例吗？',
        '想深入学习相关技能吗？',
      ],
      'problem-solving': [
        '遇到类似问题时该如何处理？',
        '有什么预防措施可以采取？',
        '还有其他解决方案吗？',
      ],
      'comparison': [
        '这些方案的优缺点分别是什么？',
        '在不同场景下该如何选择？',
        '有没有更好的替代方案？',
      ],
    };

    const intentQuestions = intentQuestionMap[intent as keyof typeof intentQuestionMap] || [];
    
    intentQuestions.forEach((question, index) => {
      questions.push({
        id: uuidv4(),
        question,
        category: '实践操作',
        relevanceScore: 0.75,
        context: `基于用户意图 ${intent} 生成的推荐问题`,
      });
    });
    
    return questions;
  }

  /**
   * 基于文档内容生成问题
   */
  private async generateSourceBasedQuestions(
    sources: Array<{ filename: string; content: string }>
  ): Promise<RecommendedQuestion[]> {
    const questions: RecommendedQuestion[] = [];
    
    for (const source of sources.slice(0, 2)) {
      // 从文档内容中提取关键概念
      const concepts = this.extractConceptsFromContent(source.content);
      
      concepts.forEach((concept, index) => {
        questions.push({
          id: uuidv4(),
          question: `在${source.filename}中，${concept}的具体应用是什么？`,
          category: '案例分析',
          relevanceScore: 0.7,
          context: source.content.substring(0, 100) + '...',
          source: source.filename,
        });
      });
    }
    
    return questions;
  }

  /**
   * 对问题进行评分
   */
  private async scoreQuestions(
    questions: RecommendedQuestion[],
    analysis: any
  ): Promise<RecommendedQuestion[]> {
    // 基于多个因素对问题进行评分
    return questions.map(question => ({
      ...question,
      relevanceScore: this.calculateRelevanceScore(question, analysis),
    })).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * 计算相关性得分
   */
  private calculateRelevanceScore(question: RecommendedQuestion, analysis: any): number {
    let score = question.relevanceScore;
    
    // 基于关键词匹配度调整得分
    const keywordMatches = analysis.keywords.filter((keyword: string) =>
      question.question.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    score += keywordMatches * 0.1;
    
    // 基于类别权重调整得分
    const categoryWeights = {
      '基础概念': 0.8,
      '实践操作': 0.9,
      '案例分析': 0.85,
      '深入学习': 0.75,
      '相关主题': 0.7,
    };
    score *= categoryWeights[question.category as keyof typeof categoryWeights] || 0.7;
    
    return Math.min(score, 1.0);
  }

  /**
   * 应用多样性过滤
   */
  private applyDiversityFilter(questions: RecommendedQuestion[]): RecommendedQuestion[] {
    const filtered: RecommendedQuestion[] = [];
    const usedCategories = new Set<string>();
    
    for (const question of questions) {
      if (question.relevanceScore >= this.config.relevanceThreshold) {
        // 确保类别多样性
        if (!usedCategories.has(question.category) || usedCategories.size < this.config.categories.length) {
          filtered.push(question);
          usedCategories.add(question.category);
        }
      }
    }
    
    return filtered;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 简单的关键词提取逻辑
    const stopWords = new Set(['的', '是', '在', '有', '和', '与', '或', '但', '如何', '什么', '哪些']);
    const words = text.split(/\s+|[，。！？；：]/).filter(word => 
      word.length > 1 && !stopWords.has(word)
    );
    
    // 返回出现频率最高的关键词
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });
    
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * 识别主题
   */
  private async identifyTopics(context: ConversationContext): Promise<string[]> {
    const allText = [
      context.currentMessage,
      ...context.previousMessages.map(msg => msg.content)
    ].join(' ');
    
    const topicKeywords = {
      '电子商务': ['电商', '电子商务', '网店', '在线销售', '电商平台'],
      '直播电商': ['直播', '直播带货', '主播', '直播间', '直播电商'],
      '运营': ['运营', '推广', '营销', '数据分析', '用户运营'],
      '供应链': ['供应链', '物流', '仓储', '配送', '库存'],
    };
    
    const identifiedTopics: string[] = [];
    
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => allText.includes(keyword))) {
        identifiedTopics.push(topic);
      }
    }
    
    return identifiedTopics;
  }

  /**
   * 分析用户意图
   */
  private analyzeUserIntent(context: ConversationContext): string {
    const message = context.currentMessage.toLowerCase();
    
    if (message.includes('如何') || message.includes('怎么') || message.includes('方法')) {
      return 'problem-solving';
    } else if (message.includes('区别') || message.includes('对比') || message.includes('比较')) {
      return 'comparison';
    } else if (message.includes('学习') || message.includes('了解') || message.includes('知识')) {
      return 'learning';
    } else {
      return 'general';
    }
  }

  /**
   * 从内容中提取概念
   */
  private extractConceptsFromContent(content: string): string[] {
    // 简单的概念提取逻辑
    const concepts: string[] = [];
    const sentences = content.split(/[。！？]/).filter(s => s.length > 10);
    
    sentences.slice(0, 3).forEach(sentence => {
      const words = sentence.split(/\s+|[，、]/).filter(word => word.length > 2);
      if (words.length > 0) {
        concepts.push(words[0]);
      }
    });
    
    return concepts.slice(0, 3);
  }

  /**
   * 获取备用推荐问题
   */
  private getFallbackRecommendations(): RecommendedQuestion[] {
    return [
      {
        id: uuidv4(),
        question: '电子商务的基本概念是什么？',
        category: '基础概念',
        relevanceScore: 0.6,
        context: '基础电商知识',
      },
      {
        id: uuidv4(),
        question: '如何开始电商运营？',
        category: '实践操作',
        relevanceScore: 0.6,
        context: '电商运营入门',
      },
      {
        id: uuidv4(),
        question: '直播电商有哪些优势？',
        category: '相关主题',
        relevanceScore: 0.6,
        context: '直播电商知识',
      },
    ];
  }
}

// 创建默认推荐引擎实例
export const recommendationEngine = new RecommendationEngine();