import { format, formatISO, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

export const TIMEZONE = "Australia/Sydney";

export function nowSydney(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(toZonedTime(d, TIMEZONE), "dd MMM yyyy");
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(toZonedTime(d, TIMEZONE), "dd/MM/yyyy");
}

export function formatMonth(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(toZonedTime(d, TIMEZONE), "MMM yyyy");
}

export function currentMonthStart(): Date {
  const now = nowSydney();
  return fromZonedTime(startOfMonth(now), TIMEZONE);
}

export function currentMonthEnd(): Date {
  const now = nowSydney();
  return fromZonedTime(endOfMonth(now), TIMEZONE);
}

export function monthStart(year: number, month: number): Date {
  return fromZonedTime(new Date(year, month - 1, 1), TIMEZONE);
}

export function last12MonthStarts(): Array<{ year: number; month: number; label: string; date: Date }> {
  const now = nowSydney();
  return Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: format(d, "MMM yy"),
      date: fromZonedTime(startOfMonth(d), TIMEZONE),
    };
  });
}

export function toISODateString(date: Date): string {
  return formatISO(date, { representation: "date" });
}

export { endOfMonth };
