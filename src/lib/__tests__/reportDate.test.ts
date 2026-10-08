import { describe, expect, it } from 'vitest';
import { findReportDate } from '../reportDate';

describe('findReportDate', () => {
  it('prefers the value next to a date label', () => {
    expect(findReportDate([['رقم 12/12/2020 مرجعي'], ['التاريخ', '07/10/2026']])).toBe('2026/10/07');
  });
  it('reads year-first and day-first forms, Arabic digits and Excel dates', () => {
    expect(findReportDate([['LAST UPDATED:', '2026-10-07']])).toBe('2026/10/07');
    expect(findReportDate([['٠٧/١٠/٢٠٢٦']])).toBe('2026/10/07');
    expect(findReportDate([[new Date(2026, 9, 7)]])).toBe('2026/10/07');
  });
  it('ignores impossible dates and plain numbers', () => {
    expect(findReportDate([['31/02/2026', 10994558]])).toBeNull();
  });
});
