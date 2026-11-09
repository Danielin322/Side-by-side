/**
 * Normalizes an Israeli phone number to local format (e.g. 0521234567).
 * Accepts spaces, dashes, brackets and a +972 / 972 prefix. Returns null if invalid.
 */
export function normalizeIsraeliPhone(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+972")) digits = "0" + digits.slice(4);
  else if (digits.startsWith("972")) digits = "0" + digits.slice(3);
  // Mobile and VoIP: 05X / 07X + 7 digits. Landline: 02/03/04/08/09 + 7 digits.
  if (/^0[57]\d{8}$/.test(digits) || /^0[23489]\d{7}$/.test(digits)) return digits;
  return null;
}

/**
 * Validates an Israeli ID number (Teudat Zehut) with its check digit and returns it padded to 9 digits.
 * Returns null if invalid.
 */
export function normalizeIsraeliId(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 5 || digits.length > 9) return null;
  const id = digits.padStart(9, "0");
  if (id === "000000000") return null;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(id[i]) * ((i % 2) + 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  return sum % 10 === 0 ? id : null;
}

/** Age in whole years on today's date, or null for an invalid YYYY-MM-DD date. */
export function ageFromIsoDate(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const birth = new Date(iso + "T00:00:00");
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age--;
  return age;
}
