import { Category } from '../types';

/**
 * Standard predefined acronym dictionary based on PLN Corporate University standards
 */
export const KNOWN_CATEGORY_ABBRS: Record<string, string> = {
  'jaringan dan internet': 'JAIT',
  'perangkat keras': 'PEKE',
  'perangkat lunak': 'PELU',
  'akun dan hak akses': 'ADHA',
  'aplikasi internal': 'APIN',
  'sistem pembelajaran (hxms)': 'SIPH',
  'sistem pembelajaran (hsms)': 'SIPH',
  'sistem pembelajaran': 'SIPH',
  'sistem pembelajaran hxms': 'SIPH',
  'sistem pembelajaran hsms': 'SIPH',
  'kelas dan fasilitas pelatihan': 'KEFA',
  'sarana dan prasarana': 'SADA',
  'administrasi diklat': 'ADDI',
  'permintaan layanan lainnya': 'PLLY',
};

/**
 * Indonesian month names mapping for selection & preview
 */
export const MONTH_NAMES_ID: { value: string; label: string; name: string }[] = [
  { value: '01', label: '01 - Januari', name: 'Januari' },
  { value: '02', label: '02 - Februari', name: 'Februari' },
  { value: '03', label: '03 - Maret', name: 'Maret' },
  { value: '04', label: '04 - April', name: 'April' },
  { value: '05', label: '05 - Mei', name: 'Mei' },
  { value: '06', label: '06 - Juni', name: 'Juni' },
  { value: '07', label: '07 - Juli', name: 'Juli' },
  { value: '08', label: '08 - Agustus', name: 'Agustus' },
  { value: '09', label: '09 - September', name: 'September' },
  { value: '10', label: '10 - Oktober', name: 'Oktober' },
  { value: '11', label: '11 - November', name: 'November' },
  { value: '12', label: '12 - Desember', name: 'Desember' },
];

/**
 * Indonesian stop words often skipped or specifically handled in abbreviations
 */
const STOP_WORDS = new Set(['dan', 'atau', 'pada', 'di', 'ke', 'dari', 'untuk', 'yang', '&']);

/**
 * Generates a 4-capital-letter abbreviation (XXXX) from category name automatically.
 * Rule:
 * 1. Checks known dictionary first.
 * 2. If name has parentheses acronym e.g. "Sistem Pembelajaran (HXMS)" -> SI + P + H = SIPH.
 * 3. 4 words (e.g. "Akun dan Hak Akses"): takes first letter of each word -> A-D-H-A = ADHA.
 * 4. 2 words (e.g. "Perangkat Keras", "Aplikasi Internal"): 2 letters of word 1 + 2 letters of word 2 -> PE+KE = PEKE, AP+IN = APIN.
 * 5. 3 words:
 *    - With stop word in middle (e.g. "Jaringan dan Internet"): ignores stop word -> JA + IT = JAIT.
 *    - "Sarana dan Prasarana" -> SA + D + A = SADA.
 *    - 3 content words (e.g. "Permintaan Layanan Lainnya"): 1st letter + 1st letter + 2 letters of 3rd word -> P + L + LY = PLLY.
 * 6. Multi-word with stop words (e.g. "Kelas dan Fasilitas Pelatihan"): 2 letters of 1st + 2 letters of 3rd -> KE + FA = KEFA.
 * 7. Single word: takes first 4 letters (padded with 'X' if < 4).
 */
export function generateCategoryAbbreviation(categoryName: string): string {
  if (!categoryName || !categoryName.trim()) {
    return 'KATG';
  }

  const rawClean = categoryName.trim().toLowerCase();

  // 1. Check known mappings
  if (KNOWN_CATEGORY_ABBRS[rawClean]) {
    return KNOWN_CATEGORY_ABBRS[rawClean];
  }

  // Remove content in parentheses if it has standard acronym or check if it's special
  const parenMatch = categoryName.match(/\(([^)]+)\)/);
  const acronymInParen = parenMatch ? parenMatch[1].trim() : '';

  // Clean string: remove punctuation except spaces
  const textWithoutParen = categoryName.replace(/\([^)]*\)/g, ' ').trim();
  const cleanedText = textWithoutParen.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = cleanedText.split(' ').filter(Boolean);

  if (words.length === 0) {
    return 'KATG';
  }

  // If acronym in parentheses is 4 letters and uppercase, e.g. (HXMS) or (HSMS)
  if (acronymInParen && acronymInParen.length === 4 && /^[a-zA-Z]+$/.test(acronymInParen)) {
    if (words.length <= 1) {
      return acronymInParen.toUpperCase();
    }
  }

  // If there's an acronym in paren like HXMS/HSMS and words like "Sistem Pembelajaran" -> SI + P + H = SIPH
  if (acronymInParen && words.length >= 2) {
    const w1 = words[0];
    const w2 = words[1];
    const parenLetter = acronymInParen.charAt(0);
    const candidate = `${w1.substring(0, 2)}${w2.charAt(0)}${parenLetter}`.toUpperCase();
    if (candidate.length === 4) return candidate;
  }

  // Case: exactly 4 words (e.g., "Akun dan Hak Akses") -> A, D, H, A
  if (words.length === 4) {
    const abbr = words.map((w) => w.charAt(0)).join('').toUpperCase();
    if (abbr.length === 4) return abbr;
  }

  // Filter stop words to find significant words
  const significantWords = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()));

  // If 2 significant words (e.g. "Perangkat Keras", "Jaringan dan Internet" where 'dan' was removed)
  if (significantWords.length === 2) {
    const w1 = significantWords[0];
    const w2 = significantWords[1];
    const part1 = (w1.length >= 2 ? w1.substring(0, 2) : w1.padEnd(2, 'X')).toUpperCase();
    const part2 = (w2.length >= 2 ? w2.substring(0, 2) : w2.padEnd(2, 'X')).toUpperCase();
    return `${part1}${part2}`;
  }

  // If 3 significant words (e.g. "Permintaan Layanan Lainnya")
  if (significantWords.length === 3) {
    const w1 = significantWords[0].charAt(0);
    const w2 = significantWords[1].charAt(0);
    const w3 = significantWords[2].length >= 2 ? significantWords[2].substring(0, 2) : significantWords[2].padEnd(2, 'X');
    return `${w1}${w2}${w3}`.toUpperCase();
  }

  // If more than 3 significant words (e.g. "Kelas Fasilitas Pelatihan Bersama")
  if (significantWords.length >= 4) {
    return significantWords.slice(0, 4).map((w) => w.charAt(0)).join('').toUpperCase();
  }

  // Single significant word (e.g. "Infrastruktur")
  if (significantWords.length === 1) {
    const word = significantWords[0];
    if (word.length >= 4) {
      return word.substring(0, 4).toUpperCase();
    }
    return word.padEnd(4, 'X').toUpperCase();
  }

  // Fallback to taking letters from raw words
  let fallback = '';
  for (const w of words) {
    fallback += w.charAt(0);
  }
  if (fallback.length < 4) {
    fallback = (fallback + (words[0] || 'KATG')).substring(0, 4);
  }
  return fallback.substring(0, 4).padEnd(4, 'X').toUpperCase();
}

/**
 * Parses an existing category code into its components.
 * Supports standard format #XXXX-MM-YYYY-NNN
 * Also gracefully handles legacy #XXXX-YYYY-NNN
 */
export function parseCategoryCode(code: string): {
  prefix: string;
  abbr: string;
  month: number;
  monthStr: string;
  year: number;
  seq: number;
  raw: string;
  isLegacyFormat?: boolean;
} | null {
  if (!code) return null;
  const trimmed = code.trim();

  // Standard format #XXXX-MM-YYYY-NNN
  const matchNew = trimmed.match(/^#([A-Z0-9]{4})-(\d{2})-(\d{4})-(\d{3})$/);
  if (matchNew) {
    return {
      prefix: '#',
      abbr: matchNew[1],
      month: parseInt(matchNew[2], 10),
      monthStr: matchNew[2],
      year: parseInt(matchNew[3], 10),
      seq: parseInt(matchNew[4], 10),
      raw: trimmed,
      isLegacyFormat: false,
    };
  }

  // Legacy format #XXXX-YYYY-NNN (backward compatibility)
  const matchLegacy = trimmed.match(/^#([A-Z0-9]{4})-(\d{4})-(\d{3})$/);
  if (matchLegacy) {
    return {
      prefix: '#',
      abbr: matchLegacy[1],
      month: 10, // Default to October if undefined
      monthStr: '10',
      year: parseInt(matchLegacy[2], 10),
      seq: parseInt(matchLegacy[3], 10),
      raw: trimmed,
      isLegacyFormat: true,
    };
  }

  return null;
}

/**
 * Formats components into the standard category code: #XXXX-MM-YYYY-NNN
 */
export function formatCategoryCode(
  abbr: string,
  month: number | string,
  year: number,
  seq: number
): string {
  const cleanAbbr = (abbr || 'KATG')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 4)
    .padEnd(4, 'X');

  const numMonth = typeof month === 'string' ? parseInt(month, 10) : month;
  const validMonth = Math.max(1, Math.min(12, isNaN(numMonth) || numMonth < 1 ? new Date().getMonth() + 1 : numMonth));
  const paddedMonth = validMonth.toString().padStart(2, '0');

  const validYear = year && year > 2000 ? year : new Date().getFullYear();
  const paddedSeq = Math.max(1, Math.min(999, seq)).toString().padStart(3, '0');

  return `#${cleanAbbr}-${paddedMonth}-${validYear}-${paddedSeq}`;
}

/**
 * Calculates the next available 3-digit sequence number from existing categories.
 * Ensures strict continuous sequencing without duplicates.
 */
export function getNextCategorySequence(existingCategories: Category[]): number {
  let maxSeq = 0;

  for (const cat of existingCategories) {
    if (!cat.code) continue;
    const parsed = parseCategoryCode(cat.code);
    if (parsed && parsed.seq > maxSeq) {
      maxSeq = parsed.seq;
    }
  }

  return maxSeq + 1;
}

/**
 * Automatically creates a full category code for a new category.
 * Format: #XXXX-MM-YYYY-NNN
 */
export function generateNextCategoryCode(
  categoryName: string,
  existingCategories: Category[],
  customAbbr?: string,
  month?: number | string,
  year?: number
): string {
  const now = new Date();
  const targetMonth = month !== undefined ? month : now.getMonth() + 1;
  const targetYear = year || now.getFullYear();

  const abbr = customAbbr && customAbbr.trim()
    ? customAbbr.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4).padEnd(4, 'X')
    : generateCategoryAbbreviation(categoryName);

  const nextSeq = getNextCategorySequence(existingCategories);
  return formatCategoryCode(abbr, targetMonth, targetYear, nextSeq);
}

/**
 * Predefined static mapping of initial categories matching PLN CorpU standard examples:
 * - #JAIT-01-2026-001 = Jaringan dan Internet (Januari 2026)
 * - #PEKE-10-2026-002 = Perangkat Keras (Oktober 2026)
 * - #PELU-03-2026-003 = Perangkat Lunak (Maret 2026)
 * - #ADHA-04-2026-004 = Akun dan Hak Akses (April 2026)
 * - #APIN-05-2026-005 = Aplikasi Internal (Mei 2026)
 * - #SIPH-06-2026-006 = Sistem Pembelajaran (HXMS) (Juni 2026)
 * - #KEFA-07-2026-007 = Kelas dan Fasilitas Pelatihan (Juli 2026)
 * - #SADA-08-2026-008 = Sarana dan Prasarana (Agustus 2026)
 * - #ADDI-09-2026-009 = Administrasi Diklat (September 2026)
 * - #PLLY-10-2026-010 = Permintaan Layanan Lainnya (Oktober 2026)
 */
export const INITIAL_PREDEFINED_CODES: Record<string, string> = {
  'cat-net': '#JAIT-01-2026-001',
  'cat-hw': '#PEKE-10-2026-002',
  'cat-sw': '#PELU-03-2026-003',
  'cat-acc': '#ADHA-04-2026-004',
  'cat-app': '#APIN-05-2026-005',
  'cat-lms': '#SIPH-06-2026-006',
  'cat-cls': '#KEFA-07-2026-007',
  'cat-srp': '#SADA-08-2026-008',
  'cat-adm': '#ADDI-09-2026-009',
  'cat-oth': '#PLLY-10-2026-010',
};

/**
 * Validates if a code follows #XXXX-MM-YYYY-NNN
 */
export function isValidCategoryCode(code: string): boolean {
  if (!code) return false;
  return /^#[A-Z0-9]{4}-\d{2}-\d{4}-\d{3}$/.test(code.trim());
}
