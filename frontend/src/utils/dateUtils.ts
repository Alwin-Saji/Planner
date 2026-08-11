export function formatLocalDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayStr(): string {
  return formatLocalDateStr(new Date());
}

export function parseLocalDateStr(dateStr: string): Date {
  const [year, month, day] = (dateStr || '').split('-').map(Number);
  return new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1);
}
