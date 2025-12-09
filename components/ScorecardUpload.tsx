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
    // Check if it's an image or HEIC file
    const isImage = file.type.startsWith('image/');
    const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
    
    if (!isImage && !isHeic) {
      setError('Please upload an image file (JPG, PNG, WebP, HEIC)');
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
      console.log('[ScorecardUpload] Received response data:', data);
      console.log('[ScorecardUpload] Extracted players:', data.extracted?.players?.length);
      console.log('[ScorecardUpload] Calling onAnalysisComplete...');
      onAnalysisComplete(data);
      console.log('[ScorecardUpload] onAnalysisComplete called successfully');
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
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 ${
          dragActive
            ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg scale-105'
            : 'border-gray-300 bg-white/50 backdrop-blur-sm hover:border-blue-400 hover:shadow-md'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="relative w-32 h-32 rounded-2xl overflow-hidden shadow-lg border-2 border-blue-200">
              <img 
                src="/scorecard-example.jpg" 
                alt="Golf scorecard example" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 flex items-center justify-center">
                <span className="text-5xl drop-shadow-lg">📸</span>
              </div>
            </div>
          </div>
          
          {isUploading ? (
            <div className="space-y-4">
              <div className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Analyzing your scorecard...
              </div>
              <div className="text-sm text-gray-600">
                This may take a few moments
              </div>
              <div className="flex justify-center">
                <div className="relative">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200"></div>
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-transparent border-t-blue-600 absolute top-0 left-0"></div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="text-xl font-semibold text-gray-900">
                  Upload Golf Scorecard
                </div>
                <div className="text-sm text-gray-600">
                  Drag and drop an image, or click to select
                </div>
              </div>
              <label className="inline-block">
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  onChange={handleFileInput}
                  className="hidden"
                  disabled={isUploading}
                />
                <span className="inline-flex items-center px-6 py-3 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 cursor-pointer shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Choose File
                </span>
              </label>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl shadow-sm">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-red-800 font-medium">{error}</div>
          </div>
        </div>
      )}
    </div>
  );
}
