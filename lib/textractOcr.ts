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

  // Find hole numbers row (usually first row with numbers 1-18 or 1-9)
  let holeRowIndex = -1;
  let holeColumns: number[] = [];
  
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
      // Player initials are typically 2-3 letters
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
    // Must be exactly 9 or 18 holes
    if ((potentialHoles.length === 9 || potentialHoles.length === 18) && 
        potentialHoles[0].value === 1) {
      // Verify sequential
      const isSequential = potentialHoles.every((hole, idx) => hole.value === idx + 1);
      if (isSequential) {
        holeRowIndex = i;
        holeColumns = potentialHoles.map(h => h.idx);
        
        // CRITICAL: Verify no extra columns between holes 9 and 10 for 18-hole courses
        if (potentialHoles.length === 18) {
          const hole9ColIdx = potentialHoles[8].idx;
          const hole10ColIdx = potentialHoles[9].idx;
          const colDiff = hole10ColIdx - hole9ColIdx;
          
          // If there's a gap of more than 1 column, there might be an Out/Initials column
          if (colDiff > 1) {
            console.log(`[Textract] WARNING: Gap detected between hole 9 (col ${hole9ColIdx}) and hole 10 (col ${hole10ColIdx})`);
            console.log(`[Textract] Columns between: ${row.slice(hole9ColIdx + 1, hole10ColIdx).join(', ')}`);
          }
        }
        
        break;
      }
    }
  }

  if (holeRowIndex === -1 || holeColumns.length === 0) {
    throw new Error('Could not identify hole numbers in scorecard table');
  }

  console.log('[Textract] Found holes row at index:', holeRowIndex);
  console.log('[Textract] Hole columns:', holeColumns);
  console.log('[Textract] Full holes row:', rows[holeRowIndex]);

  // Debug: print rows around hole row to find par
  console.log('[Textract] Searching for par row...');
  for (let i = Math.max(0, holeRowIndex - 2); i < Math.min(holeRowIndex + 8, rows.length); i++) {
    const label = rows[i][0] || '';
    console.log(`[Textract]   Row ${i} label: "${label}" - Full row:`, rows[i].slice(0, 10));
  }

  // Find the par row - check multiple rows around the hole row
  let parRowIndex = -1;
  
  // First check the row BEFORE the hole numbers (some scorecards have par first)
  if (holeRowIndex > 0) {
    const labelBefore = rows[holeRowIndex - 1][0]?.toLowerCase() || '';
    // Look for "par", "men's par", "mens par", "m par", etc.
    if (labelBefore.includes('par') || /men['s]*\s*par/i.test(labelBefore)) {
      parRowIndex = holeRowIndex - 1;
      console.log('[Textract] Found par row BEFORE holes at index:', parRowIndex);
    }
  }
  
  // If not found before, check rows AFTER the hole numbers (expanded to check up to 7 rows after)
  if (parRowIndex === -1) {
    for (let r = holeRowIndex + 1; r < Math.min(holeRowIndex + 8, rows.length); r++) {
      const label = rows[r][0]?.toLowerCase() || '';
      // Look for "par", "men's par", "mens par", "m par", etc.
      if (label.includes('par') || /men['s]*\s*par/i.test(label)) {
        parRowIndex = r;
        console.log('[Textract] Found par row AFTER holes at index:', parRowIndex);
        break;
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
    const cellValue = rows[holeRowIndex][colIdx];
    
    console.log(`[Textract] Hole ${holeNumber} at column ${colIdx}: "${cellValue}"`);
    
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
  const players: { name: string; scores: { holeNumber: number; score: number | null }[] }[] = [];
  
  // Look for rows after the par row
  let startPlayerRow = holeRowIndex + 1;
  for (let r = holeRowIndex + 1; r < Math.min(holeRowIndex + 5, rows.length); r++) {
    const label = rows[r][0]?.toLowerCase() || '';
    if (label.includes('par') || label.includes('hdcp') || label.includes('yardage')) {
      startPlayerRow = r + 1;
    }
  }

  for (let r = startPlayerRow; r < rows.length; r++) {
    const row = rows[r];
    const playerName = row[0]?.trim();
    
    // Skip empty rows or metadata rows
    if (!playerName || playerName.length === 0) continue;
    if (playerName.toLowerCase().includes('total')) continue;
    if (playerName.toLowerCase().includes('score')) continue;
    if (playerName.toLowerCase().includes('handicap')) continue;
    if (playerName.toLowerCase() === 'par') continue;
    if (playerName.toLowerCase().includes('pace of play')) continue;
    if (playerName.toLowerCase().includes('hcp')) continue;
    // Skip tee box names (color names followed by numbers)
    if (/^(black|blue|white|red|green|gold|brown|silver)\s+\d/i.test(playerName)) continue;
    if (/^(ladies|men|mens|ladies')/i.test(playerName)) continue;
    
    // Extract scores for each hole
    const scores = holeColumns.map((colIdx, idx) => {
      const cellValue = row[colIdx]?.trim() || '';
      const score = parseInt(cellValue);
      
      // Additional validation: skip if cell contains non-numeric characters (like initials)
      if (cellValue && !/^\d+$/.test(cellValue)) {
        console.log(`[Textract] Skipping non-numeric cell for ${playerName} at column ${colIdx}: "${cellValue}"`);
        return {
          holeNumber: idx + 1,
          score: null,
        };
      }
      
      return {
        holeNumber: idx + 1,
        score: isNaN(score) || score < 1 || score > 20 ? null : score,
      };
    });

    console.log(`[Textract] ${playerName} scores:`, scores.map((s, i) => `H${i+1}:${s.score ?? '-'}`).join(' '));

    // Only add player if they have at least one valid score
    const hasValidScores = scores.some(s => s.score !== null);
    if (hasValidScores) {
      players.push({
        name: playerName,
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
  };
}
