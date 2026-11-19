const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");

function isValidYMD(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const dim = new Date(y, m, 0).getDate();
  return d <= dim;
}

/**
 * Parse a user-typed date into YYYY-MM-DD. DAY ALWAYS COMES FIRST.
 * Accepts: 27/04/2027, 27-04-27, 27.4.27, 27/Apr/2027, 27 April 2027, 2027-04-27 (ISO).
 * Two-digit years are 20xx. Returns null when it cannot be understood.
 */
export function parseExpiry(input: string | null | undefined): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;

  // ISO: YYYY-MM-DD (optionally followed by a time part)
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    return isValidYMD(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }

  // D/M/Y with / - . or space separators, numeric month
  m = s.match(/^(\d{1,2})[\/\-.\s](\d{1,2})[\/\-.\s](\d{2}|\d{4})$/);
  if (m) {
    const d = +m[1], mo = +m[2];
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return isValidYMD(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }

  // D/Mon/Y with a month name
  m = s.match(/^(\d{1,2})[\/\-.\s]([A-Za-z]{3,9})[\/\-.\s,]*(\d{2}|\d{4})$/);
  if (m) {
    const idx = MONTHS.findIndex(x => x.toLowerCase() === m![2].slice(0, 3).toLowerCase());
    if (idx < 0) return null;
    const d = +m[1], mo = idx + 1;
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return isValidYMD(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }

  return null;
}

/** Format a stored date (YYYY-MM-DD or ISO timestamp) as DD/Mon/YYYY, e.g. 27/Apr/2027. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  if (typeof value === "string") {
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return `${iso[3]}/${MONTHS[+iso[2] - 1]}/${iso[1]}`; // no timezone shift for plain dates
  }
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "-";
  return `${pad(d.getDate())}/${MONTHS[d.getMonth()]}/${d.getFullYear()}`;
}

/** DD/Mon/YYYY plus 12-hour time, for timestamps. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "-";
  const h = d.getHours();
  return `${formatDate(d)} ${pad(h % 12 || 12)}:${pad(d.getMinutes())} ${h >= 12 ? "PM" : "AM"}`;
}
