/**
 * OpenAI Vision API integration for golf scorecard image analysis
 * 
 * This module uses OpenAI's GPT-4 Vision model to extract structured data
 * from golf scorecard images. The API key is securely fetched from AWS Secrets Manager.
 * 
 * SEPARATION OF CONCERNS:
 * - This module handles ONLY OpenAI Vision API calls (image → structured data)
 * - It does NOT interact with Bedrock or any other AI service
 * - The API key is never exposed to the client (server-side only)
 */

import OpenAI from 'openai';
import { getOpenAIApiKey } from './secrets';

import type { ExtractedScorecard } from './types';

/**
 * Analyzes a golf scorecard image using OpenAI Vision API
 * 
 * @param imageBuffer - The image file as a Buffer
 * @returns Structured scorecard data
 * @throws Error if analysis fails
 */
export async function analyzeScorecardImage(imageBuffer: Buffer): Promise<ExtractedScorecard> {
  console.log('[OpenAI Vision] Starting scorecard image analysis...');

  // Get API key from Secrets Manager (or local env)
  const apiKey = await getOpenAIApiKey();
  
  // Initialize OpenAI client
  const openai = new OpenAI({ apiKey });

  // Convert buffer to base64
  const base64Image = imageBuffer.toString('base64');
  const mimeType = detectMimeType(imageBuffer);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are an expert at analyzing golf scorecards. Extract ALL information from this scorecard image with EXTREME ACCURACY.

CRITICAL INSTRUCTIONS:
1. Read numbers VERY carefully - double-check each score
2. Match player names to their correct row
3. Match hole numbers to the correct column
4. If a cell is empty or unclear, use null for the score
5. Pay special attention to handwriting - some numbers may look similar (1/7, 4/9, 5/6, etc.)

Extract the following data:
- Course name (or use null if not visible)
- Tee name/color (or use null if not visible)  
- Date (or use null if not visible)
- For EACH hole (1-18 or 1-9):
  * Hole number (1, 2, 3, etc.)
  * Par (typically 3, 4, or 5)
  * Yardage in yards (or null if not visible)
  * Handicap/stroke index (1-18, or null if not visible)
- For EACH player:
  * Player name (exactly as written)
  * Score for EACH hole (the actual strokes taken, or null if not played/visible)

VALIDATION:
- Hole numbers should be sequential (1, 2, 3, ...)
- Par values are typically between 3-5
- Scores are typically between 2-12 for amateur golfers
- Each player should have scores for the same holes

Return ONLY valid JSON (no markdown, no code blocks, no explanations):
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
}`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1, // Low temperature for more consistent extraction
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response content from OpenAI Vision');
    }

    console.log('[OpenAI Vision] Raw response:', content);

    // Parse the JSON response
    // Remove markdown code blocks if present
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
      console.error('[OpenAI Vision] JSON parse error:', parseError);
      console.error('[OpenAI Vision] Failed to parse:', jsonString.substring(0, 500));
      throw new Error('Failed to parse OpenAI Vision response as JSON');
    }

    // Validate and fix the structure
    if (!extracted.courseName) {
      extracted.courseName = 'Unknown Course';
    }
    
    if (!extracted.holes || !Array.isArray(extracted.holes)) {
      console.error('[OpenAI Vision] Invalid holes structure:', extracted.holes);
      throw new Error('Invalid scorecard structure: holes array missing or invalid');
    }
    
    if (!extracted.players || !Array.isArray(extracted.players)) {
      console.error('[OpenAI Vision] Invalid players structure:', extracted.players);
      throw new Error('Invalid scorecard structure: players array missing or invalid');
    }

    // Ensure all holes have required fields
    extracted.holes = extracted.holes.map((hole: any) => ({
      holeNumber: hole.holeNumber || 0,
      par: hole.par || 4,
      yardage: hole.yardage || undefined,
      handicap: hole.handicap || undefined,
    }));

    // Ensure all players have required fields
    extracted.players = extracted.players.map((player: any) => ({
      name: player.name || 'Unknown Player',
      scores: Array.isArray(player.scores) ? player.scores.map((s: any) => ({
        holeNumber: s.holeNumber || 0,
        score: s.score === null || s.score === undefined ? null : s.score,
      })) : [],
    }));

    console.log('[OpenAI Vision] Successfully extracted scorecard:', {
      course: extracted.courseName,
      holes: extracted.holes.length,
      players: extracted.players.length,
    });

    return extracted;
  } catch (error) {
    console.error('[OpenAI Vision] Error analyzing scorecard:', error);
    
    if (error instanceof Error) {
      throw new Error(`Failed to analyze scorecard image: ${error.message}`);
    }
    
    throw new Error('Failed to analyze scorecard image');
  }
}

/**
 * Detects MIME type from buffer magic numbers
 */
function detectMimeType(buffer: Buffer): string {
  // Check for common image formats
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
  
  // Default to jpeg
  return 'image/jpeg';
}
