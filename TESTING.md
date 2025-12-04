# Testing Guide

This document outlines the testing strategy for TopScore Golf to prevent regressions and maintain code quality.

## Testing Strategy

### 1. **Unit Tests**
Test individual functions in isolation:
- Score notation detection and conversion (`lib/scoreNotation.ts`)
- Par value validation
- Player name filtering
- Score validation logic

**Location**: `__tests__/*.test.ts`

### 2. **Integration Tests**
Test end-to-end OCR flows with real scorecard images:
- Upload → Textract → Vision → Cleanup → Response
- Validate against known-good results
- Catch regressions in notation handling, par detection, player extraction

**Location**: `__tests__/integration/*.test.ts`

### 3. **Regression Test Images**
Maintain a library of test scorecards covering edge cases:

```
test-images/
├── IMG_5635.jpg          # Obstructed, relative notation, par in middle
├── standard-18-hole.jpg  # Clean 18-hole scorecard
├── standard-9-hole.jpg   # Clean 9-hole scorecard
├── gross-notation.jpg    # Scorecard using gross strokes (4, 5, 6)
└── handwritten-messy.jpg # Difficult handwriting
```

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- scoreNotation.test.ts

# Run integration tests only
npm test -- integration/

# Watch mode for development
npm test -- --watch
```

## Setting Up Jest

To run these tests, install Jest:

```bash
npm install --save-dev jest @types/jest ts-jest @testing-library/jest-dom
```

Create `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  collectCoverageFrom: [
    'lib/**/*.ts',
    '!lib/**/*.d.ts'
  ]
};
```

Add to `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

## Pre-commit Hooks

Use Husky to run tests before commits:

```bash
npm install --save-dev husky
npx husky init
echo "npm test" > .husky/pre-commit
```

## Continuous Integration

Add GitHub Actions workflow (`.github/workflows/test.yml`):

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
```

## Test Coverage Goals

- **Critical paths**: 90%+ coverage
  - Score notation conversion
  - Par detection fallback logic
  - Player extraction and filtering
- **Integration tests**: Cover all known edge cases
- **Regression tests**: Add test for every bug fix

## Adding New Tests

When adding a new feature or fixing a bug:

1. **Write the test first** (TDD approach)
2. **Add a regression test** if fixing a bug
3. **Update test images** if handling new scorecard layouts
4. **Document edge cases** in test descriptions

Example:

```typescript
it('should handle players appearing before par row', () => {
  // Regression test for IMG_5635.jpg issue
  const result = parseTableToScorecard(testTable);
  expect(result.players).toHaveLength(3);
  expect(result.players.map(p => p.name)).not.toContain('PAR');
});
```

## Manual Testing Checklist

Before each release, manually test:

- [ ] Upload IMG_5635.jpg → verify 3 players, correct scores
- [ ] Upload standard 18-hole → verify all 18 holes detected
- [ ] Upload gross notation scorecard → verify no conversion applied
- [ ] Upload relative notation scorecard → verify conversions correct
- [ ] Check cleanup removes RED/GREEN/BLUE tee boxes
- [ ] Verify Vision gap-filling uses correct notation
- [ ] Test with obstructed/partial scorecards

## Monitoring & Alerting

Track OCR accuracy in production:
- Log confidence scores for each extraction
- Alert if confidence drops below 80%
- Track Vision API fallback rate (should be <30%)

## Rollback Strategy

If a regression is detected:

1. **Immediate**: Revert the problematic commit
2. **Add regression test** for the issue
3. **Fix forward** with test coverage
4. **Deploy** after all tests pass
