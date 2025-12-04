/**
 * Hybrid OCR approach combining Textract's structure detection 
 * with OpenAI Vision's handwriting recognition
 * 
 * Strategy:
 * 1. Use Textract to identify table structure (rows, columns, cells)
 * 2. Use OpenAI Vision with targeted prompts for handwritten score extraction
 * 3. Merge the results for best accuracy
 */

import { analyzeWithTextract } from './textractOcr';
import OpenAI from 'openai';
import { getOpenAIApiKey } from './secrets';
import { 
  generateTemplateGuidedPrompt, 
  validateAgainstTemplate,
  getVisualTemplate 
} from './scorecardTemplate';
import { cleanupExtractedData } from './cleanupOcr';
import type { ExtractedScorecard } from './types';

/**
 * Enhanced scorecard analysis using hybrid OCR approach
 */
export async function analyzeWithHybridOcr(imageBuffer: Buffer): Promise<ExtractedScorecard> {
  console.log('[Hybrid OCR] Starting hybrid analysis...');

  // Step 1: Get structure from Textract (it's good at finding tables)
  let structure: ExtractedScorecard;
  try {
    structure = await analyzeWithTextract(imageBuffer);
    console.log('[Hybrid OCR] Textract structure extraction successful');
    console.log('[Hybrid OCR] Detected hole count:', structure.holes.length);
  } catch (error) {
    console.warn('[Hybrid OCR] Textract failed, detecting hole count with Vision...');
    // Detect hole count first, then do full analysis
    const holeCount = await detectHoleCount(imageBuffer);
    console.log('[Hybrid OCR] Detected', holeCount, 'holes, using full Vision analysis');
    return await fullVisionAnalysis(imageBuffer, holeCount);
  }

  // Step 2: Use OpenAI Vision ONLY to fill in gaps where Textract couldn't read
  console.log('[Hybrid OCR] Using Vision to fill gaps in Textract extraction...');
  const enhanced = await enhanceWithVision(imageBuffer, structure);

  // Step 2.5: Clean up any invalid data (Out/In/Total columns, etc.)
  console.log('[Hybrid OCR] Cleaning up extracted data...');
  const cleaned = cleanupExtractedData(enhanced);

  // Step 3: Validate against template knowledge
  console.log('[Hybrid OCR] Validating against template...');
  const validation = validateAgainstTemplate(cleaned.holes, cleaned.players);
  
  if (validation.warnings.length > 0) {
    console.warn('[Hybrid OCR] Template validation warnings:');
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  } else {
    console.log('[Hybrid OCR] All data validated successfully against template');
  }

  console.log('[Hybrid OCR] Hybrid analysis complete');
  return cleaned;
}

/**
 * Detect whether scorecard is 9-hole or 18-hole
 */
async function detectHoleCount(imageBuffer: Buffer): Promise<number> {
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
            text: `Look at this golf scorecard and determine if it's a 9-hole or 18-hole scorecard.

Look for:
- Hole numbers row (1-9 or 1-18)
- Usually at the top of the scorecard table
- May be split into "Front 9" and "Back 9" for 18-hole courses

Respond with ONLY a number: 9 or 18`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: 'low', // Low detail is fine for counting holes
            },
          },
        ],
      },
    ],
    max_tokens: 10,
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content?.trim();
  const holeCount = parseInt(content || '9');
  
  // Validate and default to 9 if invalid
  return [9, 18].includes(holeCount) ? holeCount : 9;
}

/**
 * Full OpenAI Vision analysis as fallback
 */
async function fullVisionAnalysis(imageBuffer: Buffer, holeCount: number = 9): Promise<ExtractedScorecard> {
  const apiKey = await getOpenAIApiKey();
  const openai = new OpenAI({ apiKey });
  const base64Image = imageBuffer.toString('base64');
  const mimeType = detectMimeType(imageBuffer);

  // Generate template-guided prompt based on detected hole count
  const templatePrompt = generateTemplateGuidedPrompt(holeCount);
  const visualTemplate = getVisualTemplate(holeCount);

  console.log(`[Hybrid OCR] Using ${holeCount}-hole template for full Vision analysis`);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${templatePrompt}

${visualTemplate}

Extract and return as JSON (no markdown, no explanations):
{
  "courseName": "Course Name or null",
  "teeName": "Tee Color or null",
  "date": "Date or null",
  "holes": [{"holeNumber": 1, "par": 4, "yardage": 380, "handicap": 5}],
  "players": [
    {
      "name": "Player Name",
      "scores": [{"holeNumber": 1, "score": 4}]
    }
  ]
}

CRITICAL REMINDERS:
1. This is a ${holeCount}-hole scorecard. Extract EXACTLY ${holeCount} holes!
2. DO NOT include "Out", "In", or "Total" columns as holes
3. For 18-hole: Extract holes 1-18 (Front 9 + Back 9)
4. For 9-hole: Extract holes 1-9 only
5. Summary columns are for totals, not individual holes
6. Use the PAR values as your guide for validating handwritten scores!`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: 'high', // Use high detail for better handwriting recognition
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
    throw new Error('No response from OpenAI Vision');
  }

  let jsonString = content.trim();
  if (jsonString.startsWith('```json')) {
    jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (jsonString.startsWith('```')) {
    jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  const extracted: ExtractedScorecard = JSON.parse(jsonString);

  // Ensure proper structure
  if (!extracted.courseName) {
    extracted.courseName = 'Unknown Course';
  }
  
  extracted.holes = extracted.holes?.map((hole: any) => ({
    holeNumber: hole.holeNumber || 0,
    par: hole.par || 4,
    yardage: hole.yardage || undefined,
    handicap: hole.handicap || undefined,
  })) || [];

  extracted.players = extracted.players?.map((player: any) => ({
    name: player.name || 'Unknown Player',
    scores: Array.isArray(player.scores) ? player.scores.map((s: any) => ({
      holeNumber: s.holeNumber || 0,
      score: s.score === null || s.score === undefined ? null : s.score,
    })) : [],
  })) || [];

  // Clean up any invalid data before returning
  return cleanupExtractedData(extracted);
}

/**
 * Enhance Textract results with OpenAI Vision for handwritten scores
 */
async function enhanceWithVision(
  imageBuffer: Buffer, 
  structure: ExtractedScorecard
): Promise<ExtractedScorecard> {
  const apiKey = await getOpenAIApiKey();
  const openai = new OpenAI({ apiKey });
  const base64Image = imageBuffer.toString('base64');
  const mimeType = detectMimeType(imageBuffer);

  // Detect hole count and use appropriate template
  const holeCount = structure.holes.length;
  const holeInfo = structure.holes.map(h => `Hole ${h.holeNumber} (Par ${h.par})`).join(', ');
  
  // Filter out non-player rows (HANDICAP, PAR, Ladies' Hcp, etc.)
  const actualPlayers = structure.players.filter(p => {
    const name = p.name.toLowerCase();
    return !name.includes('handicap') && 
           !name.includes('hcp') &&
           name !== 'par' && 
           !name.includes('pace of play') &&
           !/^(black|blue|white|red|green|gold|brown|silver)\s+\d/i.test(p.name) &&
           !/^(ladies|men|mens|ladies')/i.test(p.name);
  });
  
  const playerNames = actualPlayers.map(p => p.name).join(', ');
  const templatePrompt = generateTemplateGuidedPrompt(holeCount);

  console.log(`[Hybrid OCR] Using ${holeCount}-hole template for score enhancement`);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are an expert at reading golf scorecards with handwritten scores.

SCORECARD STRUCTURE:
- This is an ${holeCount}-hole scorecard
- Par values for reference: ${structure.holes.map(h => `Hole ${h.holeNumber}=Par ${h.par}`).join(', ')}
- Players to extract (top to bottom): ${actualPlayers.map((p, i) => `Row ${i + 1}: ${p.name}`).join(', ')}

CRITICAL INSTRUCTIONS FOR READING:
1. Locate the row for each player by their name in the leftmost column
2. For each player, read their score cells from LEFT TO RIGHT
3. Read EVERY cell in the row - don't skip any columns
4. The columns are in this order:
   ${holeCount === 18 
     ? 'Holes 1, 2, 3, 4, 5, 6, 7, 8, 9, OUT, Hole 10, 11, 12, 13, 14, 15, 16, 17, 18, IN, TOTAL'
     : 'Holes 1, 2, 3, 4, 5, 6, 7, 8, 9, OUT, TOTAL'}

HANDWRITING RECOGNITION TIPS:
- Compare each score to the par for that hole (scores are usually within +3 of par)
- Common OCR errors: 4→9, 7→1, 5→6, 3→8
- If a score seems unreasonable for the par, look more carefully
- Example: If par is 4 and you see "9", it's probably actually "4"
- Example: If par is 3 and you see "8", it's probably actually "3"

OUTPUT FORMAT:
Return a JSON array with ALL columns for each player:

{
  "scores": [
${actualPlayers.map(p => `    {
      "playerName": "${p.name}",
      "holeScores": [
        {"hole": 1, "score": <number or null>},
        {"hole": 2, "score": <number or null>},
        {"hole": 3, "score": <number or null>},
        {"hole": 4, "score": <number or null>},
        {"hole": 5, "score": <number or null>},
        {"hole": 6, "score": <number or null>},
        {"hole": 7, "score": <number or null>},
        {"hole": 8, "score": <number or null>},
        {"hole": 9, "score": <number or null>},
        {"hole": "OUT", "score": <number or null>},${holeCount === 18 ? `
        {"hole": 10, "score": <number or null>},
        {"hole": 11, "score": <number or null>},
        {"hole": 12, "score": <number or null>},
        {"hole": 13, "score": <number or null>},
        {"hole": 14, "score": <number or null>},
        {"hole": 15, "score": <number or null>},
        {"hole": 16, "score": <number or null>},
        {"hole": 17, "score": <number or null>},
        {"hole": 18, "score": <number or null>},
        {"hole": "IN", "score": <number or null>},` : ''}
        {"hole": "TOTAL", "score": <number or null>}
      ]
    }`).join(',\n')}
  ]
}

IMPORTANT:
- Return ONLY valid JSON (no markdown, no code blocks)
- Use null for empty cells
- Include ALL ${actualPlayers.length} players
- Include ALL columns (holes + OUT/IN/TOTAL) for each player`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: 'high', // High detail for better handwriting recognition
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
    console.warn('[Hybrid OCR] No Vision response, using Textract scores');
    return structure;
  }

  try {
    let jsonString = content.trim();
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const visionScores = JSON.parse(jsonString);

    // Log Vision response for debugging
    console.log('[Hybrid OCR] Vision returned scores for players:', 
      visionScores.scores?.map((s: any) => s.playerName) || []
    );
    console.log('[Hybrid OCR] Textract detected players:', 
      structure.players.map(p => p.name)
    );

    // Check if Vision returned all players
    if (!visionScores.scores || visionScores.scores.length < structure.players.length) {
      console.warn(`[Hybrid OCR] Vision only returned ${visionScores.scores?.length || 0} players, expected ${structure.players.length}`);
    }

    // Merge Vision scores with Textract structure
    const enhanced = { ...structure };
    
    if (visionScores.scores && Array.isArray(visionScores.scores)) {
      enhanced.players = enhanced.players.map(player => {
        console.log(`[Hybrid OCR] Looking for Vision match for Textract player: "${player.name}" (normalized: "${normalizePlayerName(player.name)}")`);
        
        const visionPlayer = visionScores.scores.find(
          (vs: any) => {
            const match = normalizePlayerName(vs.playerName) === normalizePlayerName(player.name);
            console.log(`  Comparing with Vision player: "${vs.playerName}" (normalized: "${normalizePlayerName(vs.playerName)}") - Match: ${match}`);
            return match;
          }
        );

        if (visionPlayer && visionPlayer.holeScores) {
          const updatedScores = player.scores.map(scoreEntry => {
            const visionScore = visionPlayer.holeScores.find(
              (hs: any) => hs.hole === scoreEntry.holeNumber
            );
            
            // ONLY use Vision if Textract returned null (couldn't read it)
            if (scoreEntry.score === null || scoreEntry.score === undefined) {
              if (visionScore && visionScore.score !== undefined && visionScore.score !== null) {
                const hole = structure.holes.find(h => h.holeNumber === scoreEntry.holeNumber);
                const par = hole?.par || 4;
                const visionDiff = Math.abs(visionScore.score - par);
                
                // Only accept reasonable Vision scores (within 7 of par)
                if (visionDiff <= 7) {
                  console.log(
                    `[Hybrid OCR] Filled gap with Vision for ${player.name} hole ${scoreEntry.holeNumber}: null → ${visionScore.score} (Par: ${par})`
                  );
                  // Mark confidence based on how close to par
                  const confidence = visionDiff <= 3 ? 'high' : visionDiff <= 5 ? 'medium' : 'low';
                  return { 
                    ...scoreEntry, 
                    score: visionScore.score,
                    confidence,
                    source: 'vision' as const
                  };
                } else {
                  console.log(
                    `[Hybrid OCR] Rejected Vision score for ${player.name} hole ${scoreEntry.holeNumber}: ${visionScore.score} (too far from par ${par})`
                  );
                }
              }
            } else {
              // Textract has a score - keep it and mark confidence
              const hole = structure.holes.find(h => h.holeNumber === scoreEntry.holeNumber);
              const par = hole?.par || 4;
              const diff = Math.abs(scoreEntry.score - par);
              const confidence = diff <= 3 ? 'high' : diff <= 5 ? 'medium' : 'low';
              
              console.log(
                `[Hybrid OCR] Keeping Textract score for ${player.name} hole ${scoreEntry.holeNumber}: ${scoreEntry.score} (confidence: ${confidence})`
              );
              
              return {
                ...scoreEntry,
                confidence,
                source: 'textract' as const
              };
            }
            
            return scoreEntry;
          });

          return { ...player, scores: updatedScores };
        }

        return player;
      });

      console.log('[Hybrid OCR] Successfully merged Vision scores with Textract structure');
    }

    return enhanced;
  } catch (error) {
    console.warn('[Hybrid OCR] Failed to parse Vision response, using Textract scores');
    console.warn('[Hybrid OCR] Error:', error);
    return structure;
  }
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
