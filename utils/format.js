import { currencyMeta, useSettingsStore } from '@/store/useSettingsStore';

export const fmtMoney = (n) => {
  const num = Number(n ?? 0);
  const s = useSettingsStore.getState();
  const { symbol, locale } = currencyMeta(s.currency, s.custom);
  return `${symbol}${num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const currencySymbol = () => {
  const s = useSettingsStore.getState();
  return currencyMeta(s.currency, s.custom).symbol;
};

// Number only — no currency symbol. For tables whose headers carry it.
export const fmtNumber = (n) => {
  const s = useSettingsStore.getState();
  const { locale } = currencyMeta(s.currency, s.custom);
  return Number(n ?? 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

// Transaction label with the counterparty folded in:
// "Office supplies · Received from ACME" / "Rent · Paid to Landlord".
export const txLabel = (t) => {
  const base = t.description || t.category || '';
  const party = t.type === 'income' ? t.received_from : t.paid_to;
  if (!party) return base;
  const tag = `${t.type === 'income' ? 'Received from' : 'Paid to'} ${party}`;
  return base ? `${base} · ${tag}` : tag;
};

// App-wide display format: DD-MM-YYYY.
export const prettyDate = (iso) => {
  const [y, m, d] = datePart(iso).split('-');
  return `${d}-${m}-${y}`;
};
