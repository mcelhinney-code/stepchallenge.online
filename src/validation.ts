export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getEmailDomain(email: string): string {
  return email.split('@').pop()?.toLowerCase() ?? '';
}

export function isAllowedDomain(email: string, allowedDomains: string[]): boolean {
  const domain = getEmailDomain(email);
  return allowedDomains.map((d) => d.toLowerCase()).includes(domain);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 128;
}

export function isValidDisplayName(name: string | undefined | null): boolean {
  if (!name) return true;
  return name.length <= 100 && !/[<>\"]/.test(name);
}

export function isValidSteps(steps: string): boolean {
  const n = Number(steps);
  return Number.isInteger(n) && n > 0 && n <= 1_000_000;
}

export function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date.getTime() <= today.getTime();
}

export function parseAllowedDomains(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed.map((d) => String(d));
  } catch {
    // fall through
  }
  return [];
}
