'use client';

import React, { useState } from 'react';
import { Search, FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface SearchResult {
  _id: string;
  filename: string;
  content: string;
  score: number;
}

const SearchInterface: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '搜索失败');
      }
      const data = await response.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message || '发生未知错误');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleResultExpansion = (id: string) => {
    setExpandedResults(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="h-full flex flex-col p-4 bg-white rounded-lg shadow-md">
      <form onSubmit={handleSearch} className="mb-4 flex items-center">
        <div className="relative flex-grow">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入关键词进行语义搜索..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="ml-3 px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300 transition-colors"
        >
          {isLoading ? '搜索中...' : '搜索'}
        </button>
      </form>

      {error && <div className="text-red-500 text-center mb-4">{error}</div>}

      <div className="flex-grow overflow-y-auto pr-2">
        {results.length > 0 ? (
          <ul className="space-y-3">
            {results.map((result) => (
              <li key={result._id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 transition-all hover:shadow-sm">
                <div className="flex justify-between items-start cursor-pointer" onClick={() => toggleResultExpansion(result._id)}>
                  <div className="flex items-center">
                    <FileText className="text-blue-500 mr-3 flex-shrink-0" size={22} />
                    <p className="font-semibold text-gray-800 truncate" title={result.filename}>
                      {result.filename}
                    </p>
                  </div>
                  <div className="flex items-center ml-4">
                    <span className={`text-sm font-medium px-2 py-1 rounded-md ${result.score > 0.8 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      相似度: {result.score.toFixed(3)}
                    </span>
                    <button className="ml-3 text-gray-500 hover:text-gray-800">
                      {expandedResults[result._id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>
                {expandedResults[result._id] && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                      {result.content}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          !isLoading && (
            <div className="text-center text-gray-500 pt-10">
              <p>暂无搜索结果。尝试输入一些关键词开始搜索。</p>
            </div>
          )
        )}
        {isLoading && (
            <div className="text-center text-gray-500 pt-10">
              <p>正在努力搜索中...</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default SearchInterface;