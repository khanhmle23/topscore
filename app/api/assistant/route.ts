/**
 * API Route: /api/assistant
 * 
 * Handles AI assistant requests using Amazon Bedrock (Claude).
 * 
 * FLOW:
 * 1. Accepts POST requests with scorecard data and user message
 * 2. Calls Amazon Bedrock (Claude) to analyze the round (via lib/bedrockClient.ts)
 * 3. Returns the AI's response as JSON
 * 
 * IMPORTANT:
 * - This route ONLY uses Bedrock (for structured data → AI insights)
 * - It does NOT use OpenAI (that's in /api/scorecards)
 * - Uses AWS credentials from Amplify environment (no API key needed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeRoundWithBedrock, getDefaultModelId } from '@/lib/bedrockClient';
import type { AssistantRequest, AssistantResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for Bedrock response

export async function POST(request: NextRequest) {
  try {
    console.log('[API /api/assistant] Received assistant request');

    // Parse request body
    const body: AssistantRequest = await request.json();
    const { scorecard, derived, message } = body;

    // Validate request
    if (!scorecard || !derived || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: scorecard, derived, or message' },
        { status: 400 }
      );
    }

    if (typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message must be a non-empty string' },
        { status: 400 }
      );
    }

    console.log('[API /api/assistant] Processing request:', {
      course: scorecard.courseName,
      players: scorecard.players.length,
      messageLength: message.length,
    });

    // Get model ID from environment
    const modelId = getDefaultModelId();

    // Call Bedrock to analyze the round
    console.log('[API /api/assistant] Calling Bedrock API...');
    const reply = await analyzeRoundWithBedrock({
      modelId,
      scorecard,
      derived,
      userMessage: message,
    });

    // Prepare response
    const response: AssistantResponse = {
      reply,
    };

    console.log('[API /api/assistant] Successfully processed request');

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[API /api/assistant] Error processing request:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Failed to process assistant request: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process assistant request' },
      { status: 500 }
    );
  }
}
