/**
 * Preserve bound values while translating legacy positional ? markers to $n.
 * This is only a parameter-marker compiler, not a MySQL SQL translator.
 * All actual SQL/DDL and the database driver are PostgreSQL.
 */
export function prepareQuery(text, values = []) {
  if (typeof text !== 'string' || !Array.isArray(values)) throw new TypeError('SQL text dan parameter array diperlukan.');
  let out = '', count = 0, maxNative = 0;
  for (let i = 0; i < text.length;) {
    const char = text[i];
    if (char === "'" || char === '"') {
      const quote = char; let closed = false;
      out += text[i++];
      while (i < text.length) {
        const c = text[i++]; out += c;
        if (c === '\\' && quote === "'" && i < text.length) { out += text[i++]; continue; }
        if (c === quote) {
          if (text[i] === quote) { out += text[i++]; continue; }
          closed = true; break;
        }
      }
      if (!closed) throw new Error('SQL quoted string tidak ditutup.');
      continue;
    }
    if (text.startsWith('--', i)) {
      const end = text.indexOf('\n', i);
      if (end < 0) { out += text.slice(i); i = text.length; }
      else { out += text.slice(i, end + 1); i = end + 1; }
      continue;
    }
    if (text.startsWith('/*', i)) {
      let level = 1; out += '/*'; i += 2;
      while (i < text.length && level) {
        if (text.startsWith('/*', i)) { level++; out += '/*'; i += 2; }
        else if (text.startsWith('*/', i)) { level--; out += '*/'; i += 2; }
        else out += text[i++];
      }
      if (level) throw new Error('SQL comment tidak ditutup.');
      continue;
    }
    if (char === '$') {
      const tag = text.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
      if (tag) {
        const end = text.indexOf(tag, i + tag.length);
        if (end < 0) throw new Error('SQL dollar-quoted string tidak ditutup.');
        out += text.slice(i, end + tag.length); i = end + tag.length; continue;
      }
      const native = text.slice(i).match(/^\$(\d+)/);
      if (native) {
        if (Number(native[1]) < 1) throw new Error('SQL parameter index harus mulai dari 1.');
        maxNative = Math.max(maxNative, Number(native[1]));
        out += native[0]; i += native[0].length; continue;
      }
    }
    if (char === '?') { out += `$${++count}`; i++; continue; }
    out += char; i++;
  }
  if (count && maxNative) throw new Error('Mixed SQL parameter styles tidak diizinkan.');
  if ((count || maxNative) !== values.length) throw new Error('Jumlah SQL parameter tidak sesuai dengan nilai yang diberikan.');
  return { text: out, values };
}
