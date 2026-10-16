import { BadRequestException } from '@nestjs/common';

export type ImportedStatementRow = {
  externalId: string;
  transactionDate: string;
  amount: string;
  description?: string;
  rawData: Record<string, string>;
};

export interface StatementProviderAdapter {
  readonly provider: string;
  parse(input: string): ImportedStatementRow[];
}

export class CsvStatementAdapter implements StatementProviderAdapter {
  readonly provider = 'csv';

  parse(input: string): ImportedStatementRow[] {
    const lines = input.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];
    const parseLine = (line: string) => {
      const values: string[] = [];
      let current = '';
      let quoted = false;
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"' && line[i + 1] === '"') { current += '"'; i += 1; }
        else if (char === '"') quoted = !quoted;
        else if (char === ',' && !quoted) { values.push(current.trim()); current = ''; }
        else current += char;
      }
      values.push(current.trim());
      return values;
    };
    const headers = parseLine(lines[0]).map((header) => header.trim().toLowerCase());
    const dateIndex = headers.findIndex((header) => ['date', 'transactiondate', 'transaction_date'].includes(header));
    const amountIndex = headers.findIndex((header) => header === 'amount');
    const idIndex = headers.findIndex((header) => ['id', 'externalid', 'external_id', 'reference'].includes(header));
    const descriptionIndex = headers.findIndex((header) => ['description', 'memo', 'details'].includes(header));
    if (dateIndex < 0 || amountIndex < 0 || idIndex < 0) throw new BadRequestException('CSV must contain date, amount, and externalId/reference columns');
    return lines.slice(1).map((line, index) => {
      const values = parseLine(line);
      const rawAmount = values[amountIndex]?.replace(/[$,\s]/g, '');
      if (!rawAmount || !values[idIndex]) throw new BadRequestException(`CSV row ${index + 2} is missing an id or amount`);
      return { externalId: values[idIndex], transactionDate: values[dateIndex], amount: rawAmount, description: descriptionIndex >= 0 ? values[descriptionIndex] : undefined, rawData: Object.fromEntries(headers.map((header, i) => [header || `column_${i}`, values[i] ?? ''])) };
    });
  }
}

export const statementAdapters: Record<string, StatementProviderAdapter> = {
  csv: new CsvStatementAdapter(),
};
