/**
 * AWS Secrets Manager integration for securely retrieving API keys
 * 
 * This module handles fetching the OpenAI API key from AWS Secrets Manager.
 * In production (AWS Amplify), it uses the AWS SDK to fetch secrets.
 * In local development, it falls back to the OPENAI_API_KEY environment variable.
 * 
 * CONFIGURATION:
 * 1. Create a secret in AWS Secrets Manager with the name specified in
 *    SECRETS_MANAGER_SECRET_NAME environment variable (default: openai/golf-scorecard-app)
 * 2. The secret should be a JSON string like: {"OPENAI_API_KEY": "sk-..."}
 * 3. Grant your Amplify app's IAM role permission to read this secret:
 *    - secretsmanager:GetSecretValue
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// In-memory cache for the OpenAI API key to avoid hitting Secrets Manager on every request
let cachedOpenAIApiKey: string | null = null;

/**
 * Retrieves the OpenAI API key from AWS Secrets Manager (with in-memory caching)
 * Falls back to environment variable in local development
 * 
 * @returns The OpenAI API key
 * @throws Error if the key cannot be retrieved
 */
export async function getOpenAIApiKey(): Promise<string> {
  // Return cached value if available
  if (cachedOpenAIApiKey) {
    return cachedOpenAIApiKey;
  }

  // In local development, use environment variable directly
  if (process.env.NODE_ENV === 'development' && process.env.OPENAI_API_KEY) {
    console.log('[Secrets] Using OPENAI_API_KEY from local environment variable');
    cachedOpenAIApiKey = process.env.OPENAI_API_KEY;
    return cachedOpenAIApiKey;
  }

  // In production (AWS Amplify), fetch from Secrets Manager
  try {
    const secretName = process.env.SECRETS_MANAGER_SECRET_NAME || 'openai/golf-scorecard-app';
    const region = process.env.AWS_REGION || 'us-east-1';

    console.log(`[Secrets] Fetching secret from AWS Secrets Manager: ${secretName}`);

    const client = new SecretsManagerClient({ region });
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    // Parse the secret JSON
    const secret = JSON.parse(response.SecretString);
    
    if (!secret.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not found in secret');
    }

    // Cache the key
    cachedOpenAIApiKey = secret.OPENAI_API_KEY;
    console.log('[Secrets] Successfully retrieved and cached OpenAI API key');
    
    return cachedOpenAIApiKey;
  } catch (error) {
    console.error('[Secrets] Error fetching OpenAI API key from Secrets Manager:', error);
    
    // Final fallback to environment variable (for testing in Amplify without Secrets Manager)
    if (process.env.OPENAI_API_KEY) {
      console.log('[Secrets] Falling back to OPENAI_API_KEY environment variable');
      cachedOpenAIApiKey = process.env.OPENAI_API_KEY;
      return cachedOpenAIApiKey;
    }
    
    throw new Error('Failed to retrieve OpenAI API key. Ensure AWS Secrets Manager is configured or OPENAI_API_KEY is set.');
  }
}

/**
 * Clears the cached API key (useful for testing or forcing a refresh)
 */
export function clearSecretCache(): void {
  cachedOpenAIApiKey = null;
}
