/**
 * Adaptive OCR Strategy for Golf Scorecards
 * 
 * Production-ready approach that handles diverse scorecard formats:
 * - Multiple OCR strategies with automatic fallback
 * - Layout detection and normalization
 * - Confidence-based result selection
 * - Validation against golf-specific rules
 */

import { analyzeWithTextract } from './textractOcr';
import OpenAI from 'openai';
import { getOpenAIApiKey } from './secrets';
import { cleanupExtractedData } from './cleanupOcr';
import type { ExtractedScorecard, PlayerInfo, PlayerHoleScore } from './types';

interface LayoutAnalysis {
  type: 'standard-18' | 'standard-9' | 'split-9-9' | 'compact' | 'player-per-page' | 'unknown';
  holeCount: number;
  hasOutInTotal: boolean;
  hasPlayerInitials: boolean;
  rowOriented: boolean; // true if players are rows, false if players are columns
  confidence: number;
}

interface OcrResult {
  scorecard: ExtractedScorecard;
  strategy: string;
  confidence: number;
  validationScore: number;
}

/**
 * Main entry point - tries multiple strategies and returns best result
 */
export async function analyzeWithAdaptiveOcr(imageBuffer: Buffer): Promise<ExtractedScorecard> {
  console.log('[Adaptive OCR] Starting multi-strategy analysis...');
  
  // Step 1: Analyze layout to understand scorecard structure
  const layout = await detectLayout(imageBuffer);
  console.log('[Adaptive OCR] Layout detected:', layout);

  // Step 2: Try multiple extraction strategies in parallel
  const strategies = await Promise.allSettled([
    tryVisionFirst(imageBuffer, layout),
    tryTextractFirst(imageBuffer, layout),
    tryHybridApproach(imageBuffer, layout),
  ]);

  // Step 3: Collect successful results
  const results: OcrResult[] = strategies
    .filter((result): result is PromiseFulfilledResult<OcrResult> => result.status === 'fulfilled')
    .map(result => result.value)
    .filter(result => result.scorecard.players.length > 0 && result.scorecard.holes.length > 0);

  if (results.length === 0) {
    console.error('[Adaptive OCR] All strategies failed');
    throw new Error('Unable to extract scorecard data - all strategies failed. Please ensure image is clear and properly oriented.');
  }

  console.log('[Adaptive OCR] Successful strategies:', results.map(r => 
    `${r.strategy} (confidence: ${r.confidence.toFixed(2)}, validation: ${r.validationScore.toFixed(2)})`
  ));

  // Step 4: Choose best result based on validation score, then confidence
  const bestResult = results.reduce((best, current) => {
    // If validation scores are equal, prefer higher confidence
    if (Math.abs(current.validationScore - best.validationScore) < 1) {
      return current.confidence > best.confidence ? current : best;
    }
    // Otherwise prefer higher validation score
    return current.validationScore > best.validationScore ? current : best;
  });

  console.log(`[Adaptive OCR] Selected best result: ${bestResult.strategy} (validation: ${bestResult.validationScore.toFixed(1)}, confidence: ${bestResult.confidence.toFixed(2)})`);
  
  return bestResult.scorecard;
}

/**
 * Detect scorecard layout type and characteristics
 */
async function detectLayout(imageBuffer: Buffer): Promise<LayoutAnalysis> {
  const apiKey = await getOpenAIApiKey();
  const openai = new OpenAI({ apiKey });
  const base64Image = imageBuffer.toString('base64');
  const mimeType = detectMimeType(imageBuffer);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this golf scorecard layout and provide structural information.

Answer these questions:
1. How many holes are on this scorecard? (9 or 18)
2. Are the 9 holes in one table or split into two sections (Front 9 / Back 9)?
3. Are there "OUT", "IN", or "TOTAL" columns?
4. Are there player initial columns between holes (typically between 9 and 10)?
5. Are players shown as rows (horizontal) or columns (vertical)?
6. Is this a standard full-page scorecard or a compact format?

Return ONLY valid JSON:
{
  "holeCount": 9 or 18,
  "layoutType": "standard-18" | "standard-9" | "split-9-9" | "compact" | "player-per-page",
  "hasOutInTotal": true/false,
  "hasPlayerInitials": true/false,
  "rowOriented": true/false,
  "notes": "any special observations"
}`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: 'low',
            },
          },
        ],
      },
    ],
    max_tokens: 300,
    temperature: 0,
  });

  try {
    const content = response.choices[0]?.message?.content?.trim() || '{}';
    let jsonString = content;
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonString);
    
    return {
      type: parsed.layoutType || 'unknown',
      holeCount: parsed.holeCount || 9,
      hasOutInTotal: parsed.hasOutInTotal || false,
      hasPlayerInitials: parsed.hasPlayerInitials || false,
      rowOriented: parsed.rowOriented !== false, // default to true
      confidence: 0.8,
    };
  } catch (error) {
    console.warn('[Adaptive OCR] Layout detection failed, using defaults');
    return {
      type: 'unknown',
      holeCount: 9,
      hasOutInTotal: false,
      hasPlayerInitials: false,
      rowOriented: true,
      confidence: 0.3,
    };
  }
}

/**
 * Strategy 1: Vision-first approach
 * Best for: Handwritten scorecards, non-standard layouts
 */
async function tryVisionFirst(imageBuffer: Buffer, layout: LayoutAnalysis): Promise<OcrResult> {
  console.log('[Adaptive OCR] Trying Vision-first strategy...');
  
  const apiKey = await getOpenAIApiKey();
  const openai = new OpenAI({ apiKey });
  const base64Image = imageBuffer.toString('base64');
  const mimeType = detectMimeType(imageBuffer);

  const layoutGuidance = buildLayoutGuidance(layout);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are an expert at reading golf scorecards with high accuracy.

${layoutGuidance}

EXTRACTION RULES:
1. Read EVERY hole number to confirm sequence (must be 1,2,3... up to ${layout.holeCount})
2. Match each player name to their correct row
3. For each player, read their scores LEFT TO RIGHT across all holes
4. If a cell is empty or illegible, use null
5. DOUBLE-CHECK handwritten numbers (common errors: 1↔7, 4↔9, 5↔6, 3↔8)
6. Validate each score against par (scores typically within ±3 of par)

CRITICAL: DO NOT extract:
- "OUT", "IN", "TOTAL" columns (these are summary columns, not holes)
- Player initial columns (usually 2-3 letters between holes)
- "PAR", "HANDICAP", "Pace of Play" rows (these are not players)

Return ONLY valid JSON:
{
  "courseName": "Course Name or null",
  "holes": [{"holeNumber": 1, "par": 4}],
  "players": [{"name": "Player Name", "scores": [{"holeNumber": 1, "score": 4}]}]
}`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
    max_tokens: 4096,
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No Vision response');
  }

  let jsonString = content.trim();
  if (jsonString.startsWith('```')) {
    jsonString = jsonString.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const extracted: ExtractedScorecard = JSON.parse(jsonString);
  const cleaned = cleanupExtractedData(extracted);
  const validation = validateScorecard(cleaned, layout);

  return {
    scorecard: cleaned,
    strategy: 'vision-first',
    confidence: 0.7,
    validationScore: validation,
  };
}

/**
 * Strategy 2: Textract-first approach
 * Best for: Clean printed scorecards with standard layouts
 */
async function tryTextractFirst(imageBuffer: Buffer, layout: LayoutAnalysis): Promise<OcrResult> {
  console.log('[Adaptive OCR] Trying Textract-first strategy...');
  
  const extracted = await analyzeWithTextract(imageBuffer);
  const cleaned = cleanupExtractedData(extracted);
  const validation = validateScorecard(cleaned, layout);

  return {
    scorecard: cleaned,
    strategy: 'textract-first',
    confidence: 0.8,
    validationScore: validation,
  };
}

/**
 * Strategy 3: Hybrid approach
 * Best for: Mixed printed/handwritten, when both have partial success
 */
async function tryHybridApproach(imageBuffer: Buffer, layout: LayoutAnalysis): Promise<OcrResult> {
  console.log('[Adaptive OCR] Trying Hybrid strategy...');
  
  // Get Textract for structure
  let structure: ExtractedScorecard;
  try {
    structure = await analyzeWithTextract(imageBuffer);
  } catch (error) {
    throw new Error('Textract failed, cannot use hybrid approach');
  }

  // Use Vision to fill gaps and verify
  const apiKey = await getOpenAIApiKey();
  const openai = new OpenAI({ apiKey });
  const base64Image = imageBuffer.toString('base64');
  const mimeType = detectMimeType(imageBuffer);

  const playerInfo = structure.players.map((p, i) => 
    `Player ${i + 1}: ${p.name}`
  ).join(', ');

  const holeInfo = structure.holes.map(h => 
    `Hole ${h.holeNumber} (Par ${h.par})`
  ).join(', ');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Read handwritten scores from this ${layout.holeCount}-hole scorecard.

STRUCTURE (already detected):
- Holes: ${holeInfo}
- Players: ${playerInfo}

YOUR TASK: For each player, read their score for EACH hole.
- Focus on HANDWRITTEN numbers only
- Use par values as validation (scores usually within ±3 of par)
- If cell is empty or illegible, use null
- Double-check ambiguous digits (1↔7, 4↔9, 5↔6, 3↔8)

Return ONLY valid JSON with scores for all players:
{
  "players": [
    {"name": "Player 1 name", "scores": [{"holeNumber": 1, "score": 4 or null}]}
  ]
}`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
    max_tokens: 4096,
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No Vision response in hybrid mode');
  }

  let jsonString = content.trim();
  if (jsonString.startsWith('```')) {
    jsonString = jsonString.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  const visionData = JSON.parse(jsonString);

  // Merge Vision scores with Textract structure
  const merged: ExtractedScorecard = {
    ...structure,
    players: structure.players.map(structPlayer => {
      const visionPlayer = visionData.players?.find((vp: any) => 
        normalizePlayerName(vp.name) === normalizePlayerName(structPlayer.name)
      );

      if (!visionPlayer) {
        return structPlayer;
      }

      // Merge scores: prefer Vision for handwritten, keep Textract for printed
      const mergedScores = structPlayer.scores.map(scoreEntry => {
        const visionScore = visionPlayer.scores?.find((vs: any) => 
          vs.holeNumber === scoreEntry.holeNumber
        );

        // If Textract has a score, calculate confidence
        if (scoreEntry.score !== null) {
          const hole = structure.holes.find(h => h.holeNumber === scoreEntry.holeNumber);
          const par = hole?.par || 4;
          const diff = Math.abs(scoreEntry.score - par);
          
          // If Textract score seems reasonable, keep it
          if (diff <= 5) {
            return {
              ...scoreEntry,
              confidence: diff <= 3 ? 'high' : 'medium',
              source: 'textract' as const,
            };
          }
        }

        // Otherwise use Vision
        if (visionScore?.score !== null && visionScore?.score !== undefined) {
          const hole = structure.holes.find(h => h.holeNumber === scoreEntry.holeNumber);
          const par = hole?.par || 4;
          const diff = Math.abs(visionScore.score - par);
          
          return {
            ...scoreEntry,
            score: visionScore.score,
            confidence: diff <= 3 ? 'high' : diff <= 5 ? 'medium' : 'low',
            source: 'vision' as const,
          };
        }

        return scoreEntry;
      });

      return { ...structPlayer, scores: mergedScores };
    }),
  };

  const cleaned = cleanupExtractedData(merged);
  const validation = validateScorecard(cleaned, layout);

  return {
    scorecard: cleaned,
    strategy: 'hybrid',
    confidence: 0.85,
    validationScore: validation,
  };
}

/**
 * Build layout-specific guidance for Vision prompts
 */
function buildLayoutGuidance(layout: LayoutAnalysis): string {
  let guidance = `SCORECARD LAYOUT:
- This is a ${layout.holeCount}-hole scorecard
- Players are arranged as ${layout.rowOriented ? 'ROWS' : 'COLUMNS'}`;

  if (layout.hasOutInTotal) {
    guidance += `\n- Has OUT/IN/TOTAL summary columns (DO NOT extract these as holes)`;
  }

  if (layout.hasPlayerInitials) {
    guidance += `\n- Has player initial columns between holes (DO NOT extract these)`;
  }

  if (layout.type === 'split-9-9') {
    guidance += `\n- Split into Front 9 and Back 9 sections`;
  }

  return guidance;
}

/**
 * Validate scorecard against golf-specific rules
 * Returns a score from 0-100 indicating data quality
 */
function validateScorecard(scorecard: ExtractedScorecard, layout: LayoutAnalysis): number {
  let score = 100;
  const penalties: string[] = [];

  // 1. Hole count validation
  if (scorecard.holes.length !== layout.holeCount) {
    const diff = Math.abs(scorecard.holes.length - layout.holeCount);
    score -= diff * 10;
    penalties.push(`Hole count mismatch: expected ${layout.holeCount}, got ${scorecard.holes.length}`);
  }

  // 2. Hole sequence validation
  const holeNumbers = scorecard.holes.map(h => h.holeNumber).sort((a, b) => a - b);
  for (let i = 0; i < holeNumbers.length; i++) {
    if (holeNumbers[i] !== i + 1) {
      score -= 5;
      penalties.push(`Hole sequence broken at position ${i + 1}`);
      break;
    }
  }

  // 3. Par validation (pars should be 3, 4, or 5)
  const invalidPars = scorecard.holes.filter(h => h.par < 3 || h.par > 5);
  score -= invalidPars.length * 5;
  if (invalidPars.length > 0) {
    penalties.push(`${invalidPars.length} holes have invalid par values`);
  }

  // 4. Player validation
  if (scorecard.players.length === 0) {
    score -= 50;
    penalties.push('No players extracted');
  }

  // 5. Score reasonableness (most scores should be within ±5 of par)
  let unreasonableScores = 0;
  scorecard.players.forEach(player => {
    player.scores.forEach(scoreEntry => {
      if (scoreEntry.score !== null) {
        const hole = scorecard.holes.find(h => h.holeNumber === scoreEntry.holeNumber);
        if (hole) {
          const diff = Math.abs(scoreEntry.score - hole.par);
          if (diff > 7) {
            unreasonableScores++;
          }
        }
      }
    });
  });
  score -= Math.min(unreasonableScores * 2, 30);
  if (unreasonableScores > 0) {
    penalties.push(`${unreasonableScores} scores seem unreasonable (>7 from par)`);
  }

  // 6. Completeness (players should have scores for most holes)
  scorecard.players.forEach(player => {
    const validScores = player.scores.filter(s => s.score !== null).length;
    const completeness = validScores / scorecard.holes.length;
    if (completeness < 0.3) {
      score -= 20;
      penalties.push(`Player ${player.name} has very few scores (${validScores}/${scorecard.holes.length})`);
    } else if (completeness < 0.6) {
      score -= 10;
      penalties.push(`Player ${player.name} has incomplete scores (${validScores}/${scorecard.holes.length})`);
    }
  });

  // 7. Score distribution (should follow typical golf patterns)
  const allScores = scorecard.players.flatMap(p => 
    p.scores.filter(s => s.score !== null).map(s => s.score!)
  );
  
  if (allScores.length > 0) {
    const avg = allScores.reduce((sum, s) => sum + s, 0) / allScores.length;
    const avgPar = scorecard.holes.reduce((sum, h) => sum + h.par, 0) / scorecard.holes.length;
    
    // Average score should be reasonably close to average par (within 2 strokes)
    if (Math.abs(avg - avgPar) > 3) {
      score -= 10;
      penalties.push(`Average score (${avg.toFixed(1)}) far from average par (${avgPar.toFixed(1)})`);
    }
  }

  console.log(`[Adaptive OCR] Validation score: ${Math.max(0, score).toFixed(1)}/100`);
  if (penalties.length > 0) {
    console.log('[Adaptive OCR] Validation penalties:', penalties);
  }

  return Math.max(0, score);
}

/**
 * Normalize player names for matching
 */
function normalizePlayerName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/**
 * Detect MIME type from buffer
 */
function detectMimeType(buffer: Buffer): string {
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return 'image/webp';
  }
  
  return 'image/jpeg';
}
