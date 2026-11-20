import type { DiffRow } from '@/types';

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

function shouldSkipHeader(line: string): boolean {
  return line.startsWith('--- ') || line.startsWith('+++ ');
}

/**
 * Parse a Python difflib unified diff string into structured rows with dual line numbers.
 *
 * @param diffText - Unified diff string returned by GET /api/labs/{id}/source.
 * @returns Ordered DiffRow entries suitable for rendering in UnifiedDiffView.
 */
export function parseUnifiedDiff(diffText: string): DiffRow[] {
  if (diffText.trim().length === 0) {
    return [];
  }

  const rows: DiffRow[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const rawLine of diffText.split('\n')) {
    if (shouldSkipHeader(rawLine)) {
      continue;
    }

    const hunkMatch = HUNK_HEADER_RE.exec(rawLine);
    if (hunkMatch) {
      oldLine = Number.parseInt(hunkMatch[1] ?? '0', 10);
      newLine = Number.parseInt(hunkMatch[2] ?? '0', 10);
      rows.push({ kind: 'hunk', oldLine: null, newLine: null, content: rawLine });
      continue;
    }

    if (rawLine.startsWith('+')) {
      rows.push({ kind: 'add', oldLine: null, newLine, content: rawLine.slice(1) });
      newLine += 1;
    } else if (rawLine.startsWith('-')) {
      rows.push({ kind: 'remove', oldLine, newLine: null, content: rawLine.slice(1) });
      oldLine += 1;
    } else if (rawLine.startsWith(' ')) {
      rows.push({ kind: 'context', oldLine, newLine, content: rawLine.slice(1) });
      oldLine += 1;
      newLine += 1;
    }
  }

  return rows;
}
