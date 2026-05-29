// Normalize Bangladeshi phone numbers to E.164 (+8801XXXXXXXXX)
export function normalizeBdPhone(input: string): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  let national = digits;
  if (national.startsWith("880")) national = national.slice(3);
  else if (national.startsWith("0")) national = national.slice(1);
  // Must be 10 digits starting with 1 (e.g., 1712345678)
  if (!/^1[0-9]{9}$/.test(national)) return null;
  return `+880${national}`;
}

export function displayBdPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  if (e164.startsWith("+880")) return "0" + e164.slice(4);
  return e164;
}

// Student default password = last 6 digits of phone number
export function defaultStudentPassword(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return digits.slice(-6);
}
