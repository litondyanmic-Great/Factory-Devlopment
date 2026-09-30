// Dependency-free Excel & PDF export.
//
// Excel: Excel/Sheets/LibreOffice all happily open an .xls file whose
// content is actually an HTML <table> served with the right MIME type —
// this avoids pulling in a heavy binary-format library just to make a
// spreadsheet a user will open and glance at once.
//
// PDF: we render a print-ready HTML page (letterhead + table) in a new
// window and call window.print(), so the user picks "Save as PDF" in the
// browser's print dialog. Every modern browser/OS can do this natively
// with zero extra libraries and it renders the logo/letterhead perfectly.

function escapeHtml(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function letterheadHtml(settings, lang, title, subtitle) {
  const companyName = lang === 'en' ? settings?.companyNameEn || settings?.companyName : settings?.companyName;
  const logo = settings?.logoDataUrl
    ? `<img src="${settings.logoDataUrl}" style="height:52px;width:52px;object-fit:contain;border-radius:8px;" />`
    : '';
  const generatedLabel = lang === 'en' ? 'Generated' : 'তৈরি হয়েছে';
  const now = new Date().toLocaleString(lang === 'en' ? 'en-US' : 'bn-BD');
  return `
    <div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #2B4570;padding-bottom:14px;margin-bottom:18px;">
      ${logo}
      <div style="flex:1;">
        <div style="font-size:20px;font-weight:700;color:#1B2C46;">${escapeHtml(companyName || '')}</div>
        ${settings?.address ? `<div style="font-size:11px;color:#5B5F68;">${escapeHtml(settings.address)}</div>` : ''}
        ${settings?.phone ? `<div style="font-size:11px;color:#5B5F68;">${escapeHtml(settings.phone)}</div>` : ''}
      </div>
      <div style="text-align:right;font-size:10px;color:#5B5F68;">
        <div>${generatedLabel}: ${escapeHtml(now)}</div>
      </div>
    </div>
    <div style="margin-bottom:14px;">
      <div style="font-size:16px;font-weight:700;color:#1C1E22;">${escapeHtml(title)}</div>
      ${subtitle ? `<div style="font-size:12px;color:#5B5F68;margin-top:2px;">${escapeHtml(subtitle)}</div>` : ''}
    </div>
  `;
}

function tableHtml(columns, rows) {
  const thead = columns
    .map((c) => `<th style="border:1px solid #ccc;background:#2B4570;color:#fff;padding:6px 8px;text-align:left;font-size:12px;">${escapeHtml(c.label)}</th>`)
    .join('');
  const tbody = rows
    .map(
      (r, i) =>
        `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#F5F6F8'};">` +
        columns
          .map((c) => `<td style="border:1px solid #ddd;padding:5px 8px;font-size:12px;">${escapeHtml(c.render ? c.render(r) : r[c.key])}</td>`)
          .join('') +
        `</tr>`
    )
    .join('');
  return `<table style="border-collapse:collapse;width:100%;"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
}

// Renders either one plain table (columns/rows passed directly — the
// original single-table API every existing caller uses) or, when
// `sections` is passed instead, several labeled tables stacked in one
// document — used for "everything about this style in one sheet" style
// reports that need several distinct tables (yarn, accessories,
// production, etc.) rather than one flat grid.
function bodyHtml({ columns, rows, sections }) {
  if (sections && sections.length) {
    return sections
      .map(
        (s) => `
          <div style="margin-top:22px;">
            <div style="font-size:13px;font-weight:700;color:#2B4570;border-bottom:1px solid #E4E1D8;padding-bottom:4px;margin-bottom:8px;">${escapeHtml(s.heading)}</div>
            ${s.rows && s.rows.length ? tableHtml(s.columns, s.rows) : `<div style="font-size:12px;color:#5B5F68;">${escapeHtml(s.emptyLabel || 'No data')}</div>`}
          </div>
        `
      )
      .join('');
  }
  return tableHtml(columns, rows);
}

export function exportToExcel({ filename, title, subtitle, columns, rows, sections, settings, lang }) {
  const html = `
    <html><head><meta charset="UTF-8"></head>
    <body>
      <div style="font-family:sans-serif;">
        ${letterheadHtml(settings, lang, title, subtitle)}
        ${bodyHtml({ columns, rows, sections })}
      </div>
    </body></html>
  `;
  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function generatePrintableHtml({ filename, title, subtitle, columns, rows, sections, settings, lang }) {
  return `
    <!DOCTYPE html>
    <html lang="${lang === 'en' ? 'en' : 'bn'}">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(filename || title || 'Report')}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1C1E22;
          background: #ffffff;
          margin: 0;
          padding: 14px;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
        th, td { border: 1px solid #c8c5bc; padding: 6px 8px; text-align: left; }
        th { background: #2B4570 !important; color: #ffffff !important; font-weight: 600; }
        tr:nth-child(even) { background-color: #f7f6f2; }
        .print-btn-bar {
          margin-bottom: 12px;
          padding: 8px 12px;
          background: #eef2f7;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        @media print {
          .print-btn-bar { display: none !important; }
          body { padding: 0 !important; }
        }
      </style>
    </head>
    <body>
      <div class="print-btn-bar">
        <strong>${escapeHtml(title || 'Document')}</strong>
        <button onclick="window.print()" style="background:#2B4570;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:bold;">
          🖨️ ${lang === 'en' ? 'Print / Save as PDF' : 'প্রিন্ট / PDF সেভ করুন'}
        </button>
      </div>
      ${letterheadHtml(settings, lang, title, subtitle)}
      ${bodyHtml({ columns, rows, sections })}
      <script>
        window.addEventListener('load', function() {
          setTimeout(function() {
            try { window.print(); } catch(e) {}
          }, 300);
        });
      </script>
    </body>
    </html>
  `;
}

export function exportToPDF({ filename, title, subtitle, columns, rows, sections, settings, lang }) {
  const safeFilename = (filename || 'factory-report').replace(/[^a-zA-Z0-9_\-\u0980-\u09FF]/g, '_');
  const html = generatePrintableHtml({ filename: safeFilename, title, subtitle, columns, rows, sections, settings, lang });

  let printed = false;

  // Method 1: Hidden iframe printing
  try {
    let frame = document.getElementById('report-print-iframe');
    if (!frame) {
      frame = document.createElement('iframe');
      frame.id = 'report-print-iframe';
      frame.style.position = 'fixed';
      frame.style.right = '0';
      frame.style.bottom = '0';
      frame.style.width = '1px';
      frame.style.height = '1px';
      frame.style.opacity = '0.01';
      frame.style.border = '0';
      document.body.appendChild(frame);
    }
    const frameDoc = frame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    setTimeout(() => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        printed = true;
      } catch {
        fallbackBlobDownload(html, safeFilename);
      }
    }, 450);
    return;
  } catch {
    // If iframe access is denied
  }

  // Method 2: Blob fallback download so user is NEVER blocked
  if (!printed) {
    fallbackBlobDownload(html, safeFilename);
  }
}

function fallbackBlobDownload(html, filename) {
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {
    window.print();
  }
}
