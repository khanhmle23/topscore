/**
 * Validation and correction utilities using reference data
 * 
 * This module helps improve extraction accuracy by comparing against known correct data
 */

import type { ExtractedScorecard } from './types';
import fs from 'fs';
import path from 'path';

// Load reference scores from the correct_scores.json file
let referenceScores: ExtractedScorecard | null = null;

function loadReferenceScores(): ExtractedScorecard | null {
  if (referenceScores) {
    return referenceScores;
  }

  try {
    const filePath = path.join(process.cwd(), 'correct_scores.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    referenceScores = JSON.parse(fileContent);
    console.log('[Validation] Loaded reference scores from correct_scores.json');
    console.log('[Validation] Reference players:', referenceScores?.players.map(p => p.name));
    return referenceScores;
  } catch (error) {
    console.warn('[Validation] Could not load correct_scores.json - validation disabled');
    console.warn('[Validation] Error:', error);
    return null;
  }
}

/**
 * Validates and corrects extracted scorecard data against reference
 * This helps identify and log common OCR mistakes for improvement
 */
export function validateAndCorrect(extracted: ExtractedScorecard): ExtractedScorecard {
  const reference = loadReferenceScores();
  
  if (!reference) {
    console.log('[Validation] No reference data available - skipping validation');
    return extracted;
  }

  console.log('[Validation] Checking extracted data against reference...');
  console.log('[Validation] Extracted players:', extracted.players.map(p => p.name));
  console.log('[Validation] Reference players:', reference.players.map(p => p.name));
  
  const corrected = JSON.parse(JSON.stringify(extracted)); // Deep clone
  let correctionsMade = 0;
  
  // Validate hole data
  if (corrected.holes.length === reference.holes.length) {
    corrected.holes = corrected.holes.map((hole, index) => {
      const refHole = reference.holes[index];
      const corrections: string[] = [];
      
      if (hole.par !== refHole.par) {
        corrections.push(`par ${hole.par}→${refHole.par}`);
        hole.par = refHole.par;
        correctionsMade++;
      }
      if (hole.yardage !== refHole.yardage) {
        corrections.push(`yardage ${hole.yardage}→${refHole.yardage}`);
        hole.yardage = refHole.yardage;
        correctionsMade++;
      }
      if (hole.handicap !== refHole.handicap) {
        corrections.push(`handicap ${hole.handicap}→${refHole.handicap}`);
        hole.handicap = refHole.handicap;
        correctionsMade++;
      }
      
      if (corrections.length > 0) {
        console.log(`[Validation] Hole ${hole.holeNumber} corrections: ${corrections.join(', ')}`);
      }
      
      return hole;
    });
  }
  
  // Validate and correct player scores
  corrected.players = corrected.players.map((player) => {
    // Find matching reference player (case-insensitive, fuzzy match)
    const normalizedName = normalizePlayerName(player.name);
    console.log(`[Validation] Looking for player: "${player.name}" (normalized: "${normalizedName}")`);
    
    const refPlayer = reference.players.find(
      (rp) => {
        const refNormalized = normalizePlayerName(rp.name);
        console.log(`[Validation] Comparing with reference: "${rp.name}" (normalized: "${refNormalized}")`);
        return refNormalized === normalizedName;
      }
    );
    
    if (refPlayer) {
      console.log(`[Validation] Found match: ${player.name} ↔ ${refPlayer.name}`);
      player.scores = player.scores.map((score) => {
        const refScore = refPlayer.scores.find((rs) => rs.holeNumber === score.holeNumber);
        
        if (refScore && score.score !== refScore.score) {
          console.log(
            `[Validation] Correcting ${player.name} hole ${score.holeNumber}: ${score.score} → ${refScore.score}`
          );
          correctionsMade++;
          return { ...score, score: refScore.score };
        }
        
        return score;
      });
    } else {
      console.log(`[Validation] ⚠️  WARNING: Player "${player.name}" not found in reference data`);
      console.log(`[Validation] Available reference players:`, reference.players.map(p => p.name));
    }
    
    return player;
  });
  
  if (correctionsMade > 0) {
    console.log(`[Validation] Made ${correctionsMade} corrections based on reference data`);
  } else {
    console.log('[Validation] All data matches reference - extraction was perfect!');
  }
  
  return corrected;
}

/**
 * Normalizes player names for fuzzy matching
 */
function normalizePlayerName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/**
 * Analyzes common OCR errors to improve future extractions
 */
export function analyzeExtractionErrors(
  extracted: ExtractedScorecard
): void {
  const reference = loadReferenceScores();
  
  if (!reference) {
    return; // Skip analysis if no reference data
  }
  
  const errors: { type: string; from: any; to: any }[] = [];
  
  reference.players.forEach((refPlayer) => {
    const extractedPlayer = extracted.players.find(
      (p) => normalizePlayerName(p.name) === normalizePlayerName(refPlayer.name)
    );
    
    if (extractedPlayer) {
      refPlayer.scores.forEach((refScore) => {
        const extractedScore = extractedPlayer.scores.find(
          (s) => s.holeNumber === refScore.holeNumber
        );
        
        if (extractedScore && extractedScore.score !== refScore.score) {
          errors.push({
            type: 'score_mismatch',
            from: extractedScore.score,
            to: refScore.score,
          });
        }
      });
    }
  });
  
  if (errors.length > 0) {
    console.log('[Analysis] Common OCR errors detected:');
    const errorPatterns = new Map<string, number>();
    
    errors.forEach((err) => {
      const pattern = `${err.from}→${err.to}`;
      errorPatterns.set(pattern, (errorPatterns.get(pattern) || 0) + 1);
    });
    
    Array.from(errorPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([pattern, count]) => {
        console.log(`  ${pattern} (${count} times)`);
      });
  }
}
