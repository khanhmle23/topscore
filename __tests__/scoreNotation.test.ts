/**
 * Unit tests for score notation detection and conversion
 */

import { 
  isRelativeToParNotation, 
  parseScoreToGross, 
  detectNotationStyle,
  formatScore 
} from '@/lib/scoreNotation';

describe('Score Notation', () => {
  describe('isRelativeToParNotation', () => {
    it('should detect explicit relative notation', () => {
      expect(isRelativeToParNotation('+1')).toBe(true);
      expect(isRelativeToParNotation('-1')).toBe(true);
      expect(isRelativeToParNotation('+2')).toBe(true);
      expect(isRelativeToParNotation('-2')).toBe(true);
    });

    it('should detect even par notation', () => {
      expect(isRelativeToParNotation('E')).toBe(true);
      expect(isRelativeToParNotation('e')).toBe(true);
      expect(isRelativeToParNotation('0')).toBe(true);
    });

    it('should reject gross strokes', () => {
      expect(isRelativeToParNotation('4')).toBe(false);
      expect(isRelativeToParNotation('5')).toBe(false);
      expect(isRelativeToParNotation('10')).toBe(false);
    });
  });

  describe('parseScoreToGross', () => {
    it('should convert relative notation to gross strokes', () => {
      expect(parseScoreToGross('+1', 4)).toBe(5);  // 1 over par 4
      expect(parseScoreToGross('-1', 4)).toBe(3);  // 1 under par 4
      expect(parseScoreToGross('0', 4)).toBe(4);   // Even par
      expect(parseScoreToGross('E', 4)).toBe(4);   // Even par
      expect(parseScoreToGross('+2', 5)).toBe(7);  // 2 over par 5
      expect(parseScoreToGross('-2', 5)).toBe(3);  // 2 under par 5
    });

    it('should pass through gross strokes unchanged', () => {
      expect(parseScoreToGross('4', 4)).toBe(4);
      expect(parseScoreToGross('5', 4)).toBe(5);
      expect(parseScoreToGross('3', 4)).toBe(3);
      expect(parseScoreToGross('10', 5)).toBe(10);
    });

    it('should handle null and invalid values', () => {
      expect(parseScoreToGross(null, 4)).toBe(null);
      expect(parseScoreToGross('', 4)).toBe(null);
      expect(parseScoreToGross('-', 4)).toBe(null);
    });

    it('should reject unreasonable scores', () => {
      expect(parseScoreToGross('0', 4)).toBe(4);   // 0 is even par, not 0 strokes
      expect(parseScoreToGross('25', 4)).toBe(null); // Too high
    });
  });

  describe('detectNotationStyle', () => {
    it('should detect relative notation from explicit signs', () => {
      const scores = ['1', '1', '-1', '0', '1'];
      expect(detectNotationStyle(scores)).toBe('relative');
    });

    it('should detect relative notation from all small numbers', () => {
      const scores = ['1', '0', '2', '1', '0', '1'];
      expect(detectNotationStyle(scores)).toBe('relative');
    });

    it('should detect gross notation from typical golf scores', () => {
      const scores = ['5', '4', '6', '5', '4', '7'];
      expect(detectNotationStyle(scores)).toBe('gross');
    });

    it('should handle mixed scores correctly', () => {
      // If we see ANY explicit relative notation, treat all as relative
      const scores = ['1', '4', '-1', '5'];
      expect(detectNotationStyle(scores)).toBe('relative');
    });
  });

  describe('formatScore', () => {
    it('should format as gross strokes', () => {
      expect(formatScore(5, 4, 'gross')).toBe('5');
      expect(formatScore(4, 4, 'gross')).toBe('4');
      expect(formatScore(3, 4, 'gross')).toBe('3');
    });

    it('should format as relative to par', () => {
      expect(formatScore(5, 4, 'relative')).toBe('+1');
      expect(formatScore(4, 4, 'relative')).toBe('E');
      expect(formatScore(3, 4, 'relative')).toBe('-1');
      expect(formatScore(6, 4, 'relative')).toBe('+2');
      expect(formatScore(2, 4, 'relative')).toBe('-2');
    });

    it('should handle null scores', () => {
      expect(formatScore(null, 4, 'gross')).toBe('-');
      expect(formatScore(null, 4, 'relative')).toBe('-');
    });
  });
});
