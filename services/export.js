import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Share } from 'react-native';
import * as XLSX from 'xlsx';
import { currencySymbol, fmtNumber, prettyDate, txLabel } from '@/utils/format';

const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const canShare = async () => {
  const ok = await Sharing.isAvailableAsync();
  if (!ok) throw new Error('Sharing is not available on this device');
};

const writeAndShare = async (filename, content, encoding, dialogTitle) => {
  await canShare();
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, content, { encoding });
  await Sharing.shareAsync(uri, { dialogTitle });
};

// ---- CSV ------------------------------------------------------------------
export const shareCSV = (filename, headers, rows) =>
  writeAndShare(
    filename,
    [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n'),
    FileSystem.EncodingType.UTF8,
    filename
  );

// ---- XLSX -----------------------------------------------------------------
// extraSheets: optional [[name, aoa], ...] appended after the main sheet.
export const shareXLSX = async (filename, sheetName, aoa, extraSheets = []) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheetName.slice(0, 31));
  for (const [name, sheetAoa] of extraSheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetAoa), name.slice(0, 31));
  }
  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  await writeAndShare(filename, base64, FileSystem.EncodingType.Base64, filename);
};

// ---- PDF (mirrors the Reports screen: KPI cards + daily table) -------------
const css = `
  * { box-sizing: border-box; font-family: Helvetica, Arial, sans-serif; }
  body { margin: 0; padding: 24px; }
  h1 { font-size: 20px; margin: 0; color: #111827; }
  h2 { font-size: 14px; margin: 26px 0 8px; color: #111827; }
  .sub { color: #6B7280; font-size: 12px; margin: 4px 0 18px; }
  .kpis { display: flex; gap: 8px; margin-bottom: 18px; }
  .kpi { flex: 1; border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px; }
  .kpi .l { font-size: 10px; text-transform: uppercase; color: #6B7280; letter-spacing: .5px; }
  .kpi .v { font-size: 15px; font-weight: 700; margin-top: 4px; }
  /* fixed layout so a long value can never push columns off the page */
  table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
  th { text-align: right; text-transform: uppercase; font-size: 9px; color: #6B7280;
       border-bottom: 2px solid #E5E7EB; padding: 6px 4px; }
  th.l, td.l { text-align: left; }
  td { border-bottom: 1px solid #F3F4F6; padding: 7px 4px; text-align: right;
       overflow-wrap: break-word; }
  .pos { color: #16A34A; } .neg { color: #DC2626; }
`;

const money = (n) => `${currencySymbol()}${fmtNumber(n)}`;

// Shared markup for the Closing Balance Report — rendered for the in-app
// preview modal and the exported PDF file alike.
export const reportHtml = ({ title, subtitle, totals, transactions = [] }) => {
  const sym = currencySymbol();
  // Running-balance ledger: each row carries the balance before (Opening) and
  // after (Closing) its entry, starting from the range's opening balance.
  let running = Number(totals.opening_balance ?? 0);
  const txRows = transactions
    .map((x) => {
      const opening = running;
      running += x.type === 'income' ? Number(x.amount) : -Number(x.amount);
      return `<tr>
        <td class="l">${prettyDate(x.business_date)}</td>
        <td>${fmtNumber(opening)}</td>
        <td class="pos">${x.type === 'income' ? fmtNumber(x.amount) : ''}</td>
        <td class="l">${(txLabel(x) || '—').replace(/</g, '&lt;')}</td>
        <td class="neg">${x.type === 'expense' ? fmtNumber(x.amount) : ''}</td>
        <td>${fmtNumber(running)}</td></tr>`;
    })
    .join('');
  return `<!doctype html><html><head><style>${css}</style></head><body>
    <h1>${title}</h1><div class="sub">Closing Balance Report — ${subtitle}</div>
    <div class="kpis">
      <div class="kpi"><div class="l">Credit</div><div class="v pos">${money(totals.credit)}</div></div>
      <div class="kpi"><div class="l">Debit</div><div class="v neg">${money(totals.debit)}</div></div>
      <div class="kpi"><div class="l">Net</div><div class="v">${money(totals.net)}</div></div>
      <div class="kpi"><div class="l">Balance</div><div class="v">${money(totals.closing_balance)}</div></div>
    </div>
    ${txRows ? `<table>
      <colgroup><col style="width:12%"><col style="width:15%"><col style="width:13%"><col style="width:32%"><col style="width:13%"><col style="width:15%"></colgroup>
      <tr><th class="l">Date</th><th>Opening (${sym})</th><th>Received (${sym})</th><th class="l">Description</th><th>Paid (${sym})</th><th>Closing (${sym})</th></tr>
      ${txRows}
    </table>` : '<div class="sub">No transactions in this range.</div>'}
    </body></html>`;
};

export const shareReportPDF = async (filename, payload) => {
  await canShare();
  const html = reportHtml(payload);
  // printToFileAsync writes outside expo-sharing's permitted dirs — render to
  // base64 and write into cacheDirectory ourselves so shareAsync can read it.
  const { base64 } = await Print.printToFileAsync({ html, base64: true });
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(uri, { dialogTitle: filename, mimeType: 'application/pdf' });
};

// ---- WhatsApp (plain-text share) -------------------------------------------
// Opens WhatsApp directly with the report as a text message; falls back to the
// native share sheet when WhatsApp isn't installed.
export const shareTextWhatsApp = async (text) => {
  const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
  if (await Linking.canOpenURL(url)) {
    await Linking.openURL(url);
  } else {
    await Share.share({ message: text });
  }
};

// Formats a range report as readable plain text for WhatsApp/SMS/clipboard.
export const reportAsText = ({ workspace, range, totals, days, transactions = [] }) => {
  const line = (label, value) => `${label}: ${money(value)}`;
  const dayRows = (days ?? []).map(
    (d) =>
      `${prettyDate(d.business_date ?? d.date)}  |  O:${money(d.opening_balance)}  +${money(d.credit)}  −${money(d.debit)}  =${money(d.closing_balance)}`
  );
  const txRows = transactions.map(
    (x) =>
      `${prettyDate(x.business_date)}  |  ${txLabel(x) || '—'}  ${x.type === 'income' ? '+' : '−'}${money(x.amount)}`
  );
  return [
    `*${workspace} — Report*`,
    `${range.from} → ${range.to}`,
    '',
    line('Credit', totals.credit),
    line('Debit', totals.debit),
    line('Net', totals.net),
    line('Balance', totals.closing_balance),
    '',
    ...dayRows,
    ...(txRows.length ? ['', '*Transactions*', ...txRows] : []),
  ].join('\n');
};
