export function formatAUD(cents: number): string {
  const amount = cents / 100;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatAUDCompact(cents: number): string {
  const amount = cents / 100;
  if (Math.abs(amount) >= 1_000_000) {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  }
  if (Math.abs(amount) >= 10_000) {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return formatAUD(cents);
}

export function parseCentString(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;
  return Math.round(parsed * 100);
}

export function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}
