/**
 * Parse natural language date strings to ISO date strings (YYYY-MM-DD).
 */
export function parseDateInput(input: string): string {
  const s = input.toLowerCase().trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (s === "today") return toISO(today);
  if (s === "tomorrow") return toISO(addDays(today, 1));
  if (s === "yesterday") return toISO(addDays(today, -1));

  const inNDays = s.match(/^in (\d+) days?$/);
  if (inNDays) return toISO(addDays(today, Number.parseInt(inNDays[1], 10)));

  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const nextDay = s.match(
    /^next (sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/,
  );
  if (nextDay) {
    const targetDay = dayNames.indexOf(nextDay[1]);
    const currentDay = today.getDay();
    let diff = targetDay - currentDay;
    if (diff <= 0) diff += 7;
    return toISO(addDays(today, diff));
  }

  // Try native date parsing as fallback
  const parsed = new Date(input);
  if (!Number.isNaN(parsed.getTime())) {
    return toISO(parsed);
  }

  return input;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISO(date: Date): string {
  return date.toISOString().split("T")[0];
}
