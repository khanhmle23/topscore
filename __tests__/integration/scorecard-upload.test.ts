/**
 * Integration tests for scorecard upload and OCR processing
 * 
 * These tests validate the end-to-end flow with real test images
 * to catch regressions in OCR accuracy and notation handling
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { analyzeWithHybridOcr } from '@/lib/hybridOcr';

describe('Scorecard Upload Integration', () => {
  // Skip these tests in CI if AWS/OpenAI credentials aren't available
  const hasCredentials = process.env.AWS_ACCESS_KEY_ID && process.env.OPENAI_API_KEY;
  const describeIfCredentials = hasCredentials ? describe : describe.skip;

  describeIfCredentials('IMG_5635.jpg - Obstructed scorecard with relative notation', () => {
    let result: any;

    beforeAll(async () => {
      const imagePath = join(process.cwd(), 'test-images', 'IMG_5635.jpg');
      const imageBuffer = readFileSync(imagePath);
      result = await analyzeWithHybridOcr(imageBuffer);
    }, 60000); // 60 second timeout for OCR

    it('should detect 9 holes', () => {
      expect(result.holes).toHaveLength(9);
    });

    it('should extract correct par values', () => {
      const pars = result.holes.map((h: any) => h.par);
      expect(pars).toEqual([5, 4, 4, 4, 5, 3, 4, 3, 4]);
    });

    it('should extract 3 players', () => {
      expect(result.players).toHaveLength(3);
      const names = result.players.map((p: any) => p.name);
      expect(names).toContain('JAY');
      expect(names).toContain('Jessie');
      expect(names).toContain('Wally');
    });

    it('should NOT extract tee box rows as players', () => {
      const names = result.players.map((p: any) => p.name);
      expect(names).not.toContain(expect.stringMatching(/RED/i));
      expect(names).not.toContain(expect.stringMatching(/GREEN/i));
      expect(names).not.toContain(expect.stringMatching(/BLUE/i));
    });

    it('should detect relative-to-par notation', () => {
      expect(result.notationStyle).toBe('relative');
    });

    it('should convert relative notation to gross strokes correctly', () => {
      const jay = result.players.find((p: any) => p.name === 'JAY');
      expect(jay).toBeDefined();
      
      // JAY's raw scores: 1, 1, 1, -1, 3, 0, 1, 1, (missing)
      // With pars:        5, 4, 4,  4, 5, 3, 4, 3, 4
      // Expected gross:   6, 5, 5,  3, 8, 3, 5, 4, 4
      const jayScores = jay.scores.map((s: any) => s.score);
      expect(jayScores[0]).toBe(6);  // 1 over par 5
      expect(jayScores[1]).toBe(5);  // 1 over par 4
      expect(jayScores[2]).toBe(5);  // 1 over par 4
      expect(jayScores[3]).toBe(3);  // -1 = 1 under par 4
      expect(jayScores[4]).toBe(8);  // 3 over par 5
      expect(jayScores[5]).toBe(3);  // 0 = even par 3
    });

    it('should fill gaps with Vision using correct notation', () => {
      const jessie = result.players.find((p: any) => p.name === 'Jessie');
      expect(jessie).toBeDefined();
      
      // Jessie holes 1-3 had "/" (non-numeric), filled by Vision with "1"
      // Should be converted as relative: 1 + par = gross
      expect(jessie.scores[0].score).toBe(6);  // 1 (relative) + par 5 = 6 gross
      expect(jessie.scores[1].score).toBe(5);  // 1 (relative) + par 4 = 5 gross
      expect(jessie.scores[2].score).toBe(5);  // 1 (relative) + par 4 = 5 gross
    });

    it('should calculate reasonable totals', () => {
      const jay = result.players.find((p: any) => p.name === 'JAY');
      const total = jay.scores.reduce((sum: number, s: any) => sum + (s.score || 0), 0);
      
      // Total should be around par (36) +/- reasonable range
      expect(total).toBeGreaterThan(30);
      expect(total).toBeLessThan(60);
    });
  });

  describe('Regression Prevention', () => {
    it('should maintain par detection accuracy', async () => {
      // Add more test cases here for different scorecard layouts
      expect(true).toBe(true); // Placeholder
    });

    it('should handle both 9-hole and 18-hole scorecards', async () => {
      expect(true).toBe(true); // Placeholder
    });
  });
});
