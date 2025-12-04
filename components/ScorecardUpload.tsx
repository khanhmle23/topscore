/**
 * ScorecardUpload Component
 * 
 * Allows users to upload a golf scorecard image for analysis.
 * Sends the image to /api/scorecards and displays loading state.
 */

'use client';

import { useState } from 'react';
import type { ScorecardAnalysisResponse } from '@/lib/types';

interface ScorecardUploadProps {
  onAnalysisComplete: (data: ScorecardAnalysisResponse) => void;
}

export default function ScorecardUpload({ onAnalysisComplete }: ScorecardUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image file too large (max 10MB)');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/scorecards', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze scorecard');
      }

      const data: ScorecardAnalysisResponse = await response.json();
      onAnalysisComplete(data);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload scorecard');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="space-y-4">
          <div className="text-4xl">⛳</div>
          
          {isUploading ? (
            <div className="space-y-2">
              <div className="text-lg font-semibold text-gray-700">
                Analyzing your scorecard...
              </div>
              <div className="text-sm text-gray-500">
                This may take a few moments
              </div>
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            </div>
          ) : (
            <>
              <div className="text-lg font-semibold text-gray-700">
                Upload Golf Scorecard
              </div>
              <div className="text-sm text-gray-500">
                Drag and drop an image, or click to select
              </div>
              <label className="inline-block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  className="hidden"
                  disabled={isUploading}
                />
                <span className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer">
                  Choose File
                </span>
              </label>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}
    </div>
  );
}
