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
import AdditionalPlayersUpload from '@/components/AdditionalPlayersUpload';
import PWAInstall from '@/components/PWAInstall';
import { calculateDerivedScoring } from '@/lib/golfScoring';
import { mergePlayers, validateScorecardCompatibility, getMergeSummary } from '@/lib/mergeScorecards';
import type { ExtractedScorecard, DerivedScoring, ScorecardAnalysisResponse } from '@/lib/types';

export default function Home() {
  const [scorecard, setScorecard] = useState<ExtractedScorecard | null>(null);
  const [derived, setDerived] = useState<DerivedScoring | null>(null);
  const [showAddPlayers, setShowAddPlayers] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [mergeSuccess, setMergeSuccess] = useState<string | null>(null);

  const handleAnalysisComplete = (data: ScorecardAnalysisResponse) => {
    console.log('[handleAnalysisComplete] Received data:', data);
    console.log('[handleAnalysisComplete] Setting scorecard with players:', data.extracted.players.length);
    setScorecard(data.extracted);
    setDerived(data.derived);
  };

  const handleScorecardChange = (updatedScorecard: ExtractedScorecard, updatedDerived: DerivedScoring) => {
    setScorecard(updatedScorecard);
    setDerived(updatedDerived);
  };

  const handleReset = () => {
    setScorecard(null);
    setDerived(null);
    setShowAddPlayers(false);
    setMergeError(null);
    setMergeSuccess(null);
  };

  const handleAddPlayersClick = () => {
    setShowAddPlayers(true);
    setMergeError(null);
    setMergeSuccess(null);
  };

  const handlePlayersAdded = (newScorecard: ExtractedScorecard) => {
    if (!scorecard) return;

    console.log('[handlePlayersAdded] Current scorecard:', scorecard);
    console.log('[handlePlayersAdded] New scorecard:', newScorecard);

    try {
      // Validate compatibility
      const validation = validateScorecardCompatibility(scorecard, newScorecard);
      console.log('[handlePlayersAdded] Validation result:', validation);
      
      if (!validation.isValid) {
        setMergeError(validation.error || 'Scorecards are not compatible');
        return;
      }

      // Get merge summary
      const summary = getMergeSummary(scorecard, newScorecard);
      console.log('[handlePlayersAdded] Merge summary:', summary);
      
      if (summary.newPlayers.length === 0) {
        setMergeError('No new players to add. All players already exist in the scorecard.');
        return;
      }

      // Merge the scorecards
      const mergedScorecard = mergePlayers(scorecard, newScorecard);
      console.log('[handlePlayersAdded] Merged scorecard:', mergedScorecard);
      
      const newDerived = calculateDerivedScoring(mergedScorecard);
      
      setScorecard(mergedScorecard);
      setDerived(newDerived);
      setShowAddPlayers(false);
      setMergeSuccess(
        `Successfully added ${summary.newPlayers.length} player(s): ${summary.newPlayers.join(', ')}`
      );

      // Clear success message after 5 seconds
      setTimeout(() => setMergeSuccess(null), 5000);
    } catch (error) {
      console.error('[handlePlayersAdded] Error merging scorecards:', error);
      setMergeError(error instanceof Error ? error.message : 'Failed to merge scorecards');
    }
  };

  const handleCancelAddPlayers = () => {
    setShowAddPlayers(false);
    setMergeError(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="/Topscore_Logo-192.png" 
                alt="TopScore Logo" 
                className="w-12 h-12 shadow-md"
              />
              <div>
                <h1 className="text-3xl font-bold text-black">
                  TopScore Golf Scorecard Extractor
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  AI-powered golf scorecard extractor and analyzer
                </p>
              </div>
            </div>
            {scorecard && (
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-black hover:bg-gray-800 text-white transition-all duration-200 font-medium shadow-sm hover:shadow-md"
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
            
            {/* Info Section */}
            <div className="mt-8 bg-white/70 backdrop-blur-sm shadow-lg border border-gray-100 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                How It Works
              </h2>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start group">
                  <span className="flex-shrink-0 w-8 h-8 bg-black text-white flex items-center justify-center font-semibold mr-3 shadow-sm group-hover:shadow-md transition-shadow">
                    1
                  </span>
                  <p className="pt-1">
                    <strong className="text-gray-900">Upload your scorecard</strong> - 
                    Take a clear photo of your golf scorecard and upload it
                  </p>
                </div>
                <div className="flex items-start group">
                  <span className="flex-shrink-0 w-8 h-8 bg-gray-800 text-white flex items-center justify-center font-semibold mr-3 shadow-sm group-hover:shadow-md transition-shadow">
                    2
                  </span>
                  <p className="pt-1">
                    <strong className="text-gray-900">AI extracts the data</strong> - 
                    Our AI analyzes your scorecard and extracts all the information
                  </p>
                </div>
                <div className="flex items-start group">
                  <span className="flex-shrink-0 w-8 h-8 bg-gray-700 text-white flex items-center justify-center font-semibold mr-3 shadow-sm group-hover:shadow-md transition-shadow">
                    3
                  </span>
                  <p className="pt-1">
                    <strong className="text-gray-900">Review and edit</strong> - 
                    Check the extracted data and make any corrections needed
                  </p>
                </div>
                <div className="flex items-start group">
                  <span className="flex-shrink-0 w-8 h-8 bg-gray-600 text-white flex items-center justify-center font-semibold mr-3 shadow-sm group-hover:shadow-md transition-shadow">
                    4
                  </span>
                  <p className="pt-1">
                    <strong className="text-gray-900">Export your data</strong> - 
                    Download your scorecard data as CSV for easy sharing and record keeping
                  </p>
                </div>
                <div className="flex items-start group">
                  <span className="flex-shrink-0 w-8 h-8 bg-gray-500 text-white flex items-center justify-center font-semibold mr-3 shadow-sm group-hover:shadow-md transition-shadow">
                    5
                  </span>
                  <p className="pt-1">
                    <strong className="text-gray-900">Add more players</strong> - 
                    Upload additional scorecards from the same course to add more players
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Results view
          <div className="max-w-5xl mx-auto">
            {/* Success message */}
            {mergeSuccess && (
              <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-4 shadow-sm">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-green-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-800 font-medium">{mergeSuccess}</p>
                  </div>
                  <div className="ml-auto pl-3">
                    <button
                      onClick={() => setMergeSuccess(null)}
                      className="inline-flex text-green-500 hover:text-green-700 transition-colors"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <ScorecardEditor
              initialScorecard={scorecard}
              initialDerived={derived!}
              onScorecardChange={handleScorecardChange}
              onAddPlayers={handleAddPlayersClick}
            />
          </div>
        )}
        
        {/* Additional Players Upload Modal */}
        {showAddPlayers && (
          <AdditionalPlayersUpload
            onPlayersAdded={handlePlayersAdded}
            onCancel={handleCancelAddPlayers}
          />
        )}
        
        {/* Merge Error Modal */}
        {mergeError && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-red-100 flex items-center justify-center">
                    <svg
                      className="h-6 w-6 text-red-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Cannot Add Players
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">{mergeError}</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setMergeError(null)}
                  className="px-5 py-2.5 bg-black hover:bg-gray-800 text-white transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center text-sm text-gray-500">
          <p>Powered by AI</p>
        </div>
      </div>

      {/* PWA Install Prompt */}
      <PWAInstall />
    </main>
  );
}
