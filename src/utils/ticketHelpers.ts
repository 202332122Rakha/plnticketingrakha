import { Ticket, Category } from '../types';
import { generateCategoryAbbreviation, parseCategoryCode, MONTH_NAMES_ID } from './categoryHelpers';

/**
 * Standard Ticket Number Helper for PLN Corporate University Ticketing Management System
 * Format: #XXXX-MM-YYYY-NNN
 * - #    : Symbol prefix
 * - XXXX : 4-letter category acronym (e.g. JAIT, PEKE, PELU, ADHA, SIPH)
 * - MM   : 2-digit creation month (01 - 12)
 * - YYYY : 4-digit creation year (e.g. 2026)
 * - NNN  : 3-digit continuous sequential number (001, 002, 003...)
 */

/**
 * Extracts 4-letter category acronym (XXXX) from a Category object or name/code
 */
export function extractCategoryAcronym(category?: { code?: string; name?: string } | null): string {
  if (!category) return 'TKTX';

  // 1. If category code exists and has 4 letters (e.g. #JAIT-01-2026-001)
  if (category.code) {
    const parsed = parseCategoryCode(category.code);
    if (parsed && parsed.abbr && parsed.abbr.length === 4) {
      return parsed.abbr.toUpperCase();
    }
    const match = category.code.trim().match(/^#?([A-Z0-9]{4})/i);
    if (match) {
      return match[1].toUpperCase();
    }
  }

  // 2. Generate from category name
  if (category.name) {
    return generateCategoryAbbreviation(category.name);
  }

  return 'TKTX';
}

/**
 * Formats components into the official ticket number: #XXXX-MM-YYYY-NNN
 */
export function formatTicketNumber(
  abbr: string,
  month: number | string,
  year: number | string,
  seq: number | string
): string {
  const cleanAbbr = (abbr || 'TKTX')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 4)
    .padEnd(4, 'X');

  const numMonth = typeof month === 'string' ? parseInt(month, 10) : month;
  const validMonth = Math.max(1, Math.min(12, isNaN(numMonth) || numMonth < 1 ? new Date().getMonth() + 1 : numMonth));
  const paddedMonth = validMonth.toString().padStart(2, '0');

  const numYear = typeof year === 'string' ? parseInt(year, 10) : year;
  const validYear = numYear && numYear > 2000 ? numYear : new Date().getFullYear();

  const numSeq = typeof seq === 'string' ? parseInt(seq, 10) : seq;
  const validSeq = isNaN(numSeq) || numSeq < 1 ? 1 : numSeq;
  const paddedSeq = validSeq.toString().padStart(3, '0');

  return `#${cleanAbbr}-${paddedMonth}-${validYear}-${paddedSeq}`;
}

/**
 * Parses a ticket number (both new format #XXXX-MM-YYYY-NNN and legacy TCU-YYYY-NNNNN)
 */
export function parseTicketNumber(ticketNumber: string): {
  raw: string;
  isLegacy: boolean;
  prefix: string;
  abbr: string;
  month: number;
  monthStr: string;
  year: number;
  seq: number;
  seqStr: string;
} | null {
  if (!ticketNumber) return null;
  const trimmed = ticketNumber.trim();

  // 1. New Format: #XXXX-MM-YYYY-NNN (or without leading #)
  const matchNew = trimmed.match(/^#?([A-Z0-9]{4})-(\d{2})-(\d{4})-(\d{3,})$/i);
  if (matchNew) {
    return {
      raw: trimmed,
      isLegacy: false,
      prefix: '#',
      abbr: matchNew[1].toUpperCase(),
      month: parseInt(matchNew[2], 10),
      monthStr: matchNew[2],
      year: parseInt(matchNew[3], 10),
      seq: parseInt(matchNew[4], 10),
      seqStr: matchNew[4],
    };
  }

  // 2. Legacy Format: TCU-YYYY-NNNNN or #TCU-YYYY-NNNNN
  const matchLegacy = trimmed.match(/^#?TCU-(\d{4})-(\d{1,6})$/i);
  if (matchLegacy) {
    return {
      raw: trimmed,
      isLegacy: true,
      prefix: '#',
      abbr: 'TCU',
      month: 10,
      monthStr: '10',
      year: parseInt(matchLegacy[1], 10),
      seq: parseInt(matchLegacy[2], 10),
      seqStr: matchLegacy[2],
    };
  }

  return null;
}

/**
 * Calculates the next continuous sequential number across all tickets in the system
 * Strictly monotonic, starting at 1 (001).
 */
export function getNextTicketSequence(existingTickets: Ticket[]): number {
  let maxSeq = 0;

  for (const t of existingTickets) {
    if (!t.ticketNumber) continue;
    const parsed = parseTicketNumber(t.ticketNumber);
    if (parsed && parsed.seq > maxSeq) {
      maxSeq = parsed.seq;
    }
  }

  return maxSeq + 1;
}

/**
 * Generates the full ticket number for a new ticket given its category and existing tickets
 * Format: #XXXX-MM-YYYY-NNN
 */
export function generateNextTicketNumber(
  category: { code?: string; name?: string } | null | undefined,
  existingTickets: Ticket[],
  date: Date = new Date()
): string {
  const abbr = extractCategoryAcronym(category);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const nextSeq = getNextTicketSequence(existingTickets);

  return formatTicketNumber(abbr, month, year, nextSeq);
}

/**
 * Formats ticket number for clean UI display:
 * Ensures leading '#' is present once, avoiding '##XXXX...'
 */
export function formatTicketNumberDisplay(ticketNumber: string | undefined | null): string {
  if (!ticketNumber) return '-';
  const trimmed = ticketNumber.trim();
  if (trimmed.startsWith('#')) return trimmed;
  return `#${trimmed}`;
}

/**
 * Checks if a ticket number is valid according to the new format
 */
export function isValidTicketNumber(ticketNumber: string): boolean {
  if (!ticketNumber) return false;
  return /^#?[A-Z0-9]{4}-\d{2}-\d{4}-\d{3,}$/i.test(ticketNumber.trim());
}

/**
 * Provides human-readable breakdown details for the live preview in CreateTicketView
 */
export function getTicketNumberBreakdown(
  category: { code?: string; name?: string } | null | undefined,
  existingTickets: Ticket[],
  date: Date = new Date()
): {
  ticketNumber: string;
  abbr: string;
  categoryName: string;
  month: string;
  monthName: string;
  year: number;
  seq: number;
  seqStr: string;
} {
  const abbr = extractCategoryAcronym(category);
  const numMonth = date.getMonth() + 1;
  const monthStr = numMonth.toString().padStart(2, '0');
  const year = date.getFullYear();
  const seq = getNextTicketSequence(existingTickets);
  const seqStr = seq.toString().padStart(3, '0');
  const ticketNumber = formatTicketNumber(abbr, monthStr, year, seq);

  const monthObj = MONTH_NAMES_ID.find((m) => m.value === monthStr);
  const monthName = monthObj ? monthObj.name : `Bulan ${numMonth}`;

  return {
    ticketNumber,
    abbr,
    categoryName: category?.name || 'Kategori Terpilih',
    month: monthStr,
    monthName,
    year,
    seq,
    seqStr,
  };
}
