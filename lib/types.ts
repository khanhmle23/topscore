/**
 * Type definitions for the golf scorecard application
 */

// Hole information extracted from the scorecard
export interface HoleInfo {
  holeNumber: number;
  par: number;
  yardage?: number;
  handicap?: number;
}

// Individual player's score for a specific hole
export interface PlayerHoleScore {
  holeNumber: number;
  score: number | null; // null if not played yet
  confidence?: 'high' | 'medium' | 'low'; // OCR confidence level
  source?: 'textract' | 'vision' | 'manual'; // Where the score came from
}

// Player information with their scores
export interface PlayerInfo {
  name: string;
  scores: PlayerHoleScore[];
  frontNine?: number;  // Out - total for holes 1-9 (auto-calculated)
  backNine?: number;   // In - total for holes 10-18 (auto-calculated)
  total?: number;      // Total - sum of all holes (auto-calculated)
}

// Complete extracted scorecard data from OpenAI Vision
export interface ExtractedScorecard {
  courseName: string;
  teeName?: string;
  date?: string;
  holes: HoleInfo[];
  players: PlayerInfo[];
  notationStyle?: 'gross' | 'relative'; // Score notation style detected from the scorecard
}

// Relation to par for a single hole
export type RelationToPar = 'eagle' | 'birdie' | 'par' | 'bogey' | 'double-bogey' | 'triple-bogey+' | null;

// Derived scoring analysis for a hole
export interface HoleDerived {
  holeNumber: number;
  par: number;
  playerResults: {
    playerName: string;
    score: number | null;
    relationToPar: RelationToPar;
  }[];
}

// Player's overall derived statistics
export interface PlayerDerived {
  name: string;
  totalScore: number;
  totalPar: number;
  scoreToPar: number; // positive = over par, negative = under par
  birdies: number;
  pars: number;
  bogeys: number;
  doubleBogeys: number;
  eagles: number;
  tripleBogeyPlus: number;
}

// Complete derived scoring data
export interface DerivedScoring {
  holes: HoleDerived[];
  players: PlayerDerived[];
}

// API response from /api/scorecards
export interface ScorecardAnalysisResponse {
  extracted: ExtractedScorecard;
  derived: DerivedScoring;
}

// API request to /api/assistant
export interface AssistantRequest {
  scorecard: ExtractedScorecard;
  derived: DerivedScoring;
  message: string;
}

// API response from /api/assistant
export interface AssistantResponse {
  reply: string;
}
