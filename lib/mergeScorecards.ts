/**
 * Utility functions for merging scorecards
 */

import type { ExtractedScorecard } from './types';

export interface MergeValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates that two scorecards are compatible for merging
 * (same number of holes and matching par values)
 */
export function validateScorecardCompatibility(
  existingScorecard: ExtractedScorecard,
  newScorecard: ExtractedScorecard
): MergeValidationResult {
  // Check if hole counts match
  if (existingScorecard.holes.length !== newScorecard.holes.length) {
    return {
      isValid: false,
      error: `Hole count mismatch: Existing scorecard has ${existingScorecard.holes.length} holes, but new scorecard has ${newScorecard.holes.length} holes.`,
    };
  }

  // Check if par values match for each hole
  for (let i = 0; i < existingScorecard.holes.length; i++) {
    const existingHole = existingScorecard.holes[i];
    const newHole = newScorecard.holes.find(h => h.holeNumber === existingHole.holeNumber);

    if (!newHole) {
      return {
        isValid: false,
        error: `Hole ${existingHole.holeNumber} not found in new scorecard.`,
      };
    }

    if (existingHole.par !== newHole.par) {
      return {
        isValid: false,
        error: `Par mismatch on hole ${existingHole.holeNumber}: Existing par is ${existingHole.par}, but new scorecard has par ${newHole.par}.`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Merges players from a new scorecard into an existing scorecard
 * Only adds players that don't already exist (case-insensitive name comparison)
 */
export function mergePlayers(
  existingScorecard: ExtractedScorecard,
  newScorecard: ExtractedScorecard
): ExtractedScorecard {
  // Validate compatibility first
  const validation = validateScorecardCompatibility(existingScorecard, newScorecard);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  // Create a set of existing player names (normalized to lowercase for comparison)
  const existingPlayerNames = new Set(
    existingScorecard.players.map(p => p.name.toLowerCase())
  );

  // Filter new players that don't already exist
  const newPlayers = newScorecard.players.filter(
    player => !existingPlayerNames.has(player.name.toLowerCase())
  );

  // If no new players, return existing scorecard unchanged
  if (newPlayers.length === 0) {
    return existingScorecard;
  }

  // Merge players
  return {
    ...existingScorecard,
    players: [...existingScorecard.players, ...newPlayers],
  };
}

/**
 * Gets a summary of what will be added when merging
 */
export function getMergeSummary(
  existingScorecard: ExtractedScorecard,
  newScorecard: ExtractedScorecard
): {
  newPlayers: string[];
  duplicatePlayers: string[];
  totalPlayersAfterMerge: number;
} {
  const existingPlayerNames = new Set(
    existingScorecard.players.map(p => p.name.toLowerCase())
  );

  const newPlayers: string[] = [];
  const duplicatePlayers: string[] = [];

  newScorecard.players.forEach(player => {
    if (existingPlayerNames.has(player.name.toLowerCase())) {
      duplicatePlayers.push(player.name);
    } else {
      newPlayers.push(player.name);
    }
  });

  return {
    newPlayers,
    duplicatePlayers,
    totalPlayersAfterMerge: existingScorecard.players.length + newPlayers.length,
  };
}
