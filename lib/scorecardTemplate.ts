/**
 * Golf Scorecard Template Knowledge
 * 
 * Standard golf scorecard layouts and patterns to guide OCR extraction
 */

/**
 * Standard golf scorecard structure
 */
export interface ScorecardTemplate {
  // Row order (top to bottom)
  rowOrder: string[];
  // Common labels and their variations
  labelVariations: Record<string, string[]>;
  // Validation rules
  validation: {
    holeCount: number[];  // Usually 9 or 18
    parRange: [number, number];  // Par 3-5
    scoreRange: [number, number];  // Scores 1-15 typically
    yardageRange: [number, number];  // Yardage 100-600
  };
}

/**
 * Standard 18-hole golf scorecard layout
 */
export const STANDARD_18_HOLE_TEMPLATE: ScorecardTemplate = {
  rowOrder: [
    'hole',       // Row 1: Hole numbers (1-18)
    'yardage',    // Row 2: Distance in yards
    'par',        // Row 3: Par for each hole
    'handicap',   // Row 4: Handicap/Stroke Index
    'player1',    // Row 5+: Player names and scores
    'player2',
    'player3',
    'player4',
  ],
  labelVariations: {
    hole: ['hole', 'holes', '#', 'no', 'no.'],
    yardage: ['yardage', 'yards', 'yds', 'distance', 'dist'],
    par: ['par'],
    handicap: ['handicap', 'hdcp', 'hcp', 'stroke', 'si', 'index', 'strokes'],
    totals: ['total', 'tot', 'out', 'in', 'sum', 'front', 'back', 'f9', 'b9'],
    ignore: ['out', 'in', 'total', 'tot', 'sum', 'front 9', 'back 9', 'front nine', 'back nine'],
  },
  validation: {
    holeCount: [9, 18],
    parRange: [3, 5],
    scoreRange: [1, 15],
    yardageRange: [100, 650],
  },
};

/**
 * Standard 9-hole golf scorecard layout
 */
export const STANDARD_9_HOLE_TEMPLATE: ScorecardTemplate = {
  rowOrder: [
    'hole',
    'yardage',
    'par',
    'handicap',
    'player1',
    'player2',
    'player3',
    'player4',
  ],
  labelVariations: {
    hole: ['hole', 'holes', '#', 'no', 'no.'],
    yardage: ['yardage', 'yards', 'yds', 'distance', 'dist'],
    par: ['par'],
    handicap: ['handicap', 'hdcp', 'hcp', 'stroke', 'si', 'index'],
    totals: ['total', 'tot', 'sum'],
    ignore: ['total', 'tot', 'sum'],
  },
  validation: {
    holeCount: [9],
    parRange: [3, 5],
    scoreRange: [1, 15],
    yardageRange: [100, 650],
  },
};

/**
 * Identifies which template to use based on detected holes
 */
export function detectTemplate(holeCount: number): ScorecardTemplate {
  if (holeCount === 9) {
    return STANDARD_9_HOLE_TEMPLATE;
  }
  return STANDARD_18_HOLE_TEMPLATE;
}

/**
 * Generates a detailed prompt for OCR based on the template
 */
export function generateTemplateGuidedPrompt(holeCount: number = 9): string {
  const template = detectTemplate(holeCount);
  
  return `You are analyzing a GOLF SCORECARD. Golf scorecards have a VERY STANDARD FORMAT.

STANDARD GOLF SCORECARD STRUCTURE (Top to Bottom):

Row 1: HOLE NUMBERS
- Labels: ${template.labelVariations.hole.join(', ')}
- Contains: Sequential numbers 1-${holeCount} ONLY
- Location: Usually first or second row
- Format: Small printed numbers in a row
- IGNORE: "Out", "In", "Total" columns (these are summaries, NOT holes)

CRITICAL: For ${holeCount}-hole scorecards:
${holeCount === 9 ? '- Extract holes 1-9 only' : '- Extract holes 1-18 only (may be split as Front 9: 1-9, Back 9: 10-18)'}
- "Out" column = Front 9 total (NOT hole 10)
- "In" column = Back 9 total (NOT hole 19) 
- "Total" column = Overall total (NOT a hole number)
- DO NOT treat summary columns as holes!

Row 2: YARDAGE (Distance)
- Labels: ${template.labelVariations.yardage.join(', ')}
- Contains: Numbers typically ${template.validation.yardageRange[0]}-${template.validation.yardageRange[1]} yards
- Format: Larger numbers, usually printed
- Example: 380, 425, 195, 502
- Ignore yardage totals in "Out/In/Total" columns

Row 3: PAR
- Labels: ${template.labelVariations.par.join(', ')}
- Contains: ONLY numbers 3, 4, or 5
- Format: Usually bold or highlighted
- Most common: 4 (par 4 holes)
- THIS IS THE MOST IMPORTANT ROW FOR CONTEXT

Row 4: HANDICAP/STROKE INDEX (optional)
- Labels: ${template.labelVariations.handicap.join(', ')}
- Contains: Numbers 1-18 (difficulty ranking)
- Format: Small numbers

Row 5+: PLAYER ROWS
- First column: PLAYER NAME (handwritten or printed)
- Following columns: SCORES for each hole (HANDWRITTEN)
- Score format: Numbers ${template.validation.scoreRange[0]}-${template.validation.scoreRange[1]}
- Scores are typically CLOSE TO PAR
  * Excellent: Par or below (3,4,5)
  * Good: 1-2 over par (5,6,7)
  * Average: 2-4 over par (6,7,8,9)
  * Rare: 5+ over par (10+)

CRITICAL HANDWRITING TIPS:
1. Compare each score to the PAR for that hole
   - If Par is 4, expect scores around 4-7 (rarely 10+)
   - If Par is 3, expect scores around 3-5
   - If Par is 5, expect scores around 5-8

2. Number recognition patterns:
   - "1": Single vertical stroke
   - "3": Two curves facing right
   - "4": Usually has crossing strokes
   - "5": Flat top, curved bottom
   - "6": Curve at bottom, sometimes has loop
   - "7": Horizontal top with diagonal down (often looks like "1")
   - "8": Two circles stacked or figure-8 shape
   - "9": Circle on top with tail (can look like "4")

3. Context is KING:
   - On a Par 3 hole, a score of "13" is VERY unlikely (would be "3" or "4")
   - On a Par 4 hole, a score of "14" is VERY unlikely (would be "4" or "7")
   - On a Par 5 hole, a score of "15" is VERY unlikely (would be "5" or "6")

4. Common OCR mistakes to avoid:
   - Mistaking "1" for "7" (look for the horizontal top on 7)
   - Mistaking "4" for "9" (4 is usually more angular, 9 has a curved top)
   - Mistaking "5" for "6" (5 has flatter top, 6 has no top curve)
   - Mistaking "3" for "8" (3 is open on left, 8 is closed loop)

EXTRACTION STRATEGY:
1. Find the HOLE NUMBER row first (look for 1,2,3,4...)
2. Find the PAR row (look for label "Par", values only 3,4,5)
3. Use PAR as context for identifying player scores
4. For each player row, verify scores make sense with par
5. If a score seems too high, re-examine the handwriting

Remember: Golf scores follow patterns. Use the PAR values as your guide!`;
}

/**
 * Validates extracted data against template rules
 */
export function validateAgainstTemplate(
  holes: { holeNumber: number; par: number; yardage?: number; handicap?: number }[],
  players: { name: string; scores: { holeNumber: number | string; score: number | null }[] }[]
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const template = detectTemplate(holes.length);

  // Validate hole count
  if (!template.validation.holeCount.includes(holes.length)) {
    warnings.push(`Unusual hole count: ${holes.length}. Expected ${template.validation.holeCount.join(' or ')}.`);
  }

  // Validate par values
  holes.forEach((hole) => {
    if (hole.par < template.validation.parRange[0] || hole.par > template.validation.parRange[1]) {
      warnings.push(`Hole ${hole.holeNumber}: Invalid par ${hole.par}. Expected ${template.validation.parRange[0]}-${template.validation.parRange[1]}.`);
    }
  });

  // Validate yardage values
  holes.forEach((hole) => {
    if (hole.yardage && (hole.yardage < template.validation.yardageRange[0] || hole.yardage > template.validation.yardageRange[1])) {
      warnings.push(`Hole ${hole.holeNumber}: Unusual yardage ${hole.yardage}. Expected ${template.validation.yardageRange[0]}-${template.validation.yardageRange[1]}.`);
    }
  });

  // Validate player scores
  players.forEach((player) => {
    player.scores.forEach((scoreEntry) => {
      if (scoreEntry.score === null) return;

      const hole = holes.find((h) => h.holeNumber === scoreEntry.holeNumber);
      if (!hole) return;

      // Check if score is in valid range
      if (scoreEntry.score < template.validation.scoreRange[0] || scoreEntry.score > template.validation.scoreRange[1]) {
        warnings.push(`${player.name} hole ${scoreEntry.holeNumber}: Unusual score ${scoreEntry.score}. Expected ${template.validation.scoreRange[0]}-${template.validation.scoreRange[1]}.`);
      }

      // Check if score is reasonable relative to par
      const differenceFromPar = scoreEntry.score - hole.par;
      if (differenceFromPar > 7) {
        warnings.push(`${player.name} hole ${scoreEntry.holeNumber}: Score ${scoreEntry.score} is ${differenceFromPar} over par ${hole.par}. This is very unusual - please verify.`);
      }
    });
  });

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Generates visual ASCII representation of expected scorecard structure
 */
export function getVisualTemplate(holeCount: number = 9): string {
  if (holeCount === 18) {
    return get18HoleVisualTemplate();
  }
  return get9HoleVisualTemplate();
}

/**
 * 9-hole scorecard visual template
 */
function get9HoleVisualTemplate(): string {
  const cols = Array.from({ length: 9 }, (_, i) => (i + 1).toString().padStart(3));
  
  return `
EXPECTED 9-HOLE GOLF SCORECARD LAYOUT:

┌──────────┬${cols.map(() => '───').join('┬')}┬───────┐
│   HOLE   │ ${cols.join(' │ ')} │ TOTAL │
├──────────┼${cols.map(() => '───').join('┼')}┼───────┤
│ YARDAGE  │ ### │ ### │ ### │ ### │ ### │ ### │ ### │ ### │ ### │       │
├──────────┼${cols.map(() => '───').join('┼')}┼───────┤
│   PAR    │  4  │  3  │  5  │  4  │  3  │  4  │  3  │  5  │  4  │   36  │
├──────────┼${cols.map(() => '───').join('┼')}┼───────┤
│ HANDICAP │  7  │ 15  │  3  │ 11  │ 17  │  5  │ 13  │  1  │  9  │       │
├──────────┼${cols.map(() => '───').join('┼')}┼───────┤
│ Player 1 │  5  │  4  │  6  │  5  │  4  │  5  │  3  │  7  │  5  │   42  │ ← HANDWRITTEN
├──────────┼${cols.map(() => '───').join('┼')}┼───────┤
│ Player 2 │  4  │  3  │  7  │  4  │  3  │  6  │  4  │  6  │  4  │   39  │ ← HANDWRITTEN
├──────────┼${cols.map(() => '───').join('┼')}┼───────┤
│ Player 3 │  6  │  4  │  5  │  6  │  5  │  5  │  4  │  6  │  7  │   44  │ ← HANDWRITTEN
└──────────┴${cols.map(() => '───').join('┴')}┴───────┘

KEY POINTS:
- Hole numbers are SEQUENTIAL (1-9)
- Par values are ONLY 3, 4, or 5
- Player scores are near par (typically within +0 to +4)
- Handwritten scores are in PLAYER ROWS ONLY
`;
}

/**
 * 18-hole scorecard visual template
 */
function get18HoleVisualTemplate(): string {
  const frontCols = Array.from({ length: 9 }, (_, i) => (i + 1).toString().padStart(2));
  const backCols = Array.from({ length: 9 }, (_, i) => (i + 10).toString().padStart(2));
  
  return `
EXPECTED 18-HOLE GOLF SCORECARD LAYOUT:

FRONT 9 (OUT):
┌──────────┬${frontCols.map(() => '──').join('┬')}┬─────┐
│   HOLE   │${frontCols.join('│')}│ OUT │
├──────────┼${frontCols.map(() => '──').join('┼')}┼─────┤
│ YARDAGE  │###│###│###│###│###│###│###│###│###│     │
├──────────┼${frontCols.map(() => '──').join('┼')}┼─────┤
│   PAR    │ 4 │ 4 │ 3 │ 5 │ 4 │ 3 │ 4 │ 5 │ 4 │ 36  │
├──────────┼${frontCols.map(() => '──').join('┼')}┼─────┤
│ Player 1 │ 5 │ 6 │ 4 │ 7 │ 5 │ 4 │ 5 │ 6 │ 5 │ 43  │ ← HANDWRITTEN
├──────────┼${frontCols.map(() => '──').join('┼')}┼─────┤
│ Player 2 │ 4 │ 4 │ 3 │ 6 │ 4 │ 3 │ 4 │ 7 │ 4 │ 39  │ ← HANDWRITTEN
└──────────┴${frontCols.map(() => '──').join('┴')}┴─────┘

BACK 9 (IN):
┌──────────┬${backCols.map(() => '──').join('┬')}┬─────┬──────┐
│   HOLE   │${backCols.join('│')}│ IN  │TOTAL │
├──────────┼${backCols.map(() => '──').join('┼')}┼─────┼──────┤
│ YARDAGE  │###│###│###│###│###│###│###│###│###│     │      │
├──────────┼${backCols.map(() => '──').join('┼')}┼─────┼──────┤
│   PAR    │ 4 │ 3 │ 5 │ 4 │ 4 │ 3 │ 5 │ 4 │ 4 │ 36  │  72  │
├──────────┼${backCols.map(() => '──').join('┼')}┼─────┼──────┤
│ Player 1 │ 5 │ 4 │ 6 │ 4 │ 5 │ 4 │ 7 │ 5 │ 5 │ 41  │  84  │ ← HANDWRITTEN
├──────────┼${backCols.map(() => '──').join('┼')}┼─────┼──────┤
│ Player 2 │ 4 │ 3 │ 7 │ 5 │ 4 │ 3 │ 6 │ 4 │ 4 │ 40  │  79  │ ← HANDWRITTEN
└──────────┴${backCols.map(() => '──').join('┴')}┴─────┴──────┘

KEY POINTS:
- 18-hole courses split into FRONT 9 (holes 1-9) and BACK 9 (holes 10-18)
- Hole numbers are SEQUENTIAL (1-18)
- Par values are ONLY 3, 4, or 5
- Typical total par: 70-72 for 18 holes
- Player scores are near par (typically within +0 to +4 per hole)
- Handwritten scores are in PLAYER ROWS ONLY
`;
}
