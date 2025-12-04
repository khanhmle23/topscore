/**
 * Main Application Page
 * 
 * This is the home page that ties together all components:
 * - ScorecardUpload: Upload and analyze golf scorecard images
 * - ScorecardEditor: View and edit extracted scorecard data
 * - AIAssistantPanel: Get AI insights about the round
 */

'use client';

import { useState } from 'react';
import ScorecardUpload from '@/components/ScorecardUpload';
import ScorecardEditor from '@/components/ScorecardEditor';
import AIAssistantPanel from '@/components/AIAssistantPanel';
import ManualJsonInput from '@/components/ManualJsonInput';
import { calculateDerivedScoring } from '@/lib/golfScoring';
import type { ExtractedScorecard, DerivedScoring, ScorecardAnalysisResponse } from '@/lib/types';

export default function Home() {
  const [scorecard, setScorecard] = useState<ExtractedScorecard | null>(null);
  const [derived, setDerived] = useState<DerivedScoring | null>(null);

  const handleAnalysisComplete = (data: ScorecardAnalysisResponse) => {
    setScorecard(data.extracted);
    setDerived(data.derived);
  };

  const handleManualDataSubmit = (data: ExtractedScorecard) => {
    const derivedData = calculateDerivedScoring(data);
    setScorecard(data);
    setDerived(derivedData);
  };

  const handleScorecardChange = (updatedScorecard: ExtractedScorecard, updatedDerived: DerivedScoring) => {
    setScorecard(updatedScorecard);
    setDerived(updatedDerived);
  };

  const handleReset = () => {
    setScorecard(null);
    setDerived(null);
  };

  return (
    <main className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                TopScore Golf
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                AI-powered golf scorecard analysis
              </p>
            </div>
            {scorecard && (
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors font-medium"
              >
                New Scorecard
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!scorecard ? (
          // Upload view
          <div className="max-w-2xl mx-auto">
            <ScorecardUpload onAnalysisComplete={handleAnalysisComplete} />
            
            {/* Manual JSON Input */}
            <div className="mt-6 text-center">
              <ManualJsonInput onDataSubmit={handleManualDataSubmit} />
            </div>
            
            {/* Info Section */}
            <div className="mt-8 bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                How It Works
              </h2>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold mr-3">
                    1
                  </span>
                  <p>
                    <strong className="text-gray-900">Upload your scorecard</strong> - 
                    Take a photo of your golf scorecard and upload it
                  </p>
                </div>
                <div className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold mr-3">
                    2
                  </span>
                  <p>
                    <strong className="text-gray-900">AI extracts the data</strong> - 
                    OpenAI Vision analyzes your scorecard and extracts all scores
                  </p>
                </div>
                <div className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold mr-3">
                    3
                  </span>
                  <p>
                    <strong className="text-gray-900">Review and edit</strong> - 
                    Check the extracted data and make any corrections
                  </p>
                </div>
                <div className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold mr-3">
                    4
                  </span>
                  <p>
                    <strong className="text-gray-900">Get AI insights</strong> - 
                    Ask our AI assistant about your performance and get personalized tips
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Results view
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <ScorecardEditor
                initialScorecard={scorecard}
                initialDerived={derived!}
                onScorecardChange={handleScorecardChange}
              />
            </div>
            <div className="lg:col-span-1">
              <AIAssistantPanel scorecard={scorecard} derived={derived} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-sm text-gray-500">
          <p>Powered by OpenAI Vision and Amazon Bedrock</p>
        </div>
      </div>
    </main>
  );
}
