/**
 * AWS Textract OCR integration for golf scorecard text extraction
 * 
 * This module uses AWS Textract to extract text and table data from scorecard images.
 * Textract is specifically designed for document analysis and provides better accuracy
 * than general-purpose vision models for structured documents like scorecards.
 */

import {
  TextractClient,
  AnalyzeDocumentCommand,
  Block,
  Relationship,
} from '@aws-sdk/client-textract';
import type { ExtractedScorecard } from './types';
import { parseScoreToGross, detectNotationStyle } from './scoreNotation';

/**
 * Analyzes a golf scorecard image using AWS Textract
 * 
 * @param imageBuffer - The image file as a Buffer
 * @returns Structured scorecard data extracted from the image
 */
export async function analyzeWithTextract(imageBuffer: Buffer): Promise<ExtractedScorecard> {
  console.log('[Textract] Starting scorecard OCR analysis...');

  const client = new TextractClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });

  try {
    const command = new AnalyzeDocumentCommand({
      Document: {
        Bytes: imageBuffer,
      },
      FeatureTypes: ['TABLES', 'FORMS'],
    });

    const response = await client.send(command);
    
    if (!response.Blocks || response.Blocks.length === 0) {
      throw new Error('No data extracted from image');
    }

    console.log('[Textract] Extracted blocks:', response.Blocks.length);

    // Parse the Textract response into scorecard structure
    const scorecard = parseTextractResponse(response.Blocks);
    
    console.log('[Textract] Successfully parsed scorecard:', {
      course: scorecard.courseName,
      holes: scorecard.holes.length,
      players: scorecard.players.length,
    });

    return scorecard;
  } catch (error) {
    console.error('[Textract] Error analyzing scorecard:', error);
    
    if (error instanceof Error) {
      throw new Error(`Textract analysis failed: ${error.message}`);
    }
    
    throw new Error('Textract analysis failed');
  }
}

/**
 * Parses Textract blocks into structured scorecard data
 */
function parseTextractResponse(blocks: Block[]): ExtractedScorecard {
  // Extract all text from LINE blocks for metadata
  const lines = blocks
    .filter(block => block.BlockType === 'LINE' && block.Text)
    .map(block => block.Text!);

  // Extract tables
  const tables = extractTables(blocks);
  
  console.log('[Textract] Found tables:', tables.length);
  console.log('[Textract] Found text lines:', lines.length);

  // Find the main scorecard table (usually the largest one)
  const mainTable = tables.length > 0 
    ? tables.reduce((largest, current) => 
        current.rows.length > largest.rows.length ? current : largest
      )
    : null;

  if (!mainTable || mainTable.rows.length === 0) {
    throw new Error('Could not find scorecard table in image');
  }

  console.log('[Textract] Main table dimensions:', {
    rows: mainTable.rows.length,
    columns: mainTable.rows[0]?.length || 0,
  });

  // Parse the table into scorecard structure
  return parseTableToScorecard(mainTable, lines);
}

interface Table {
  rows: string[][];
}

/**
 * Extracts table structures from Textract blocks
 */
function extractTables(blocks: Block[]): Table[] {
  const tables: Table[] = [];
  const blockMap = new Map<string, Block>();
  
  // Create a map of all blocks by ID
  blocks.forEach(block => {
    if (block.Id) {
      blockMap.set(block.Id, block);
    }
  });

  // Find all TABLE blocks
  const tableBlocks = blocks.filter(block => block.BlockType === 'TABLE');

  tableBlocks.forEach(tableBlock => {
    if (!tableBlock.Relationships) return;

    // Get all CELL blocks
    const cellRelationship = tableBlock.Relationships.find(
      (rel: Relationship) => rel.Type === 'CHILD'
    );
    
    if (!cellRelationship?.Ids) return;

    const cells = cellRelationship.Ids
      .map((id: string) => blockMap.get(id))
      .filter((block): block is Block => block !== undefined && block.BlockType === 'CELL');

    // Build table grid
    const tableGrid: Map<string, string> = new Map();
    let maxRow = 0;
    let maxCol = 0;

    cells.forEach((cell: Block) => {
      if (!cell) return;
      
      const row = cell.RowIndex || 0;
      const col = cell.ColumnIndex || 0;
      
      maxRow = Math.max(maxRow, row);
      maxCol = Math.max(maxCol, col);

      // Get cell text from CHILD relationships
      let cellText = '';
      if (cell.Relationships) {
        const childRel = cell.Relationships.find((rel: Relationship) => rel.Type === 'CHILD');
        if (childRel?.Ids) {
          const words = childRel.Ids
            .map((id: string) => blockMap.get(id))
            .filter((block): block is Block => block !== undefined && block.BlockType === 'WORD')
            .map((block: Block) => block.Text || '');
          cellText = words.join(' ').trim();
        }
      }

      tableGrid.set(`${row}-${col}`, cellText);
    });

    // Convert grid to 2D array
    const rows: string[][] = [];
    for (let r = 1; r <= maxRow; r++) {
      const row: string[] = [];
      for (let c = 1; c <= maxCol; c++) {
        row.push(tableGrid.get(`${r}-${c}`) || '');
      }
      rows.push(row);
    }

    if (rows.length > 0) {
      tables.push({ rows });
    }
  });

  return tables;
}

/**
 * Parses a table structure into scorecard format
 */
function parseTableToScorecard(table: Table, metadataLines: string[]): ExtractedScorecard {
  const rows = table.rows;
  
  // Try to find course name from metadata lines
  let courseName = metadataLines.find(line => 
    line.toLowerCase().includes('golf') || 
    line.toLowerCase().includes('course') ||
    line.toLowerCase().includes('club')
  ) || null;

  // PRODUCTION READY: Use par row as anchor when hole numbers aren't in expected location
  // This handles cases like: obstructed top of scorecard, cropped images, non-standard layouts
  
  let holeRowIndex = -1;
  let holeColumns: number[] = [];
  let parRowIndex = -1;
  
  // STEP 1: Try to find hole numbers in first 5 rows (standard case)
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i];
    const potentialHoles: { value: number; idx: number }[] = [];
    
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cell = row[colIdx].trim().toLowerCase();
      
      // Skip columns that look like summary columns or player initials
      if (cell === 'out' || cell === 'in' || cell === 'total' || 
          cell === 'front 9' || cell === 'back 9' || cell === 'front' || cell === 'back' ||
          cell === 'player' || cell === 'players' || cell === 'name' || cell === 'initials') {
        continue;
      }
      
      // Skip columns with only letters (likely player initials column)
      if (/^[a-z]{1,3}$/i.test(cell)) {
        console.log(`[Textract] Skipping potential initials column: "${cell}"`);
        continue;
      }
      
      const value = parseInt(cell);
      if (!isNaN(value) && value >= 1 && value <= 18) {
        potentialHoles.push({ value, idx: colIdx });
      }
    }
    
    // Check if this looks like hole numbers (sequential starting from 1)
    // Allow 8-9 holes (front 9 with possible truncation) or 17-18 holes (full round)
    if (((potentialHoles.length >= 8 && potentialHoles.length <= 9) || 
         (potentialHoles.length >= 17 && potentialHoles.length <= 18)) && 
        potentialHoles[0].value === 1) {
      const isSequential = potentialHoles.every((hole, idx) => hole.value === idx + 1);
      if (isSequential) {
        holeRowIndex = i;
        holeColumns = potentialHoles.map(h => h.idx);
        console.log('[Textract] Found holes row at index:', holeRowIndex);
        
        // Verify no extra columns between holes 9 and 10 for 18-hole courses
        if (potentialHoles.length === 18) {
          const hole9ColIdx = potentialHoles[8].idx;
          const hole10ColIdx = potentialHoles[9].idx;
          const colDiff = hole10ColIdx - hole9ColIdx;
          
          if (colDiff > 1) {
            console.log(`[Textract] WARNING: Gap detected between hole 9 (col ${hole9ColIdx}) and hole 10 (col ${hole10ColIdx})`);
            console.log(`[Textract] Columns between: ${row.slice(hole9ColIdx + 1, hole10ColIdx).join(', ')}`);
          }
        }
        break;
      }
    }
  }

  // STEP 2: If hole numbers not found, search for par row as anchor
  if (holeRowIndex === -1) {
    console.log('[Textract] Hole numbers not in first 5 rows, searching for par row as anchor...');
    console.log('[Textract] Table has', rows.length, 'rows');
    
    // Search entire table for par row (up to 15 rows)
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      // Check first 3 columns for par label (some scorecards have empty first column)
      let foundParLabel = false;
      let parLabelCol = -1;
      
      for (let col = 0; col < Math.min(3, rows[i].length); col++) {
        const label = rows[i][col]?.toLowerCase() || '';
        if (label.includes('par') || /men['s]*\s*par/i.test(label)) {
          foundParLabel = true;
          parLabelCol = col;
          break;
        }
      }
      
      const firstLabel = rows[i][0] || '';
      console.log(`[Textract] Row ${i} first columns: [${rows[i].slice(0, 3).map(c => `"${c}"`).join(', ')}] (full row:`, rows[i].slice(0, 10), ')');
      
      if (foundParLabel) {
        console.log(`[Textract] Found par label at row ${i}, column ${parLabelCol}`);
        console.log(`[Textract] Full par row:`, rows[i]);
        
        // Analyze this row to find par values (3, 4, or 5)
        // Start from the column after the par label
        const potentialParColumns: { colIdx: number }[] = [];
        for (let colIdx = parLabelCol + 1; colIdx < rows[i].length; colIdx++) {
          const cell = rows[i][colIdx]?.trim() || '';
          const value = parseInt(cell);
          if (!isNaN(value) && value >= 3 && value <= 5) {
            potentialParColumns.push({ colIdx });
            console.log(`[Textract]   Found par ${value} at column ${colIdx}`);
          }
        }
        
        console.log(`[Textract] Found ${potentialParColumns.length} par values in this row`);
        
        // If we found 8-9 or 17-18 par values, use these columns as hole columns
        // Allow 8 for cases where Textract truncates the last column
        if ((potentialParColumns.length >= 8 && potentialParColumns.length <= 9) || 
            (potentialParColumns.length >= 17 && potentialParColumns.length <= 18)) {
          parRowIndex = i;
          holeColumns = potentialParColumns.map(p => p.colIdx);
          console.log(`[Textract] ✓ Inferred ${holeColumns.length} holes from par row at index ${i}`);
          console.log('[Textract] Hole columns:', holeColumns);
          break;
        } else {
          console.log(`[Textract] Par row has ${potentialParColumns.length} values, need 8-9 or 17-18. Continuing search...`);
        }
      }
    }
  }

  if (holeColumns.length === 0) {
    throw new Error('Could not identify hole numbers or par row in scorecard table');
  }

  console.log('[Textract] Hole columns:', holeColumns);
  if (holeRowIndex !== -1) {
    console.log('[Textract] Full holes row:', rows[holeRowIndex]);
  }

  // STEP 3: Find or refine par row location
  // If we already found it in Step 2, skip this; otherwise search around hole row
  if (parRowIndex === -1 && holeRowIndex !== -1) {
    console.log('[Textract] Searching for par row around hole numbers row...');
    
    // Debug: print rows around hole row
    for (let i = Math.max(0, holeRowIndex - 2); i < Math.min(holeRowIndex + 8, rows.length); i++) {
      const label = rows[i][0] || '';
      console.log(`[Textract]   Row ${i} label: "${label}" - Full row:`, rows[i].slice(0, 10));
    }
    
    // Check row BEFORE hole numbers
    if (holeRowIndex > 0) {
      const labelBefore = rows[holeRowIndex - 1][0]?.toLowerCase() || '';
      if (labelBefore.includes('par') || /men['s]*\s*par/i.test(labelBefore)) {
        parRowIndex = holeRowIndex - 1;
        console.log('[Textract] Found par row BEFORE holes at index:', parRowIndex);
      }
    }
    
    // Check rows AFTER hole numbers
    if (parRowIndex === -1) {
      for (let r = holeRowIndex + 1; r < Math.min(holeRowIndex + 8, rows.length); r++) {
        const label = rows[r][0]?.toLowerCase() || '';
        if (label.includes('par') || /men['s]*\s*par/i.test(label)) {
          parRowIndex = r;
          console.log('[Textract] Found par row AFTER holes at index:', parRowIndex);
          break;
        }
      }
    }
  }
  
  if (parRowIndex !== -1) {
    console.log('[Textract] Par row content:', rows[parRowIndex]);
  } else {
    console.log('[Textract] WARNING: No par row found in table');
  }

  // Build holes array with actual par values
  const holes = holeColumns.map((colIdx, idx) => {
    const holeNumber = idx + 1;
    
    // If we have a hole numbers row, log it
    if (holeRowIndex !== -1) {
      const cellValue = rows[holeRowIndex][colIdx];
      console.log(`[Textract] Hole ${holeNumber} at column ${colIdx}: "${cellValue}"`);
    } else {
      console.log(`[Textract] Hole ${holeNumber} at column ${colIdx} (inferred from par row)`);
    }
    
    // Get par value from par row
    let par = 4; // default fallback
    if (parRowIndex !== -1) {
      const parCell = rows[parRowIndex][colIdx]?.trim() || '';
      const parValue = parseInt(parCell);
      if (!isNaN(parValue) && parValue >= 3 && parValue <= 5) {
        par = parValue;
        console.log(`[Textract]   Par for hole ${holeNumber}: ${par}`);
      } else {
        console.log(`[Textract]   WARNING: Invalid par value "${parCell}" for hole ${holeNumber}, using default 4`);
      }
    } else {
      console.log(`[Textract]   WARNING: No par row found, using default par 4 for hole ${holeNumber}`);
    }

    return {
      holeNumber,
      par,
      yardage: undefined,
      handicap: undefined,
    };
  });

  // Find player rows (rows with names and scores)
  // Determine where to start looking for player rows
  let startPlayerRow = 0;
  
  if (holeRowIndex !== -1) {
    // Standard case: start after hole numbers row
    startPlayerRow = holeRowIndex + 1;
    // Skip metadata rows (par, handicap, yardage)
    for (let r = holeRowIndex + 1; r < Math.min(holeRowIndex + 5, rows.length); r++) {
      const label = rows[r][0]?.toLowerCase() || '';
      if (label.includes('par') || label.includes('hdcp') || label.includes('yardage')) {
        startPlayerRow = r + 1;
      }
    }
  } else if (parRowIndex !== -1) {
    // Fallback case: we inferred from par row, look before and after
    // Players could be before OR after the par row
    // First, check rows BEFORE par row
    for (let r = 0; r < parRowIndex; r++) {
      // Check column 0 or 1 for player name
      const name0 = rows[r][0]?.trim() || '';
      const name1 = rows[r][1]?.trim() || '';
      const potentialName = name1 || name0;
      
      // Skip metadata rows
      if (!potentialName || potentialName.length === 0) continue;
      if (potentialName.toLowerCase().includes('hole')) continue;
      if (potentialName.toLowerCase().includes('hdcp')) continue;
      if (potentialName.toLowerCase().includes('yardage')) continue;
      if (/^(black|blue|white|red|green|gold|combo)\s+m:/i.test(potentialName)) continue;
      
      // This looks like it could be a player row - we'll check it
    }
    // Start from beginning and we'll filter properly below
    startPlayerRow = 0;
  }

  console.log(`[Textract] Looking for player rows starting from row ${startPlayerRow}`);

  // STEP 1: Collect ALL raw scores from ALL players to detect scorecard-wide notation
  const allRawScores: (string | null)[] = [];
  const playerData: Array<{
    name: string;
    row: number;
    col: number;
    rawScores: (string | null)[];
  }> = [];

  for (let r = startPlayerRow; r < rows.length; r++) {
    // Check both column 0 and column 1 for player name (some scorecards vary)
    const name0 = rows[r][0]?.trim() || '';
    const name1 = rows[r][1]?.trim() || '';
    
    // Smart detection: prefer column with letters over column with only numbers
    // If col 0 has letters and col 1 is numeric, use col 0 (player name vs score)
    // If col 0 is empty, use col 1 (some scorecards have empty first column)
    let playerName = '';
    let playerNameCol = 0;
    
    if (name0 && /[a-z]/i.test(name0)) {
      // Column 0 has letters - likely the player name
      playerName = name0;
      playerNameCol = 0;
    } else if (name1) {
      // Column 0 empty or no letters, use column 1
      playerName = name1;
      playerNameCol = 1;
    } else if (name0) {
      // Fallback to column 0 if nothing else
      playerName = name0;
      playerNameCol = 0;
    }
    
    // Skip empty rows or metadata rows
    if (!playerName || playerName.length === 0) continue;
    
    // Check both column 0 AND the player name column for metadata keywords
    const col0Label = name0.toLowerCase();
    const playerNameLower = playerName.toLowerCase();
    
    if (playerNameLower.includes('total') || col0Label.includes('total')) continue;
    if (playerNameLower.includes('score') || col0Label.includes('score')) continue;
    if (playerNameLower.includes('handicap') || col0Label.includes('handicap')) continue;
    if (playerNameLower.includes('hdcp') || col0Label.includes('hdcp')) continue;
    if (playerNameLower === 'par' || col0Label === 'par' || col0Label.includes('par')) continue;
    if (playerNameLower.includes('pace of play') || col0Label.includes('pace of play')) continue;
    if (playerNameLower.includes('hole') || col0Label.includes('hole')) continue;
    if (playerNameLower.includes('yardage') || col0Label.includes('yardage')) continue;
    // Skip tee box names and ratings (various formats)
    if (/^(black|blue|white|red|green|gold|brown|silver|combo)\s+(m:|w:|\d)/i.test(playerName)) continue;
    if (/^m:\s*[\d./]+\s+(black|blue|white|red|green|gold|brown|silver)/i.test(playerName)) continue;
    if (/^(ladies|men|mens|ladies')/i.test(playerName)) continue;
    
    // Skip time/pace rows (":15", ":30", "1:06", etc.)
    if (/^:?\d+:\d+$/.test(playerName)) {
      console.log(`[Textract] Skipping time/pace row at row ${r}: "${playerName}"`);
      continue;
    }
    
    // Skip rows with tee box patterns in column 0
    // Format: "BROWN 69.8/125", "BLUE 67.9/122", "WHITE M 66.3/116 W 70.8/126"
    if (/^\s*(black|blue|white|red|green|gold|brown|silver|combo)\s+(\d+\.\d+\/\d+|m\s+\d+)/i.test(name0)) {
      console.log(`[Textract] Skipping tee box row at row ${r}: "${name0}"`);
      continue;
    }
    
    // Validate this is a player row by checking if it has at least some valid score data
    // Count how many cells in hole columns contain valid score-like values
    let validScoreCells = 0;
    let totalCells = 0;
    for (const colIdx of holeColumns) {
      const cellValue = rows[r][colIdx]?.trim() || '';
      totalCells++;
      if (cellValue && /^[+-]?\d+$/.test(cellValue)) {
        validScoreCells++;
      } else if (/^e$/i.test(cellValue)) {
        validScoreCells++;
      }
    }
    
    // A valid player row should have at least 1 score (could be partially filled)
    // But skip rows with ALL cells filled with unusual values (like all yardages > 100)
    if (validScoreCells === 0) {
      console.log(`[Textract] Skipping row "${playerName}" at row ${r} - no valid scores found`);
      continue;
    }
    
    // Additional check: if ALL scores are > 18, this is likely yardage data, not scores
    let allHighValues = true;
    for (const colIdx of holeColumns) {
      const cellValue = rows[r][colIdx]?.trim() || '';
      const numValue = parseInt(cellValue);
      if (!isNaN(numValue) && numValue <= 18) {
        allHighValues = false;
        break;
      }
    }
    
    if (allHighValues && validScoreCells > 0) {
      console.log(`[Textract] Skipping row "${playerName}" at row ${r} - all values > 18 (likely yardage)`);
      continue;
    }
    
    console.log(`[Textract] Found potential player "${playerName}" at row ${r}, column ${playerNameCol}`);
    
    // Collect raw score values
    const rawScores: (string | null)[] = holeColumns.map((colIdx) => {
      const cellValue = rows[r][colIdx]?.trim() || '';
      
      // Skip cells with non-numeric characters (like initials)
      // But allow +/- for relative-to-par notation and "E" for even par
      if (cellValue && !/^[+-]?\d+$/.test(cellValue) && !/^e$/i.test(cellValue) && cellValue !== '0') {
        console.log(`[Textract] Skipping non-numeric cell for ${playerName} at column ${colIdx}: "${cellValue}"`);
        return null;
      }
      
      return cellValue || null;
    });
    
    // Add to collection for scorecard-wide detection
    allRawScores.push(...rawScores.filter(s => s !== null));
    playerData.push({ name: playerName, row: r, col: playerNameCol, rawScores });
  }

  // STEP 2: Detect notation style ONCE for entire scorecard
  const pars = holes.map(h => h.par);
  const scorecardNotation = detectNotationStyle(allRawScores, pars);
  
  if (scorecardNotation === 'relative') {
    console.log('[Textract] Detected RELATIVE-TO-PAR notation for entire scorecard');
    console.log('[Textract] Sample raw scores:', allRawScores.slice(0, 15).join(', '));
  } else {
    console.log('[Textract] Detected GROSS STROKES notation for entire scorecard');
    console.log('[Textract] Sample raw scores:', allRawScores.slice(0, 15).join(', '));
  }

  // STEP 3: Convert all player scores using the detected notation
  const players: Array<{ name: string; scores: Array<{ holeNumber: number; score: number | null }> }> = [];
  
  for (const pd of playerData) {
    const scores = pd.rawScores.map((cellValue, idx) => {
      const holeNumber = idx + 1;
      const hole = holes[idx];
      
      if (!cellValue) {
        return {
          holeNumber,
          score: null,
        };
      }
      
      // Convert based on scorecard-wide notation
      let score: number | null = null;
      if (scorecardNotation === 'relative') {
        // For relative notation, plain numbers (without +/-) are relative to par
        const num = parseInt(cellValue, 10);
        if (!isNaN(num)) {
          score = hole.par + num; // e.g., "1" with par 5 = 6 strokes
          console.log(`[Score Notation] Converted "${cellValue}" as relative (par ${hole.par}) → ${score} gross strokes`);
        } else {
          score = parseScoreToGross(cellValue, hole.par);
        }
      } else {
        // For gross notation, use standard parsing
        score = parseScoreToGross(cellValue, hole.par);
      }
      
      return {
        holeNumber,
        score,
      };
    });

    console.log(`[Textract] ${pd.name} scores:`, scores.map((s, i) => `H${i+1}:${s.score ?? '-'}`).join(' '));

    // Only add player if they have at least one valid score
    const hasValidScores = scores.some(s => s.score !== null);
    if (hasValidScores) {
      players.push({
        name: pd.name,
        scores,
      });
    }
  }

  if (players.length === 0) {
    throw new Error('Could not extract any player scores from table');
  }

  console.log('[Textract] Extracted players:', players.map(p => p.name));

  return {
    courseName: courseName || 'Unknown Course',
    teeName: undefined,
    date: undefined,
    holes,
    players,
    notationStyle: scorecardNotation, // Pass detected notation to hybrid OCR
  };
}
