/**
 * Golf scoring utilities for calculating derived statistics
 * 
 * This module provides functions to calculate:
 * - Relation to par (birdie, par, bogey, etc.) for each hole
 * - Player totals and statistics
 * - Overall derived scoring data
 */

import type {
  ExtractedScorecard,
  DerivedScoring,
  HoleDerived,
  PlayerDerived,
  RelationToPar,
  PlayerInfo,
  PlayerHoleScore,
} from './types';

/**
 * Calculates the relation to par for a score on a hole
 * 
 * @param score - The player's score
 * @param par - The par for the hole
 * @returns The relation to par (birdie, par, bogey, etc.)
 */
export function calculateRelationToPar(score: number | null, par: number): RelationToPar {
  if (score === null) {
    return null;
  }

  const diff = score - par;

  if (diff <= -2) return 'eagle';
  if (diff === -1) return 'birdie';
  if (diff === 0) return 'par';
  if (diff === 1) return 'bogey';
  if (diff === 2) return 'double-bogey';
  return 'triple-bogey+';
}

/**
 * Calculates Out (Front 9), In (Back 9), and Total for a player
 * 
 * @param player - The player info with scores
 * @returns Updated player info with calculated totals
 */
export function calculatePlayerTotals(player: PlayerInfo): PlayerInfo {
  let frontNine = 0;
  let backNine = 0;
  let frontNineCount = 0;
  let backNineCount = 0;

  player.scores.forEach((scoreEntry: PlayerHoleScore) => {
    // Only process numeric hole numbers (1-18)
    if (typeof scoreEntry.holeNumber !== 'number') {
      return;
    }
    
    if (scoreEntry.score !== null && scoreEntry.score !== undefined) {
      if (scoreEntry.holeNumber >= 1 && scoreEntry.holeNumber <= 9) {
        frontNine += scoreEntry.score;
        frontNineCount++;
      } else if (scoreEntry.holeNumber >= 10 && scoreEntry.holeNumber <= 18) {
        backNine += scoreEntry.score;
        backNineCount++;
      }
    }
  });

  return {
    ...player,
    frontNine: frontNineCount > 0 ? frontNine : undefined,
    backNine: backNineCount > 0 ? backNine : undefined,
    total: (frontNineCount > 0 || backNineCount > 0) ? frontNine + backNine : undefined,
  };
}

/**
 * Calculates derived scoring data from extracted scorecard
 * 
 * @param extracted - The extracted scorecard data
 * @returns Complete derived scoring analysis
 */
export function calculateDerivedScoring(extracted: ExtractedScorecard): DerivedScoring {
  // Calculate per-hole derived data
  const holes: HoleDerived[] = extracted.holes.map((hole) => {
    const playerResults = extracted.players.map((player) => {
      const holeScore = player.scores.find((s) => s.holeNumber === hole.holeNumber);
      const score = holeScore?.score ?? null;
      
      return {
        playerName: player.name,
        score,
        relationToPar: calculateRelationToPar(score, hole.par),
      };
    });

    return {
      holeNumber: hole.holeNumber,
      par: hole.par,
      playerResults,
    };
  });

  // Calculate per-player derived data
  const players: PlayerDerived[] = extracted.players.map((player) => {
    const stats = {
      totalScore: 0,
      totalPar: 0,
      eagles: 0,
      birdies: 0,
      pars: 0,
      bogeys: 0,
      doubleBogeys: 0,
      tripleBogeyPlus: 0,
    };

    // Iterate through all holes
    extracted.holes.forEach((hole) => {
      const holeScore = player.scores.find((s) => s.holeNumber === hole.holeNumber);
      const score = holeScore?.score;

      if (score !== null && score !== undefined) {
        stats.totalScore += score;
        stats.totalPar += hole.par;

        const relation = calculateRelationToPar(score, hole.par);
        
        switch (relation) {
          case 'eagle':
            stats.eagles++;
            break;
          case 'birdie':
            stats.birdies++;
            break;
          case 'par':
            stats.pars++;
            break;
          case 'bogey':
            stats.bogeys++;
            break;
          case 'double-bogey':
            stats.doubleBogeys++;
            break;
          case 'triple-bogey+':
            stats.tripleBogeyPlus++;
            break;
        }
      }
    });

    return {
      name: player.name,
      totalScore: stats.totalScore,
      totalPar: stats.totalPar,
      scoreToPar: stats.totalScore - stats.totalPar,
      eagles: stats.eagles,
      birdies: stats.birdies,
      pars: stats.pars,
      bogeys: stats.bogeys,
      doubleBogeys: stats.doubleBogeys,
      tripleBogeyPlus: stats.tripleBogeyPlus,
    };
  });

  return {
    holes,
    players,
  };
}

/**
 * Formats score to par as a string (e.g., "+3", "E", "-2")
 * 
 * @param scoreToPar - The score relative to par
 * @returns Formatted string
 */
export function formatScoreToPar(scoreToPar: number): string {
  if (scoreToPar === 0) return 'E';
  if (scoreToPar > 0) return `+${scoreToPar}`;
  return `${scoreToPar}`;
}

/**
 * Gets a color class for styling based on relation to par
 * 
 * @param relation - The relation to par
 * @returns Tailwind CSS color class
 */
export function getRelationToParColor(relation: RelationToPar): string {
  switch (relation) {
    case 'eagle':
      return 'text-purple-600 font-bold';
    case 'birdie':
      return 'text-blue-600 font-semibold';
    case 'par':
      return 'text-gray-700';
    case 'bogey':
      return 'text-orange-600';
    case 'double-bogey':
      return 'text-red-600';
    case 'triple-bogey+':
      return 'text-red-800 font-bold';
    default:
      return 'text-gray-400';
  }
}
