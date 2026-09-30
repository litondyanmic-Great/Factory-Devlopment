import { useState, useMemo } from 'react';
import {
  Boxes,
  Printer,
  Plus,
  Trash2,
  Calculator,
  Ship,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Building,
} from 'lucide-react';
import { useLang } from '../../lib/i18n';
import { useSettings } from '../../lib/settingsContext';
import { Field, inputClass, btnPrimary, btnSecondary, StatCard, EmptyState, Modal } from '../../components/ui';
import ExportBar from '../../components/ExportBar';

const INITIAL_PACKING_LIST = {
  styleNo: 'HM-2026/SW-01',
  styleName: "Men's Crew Neck Pullover",
  buyer: 'H&M Hennes & Mauritz GBC AB',
  poNo: 'PO-994821',
  invoiceNo: 'INV-2026-EXP-088',
  destination: 'Hamburg Port, Germany',
  countryOfOrigin: 'Bangladesh',
  cartonLengthCm: 60,
  cartonWidthCm: 40,
  cartonHeightCm: 30,
  cartonNetWeightKg: 12.0,
  cartonGrossWeightKg: 13.5,
  rows: [
    { id: 1, ctnFrom: 1, ctnTo: 20, color: 'Navy Blue', xs: 0, s: 5, m: 10, l: 10, xl: 5, xxl: 0, pcsPerCtn: 30, totalCtns: 20 },
    { id: 2, ctnFrom: 21, ctnTo: 45, color: 'Navy Blue', xs: 0, s: 6, m: 12, l: 8, xl: 4, xxl: 0, pcsPerCtn: 30, totalCtns: 25 },
    { id: 3, ctnFrom: 46, ctnTo: 70, color: 'Heather Grey', xs: 4, s: 8, m: 10, l: 6, xl: 2, xxl: 0, pcsPerCtn: 30, totalCtns: 25 },
    { id: 4, ctnFrom: 71, ctnTo: 90, color: 'Heather Grey', xs: 0, s: 5, m: 10, l: 10, xl: 5, xxl: 0, pcsPerCtn: 30, totalCtns: 20 },
  ],
};

export default function PackingListGenerator() {
  const { t, lang } = useLang();
  const { settings } = useSettings();

  const [docData, setDocData] = useState(INITIAL_PACKING_LIST);
  const [isPrintView, setIsPrintView] = useState(false);

  const companyName = lang === 'en' ? settings?.companyNameEn || settings?.companyName : settings?.companyName;

  // Single carton volume in CBM
  const singleCtnCbm = useMemo(() => {
    const l = Number(docData.cartonLengthCm) || 0;
    const w = Number(docData.cartonWidthCm) || 0;
    const h = Number(docData.cartonHeightCm) || 0;
    return (l * w * h) / 1000000;
  }, [docData.cartonLengthCm, docData.cartonWidthCm, docData.cartonHeightCm]);

  // Aggregate totals
  const summary = useMemo(() => {
    let totalCartons = 0;
    let totalPcs = 0;

    docData.rows.forEach((r) => {
      const ctns = Math.max(0, Number(r.ctnTo) - Number(r.ctnFrom) + 1);
      const pcs = ctns * Number(r.pcsPerCtn || 0);
      totalCartons += ctns;
      totalPcs += pcs;
    });

    const totalCbm = totalCartons * singleCtnCbm;
    const totalNetWeight = totalCartons * Number(docData.cartonNetWeightKg || 0);
    const totalGrossWeight = totalCartons * Number(docData.cartonGrossWeightKg || 0);

    return {
      totalCartons,
      totalPcs,
      totalCbm,
      totalNetWeight,
      totalGrossWeight,
    };
  }, [docData, singleCtnCbm]);

  function handleAddRow() {
    const lastRow = docData.rows[docData.rows.length - 1];
    const nextFrom = lastRow ? Number(lastRow.ctnTo) + 1 : 1;
    const nextTo = nextFrom + 19;

    setDocData((prev) => ({
      ...prev,
      rows: [
        ...prev.rows,
        {
          id: Date.now(),
          ctnFrom: nextFrom,
          ctnTo: nextTo,
          color: lastRow ? lastRow.color : 'Navy Blue',
          xs: 0,
          s: 5,
          m: 10,
          l: 10,
          xl: 5,
          xxl: 0,
          pcsPerCtn: 30,
          totalCtns: nextTo - nextFrom + 1,
        },
      ],
    }));
  }

  function handleRemoveRow(id) {
    if (docData.rows.length <= 1) return;
    setDocData((prev) => ({
      ...prev,
      rows: prev.rows.filter((r) => r.id !== id),
    }));
  }

  function handleRowChange(id, field, value) {
    setDocData((prev) => {
      const updated = prev.rows.map((r) => {
        if (r.id !== id) return r;
        const newObj = { ...r, [field]: value };
        // Recalculate pcs per ctn if size breakdown changed
        if (['xs', 's', 'm', 'l', 'xl', 'xxl'].includes(field)) {
          newObj.pcsPerCtn =
            Number(field === 'xs' ? value : newObj.xs || 0) +
            Number(field === 's' ? value : newObj.s || 0) +
            Number(field === 'm' ? value : newObj.m || 0) +
            Number(field === 'l' ? value : newObj.l || 0) +
            Number(field === 'xl' ? value : newObj.xl || 0) +
            Number(field === 'xxl' ? value : newObj.xxl || 0);
        }
        return newObj;
      });
      return { ...prev, rows: updated };
    });
  }

  const exportColumns = [
    { key: 'ctnRange', label: t('কার্টুন নং', 'Carton No'), render: (r) => `${r.ctnFrom} - ${r.ctnTo}` },
    { key: 'color', label: t('কালার', 'Color') },
    { key: 'xs', label: 'XS' },
    { key: 's', label: 'S' },
    { key: 'm', label: 'M' },
    { key: 'l', label: 'L' },
    { key: 'xl', label: 'XL' },
    { key: 'xxl', label: 'XXL' },
    { key: 'pcsPerCtn', label: t('পিস/কার্টুন', 'Pcs/Ctn') },
    { key: 'totalCtns', label: t('মোট কার্টুন', 'Total Ctns'), render: (r) => `${r.ctnTo - r.ctnFrom + 1}` },
    { key: 'totalPcs', label: t('মোট পিস', 'Total Pcs'), render: (r) => `${(r.ctnTo - r.ctnFrom + 1) * r.pcsPerCtn}` },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink flex items-center gap-2">
            <Boxes className="text-indigo" size={26} />
            {t('এক্সপোর্ট প্যাকিং লিস্ট ও কার্টুন ক্যালকুলেটর', 'Export Packing List & CBM Calculator')}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {t(
              'সাইজ/কালার রেশিও ব্রেকডাউন, কার্টুন ভলিউম (CBM) ও নেট/গ্রস ওজন হিসাব করে প্রফেশনাল এক্সপোর্ট প্যাকিং লিস্ট তৈরি করুন।',
              'Calculate size/color breakdown, carton volume (CBM), and gross/net weights to generate export-ready packing lists.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportBar
            title={t('এক্সপোর্ট প্যাকিং লিস্ট', 'Export Packing List')}
            filename={`packing-list-${docData.poNo}`}
            columns={exportColumns}
            rows={docData.rows}
          />
          <button
            type="button"
            onClick={() => setIsPrintView(true)}
            className={`${btnPrimary} flex items-center gap-1.5 !text-xs`}
          >
            <Printer size={15} />
            {t('অফিশিয়াল প্যাকিং লিস্ট প্রিভিউ ও প্রিন্ট', 'Preview & Print Packing List')}
          </button>
        </div>
      </div>

      {/* PRINTABLE OFFICIAL EXPORT PACKING LIST MODAL */}
      {isPrintView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto print:fixed print:inset-0 print:bg-white print:p-0">
          <div className="relative w-full max-w-4xl rounded-lg bg-white p-8 text-black shadow-2xl print:p-0 print:shadow-none print:max-w-none max-h-[95vh] overflow-y-auto">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between border-b pb-4 mb-6 print:hidden">
              <span className="font-display font-semibold text-lg text-indigo-deep">
                {t('অফিশিয়াল এক্সপোর্ট প্যাকিং লিস্ট প্রিভিউ', 'Official Export Packing List Preview')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded bg-indigo px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-deep"
                >
                  <Printer size={15} />
                  {t('প্রিন্ট করুন (Print Now)', 'Print Now')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const printable = document.querySelector('.printable-packing-sheet');
                    if (!printable) return;
                    const docHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Packing_List_${docData.poNo}</title><style>@page{size:A4 landscape;margin:10mm;}body{font-family:sans-serif;color:#111;margin:0;padding:15px;}table{width:100%;border-collapse:collapse;margin-top:10px;}th,td{border:1px solid #333;padding:5px 8px;font-size:11px;}th{background:#f0f0f0;}.text-right{text-align:right;}.text-center{text-align:center;}@media print{.no-print{display:none;}}</style></head><body><div class="no-print" style="margin-bottom:12px;"><button onclick="window.print()" style="padding:6px 14px;background:#2B4570;color:#fff;border:0;border-radius:4px;cursor:pointer;font-weight:bold;">🖨️ Print Packing List</button></div>${printable.innerHTML}</body></html>`;
                    const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Packing_List_${docData.poNo || 'export'}.html`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 2000);
                  }}
                  className="flex items-center gap-1.5 rounded border border-indigo px-3 py-2 text-xs font-semibold text-indigo hover:bg-indigo/5"
                >
                  <Boxes size={15} />
                  {t('ডাউনলোড ফাইল', 'Download File')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintView(false)}
                  className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100"
                >
                  ✕ {t('বন্ধ করুন', 'Close')}
                </button>
              </div>
            </div>

            {/* PRINT CONTAINER */}
            <div className="printable-packing-sheet space-y-5 text-sm text-gray-900 leading-relaxed font-sans">
              <div className="text-center border-b-2 border-gray-800 pb-3">
                <h1 className="text-2xl font-bold uppercase tracking-wider">{companyName || 'Factory ERP'}</h1>
                <p className="text-xs text-gray-600 mt-0.5">{settings?.address || 'Kashimpur, Gazipur, Dhaka, Bangladesh'}</p>
                <p className="text-xs text-gray-600">Phone: ${settings?.phone || '+880 1711-000000'} • Export License: EXP-BD-89021</p>
                <div className="inline-block mt-2 px-6 py-1 border-2 border-black font-bold uppercase tracking-widest text-sm bg-gray-50">
                  COMMERCIAL EXPORT PACKING LIST & WEIGHT NOTE
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs border border-gray-300 p-3 rounded">
                <div>
                  <div><strong>Buyer / Consignee:</strong> {docData.buyer}</div>
                  <div><strong>Style No:</strong> {docData.styleNo} ({docData.styleName})</div>
                  <div><strong>PO Number:</strong> {docData.poNo}</div>
                  <div><strong>Invoice No:</strong> {docData.invoiceNo}</div>
                </div>
                <div>
                  <div><strong>Destination Port:</strong> {docData.destination}</div>
                  <div><strong>Country of Origin:</strong> {docData.countryOfOrigin}</div>
                  <div><strong>Carton Size (L x W x H):</strong> {docData.cartonLengthCm} x {docData.cartonWidthCm} x {docData.cartonHeightCm} cm</div>
                  <div><strong>Single Ctn Volume:</strong> {singleCtnCbm.toFixed(4)} CBM</div>
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-5 gap-2 text-center text-xs font-semibold bg-gray-50 p-2.5 rounded border border-gray-300">
                <div>Total Cartons: <span className="text-indigo-deep font-bold text-sm block">{summary.totalCartons} Ctns</span></div>
                <div>Total Quantity: <span className="text-indigo-deep font-bold text-sm block">{summary.totalPcs.toLocaleString()} Pcs</span></div>
                <div>Total Volume: <span className="text-indigo-deep font-bold text-sm block">{summary.totalCbm.toFixed(2)} CBM</span></div>
                <div>Total Net Weight: <span className="text-indigo-deep font-bold text-sm block">{summary.totalNetWeight.toFixed(1)} kg</span></div>
                <div>Total Gross Weight: <span className="text-indigo-deep font-bold text-sm block">{summary.totalGrossWeight.toFixed(1)} kg</span></div>
              </div>

              {/* Table */}
              <table className="w-full border-collapse border border-gray-400 text-xs">
                <thead>
                  <tr className="bg-gray-100 text-gray-800 font-semibold border-b border-gray-400">
                    <th className="border border-gray-400 p-2 text-center w-24">Ctn Range</th>
                    <th className="border border-gray-400 p-2 text-left">Color</th>
                    <th className="border border-gray-400 p-1 text-center w-10">XS</th>
                    <th className="border border-gray-400 p-1 text-center w-10">S</th>
                    <th className="border border-gray-400 p-1 text-center w-10">M</th>
                    <th className="border border-gray-400 p-1 text-center w-10">L</th>
                    <th className="border border-gray-400 p-1 text-center w-10">XL</th>
                    <th className="border border-gray-400 p-1 text-center w-10">XXL</th>
                    <th className="border border-gray-400 p-2 text-right w-16">Pcs/Ctn</th>
                    <th className="border border-gray-400 p-2 text-right w-16">Ctns</th>
                    <th className="border border-gray-400 p-2 text-right w-20">Total Pcs</th>
                  </tr>
                </thead>
                <tbody>
                  {docData.rows.map((r) => {
                    const ctns = Math.max(0, Number(r.ctnTo) - Number(r.ctnFrom) + 1);
                    const totalPcs = ctns * Number(r.pcsPerCtn || 0);
                    return (
                      <tr key={r.id} className="border-b border-gray-300">
                        <td className="border border-gray-300 p-2 text-center font-mono font-bold">{r.ctnFrom} - {r.ctnTo}</td>
                        <td className="border border-gray-300 p-2 font-medium">{r.color}</td>
                        <td className="border border-gray-300 p-1 text-center">{r.xs || '—'}</td>
                        <td className="border border-gray-300 p-1 text-center">{r.s || '—'}</td>
                        <td className="border border-gray-300 p-1 text-center">{r.m || '—'}</td>
                        <td className="border border-gray-300 p-1 text-center">{r.l || '—'}</td>
                        <td className="border border-gray-300 p-1 text-center">{r.xl || '—'}</td>
                        <td className="border border-gray-300 p-1 text-center">{r.xxl || '—'}</td>
                        <td className="border border-gray-300 p-2 text-right font-medium">{r.pcsPerCtn}</td>
                        <td className="border border-gray-300 p-2 text-right font-bold">{ctns}</td>
                        <td className="border border-gray-300 p-2 text-right font-bold">{totalPcs.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold border-t-2 border-gray-500">
                    <td colSpan={8} className="p-2.5 text-right">Grand Total:</td>
                    <td className="p-2.5 text-right">—</td>
                    <td className="p-2.5 text-right">{summary.totalCartons} Ctns</td>
                    <td className="p-2.5 text-right">{summary.totalPcs.toLocaleString()} Pcs</td>
                  </tr>
                </tfoot>
              </table>

              {/* Signatures */}
              <div className="grid grid-cols-4 gap-6 pt-10 text-center text-xs">
                <div>
                  <div className="border-t border-black pt-1">
                    <p className="font-semibold">Prepared By</p>
                    <p className="text-[10px] text-gray-500">Commercial / Packing</p>
                  </div>
                </div>
                <div>
                  <div className="border-t border-black pt-1">
                    <p className="font-semibold">Quality Assurance</p>
                    <p className="text-[10px] text-gray-500">GPQ Final Inspection</p>
                  </div>
                </div>
                <div>
                  <div className="border-t border-black pt-1">
                    <p className="font-semibold">Store & Dispatch</p>
                    <p className="text-[10px] text-gray-500">CFS Dispatch Verified</p>
                  </div>
                </div>
                <div>
                  <div className="border-t border-black pt-1">
                    <p className="font-semibold">Authorized Signature</p>
                    <p className="text-[10px] text-gray-500">General Manager / MD</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor View Content */}
      <div className={`space-y-6 ${isPrintView ? 'print:hidden' : ''}`}>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label={t('মোট কার্টুন', 'Total Cartons')} value={`${summary.totalCartons} Ctns`} />
        <StatCard label={t('মোট গার্মেন্টস পিস', 'Total Garments')} value={`${summary.totalPcs.toLocaleString()} pcs`} tone="indigo" />
        <StatCard label={t('মোট ভলিউম (CBM)', 'Total Volume (CBM)')} value={`${summary.totalCbm.toFixed(2)} m³`} tone="amber" sub={`1 Ctn = ${singleCtnCbm.toFixed(3)} CBM`} />
        <StatCard label={t('মোট নেট ওজন', 'Total Net Weight')} value={`${summary.totalNetWeight.toFixed(1)} kg`} sub="Goods weight" />
        <StatCard label={t('মোট গ্রস ওজন', 'Total Gross Weight')} value={`${summary.totalGrossWeight.toFixed(1)} kg`} tone="green" sub="With packaging" />
      </div>

      {/* Carton Specification Bar */}
      <div className="rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center gap-2 border-b border-line pb-2 mb-3">
          <Calculator size={18} className="text-indigo" />
          <h2 className="font-display text-sm font-semibold text-ink">
            {t('মাস্টার কার্টুন সাইজ ও ওজন স্পেসিফিকেশন (CBM Calculation)', 'Master Carton Dimensions & CBM Setup')}
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Field label={t('দৈর্ঘ্য (Length cm)', 'Length (cm)')}>
            <input
              type="number"
              className={inputClass}
              value={docData.cartonLengthCm}
              onChange={(e) => setDocData((d) => ({ ...d, cartonLengthCm: e.target.value }))}
            />
          </Field>
          <Field label={t('প্রস্থ (Width cm)', 'Width (cm)')}>
            <input
              type="number"
              className={inputClass}
              value={docData.cartonWidthCm}
              onChange={(e) => setDocData((d) => ({ ...d, cartonWidthCm: e.target.value }))}
            />
          </Field>
          <Field label={t('উচ্চতা (Height cm)', 'Height (cm)')}>
            <input
              type="number"
              className={inputClass}
              value={docData.cartonHeightCm}
              onChange={(e) => setDocData((d) => ({ ...d, cartonHeightCm: e.target.value }))}
            />
          </Field>
          <Field label={t('নেট ওজন (Net Wt kg/ctn)', 'NW (kg/ctn)')}>
            <input
              type="number"
              step="0.1"
              className={inputClass}
              value={docData.cartonNetWeightKg}
              onChange={(e) => setDocData((d) => ({ ...d, cartonNetWeightKg: e.target.value }))}
            />
          </Field>
          <Field label={t('গ্রস ওজন (Gross Wt kg/ctn)', 'GW (kg/ctn)')}>
            <input
              type="number"
              step="0.1"
              className={inputClass}
              value={docData.cartonGrossWeightKg}
              onChange={(e) => setDocData((d) => ({ ...d, cartonGrossWeightKg: e.target.value }))}
            />
          </Field>
        </div>
      </div>

      {/* Shipment & PO Details Grid */}
      <div className="rounded-lg border border-line bg-surface p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label={t('বায়ারের নাম (Buyer)', 'Buyer Name')}>
            <input
              type="text"
              className={inputClass}
              value={docData.buyer}
              onChange={(e) => setDocData((d) => ({ ...d, buyer: e.target.value }))}
            />
          </Field>
          <Field label={t('স্টাইল নম্বর (Style No)', 'Style No')}>
            <input
              type="text"
              className={inputClass}
              value={docData.styleNo}
              onChange={(e) => setDocData((d) => ({ ...d, styleNo: e.target.value }))}
            />
          </Field>
          <Field label={t('পিও নম্বর (PO No)', 'PO No')}>
            <input
              type="text"
              className={inputClass}
              value={docData.poNo}
              onChange={(e) => setDocData((d) => ({ ...d, poNo: e.target.value }))}
            />
          </Field>
          <Field label={t('ইনভয়েস নম্বর (Invoice No)', 'Invoice No')}>
            <input
              type="text"
              className={inputClass}
              value={docData.invoiceNo}
              onChange={(e) => setDocData((d) => ({ ...d, invoiceNo: e.target.value }))}
            />
          </Field>
          <Field label={t('গন্তব্য পোর্ট / দেশ (Destination)', 'Destination Port')}>
            <input
              type="text"
              className={inputClass}
              value={docData.destination}
              onChange={(e) => setDocData((d) => ({ ...d, destination: e.target.value }))}
            />
          </Field>
          <Field label={t('উৎপত্তিস্থল (Country of Origin)', 'Country of Origin')}>
            <input
              type="text"
              className={inputClass}
              value={docData.countryOfOrigin}
              onChange={(e) => setDocData((d) => ({ ...d, countryOfOrigin: e.target.value }))}
            />
          </Field>
        </div>
      </div>

      {/* Carton Ratio Breakdown Table */}
      <div className="rounded-lg border border-line bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-ink">
            {t('কার্টুন অনুপাত ও সাইজ ব্রেকডাউন তালিকা', 'Carton Ratio & Size Breakdown Matrix')}
          </h2>
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-1 rounded bg-indigo px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-deep"
          >
            <Plus size={14} />
            {t('+ নতুন কার্টুন রেঞ্জ যোগ করুন', '+ Add Carton Range')}
          </button>
        </div>

        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[850px] text-xs">
            <thead>
              <tr className="border-b border-line text-left font-semibold text-ink-soft">
                <th className="py-2.5 pr-2 w-28">{t('কার্টুন রেঞ্জ', 'Ctn Range')}</th>
                <th className="py-2.5 pr-2 w-28">{t('কালার', 'Color')}</th>
                <th className="py-2.5 pr-1 text-center w-14">XS</th>
                <th className="py-2.5 pr-1 text-center w-14">S</th>
                <th className="py-2.5 pr-1 text-center w-14">M</th>
                <th className="py-2.5 pr-1 text-center w-14">L</th>
                <th className="py-2.5 pr-1 text-center w-14">XL</th>
                <th className="py-2.5 pr-1 text-center w-14">XXL</th>
                <th className="py-2.5 pr-2 text-right w-20">{t('পিস/Ctn', 'Pcs/Ctn')}</th>
                <th className="py-2.5 pr-2 text-right w-20">{t('মোট Ctn', 'Ctns')}</th>
                <th className="py-2.5 pr-2 text-right w-24">{t('মোট পিস', 'Total Pcs')}</th>
                <th className="py-2.5 pr-1 text-center w-10"></th>
              </tr>
            </thead>
            <tbody>
              {docData.rows.map((row) => {
                const ctns = Math.max(0, Number(row.ctnTo) - Number(row.ctnFrom) + 1);
                const totalPcs = ctns * Number(row.pcsPerCtn || 0);

                return (
                  <tr key={row.id} className="border-b border-line last:border-0 hover:bg-paper/50">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-1 font-mono">
                        <input
                          type="number"
                          className={`${inputClass} !py-1 !px-1.5 text-center !w-12 text-xs`}
                          value={row.ctnFrom}
                          onChange={(e) => handleRowChange(row.id, 'ctnFrom', e.target.value)}
                        />
                        <span>-</span>
                        <input
                          type="number"
                          className={`${inputClass} !py-1 !px-1.5 text-center !w-12 text-xs`}
                          value={row.ctnTo}
                          onChange={(e) => handleRowChange(row.id, 'ctnTo', e.target.value)}
                        />
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        className={`${inputClass} !py-1 text-xs`}
                        value={row.color}
                        onChange={(e) => handleRowChange(row.id, 'color', e.target.value)}
                      />
                    </td>
                    <td className="py-2 pr-1 text-center">
                      <input
                        type="number"
                        className={`${inputClass} !py-1 text-center !w-12 text-xs`}
                        value={row.xs}
                        onChange={(e) => handleRowChange(row.id, 'xs', e.target.value)}
                      />
                    </td>
                    <td className="py-2 pr-1 text-center">
                      <input
                        type="number"
                        className={`${inputClass} !py-1 text-center !w-12 text-xs`}
                        value={row.s}
                        onChange={(e) => handleRowChange(row.id, 's', e.target.value)}
                      />
                    </td>
                    <td className="py-2 pr-1 text-center">
                      <input
                        type="number"
                        className={`${inputClass} !py-1 text-center !w-12 text-xs`}
                        value={row.m}
                        onChange={(e) => handleRowChange(row.id, 'm', e.target.value)}
                      />
                    </td>
                    <td className="py-2 pr-1 text-center">
                      <input
                        type="number"
                        className={`${inputClass} !py-1 text-center !w-12 text-xs`}
                        value={row.l}
                        onChange={(e) => handleRowChange(row.id, 'l', e.target.value)}
                      />
                    </td>
                    <td className="py-2 pr-1 text-center">
                      <input
                        type="number"
                        className={`${inputClass} !py-1 text-center !w-12 text-xs`}
                        value={row.xl}
                        onChange={(e) => handleRowChange(row.id, 'xl', e.target.value)}
                      />
                    </td>
                    <td className="py-2 pr-1 text-center">
                      <input
                        type="number"
                        className={`${inputClass} !py-1 text-center !w-12 text-xs`}
                        value={row.xxl}
                        onChange={(e) => handleRowChange(row.id, 'xxl', e.target.value)}
                      />
                    </td>
                    <td className="py-2 pr-2 text-right font-bold text-ink">
                      {row.pcsPerCtn}
                    </td>
                    <td className="py-2 pr-2 text-right font-bold text-indigo">
                      {ctns}
                    </td>
                    <td className="py-2 pr-2 text-right font-bold text-ink">
                      {totalPcs.toLocaleString()}
                    </td>
                    <td className="py-2 pr-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        disabled={docData.rows.length <= 1}
                        className="text-red hover:opacity-80 disabled:opacity-20 font-bold"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line bg-paper font-bold text-ink">
                <td colSpan={8} className="py-3 px-2 text-right">
                  {t('সর্বমোট (Grand Total):', 'Grand Total:')}
                </td>
                <td className="py-3 pr-2 text-right">—</td>
                <td className="py-3 pr-2 text-right text-indigo font-display text-sm">
                  {summary.totalCartons} Ctns
                </td>
                <td className="py-3 pr-2 text-right text-green font-display text-sm">
                  {summary.totalPcs.toLocaleString()} pcs
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}
