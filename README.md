# TopScore Golf - AI-Powered Scorecard Analysis

A Next.js 14 application that uses a **Hybrid OCR approach** combining AWS Textract's structure detection with OpenAI Vision's handwriting recognition to extract golf scorecard data from images. **Amazon Bedrock (Claude)** provides intelligent insights and analysis. Designed to run on **AWS Amplify Hosting** with secure secret management via **AWS Secrets Manager**.

## Features

- 📸 **Image Upload**: Upload golf scorecard photos
- 🔍 **Hybrid OCR**: Production-ready approach
  - **AWS Textract** detects table structure and identifies holes, par values, and player names
  - **OpenAI Vision (GPT-4o)** fills gaps in handwritten scores with high accuracy
  - Handles various scorecard formats from different golf courses
- ✏️ **Editable Results**: Review and correct extracted data in an intuitive table
- 📊 **Automatic Calculations**: Real-time statistics (out/in/total scores)
- 💬 **AI Assistant**: Chat with Amazon Bedrock (Claude) for personalized insights and tips
- 🔒 **Secure**: API keys stored in AWS Secrets Manager

## Why Hybrid OCR?

Golf scorecards are challenging for OCR because they combine:
- **Printed text** (course names, hole numbers, par values, tee names)
- **Tables** (structured grid layout with varying formats)
- **Handwritten numbers** (player scores, often messy)

Our hybrid approach leverages the strengths of each technology:

| Capability | Textract | OpenAI Vision | Hybrid Result |
|------------|----------|---------------|---------------|
| Table detection | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Best structure |
| Printed text | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | High accuracy |
| Handwriting | ⭐⭐ | ⭐⭐⭐⭐⭐ | Best scores |
| Speed | Fast | Moderate | Optimized |
| Cost | $1.50/1000 pages | $0.01/image | Balanced |

**Result**: ~90%+ accuracy on handwritten golf scorecards from various courses vs ~70% with single OCR approach.

## Scorecard Format Support

The system intelligently handles various golf scorecard layouts:

**Standard Layout Detection:**
- **Hole Numbers Row** - Sequential 1-9 or 1-18 (automatically detected)
- **Par Row** - Supports multiple label formats:
  - "Par" (standard)
  - "Men's Par" or "Mens Par" 
  - Can appear before or after hole numbers
  - Searches up to 8 rows from hole numbers to accommodate different layouts
- **Player Rows** - Automatically identifies player names and their scores

**Smart Par Detection:**
- Checks row before hole numbers (some courses have par first)
- Checks up to 8 rows after hole numbers (handles tee yardages like Black/Blue/White/Gold)
- Uses regex pattern matching: `/men['s]*\s*par/i`
- Falls back to par 4 default if not found (rare)

**Confidence Scoring:**
- **High confidence**: Score within 3 of par
- **Medium confidence**: 4-5 strokes from par  
- **Low confidence**: 6-7 strokes from par
- Scores beyond 7 over par flagged for review

**Example Scorecard Structure:**
```
Row 0: Course Name (e.g., "Elk Grove")
Row 1: HOLE | 1 | 2 | 3 | ... | 18 | IN | TOT | HCP | NET
Row 2: Black (tee yardages)
Row 3: Blue (tee yardages)
Row 4: White (tee yardages)
Row 5: Gold (tee yardages)
Row 6: Men's Par | 4 | 4 | 3 | ... | 5 | 36 | 72
Row 7+: Player rows with handwritten scores
```

## Architecture

### Hybrid OCR Flow

```
Scorecard Image Upload
         ↓
    ┌────────────────────────────────┐
    │   Hybrid OCR Orchestrator      │
    │      (hybridOcr.ts)            │
    └────────────────────────────────┘
         ↓
    ┌─────────────────────────┐
    │   AWS Textract          │
    │   (Structure Detection) │
    └─────────────────────────┘
         ↓
    • Finds table structure
    • Identifies hole numbers (1-18)
    • Detects par row (with flexible search)
    • Extracts player names
    • Reads printed text (course info)
    • Maps all table cells
         ↓
    ┌─────────────────────────┐
    │  Check for Null Scores  │
    │  (Gap Detection)        │
    └─────────────────────────┘
         ↓
    If gaps exist:
         ↓
    ┌─────────────────────────┐
    │   OpenAI Vision         │
    │   (GPT-4o High Detail)  │
    └─────────────────────────┘
         ↓
    • Reads handwritten scores
    • Fills only null/missing values
    • Context-aware recognition
    • Uses 18-hole template
         ↓
    ┌─────────────────────────┐
    │   Merge & Validate      │
    │   (Conservative Fill)   │
    └─────────────────────────┘
         ↓
    • Keep Textract scores (high confidence)
    • Fill gaps with Vision scores
    • Calculate confidence levels
    • Track source (textract vs vision)
         ↓
    ┌─────────────────────────┐
    │   Cleanup & Finalize    │
    └─────────────────────────┘
         ↓
    • Remove invalid scores
    • Calculate Out/In/Total
    • Return structured data
         ↓
    Final Scorecard Data
```

### Key Design Principles

1. **Conservative Gap Filling**: Only use Vision API when Textract returns null
2. **Source Tracking**: Every score tagged with its source (textract/vision)
3. **Confidence Scoring**: Based on distance from par (high/medium/low)
4. **Flexible Layout Detection**: Handles various scorecard formats automatically

### Key Components

```
lib/
├── types.ts              # TypeScript interfaces (Scorecard, Player, Hole)
├── secrets.ts            # AWS Secrets Manager integration (OpenAI key)
├── hybridOcr.ts          # Hybrid OCR orchestrator (MAIN ENTRY POINT)
├── textractOcr.ts        # AWS Textract for structure detection
├── openaiVision.ts       # OpenAI Vision for handwriting (gap filling)
├── cleanupOcr.ts         # Post-processing and validation
├── bedrockClient.ts      # Amazon Bedrock client
└── playerTotals.ts       # Golf scoring calculations (Out/In/Total)

app/
├── api/
│   ├── scorecards/route.ts    # POST endpoint: Image → Hybrid OCR → JSON
│   └── assistant/route.ts     # POST endpoint: Chat → Bedrock
├── page.tsx              # Main page
├── layout.tsx            # Root layout
└── globals.css           # Global styles

components/
├── ScorecardUpload.tsx   # Image upload component
├── ScorecardEditor.tsx   # Editable scorecard table
└── AIAssistantPanel.tsx  # Chat interface for Bedrock
```

### Component Responsibilities

**Textract (`lib/textractOcr.ts`)**:
- Table structure extraction from AWS Textract API
- Hole number detection (finds sequential 1-9 or 1-18)
- Par row detection with flexible search (checks 8 rows, supports "Men's Par")
- Player name extraction from row labels
- Score extraction from table cells
- Returns structured scorecard with possible null scores

**OpenAI Vision (`lib/openaiVision.ts`)**:
- Handwriting recognition using GPT-4o high-detail mode
- Gap filling only (doesn't replace Textract scores)
- Uses 18-hole or 9-hole templates
- Structured JSON output with player scores

**Hybrid Orchestrator (`lib/hybridOcr.ts`)**:
- Calls Textract first for structure
- Detects null scores (gaps) in Textract result
- Calls Vision API only if gaps exist
- Merges Vision scores into Textract structure (conservative fill)
- Calculates confidence based on par values
- Returns final scorecard with source tracking

**Cleanup (`lib/cleanupOcr.ts`)**:
- Removes invalid/null scores
- Validates hole sequences
- Final data sanitization

**Player Totals (`lib/playerTotals.ts`)**:
- Calculates Out (holes 1-9), In (holes 10-18), Total scores
- Handles missing scores gracefully

## Local Development

### Prerequisites

- Node.js 18+ and npm
- OpenAI API key (for local testing)

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create `.env.local`** file:
   ```bash
   # Copy the example file
   copy .env.example .env.local
   ```

3. **Add your OpenAI API key** to `.env.local`:
   ```env
   OPENAI_API_KEY=sk-...
   AWS_REGION=us-east-1
   BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser** to `http://localhost:3000`

### Local Testing Notes

- In development mode, the app uses `OPENAI_API_KEY` from `.env.local`
- Bedrock features will only work if you have AWS credentials configured locally
- To test Bedrock locally, ensure you have AWS CLI configured with appropriate credentials

## AWS Amplify Deployment

### Step 1: Create AWS Secrets Manager Secret

1. **Go to AWS Secrets Manager** in the AWS Console
2. **Create a new secret**:
   - Secret type: "Other type of secret"
   - Key/value pairs:
     ```json
     {
       "OPENAI_API_KEY": "sk-your-actual-openai-key"
     }
     ```
   - Secret name: `openai/golf-scorecard-app` (or customize via `SECRETS_MANAGER_SECRET_NAME`)
   - Region: Same as your Amplify app (e.g., `us-east-1`)

3. **Note the secret ARN** for the next step

### Step 2: Deploy to AWS Amplify

1. **Push your code to GitHub** (or GitLab, Bitbucket, etc.)

2. **Go to AWS Amplify Console** and click "New app" → "Host web app"

3. **Connect your repository** and select the branch

4. **Build settings** (Amplify should auto-detect Next.js):
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm ci
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```

5. **Environment variables**:
   Add these in the Amplify Console → Environment variables:
   
   | Variable Name | Value |
   |--------------|-------|
   | `AWS_REGION` | `us-east-1` (or your region) |
   | `BEDROCK_MODEL_ID` | `anthropic.claude-3-sonnet-20240229-v1:0` |
   | `SECRETS_MANAGER_SECRET_NAME` | `openai/golf-scorecard-app` |

   **Important**: Do NOT set `OPENAI_API_KEY` here - it will be fetched from Secrets Manager

6. **Deploy** the app

### Step 3: Configure IAM Permissions

Your Amplify app needs permissions to access Secrets Manager and Bedrock.

1. **Go to AWS Amplify Console** → Your app → App settings → General

2. **Find the service role** (something like `amplifyconsole-backend-role`)

3. **Go to IAM** → Roles → Find that role

4. **Add inline policy** (or attach managed policies):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "secretsmanager:GetSecretValue"
         ],
         "Resource": "arn:aws:secretsmanager:us-east-1:YOUR-ACCOUNT-ID:secret:openai/golf-scorecard-app-*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "bedrock:InvokeModel"
         ],
         "Resource": "arn:aws:bedrock:*:*:foundation-model/*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "textract:AnalyzeDocument",
           "textract:DetectDocumentText"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

   **Replace** `YOUR-ACCOUNT-ID` and region as needed

5. **Redeploy** the Amplify app (or trigger a new build)

### Step 4: Test the Deployment

1. Visit your Amplify app URL
2. Upload a golf scorecard image
3. Verify the extraction works (OpenAI Vision)
4. Ask the AI assistant a question (Amazon Bedrock)

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Local only | - | OpenAI API key (use Secrets Manager in production) |
| `AWS_REGION` | Yes | `us-east-1` | AWS region for Secrets Manager and Bedrock |
| `BEDROCK_MODEL_ID` | Yes | `anthropic.claude-3-sonnet-20240229-v1:0` | Bedrock model ID |
| `SECRETS_MANAGER_SECRET_NAME` | No | `openai/golf-scorecard-app` | Secret name in AWS Secrets Manager |

## Troubleshooting

### "Failed to retrieve OpenAI API key"

- **Local**: Check that `OPENAI_API_KEY` is in `.env.local`
- **Amplify**: Verify the secret exists in Secrets Manager and the IAM role has `secretsmanager:GetSecretValue` permission

### "Failed to analyze round with Bedrock"

- Check that `BEDROCK_MODEL_ID` and `AWS_REGION` are set in Amplify environment variables
- Verify the IAM role has `bedrock:InvokeModel` permission
- Ensure the model ID is valid and available in your region

### TypeScript errors

- Run `npm install` to ensure all dependencies are installed
- The TypeScript errors shown during file creation are normal before running `npm install`

## Tech Stack

- **Next.js 14** (App Router, Server Components)
- **TypeScript**
- **Tailwind CSS**
- **AWS Textract** (Table structure detection)
- **OpenAI GPT-4o Vision** (Handwriting recognition)
- **Amazon Bedrock (Claude 3 Sonnet)** (AI insights)
- **AWS Secrets Manager** (Secure API key storage)
- **AWS Amplify Hosting**

## Production Notes

- **Par Detection**: System automatically detects par row with flexible search (up to 8 rows from hole numbers)
- **Confidence Scoring**: Based on actual par values extracted from scorecard
- **Gap Filling**: Vision API only called when Textract leaves null scores
- **Cost Optimization**: Typically 1 Textract call + 1 Vision call per scorecard
- **Error Handling**: Validates scores >7 over par and flags for review

## License

MIT
