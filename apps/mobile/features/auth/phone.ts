/**
 * Brazilian phone numbers (+55) for S1B / S1C. Pure string helpers: no React Native
 * imports, so the `tsx` unit runner can test them (docs/testing.md, "Gotchas").
 *
 * A national number is the 2-digit area code plus 8 digits (landline) or 9 digits
 * starting with 9 (mobile). Firebase only accepts E.164, the UI only shows `formatBR`.
 */

/** Digits only, with a leading `55` country code dropped from 12–13 digit input. */
export function nationalDigits(input: string): string {
  const digits = input.replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits.slice(2);
  }
  return digits;
}

/** `+55` plus 10 or 11 national digits, or null when the number cannot be Brazilian. */
export function toE164BR(input: string): string | null {
  const digits = nationalDigits(input);
  if (digits.length !== 10 && digits.length !== 11) return null;

  const areaCode = digits.slice(0, 2);
  // Area codes run 11–99: no zero in either position, no leading zero.
  if (!/^[1-9][0-9]$/.test(areaCode)) return null;

  const subscriber = digits.slice(2);
  if (subscriber.length === 8) return `+55${digits}`;
  if (subscriber.length === 9 && subscriber.startsWith('9')) return `+55${digits}`;
  return null;
}

/**
 * Display format: `(11) 98765-4321` for mobiles, `(11) 3456-7890` for landlines.
 * Partial input is formatted progressively, so it can run on every keystroke.
 */
export function formatBR(input: string): string {
  const digits = nationalDigits(input);
  if (digits.length === 0) return '';

  const areaCode = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length === 0) return `(${areaCode}`;

  // A 9 after the area code is a mobile: five digits, then four.
  const head = rest.startsWith('9') ? 5 : 4;
  const first = rest.slice(0, head);
  const tail = rest.slice(head, head + 4);

  return tail.length > 0 ? `(${areaCode}) ${first}-${tail}` : `(${areaCode}) ${first}`;
}
