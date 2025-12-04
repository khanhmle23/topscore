/**
 * Score notation utilities for handling different golf scoring styles
 * 
 * Supports two notation styles:
 * 1. Gross strokes (e.g., "4", "5", "6") - absolute number of strokes
 * 2. Relative to par (e.g., "+1", "-1", "E", "0") - score relative to par
 */

export type ScoreNotation = 'gross' | 'relative';

/**
 * Detects if a score string represents relative-to-par notation
 * 
 * @param scoreStr - The score string to check
 * @returns True if the string is relative-to-par notation
 * 
 * @example
 * isRelativeToParNotation("+1") // true
 * isRelativeToParNotation("-2") // true
 * isRelativeToParNotation("E") // true
 * isRelativeToParNotation("5") // false
 */
export function isRelativeToParNotation(scoreStr: string): boolean {
  if (!scoreStr || typeof scoreStr !== 'string') {
    return false;
  }

  const trimmed = scoreStr.trim();
  
  // Check for explicit relative notation: +1, -1, +2, -2, etc.
  if (/^[+-]\d+$/.test(trimmed)) {
    return true;
  }
  
  // Check for "E" or "e" (even par)
  if (/^e$/i.test(trimmed)) {
    return true;
  }
  
  // Check for "0" which could mean even par (ambiguous, but common convention)
  // Only treat as relative if it's standalone "0" (not "10", "20", etc.)
  if (trimmed === '0') {
    return true;
  }
  
  return false;
}

/**
 * Parses a score string and converts to gross strokes
 * 
 * @param scoreStr - The score string (could be "5", "+1", "-1", "E", etc.)
 * @param par - The par value for the hole
 * @returns The gross stroke count, or null if invalid
 * 
 * @example
 * parseScoreToGross("5", 4) // 5 (already gross)
 * parseScoreToGross("+1", 4) // 5 (1 over par 4)
 * parseScoreToGross("-1", 4) // 3 (1 under par 4)
 * parseScoreToGross("E", 4) // 4 (even par)
 * parseScoreToGross("0", 4) // 4 (treat 0 as even par)
 */
export function parseScoreToGross(scoreStr: string | number | null, par: number): number | null {
  if (scoreStr === null || scoreStr === undefined) {
    return null;
  }

  const str = String(scoreStr).trim();
  
  if (!str || str === '-' || str === '') {
    return null;
  }

  // Check if it's relative-to-par notation
  if (isRelativeToParNotation(str)) {
    const gross = convertRelativeToGross(str, par);
    console.log(`[Score Notation] Converted "${str}" (par ${par}) → ${gross} gross strokes`);
    return gross;
  }

  // Otherwise, parse as gross strokes
  const gross = parseInt(str, 10);
  
  if (isNaN(gross) || gross < 1 || gross > 20) {
    return null; // Invalid score
  }

  return gross;
}

/**
 * Converts relative-to-par notation to gross strokes
 * 
 * @param relativeStr - The relative score string ("+1", "-2", "E", "0")
 * @param par - The par value for the hole
 * @returns The gross stroke count
 * 
 * @example
 * convertRelativeToGross("+1", 4) // 5
 * convertRelativeToGross("-1", 4) // 3
 * convertRelativeToGross("E", 4) // 4
 */
function convertRelativeToGross(relativeStr: string, par: number): number {
  const trimmed = relativeStr.trim();
  
  // Handle "E" or "e" (even par)
  if (/^e$/i.test(trimmed)) {
    return par;
  }
  
  // Handle "0" (even par)
  if (trimmed === '0') {
    return par;
  }
  
  // Handle "+1", "-2", etc.
  const match = trimmed.match(/^([+-])(\d+)$/);
  if (match) {
    const sign = match[1];
    const value = parseInt(match[2], 10);
    return sign === '+' ? par + value : par - value;
  }
  
  return par; // Fallback to par
}

/**
 * Detects the predominant notation style used by a player
 * 
 * @param scores - Array of score strings for a player
 * @param pars - Optional array of par values to help detect notation style
 * @returns The detected notation style ('gross' or 'relative')
 * 
 * @example
 * detectNotationStyle(["4", "5", "6"]) // 'gross'
 * detectNotationStyle(["+1", "-1", "E"]) // 'relative'
 * detectNotationStyle(["1", "1", "-1", "0", "1"], [5,4,4,3,4]) // 'relative' (context-aware)
 */
export function detectNotationStyle(scores: (string | number | null)[], pars?: number[]): ScoreNotation {
  let hasExplicitRelative = false;
  let allSmallNumbers = true;
  let validScoreCount = 0;
  let scoreNumbers: number[] = [];
  
  for (let i = 0; i < scores.length; i++) {
    const score = scores[i];
    
    if (score === null || score === undefined) {
      continue;
    }
    
    const str = String(score).trim();
    
    if (!str || str === '-') {
      continue;
    }
    
    // Check for explicit relative notation (+1, -1, E)
    if (/^[+-]\d+$/.test(str) || /^e$/i.test(str)) {
      hasExplicitRelative = true;
    }
    
    const num = parseInt(str, 10);
    if (!isNaN(num)) {
      validScoreCount++;
      scoreNumbers.push(num);
      
      // If we see numbers >= 4 (typical golf scores), likely gross notation
      if (num >= 4) {
        allSmallNumbers = false;
      }
    }
  }
  
  // If we see ANY explicit relative notation (like -1 or +1), treat the entire row as relative
  if (hasExplicitRelative) {
    console.log('[Score Notation] Detected relative-to-par notation (found explicit +/- signs)');
    return 'relative';
  }
  
  // More conservative check: Only detect relative if ALL scores are 0-3 AND they're too good to be true
  // Real gross scores of 3s and 4s are rare but possible, so we need additional evidence
  if (allSmallNumbers && validScoreCount >= 5) {
    // Check if scores are suspiciously uniform (like all 1s, all 0s)
    const uniqueScores = new Set(scoreNumbers);
    const avgScore = scoreNumbers.reduce((a, b) => a + b, 0) / scoreNumbers.length;
    
    // If average score is very low (< 2.5) with good sample size, likely relative notation
    // because getting mostly aces, eagles, and birdies is statistically impossible
    if (avgScore < 2.5 && validScoreCount >= 6) {
      console.log('[Score Notation] Detected relative-to-par notation (all small numbers 0-3, avg < 2.5)');
      return 'relative';
    }
  }
  
  // Default to gross strokes (safer assumption)
  console.log('[Score Notation] Detected gross strokes notation');
  return 'gross';
}

/**
 * Formats a gross score for display based on desired notation
 * 
 * @param gross - The gross stroke count
 * @param par - The par value for the hole
 * @param notation - Desired display notation ('gross' or 'relative')
 * @returns Formatted score string
 * 
 * @example
 * formatScore(5, 4, 'gross') // "5"
 * formatScore(5, 4, 'relative') // "+1"
 * formatScore(4, 4, 'relative') // "E"
 */
export function formatScore(gross: number | null, par: number, notation: ScoreNotation = 'gross'): string {
  if (gross === null) {
    return '-';
  }
  
  if (notation === 'gross') {
    return String(gross);
  }
  
  // Format as relative
  const diff = gross - par;
  
  if (diff === 0) {
    return 'E';
  }
  
  if (diff > 0) {
    return `+${diff}`;
  }
  
  return String(diff); // Already has negative sign
}
