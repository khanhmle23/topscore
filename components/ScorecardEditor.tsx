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
  onAddPlayers?: () => void;
}

function ScorecardEditor({
  initialScorecard,
  initialDerived,
  onScorecardChange,
  onAddPlayers,
}: ScorecardEditorProps) {
  const [scorecard, setScorecard] = useState<ExtractedScorecard>(initialScorecard);
  const [derived, setDerived] = useState<DerivedScoring>(initialDerived);
  const isInitialMount = useRef(true);

  // Determine if this is an 18-hole scorecard
  const is18Holes = scorecard.holes.length === 18;
  const frontNineHoles = scorecard.holes.filter(h => h.holeNumber <= 9);
  const backNineHoles = scorecard.holes.filter(h => h.holeNumber >= 10);

  // Update internal state when props change (e.g., when players are added)
  useEffect(() => {
    setScorecard(initialScorecard);
    setDerived(initialDerived);
  }, [initialScorecard, initialDerived]);

  // Recalculate derived data when scorecard changes (only from user edits)
  useEffect(() => {
    // Skip the initial mount to avoid calling onScorecardChange unnecessarily
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const newDerived = calculateDerivedScoring(scorecard);
    setDerived(newDerived);
    onScorecardChange(scorecard, newDerived);
  }, [scorecard]);  // Removed onScorecardChange from dependencies to prevent infinite loop

  const handleScoreChange = (playerName: string, holeNumber: number, newScore: string) => {
    const scoreValue = newScore === '' ? null : parseInt(newScore, 10);
    
    if (scoreValue !== null && (isNaN(scoreValue) || scoreValue < 1 || scoreValue > 20)) {
      return;
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

      return {
        ...updatedScorecard,
        players: updatedScorecard.players.map((player) => calculatePlayerTotals(player)),
      };
    });
  };

  const handleCourseNameChange = (newName: string) => {
    setScorecard((prev) => ({
      ...prev,
      courseName: newName,
    }));
  };

  const handlePlayerNameChange = (oldName: string, newName: string) => {
    if (!newName.trim()) return; // Don't allow empty names
    
    setScorecard((prev) => ({
      ...prev,
      players: prev.players.map((player) =>
        player.name === oldName ? { ...player, name: newName.trim() } : player
      ),
    }));
  };

  const exportToCSV = () => {
    // Build CSV content
    const rows: string[][] = [];
    
    // Header row with course info
    rows.push([scorecard.courseName]);
    if (scorecard.date) rows.push(['Date:', scorecard.date]);
    if (scorecard.teeName) rows.push(['Tee:', scorecard.teeName]);
    rows.push([]); // Empty row
    
    // Column headers
    const headers = ['Player', ...scorecard.holes.map(h => `Hole ${h.holeNumber}`), 'Out', 'In', 'Total', 'Score to Par'];
    rows.push(headers);
    
    // Par row
    const parRow = ['Par', ...scorecard.holes.map(h => h.par.toString()), 
      scorecard.holes.filter(h => h.holeNumber <= 9).reduce((sum, h) => sum + h.par, 0).toString(),
      scorecard.holes.filter(h => h.holeNumber >= 10).reduce((sum, h) => sum + h.par, 0).toString(),
      scorecard.holes.reduce((sum, h) => sum + h.par, 0).toString(),
      '0'
    ];
    rows.push(parRow);
    
    // Player rows
    scorecard.players.forEach(player => {
      const playerDerived = derived.players.find(p => p.name === player.name);
      const scores = scorecard.holes.map(hole => {
        const score = player.scores.find(s => s.holeNumber === hole.holeNumber);
        return score?.score?.toString() || '';
      });
      
      const row = [
        player.name,
        ...scores,
        player.frontNine?.toString() || '',
        player.backNine?.toString() || '',
        player.total?.toString() || '',
        playerDerived ? (playerDerived.scoreToPar > 0 ? `+${playerDerived.scoreToPar}` : playerDerived.scoreToPar.toString()) : ''
      ];
      rows.push(row);
    });
    
    // Convert to CSV string
    const csvContent = rows.map(row => 
      row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma
        const escaped = cell.replace(/"/g, '""');
        return escaped.includes(',') ? `"${escaped}"` : escaped;
      }).join(',')
    ).join('\n');
    
    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const fileName = `${scorecard.courseName.replace(/[^a-z0-9]/gi, '_')}_${scorecard.date || 'scorecard'}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Course Info */}
      <div className="bg-white/70 backdrop-blur-sm shadow-lg border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={scorecard.courseName}
              onChange={(e) => handleCourseNameChange(e.target.value)}
              className="text-2xl font-bold text-black mb-2 border-b-2 border-transparent hover:border-gray-400 focus:border-black focus:outline-none transition-colors w-full"
              placeholder="Course Name"
            />
            {scorecard.teeName && (
              <p className="text-sm text-gray-600">Tee: {scorecard.teeName}</p>
            )}
            {scorecard.date && (
              <p className="text-sm text-gray-600">Date: {scorecard.date}</p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={exportToCSV}
              className="flex items-center justify-center px-5 py-2.5 bg-black hover:bg-gray-800 text-white transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            {onAddPlayers && (
              <button
                onClick={onAddPlayers}
                className="flex items-center justify-center px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Players
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scorecard Table */}
      <div className="bg-white/70 backdrop-blur-sm shadow-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
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
                    <input
                      type="text"
                      value={player.name}
                      onChange={(e) => handlePlayerNameChange(player.name, e.target.value)}
                      className="w-full border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none transition-colors bg-transparent font-medium"
                      placeholder="Player Name"
                    />
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
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {derived.players.map((player) => (
          <div key={player.name} className="bg-white/70 backdrop-blur-sm shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-200">
              {player.name}
            </h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center p-2 bg-gray-50">
                <span className="text-gray-700 font-medium">Score:</span>
                <span className="font-bold text-gray-900">
                  {player.totalScore} ({player.scoreToPar >= 0 ? '+' : ''}
                  {player.scoreToPar})
                </span>
              </div>
              {player.eagles > 0 && (
                <div className="flex justify-between items-center p-2 hover:bg-gray-100 transition-colors">
                  <span className="text-gray-600">Eagles:</span>
                  <span className="font-semibold text-purple-600">{player.eagles}</span>
                </div>
              )}
              <div className="flex justify-between items-center p-2 hover:bg-gray-100 transition-colors">
                <span className="text-gray-600">Birdies:</span>
                <span className="font-semibold text-blue-600">{player.birdies}</span>
              </div>
              <div className="flex justify-between items-center p-2 hover:bg-gray-100 transition-colors">
                <span className="text-gray-600">Pars:</span>
                <span className="font-semibold text-gray-700">{player.pars}</span>
              </div>
              <div className="flex justify-between items-center p-2 hover:bg-gray-100 transition-colors">
                <span className="text-gray-600">Bogeys:</span>
                <span className="font-semibold text-orange-600">{player.bogeys}</span>
              </div>
              {player.doubleBogeys > 0 && (
                <div className="flex justify-between items-center p-2 hover:bg-gray-100 transition-colors">
                  <span className="text-gray-600">Double Bogeys:</span>
                  <span className="font-semibold text-red-600">{player.doubleBogeys}</span>
                </div>
              )}
              {player.tripleBogeyPlus > 0 && (
                <div className="flex justify-between items-center p-2 hover:bg-gray-100 transition-colors">
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

export default ScorecardEditor;
