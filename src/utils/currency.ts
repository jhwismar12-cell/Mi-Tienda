/**
 * Utilities for handling 4-decimal distributor unit costs while keeping clean
 * 2-decimal default formatting when trailing digits are zero.
 */

export function roundCostPrice(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Number(value.toFixed(4));
}

export function formatCostPrice(value: number): string {
  const rounded = roundCostPrice(value);
  return rounded.toFixed(4).replace(/(\.\d{2,}?)0+$/, '$1');
}

export function parseDecimalInput(raw: string): number {
  const normalized = raw.trim().replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
