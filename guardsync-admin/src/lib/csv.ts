// Builds a CSV file in the browser and offers it as a download.

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  // Spreadsheet apps run a cell starting with = @ (or + - followed by more than a number) as a
  // formula. Names come from guards' own enrolments, so such cells are made plain text.
  // Phone numbers like '+91 98450 12345' are left as they are.
  const looksLikeFormula = /^[=@\t\r]/.test(text) || (/^[+-]/.test(text) && /[^\d\s().+-]/.test(text));
  if (looksLikeFormula) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, header: string[], rows: unknown[][]): void {
  const csv = [header, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
