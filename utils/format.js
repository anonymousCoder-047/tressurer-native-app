import { currencyMeta, useSettingsStore } from '@/store/useSettingsStore';

export const fmtMoney = (n) => {
  const num = Number(n ?? 0);
  const s = useSettingsStore.getState();
  const { symbol, locale } = currencyMeta(s.currency, s.custom);
  return `${symbol}${num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// YYYY-MM-DD for a Date (local time — matches the backend's business_date).
export const toISODate = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const todayISO = () => toISODate(new Date());

// First/last day of the month containing `d`.
export const monthRange = (d) => ({
  from: toISODate(new Date(d.getFullYear(), d.getMonth(), 1)),
  to: toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
});

export const monthLabel = (d) =>
  d.toLocaleString('en-US', { month: 'long', year: 'numeric' });

export const shiftMonth = (d, delta) => new Date(d.getFullYear(), d.getMonth() + delta, 1);

// The API returns business_date as a full timestamp ("2026-10-17T20:00:00.000Z")
// — keep only the date part, otherwise string concatenation gives Invalid Date.
const datePart = (iso) => String(iso ?? '').slice(0, 10);

export const shiftDay = (iso, delta) => {
  const d = new Date(`${datePart(iso)}T12:00:00`); // noon avoids DST edge cases
  d.setDate(d.getDate() + delta);
  return toISODate(d);
};

export const prettyDate = (iso) =>
  new Date(`${datePart(iso)}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
