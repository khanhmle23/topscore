/**
 * ScorecardEditor Component
 * 
 * Displays extracted scorecard data in an editable table format.
 * Allows users to correct any mistakes from the AI extraction.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import type { ExtractedScorecard, DerivedScoring, PlayerHoleScore } from '@/lib/types';
import { calculateDerivedScoring, getRelationToParColor, calculatePlayerTotals } from '@/lib/golfScoring';

interface ScorecardEditorProps {
  initialScorecard: ExtractedScorecard;
  initialDerived: DerivedScoring;
  onScorecardChange: (scorecard: ExtractedScorecard, derived: DerivedScoring) => void;
}

export default function ScorecardEditor({
  initialScorecard,
  initialDerived,
  onScorecardChange,
}: ScorecardEditorProps) {
  const [scorecard, setScorecard] = useState<ExtractedScorecard>(initialScorecard);
  const [derived, setDerived] = useState<DerivedScoring>(initialDerived);
  const isInitialMount = useRef(true);

  // Determine if this is an 18-hole scorecard
  const is18Holes = scorecard.holes.length === 18;
  const frontNineHoles = scorecard.holes.filter(h => h.holeNumber <= 9);
  const backNineHoles = scorecard.holes.filter(h => h.holeNumber >= 10);

  // Recalculate derived data when scorecard changes
  useEffect(() => {
    // Skip the initial mount to avoid calling onScorecardChange unnecessarily
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const newDerived = calculateDerivedScoring(scorecard);
    setDerived(newDerived);
    onScorecardChange(scorecard, newDerived);
  }, [scorecard]);

  const handleScoreChange = (playerName: string, holeNumber: number, newScore: string) => {
    const scoreValue = newScore === '' ? null : parseInt(newScore, 10);
    
    if (scoreValue !== null && (isNaN(scoreValue) || scoreValue < 1 || scoreValue > 20)) {
      return; // Invalid score
    }

    setScorecard((prev) => {
      const updatedScorecard = {
        ...prev,
        players: prev.players.map((player) =>
          player.name === playerName
            ? {
                ...player,
                scores: player.scores.map((s) =>
                  s.holeNumber === holeNumber ? { ...s, score: scoreValue } : s
                ),
              }
            : player
        ),
      };

      // Recalculate totals for all players
      return {
        ...updatedScorecard,
        players: updatedScorecard.players.map(player => calculatePlayerTotals(player)),
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Course Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {scorecard.courseName}
        </h2>
        {scorecard.teeName && (
          <p className="text-sm text-gray-600">Tee: {scorecard.teeName}</p>
        )}
        {scorecard.date && (
          <p className="text-sm text-gray-600">Date: {scorecard.date}</p>
        )}
      </div>

      {/* Scorecard Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Hole
              </th>
              {/* Front 9 holes */}
              {scorecard.holes.filter(h => h.holeNumber <= 9).map((hole) => (
                <th
                  key={hole.holeNumber}
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {hole.holeNumber}
                </th>
              ))}
              {/* OUT column after hole 9 */}
              {is18Holes && (
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                  Out
                </th>
              )}
              {/* Back 9 holes */}
              {scorecard.holes.filter(h => h.holeNumber >= 10).map((hole) => (
                <th
                  key={hole.holeNumber}
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {hole.holeNumber}
                </th>
              ))}
              {/* IN column after hole 18 for 18-hole courses */}
              {is18Holes && backNineHoles.length > 0 && (
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-green-50">
                  In
                </th>
              )}
              {/* TOTAL column at the end */}
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100">
                Total
              </th>
            </tr>
            <tr className="bg-gray-50 border-t border-gray-200">
              <td className="px-4 py-2 text-sm font-medium text-gray-700">Par</td>
              {/* Front 9 pars */}
              {scorecard.holes.filter(h => h.holeNumber <= 9).map((hole) => (
                <td
                  key={hole.holeNumber}
                  className="px-4 py-2 text-center text-sm font-semibold text-gray-900"
                >
                  {hole.par}
                </td>
              ))}
              {/* OUT par total */}
              {is18Holes && (
                <td className="px-4 py-2 text-center text-sm font-bold text-gray-900 bg-blue-50">
                  {frontNineHoles.reduce((sum, h) => sum + h.par, 0)}
                </td>
              )}
              {/* Back 9 pars */}
              {scorecard.holes.filter(h => h.holeNumber >= 10).map((hole) => (
                <td
                  key={hole.holeNumber}
                  className="px-4 py-2 text-center text-sm font-semibold text-gray-900"
                >
                  {hole.par}
                </td>
              ))}
              {/* IN par total */}
              {is18Holes && backNineHoles.length > 0 && (
                <td className="px-4 py-2 text-center text-sm font-bold text-gray-900 bg-green-50">
                  {backNineHoles.reduce((sum, h) => sum + h.par, 0)}
                </td>
              )}
              {/* TOTAL par */}
              <td className="px-4 py-2 text-center text-sm font-bold text-gray-900 bg-gray-100">
                {scorecard.holes.reduce((sum, h) => sum + h.par, 0)}
              </td>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {scorecard.players.map((player, playerIdx) => {
              const playerDerived = derived.players.find((p) => p.name === player.name);
              
              return (
                <tr key={player.name} className={playerIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {player.name}
                  </td>
                  {/* Front 9 scores */}
                  {scorecard.holes.filter(h => h.holeNumber <= 9).map((hole) => {
                    const holeScore = player.scores.find((s) => s.holeNumber === hole.holeNumber);
                    const holeDerived = derived.holes
                      .find((h) => h.holeNumber === hole.holeNumber)
                      ?.playerResults.find((pr) => pr.playerName === player.name);
                    
                    return (
                      <td key={hole.holeNumber} className="px-2 py-2 text-center">
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={holeScore?.score ?? ''}
                          onChange={(e) =>
                            handleScoreChange(player.name, hole.holeNumber, e.target.value)
                          }
                          className={`w-12 text-center border rounded px-2 py-1 text-sm ${
                            holeDerived?.relationToPar
                              ? getRelationToParColor(holeDerived.relationToPar)
                              : 'text-gray-400'
                          } ${
                            holeScore?.confidence === 'low' 
                              ? 'border-2 border-yellow-400 bg-yellow-50' 
                              : holeScore?.confidence === 'medium'
                              ? 'border-yellow-300'
                              : ''
                          }`}
                          title={holeScore?.confidence === 'low' ? 'Low confidence - please verify' : holeScore?.confidence === 'medium' ? 'Medium confidence' : ''}
                        />
                      </td>
                    );
                  })}
                  {/* OUT column */}
                  {is18Holes && (
                    <td className="px-4 py-3 text-center text-sm font-bold text-gray-900 bg-blue-50">
                      {player.frontNine ?? '-'}
                    </td>
                  )}
                  {/* Back 9 scores */}
                  {scorecard.holes.filter(h => h.holeNumber >= 10).map((hole) => {
                    const holeScore = player.scores.find((s) => s.holeNumber === hole.holeNumber);
                    const holeDerived = derived.holes
                      .find((h) => h.holeNumber === hole.holeNumber)
                      ?.playerResults.find((pr) => pr.playerName === player.name);
                    
                    return (
                      <td key={hole.holeNumber} className="px-2 py-2 text-center">
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={holeScore?.score ?? ''}
                          onChange={(e) =>
                            handleScoreChange(player.name, hole.holeNumber, e.target.value)
                          }
                          className={`w-12 text-center border rounded px-2 py-1 text-sm ${
                            holeDerived?.relationToPar
                              ? getRelationToParColor(holeDerived.relationToPar)
                              : 'text-gray-400'
                          } ${
                            holeScore?.confidence === 'low' 
                              ? 'border-2 border-yellow-400 bg-yellow-50' 
                              : holeScore?.confidence === 'medium'
                              ? 'border-yellow-300'
                              : ''
                          }`}
                          title={holeScore?.confidence === 'low' ? 'Low confidence - please verify' : holeScore?.confidence === 'medium' ? 'Medium confidence' : ''}
                        />
                      </td>
                    );
                  })}
                  {/* IN column */}
                  {is18Holes && backNineHoles.length > 0 && (
                    <td className="px-4 py-3 text-center text-sm font-bold text-gray-900 bg-green-50">
                      {player.backNine ?? '-'}
                    </td>
                  )}
                  {/* TOTAL column */}
                  <td className="px-4 py-3 text-center text-sm font-bold text-gray-900 bg-gray-50">
                    {playerDerived?.totalScore || 0}
                    <div className="text-xs text-gray-600">
                      ({playerDerived && playerDerived.scoreToPar >= 0 ? '+' : ''}
                      {playerDerived?.scoreToPar})
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {derived.players.map((player) => (
          <div key={player.name} className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {player.name}
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Score:</span>
                <span className="font-semibold">
                  {player.totalScore} ({player.scoreToPar >= 0 ? '+' : ''}
                  {player.scoreToPar})
                </span>
              </div>
              {player.eagles > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Eagles:</span>
                  <span className="font-semibold text-purple-600">{player.eagles}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Birdies:</span>
                <span className="font-semibold text-blue-600">{player.birdies}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pars:</span>
                <span className="font-semibold">{player.pars}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bogeys:</span>
                <span className="font-semibold text-orange-600">{player.bogeys}</span>
              </div>
              {player.doubleBogeys > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Double Bogeys:</span>
                  <span className="font-semibold text-red-600">{player.doubleBogeys}</span>
                </div>
              )}
              {player.tripleBogeyPlus > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Triple+:</span>
                  <span className="font-semibold text-red-800">{player.tripleBogeyPlus}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
