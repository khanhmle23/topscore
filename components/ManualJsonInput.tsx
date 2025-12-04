/**
 * ManualJsonInput Component
 * 
 * Allows users to paste JSON data directly for testing or when image extraction fails.
 */

'use client';

import { useState } from 'react';
import type { ExtractedScorecard } from '@/lib/types';

interface ManualJsonInputProps {
  onDataSubmit: (data: ExtractedScorecard) => void;
}

export default function ManualJsonInput({ onDataSubmit }: ManualJsonInputProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const data = JSON.parse(jsonInput);
      
      // Basic validation
      if (!data.holes || !Array.isArray(data.holes) || !data.players || !Array.isArray(data.players)) {
        throw new Error('Invalid JSON structure: must have holes and players arrays');
      }

      onDataSubmit(data);
      setJsonInput('');
      setShowInput(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON format');
    }
  };

  if (!showInput) {
    return (
      <button
        onClick={() => setShowInput(true)}
        className="text-sm text-blue-600 hover:text-blue-700 underline"
      >
        Or paste JSON manually
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Paste Scorecard JSON
          </label>
          <button
            type="button"
            onClick={() => {
              setShowInput(false);
              setJsonInput('');
              setError(null);
            }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder='{"courseName": "...", "holes": [...], "players": [...]}'
          className="w-full h-48 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
      >
        Load Data
      </button>
    </form>
  );
}
