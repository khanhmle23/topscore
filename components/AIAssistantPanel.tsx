/**
 * AIAssistantPanel Component
 * 
 * Provides a chat-like interface for users to ask questions about their round.
 * Uses Amazon Bedrock (Claude) via /api/assistant to provide insights.
 */

'use client';

import { useState } from 'react';
import type { ExtractedScorecard, DerivedScoring, AssistantResponse } from '@/lib/types';

interface AIAssistantPanelProps {
  scorecard: ExtractedScorecard | null;
  derived: DerivedScoring | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIAssistantPanel({ scorecard, derived }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || !scorecard || !derived) {
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setError(null);

    // Add user message to chat
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scorecard,
          derived,
          message: userMessage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get assistant response');
      }

      const data: AssistantResponse = await response.json();

      // Add assistant response to chat
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error('Assistant error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get assistant response');
    } finally {
      setIsLoading(false);
    }
  };

  const quickQuestions = [
    'How did I play overall?',
    'What were my strongest holes?',
    'Where can I improve?',
    'Any tips for my next round?',
  ];

  const handleQuickQuestion = (question: string) => {
    setInput(question);
  };

  if (!scorecard || !derived) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <div className="text-4xl mb-4">🤖</div>
        <div className="text-lg font-semibold text-gray-700 mb-2">
          AI Golf Assistant
        </div>
        <div className="text-sm text-gray-500">
          Upload a scorecard to get personalized insights and tips
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow flex flex-col h-[600px]">
      {/* Header */}
      <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg">
        <h3 className="text-lg font-semibold">AI Golf Assistant</h3>
        <p className="text-sm text-blue-100">Ask me anything about your round</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p className="mb-4">Try asking:</p>
            <div className="space-y-2">
              {quickQuestions.map((question) => (
                <button
                  key={question}
                  onClick={() => handleQuickQuestion(question)}
                  className="block w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, idx) => (
          <div
            key={idx}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex items-center space-x-2">
                <div className="animate-pulse text-gray-600">Thinking...</div>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your round..."
            disabled={isLoading}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
