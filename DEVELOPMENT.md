# Development Guidelines

## Code Organization Principles

### 1. **Single Responsibility**
Each module should have ONE clear purpose:
- `scoreNotation.ts` → ONLY score notation logic
- `textractOcr.ts` → ONLY Textract extraction
- `hybridOcr.ts` → ONLY orchestration between Textract and Vision

### 2. **Data Flow**
Always maintain clear data flow direction:
```
Upload → Textract → Hybrid → Cleanup → Scoring → Response
```

**Never skip steps or create shortcuts that bypass validation**

### 3. **Immutability**
Prefer immutable operations:
```typescript
// ✅ Good: Create new object
const enhanced = { ...structure, notationStyle: 'relative' };

// ❌ Bad: Mutate original
structure.notationStyle = 'relative';
```

### 4. **Explicit Over Implicit**
Make important decisions explicit:
```typescript
// ✅ Good: Explicit notation detection
return {
  ...scorecard,
  notationStyle: scorecardNotation  // Explicitly pass detected style
};

// ❌ Bad: Implicit re-detection
// (Hybrid OCR tries to detect again from already-converted scores)
```

## Making Changes Safely

### Before Changing Code

1. **Understand the full context**:
   - What calls this function?
   - What does it return?
   - Where is the return value used?

2. **Check for side effects**:
   ```bash
   # Find all usages of a function
   git grep "functionName"
   ```

3. **Read related code**:
   - If changing `textractOcr.ts`, review `hybridOcr.ts`
   - If changing types, review all files importing them

### While Changing Code

1. **Make small, focused changes**
   - One logical change per commit
   - Don't refactor while adding features

2. **Update types immediately**
   - Changed function signature? Update TypeScript types
   - New field? Add to interface
   - TypeScript errors = compile-time safety

3. **Add logging for debugging**:
   ```typescript
   console.log('[Module Name] Action: detail');
   ```
   - Use consistent prefixes: `[Textract]`, `[Hybrid OCR]`, `[Cleanup]`
   - Log inputs, outputs, and key decisions

### After Changing Code

1. **Test the happy path**
   - Upload IMG_5635.jpg
   - Verify all 3 players extracted
   - Check scores converted correctly

2. **Test edge cases**
   - What if notation is ambiguous?
   - What if no players found?
   - What if all scores are null?

3. **Check for unintended effects**:
   ```bash
   # Look for console errors
   npm run dev
   # Upload multiple test images
   # Check browser console for errors
   ```

## Common Pitfalls

### ❌ Pitfall 1: Detecting notation from converted scores
```typescript
// WRONG: Textract already converted "1" → 6
const scores = player.scores.map(s => s.score); // [6, 5, 5, 3...]
detectNotationStyle(scores); // Will detect "gross" not "relative"!
```

**Solution**: Pass notation style explicitly from Textract to Hybrid OCR

### ❌ Pitfall 2: Filtering players too early
```typescript
// WRONG: Filter before collecting all data
if (playerName.includes('RED')) continue;
// Later: try to detect notation from incomplete data
```

**Solution**: Collect ALL data first, then filter in cleanup phase

### ❌ Pitfall 3: Per-player notation detection
```typescript
// WRONG: One person fills the scorecard!
players.forEach(player => {
  const notation = detectNotation(player.scores);
});
```

**Solution**: Detect once at scorecard level

### ❌ Pitfall 4: Not handling null values
```typescript
// WRONG: Will crash if score is null
const total = scores.reduce((sum, s) => sum + s.score, 0);
```

**Solution**: Always handle null
```typescript
const total = scores.reduce((sum, s) => sum + (s.score || 0), 0);
```

## File Modification Impact Matrix

| File Modified | Likely to Affect | Test Priority |
|--------------|------------------|---------------|
| `scoreNotation.ts` | All score conversions | HIGH - Run all tests |
| `textractOcr.ts` | Primary extraction path | HIGH - Test with real images |
| `hybridOcr.ts` | Gap filling, Vision integration | MEDIUM - Test with missing data |
| `cleanupOcr.ts` | Final validation, filtering | MEDIUM - Check edge cases |
| `types.ts` | Everything (TypeScript will catch most) | LOW - Compiler checks |
| `golfScoring.ts` | Derived stats only | LOW - Doesn't affect extraction |

## When to Add New Features

### Planning Phase
1. **Document the requirement**
   - What problem does it solve?
   - What are the edge cases?
   - What could break?

2. **Design the solution**
   - Where does it fit in the data flow?
   - What new types are needed?
   - Can existing code be reused?

3. **Write tests first**
   - What's the happy path?
   - What are the edge cases?
   - How will you verify it works?

### Implementation Phase
1. **Add types first**
2. **Implement core logic**
3. **Add logging**
4. **Write tests**
5. **Test manually**
6. **Document changes**

### Example: Adding Support for Match Play Scoring

1. **Types** (`types.ts`):
```typescript
export type ScoringFormat = 'stroke-play' | 'match-play' | 'stableford';

export interface ExtractedScorecard {
  // ... existing fields
  scoringFormat?: ScoringFormat;
}
```

2. **Detection** (new `scoringFormat.ts`):
```typescript
export function detectScoringFormat(scorecard: ExtractedScorecard): ScoringFormat {
  // Logic here
}
```

3. **Tests** (`__tests__/scoringFormat.test.ts`):
```typescript
describe('Scoring Format Detection', () => {
  it('should detect match play from score patterns', () => {
    // Test implementation
  });
});
```

4. **Integration** (update `hybridOcr.ts`):
```typescript
const format = detectScoringFormat(extracted);
return { ...extracted, scoringFormat: format };
```

## Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/match-play-support

# 2. Make small commits
git add types.ts
git commit -m "Add ScoringFormat type"

git add lib/scoringFormat.ts
git commit -m "Add scoring format detection"

git add __tests__/scoringFormat.test.ts
git commit -m "Add tests for scoring format detection"

# 3. Test thoroughly
npm test
npm run dev # Manual testing

# 4. Merge when all tests pass
git checkout main
git merge feature/match-play-support
```

## Code Review Checklist

Before merging:
- [ ] All tests pass
- [ ] TypeScript compiles with no errors
- [ ] Added tests for new functionality
- [ ] Manual testing completed
- [ ] Logging added for debugging
- [ ] Documentation updated
- [ ] No console.errors in browser
- [ ] IMG_5635.jpg still works correctly (regression check)

## Resources

- **TypeScript**: Catch errors at compile time
- **Console logging**: Debug production issues
- **Git history**: Understand why changes were made
- **Test images**: Real-world validation
- **This guide**: Reference before making changes
