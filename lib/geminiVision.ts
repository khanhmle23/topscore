/**
 * Google Gemini API integration for golf scorecard image analysis
 * 
 * Gemini 1.5 Pro/Flash have excellent vision capabilities for:
 * - Handwriting recognition
 * - Table structure understanding
 * - Large context windows (up to 1M tokens)
 * - Strong multimodal reasoning
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ExtractedScorecard } from './types';

/**
 * Get Gemini API key from environment
 */
async function getGeminiApiKey(): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY not found in environment variables');
  }
  
  return apiKey;
}

/**
 * Analyzes a golf scorecard image using Google Gemini
 * 
 * @param imageBuffer - The image file as a Buffer
 * @returns Structured scorecard data
 */
export async function analyzeWithGemini(imageBuffer: Buffer): Promise<ExtractedScorecard> {
  console.log('[Gemini] Starting scorecard image analysis...');

  const apiKey = await getGeminiApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Use Gemini Pro Vision (stable model with vision capabilities)
  const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });

  // Convert buffer to base64
  const base64Image = imageBuffer.toString('base64');
  const mimeType = detectMimeType(imageBuffer);

  try {
    const prompt = `You are an expert at extracting data from golf scorecards. Analyze this golf scorecard image and extract ALL information with perfect accuracy.

CRITICAL INSTRUCTIONS:
1. Identify if this is a 9-hole or 18-hole scorecard
2. For each hole, extract:
   - Hole number (1-18 or 1-9)
   - Par value (typically 3, 4, or 5)
   - Yardage (if visible)
   - Handicap/Stroke index (if visible)

3. For each player, extract:
   - Player name (exactly as written)
   - Score for EACH hole (read carefully, these are handwritten)
   - Use null for empty/unplayed holes

4. DO NOT extract these as holes or players:
   - "OUT", "IN", "TOTAL" columns (these are summary columns)
   - "PAR", "HANDICAP", "HCP" rows (these are not players)
   - Player initial columns (usually 2-3 letters between holes 9 and 10)
   - Tee box information (e.g., "White 72.1/131")

5. HANDWRITING TIPS:
   - Double-check each score - handwriting can be messy
   - Compare scores to par values (scores usually within ±3 of par)
   - Common OCR errors: 1↔7, 4↔9, 5↔6, 3↔8
   - If truly illegible, use null rather than guessing

Return ONLY valid JSON (no markdown, no explanations):
{
  "courseName": "Course Name or null",
  "teeName": "Tee Color or null",
  "date": "Date or null",
  "holes": [
    {"holeNumber": 1, "par": 4, "yardage": 380, "handicap": 5}
  ],
  "players": [
    {
      "name": "Player Name",
      "scores": [{"holeNumber": 1, "score": 4}]
    }
  ]
}`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
    ]);

    const response = await result.response;
    const content = response.text();

    if (!content) {
      throw new Error('No response from Gemini');
    }

    console.log('[Gemini] Raw response length:', content.length);

    // Parse JSON response (remove markdown if present)
    let jsonString = content.trim();
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let extracted: ExtractedScorecard;
    
    try {
      extracted = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('[Gemini] JSON parse error:', parseError);
      console.error('[Gemini] Failed to parse:', jsonString.substring(0, 500));
      throw new Error('Failed to parse Gemini response as JSON');
    }

    // Validate and normalize structure
    if (!extracted.courseName) {
      extracted.courseName = 'Unknown Course';
    }
    
    if (!extracted.holes || !Array.isArray(extracted.holes)) {
      console.error('[Gemini] Invalid holes structure:', extracted.holes);
      throw new Error('Invalid scorecard structure: holes array missing or invalid');
    }
    
    if (!extracted.players || !Array.isArray(extracted.players)) {
      console.error('[Gemini] Invalid players structure:', extracted.players);
      throw new Error('Invalid scorecard structure: players array missing or invalid');
    }

    // Normalize holes
    extracted.holes = extracted.holes.map((hole: any) => ({
      holeNumber: hole.holeNumber || 0,
      par: hole.par || 4,
      yardage: hole.yardage || undefined,
      handicap: hole.handicap || undefined,
    }));

    // Normalize players and scores
    extracted.players = extracted.players.map((player: any) => ({
      name: player.name || 'Unknown Player',
      scores: Array.isArray(player.scores) ? player.scores.map((s: any) => ({
        holeNumber: s.holeNumber || 0,
        score: s.score === null || s.score === undefined ? null : s.score,
      })) : [],
    }));

    console.log('[Gemini] Successfully extracted scorecard:', {
      course: extracted.courseName,
      holes: extracted.holes.length,
      players: extracted.players.length,
    });

    return extracted;
  } catch (error) {
    console.error('[Gemini] Error analyzing scorecard:', error);
    
    if (error instanceof Error) {
      throw new Error(`Gemini analysis failed: ${error.message}`);
    }
    
    throw new Error('Gemini analysis failed');
  }
}

/**
 * Detects MIME type from buffer magic numbers
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
