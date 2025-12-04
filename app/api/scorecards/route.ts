/**
 * API Route: /api/scorecards
 * 
 * Handles golf scorecard image uploads using a hybrid OCR approach.
 * 
 * FLOW:
 * 1. Accepts multipart/form-data image upload
 * 2. Uses hybrid OCR approach:
 *    a. Textract analyzes image structure (tables, rows, columns)
 *    b. OpenAI Vision fills gaps in handwritten scores
 *    c. Validates against par values
 * 3. Calculates derived scoring statistics (via lib/golfScoring.ts)
 * 4. Returns both extracted and derived data as JSON
 * 
 * WHY HYBRID?
 * - Textract: Excellent at finding table structure
 * - OpenAI Vision: Fills in gaps where Textract couldn't read
 * - Conservative approach: Trust what works, fill only gaps
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeWithHybridOcr } from '@/lib/hybridOcr';
import { calculateDerivedScoring, calculatePlayerTotals } from '@/lib/golfScoring';
import type { ScorecardAnalysisResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for image processing

export async function POST(request: NextRequest) {
  try {
    console.log('[API /api/scorecards] Received scorecard upload request');

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image file too large (max 10MB)' },
        { status: 400 }
      );
    }

    console.log('[API /api/scorecards] Processing image:', {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract structured data using hybrid OCR approach
    // (Textract for structure + Vision fills gaps only)
    console.log('[API /api/scorecards] Starting hybrid OCR extraction...');
    const extracted = await analyzeWithHybridOcr(buffer);

    // Calculate Out/In/Total for each player (auto-calculated from scores)
    console.log('[API /api/scorecards] Calculating player totals (Out/In/Total)...');
    const withTotals = {
      ...extracted,
      players: extracted.players.map((player: any) => calculatePlayerTotals(player)),
    };

    // Calculate derived scoring statistics
    console.log('[API /api/scorecards] Calculating derived scoring...');
    const derived = calculateDerivedScoring(withTotals);

    // Prepare response
    const response: ScorecardAnalysisResponse = {
      extracted: withTotals,
      derived,
    };

    console.log('[API /api/scorecards] Successfully processed scorecard:', {
      course: withTotals.courseName,
      holes: withTotals.holes.length,
      players: withTotals.players.length,
    });

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[API /api/scorecards] Error processing scorecard:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to process scorecard: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process scorecard' },
      { status: 500 }
    );
  }
}
