/**
 * Amazon Bedrock integration for AI assistant functionality
 * 
 * This module uses Amazon Bedrock (Claude) to provide intelligent analysis
 * of golf rounds based on already-structured scorecard data.
 * 
 * SEPARATION OF CONCERNS:
 * - This module handles ONLY Bedrock API calls (structured data → AI insights)
 * - It does NOT interact with OpenAI or image processing
 * - Uses AWS credentials from the Amplify environment (no separate API key needed)
 * 
 * CONFIGURATION:
 * Set these environment variables in AWS Amplify:
 * - AWS_REGION: The AWS region for Bedrock (e.g., us-east-1)
 * - BEDROCK_MODEL_ID: The Bedrock model ID (e.g., anthropic.claude-3-sonnet-20240229-v1:0)
 * 
 * IAM PERMISSIONS:
 * Your Amplify app's IAM role needs:
 * - bedrock:InvokeModel
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { ExtractedScorecard, DerivedScoring } from './types';

/**
 * Parameters for analyzing a round with Bedrock
 */
export interface AnalyzeRoundParams {
  modelId: string;
  scorecard: ExtractedScorecard;
  derived: DerivedScoring;
  userMessage: string;
}

/**
 * Analyzes a golf round using Amazon Bedrock (Claude)
 * 
 * @param params - Analysis parameters including scorecard data and user message
 * @returns AI-generated response text
 * @throws Error if analysis fails
 */
export async function analyzeRoundWithBedrock(params: AnalyzeRoundParams): Promise<string> {
  const { modelId, scorecard, derived, userMessage } = params;

  console.log('[Bedrock] Starting round analysis with model:', modelId);

  const region = process.env.AWS_REGION || 'us-east-1';

  // Initialize Bedrock Runtime client
  // In AWS Amplify, credentials are automatically provided by the IAM role
  const client = new BedrockRuntimeClient({ region });

  // Construct a comprehensive prompt with scorecard context
  const systemPrompt = `You are an expert golf instructor and analyst. You have access to a player's complete golf scorecard with all the details and statistics. Your role is to:

1. Validate data consistency (e.g., check if scores add up correctly)
2. Provide insightful feedback about the player's performance
3. Identify strengths and areas for improvement
4. Answer specific questions about the round
5. Give practical tips based on the data

Be conversational, encouraging, and data-driven in your responses.`;

  const contextPrompt = `Here is the golf round data:

COURSE INFORMATION:
- Course: ${scorecard.courseName}
${scorecard.teeName ? `- Tee: ${scorecard.teeName}` : ''}
${scorecard.date ? `- Date: ${scorecard.date}` : ''}

HOLE DETAILS:
${scorecard.holes.map((h) => `Hole ${h.holeNumber}: Par ${h.par}${h.yardage ? `, ${h.yardage} yards` : ''}${h.handicap ? `, Handicap ${h.handicap}` : ''}`).join('\n')}

PLAYERS AND SCORES:
${derived.players.map((p) => {
  const player = scorecard.players.find((sp) => sp.name === p.name);
  const scoresStr = player?.scores
    .map((s) => {
      const hole = scorecard.holes.find((h) => h.holeNumber === s.holeNumber);
      const relation = s.score !== null && hole ? ` (${s.score - hole.par > 0 ? '+' : ''}${s.score - hole.par})` : '';
      return `  Hole ${s.holeNumber}: ${s.score ?? 'N/A'}${relation}`;
    })
    .join('\n');
  
  return `${p.name}:
  Total Score: ${p.totalScore} (${p.scoreToPar > 0 ? '+' : ''}${p.scoreToPar})
  Statistics: ${p.eagles} eagles, ${p.birdies} birdies, ${p.pars} pars, ${p.bogeys} bogeys, ${p.doubleBogeys} double bogeys, ${p.tripleBogeyPlus} triple+
${scoresStr}`;
}).join('\n\n')}

USER QUESTION:
${userMessage}`;

  try {
    // Prepare the request body for Claude
    const requestBody = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2000,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: `${systemPrompt}\n\n${contextPrompt}`,
        },
      ],
    };

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    });

    console.log('[Bedrock] Sending request to model...');
    const response = await client.send(command);

    // Parse the response
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    console.log('[Bedrock] Response received:', {
      stopReason: responseBody.stop_reason,
      contentLength: responseBody.content?.[0]?.text?.length,
    });

    // Extract the text from Claude's response
    const assistantReply = responseBody.content?.[0]?.text;

    if (!assistantReply) {
      throw new Error('No response text from Bedrock model');
    }

    return assistantReply;
  } catch (error) {
    console.error('[Bedrock] Error analyzing round:', error);

    if (error instanceof Error) {
      throw new Error(`Failed to analyze round with Bedrock: ${error.message}`);
    }

    throw new Error('Failed to analyze round with Bedrock');
  }
}

/**
 * Gets the default Bedrock model ID from environment variables
 */
export function getDefaultModelId(): string {
  return process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';
}
