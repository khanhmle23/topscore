/**
 * Post-processing utilities to clean up OCR extraction results
 */

import type { ExtractedScorecard } from './types';

/**
 * Cleans up extracted scorecard data by removing invalid holes and scores
 */
export function cleanupExtractedData(scorecard: ExtractedScorecard): ExtractedScorecard {
  console.log('[Cleanup] Starting post-processing...');
  console.log('[Cleanup] Initial holes:', scorecard.holes.map(h => h.holeNumber));
  
  // Filter out invalid holes (Out, In, Total, etc.)
  const validHoles = scorecard.holes.filter(hole => {
    // Hole numbers should be 1-18
    if (hole.holeNumber < 1 || hole.holeNumber > 18) {
      console.log(`[Cleanup] Removing invalid hole number: ${hole.holeNumber}`);
      return false;
    }
    
    // Par should only be 3, 4, or 5
    if (hole.par < 3 || hole.par > 5) {
      console.log(`[Cleanup] Removing hole ${hole.holeNumber} with invalid par: ${hole.par}`);
      return false;
    }
    
    return true;
  });

  // Sort holes by hole number to ensure correct order
  validHoles.sort((a, b) => a.holeNumber - b.holeNumber);

  // Remove duplicate holes (keep first occurrence)
  const uniqueHoles = validHoles.filter((hole, index, array) => 
    array.findIndex(h => h.holeNumber === hole.holeNumber) === index
  );

  if (uniqueHoles.length !== validHoles.length) {
    console.log(`[Cleanup] Removed ${validHoles.length - uniqueHoles.length} duplicate holes`);
  }

  // CRITICAL: Limit to exactly 9 or 18 holes
  // If we have more than 18 holes, take only the first 18
  // If we have between 10-17 holes, take only the first 9
  let finalHoles = uniqueHoles;
  if (uniqueHoles.length > 18) {
    console.log(`[Cleanup] Too many holes (${uniqueHoles.length}), limiting to 18`);
    finalHoles = uniqueHoles.slice(0, 18);
  } else if (uniqueHoles.length > 9 && uniqueHoles.length < 18) {
    console.log(`[Cleanup] Irregular hole count (${uniqueHoles.length}), limiting to 9`);
    finalHoles = uniqueHoles.slice(0, 9);
  }

  console.log('[Cleanup] Final holes:', finalHoles.map(h => h.holeNumber));

  // Get valid hole numbers for score filtering
  const validHoleNumbers = finalHoles.map(h => h.holeNumber);

  // Clean up player scores - only keep scores for valid holes
  const cleanedPlayers = scorecard.players.map(player => {
    const validScores = player.scores.filter(scoreEntry => {
      // Filter out OUT/IN/TOTAL entries that Vision might have extracted
      if (typeof scoreEntry.holeNumber === 'string') {
        const holeStr = scoreEntry.holeNumber.toLowerCase();
        if (holeStr === 'out' || holeStr === 'in' || holeStr === 'total') {
          console.log(`[Cleanup] Removing ${player.name}'s ${scoreEntry.holeNumber} column (will be auto-calculated)`);
          return false;
        }
      }
      
      // Must be for a valid hole
      if (!validHoleNumbers.includes(scoreEntry.holeNumber)) {
        console.log(`[Cleanup] Removing ${player.name}'s score for invalid hole: ${scoreEntry.holeNumber}`);
        return false;
      }

      // If score is null, keep it
      if (scoreEntry.score === null) {
        return true;
      }

      // Score should be reasonable (1-15)
      if (scoreEntry.score < 1 || scoreEntry.score > 15) {
        console.log(`[Cleanup] Removing ${player.name}'s invalid score on hole ${scoreEntry.holeNumber}: ${scoreEntry.score}`);
        return false;
      }

      return true;
    });

    // Sort scores by hole number
    validScores.sort((a, b) => a.holeNumber - b.holeNumber);

    // Remove duplicate scores (keep first occurrence)
    const uniqueScores = validScores.filter((score, index, array) =>
      array.findIndex(s => s.holeNumber === score.holeNumber) === index
    );

    return {
      ...player,
      scores: uniqueScores,
    };
  });

  // Filter out non-player rows (HANDICAP, PAR, Ladies' Hcp, etc.)
  const actualPlayers = cleanedPlayers.filter(player => {
    const name = player.name.toLowerCase();
    const isNonPlayer = name.includes('handicap') || 
                        name.includes('hcp') ||
                        name === 'par' || 
                        name.includes('pace of play') ||
                        /^(black|blue|white|red|green|gold|brown|silver)\s+\d/i.test(player.name) ||
                        /^m:\s*[\d./]+\s+(black|blue|white|red|green|gold|brown|silver)/i.test(player.name) ||
                        /^(ladies|men|mens|ladies')/i.test(player.name);
    
    if (isNonPlayer) {
      console.log(`[Cleanup] Removing non-player row: "${player.name}"`);
    }
    
    return !isNonPlayer;
  });

  const cleanedScorecard: ExtractedScorecard = {
    ...scorecard,
    holes: finalHoles,
    players: actualPlayers,
  };

  console.log(`[Cleanup] Cleaned scorecard: ${finalHoles.length} holes, ${actualPlayers.length} players`);
  
  return cleanedScorecard;
}

/**
 * Validates that hole numbers are sequential (1, 2, 3, ...)
 */
export function validateSequentialHoles(holes: { holeNumber: number }[]): boolean {
  if (holes.length === 0) return false;

  const sortedHoles = [...holes].sort((a, b) => a.holeNumber - b.holeNumber);
  
  for (let i = 0; i < sortedHoles.length; i++) {
    if (sortedHoles[i].holeNumber !== i + 1) {
      console.warn(`[Cleanup] Non-sequential holes detected. Expected ${i + 1}, got ${sortedHoles[i].holeNumber}`);
      return false;
    }
  }

  return true;
}
