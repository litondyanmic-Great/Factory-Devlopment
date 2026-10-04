import { useState, useMemo, useEffect } from 'react';
import {
  Boxes,
  Printer,
  Plus,
  Calculator,
  CheckCircle2,
  Save,
  RotateCcw,
  Search,
  Pencil,
  Trash2,
  Download,
  List,
  AlertTriangle,
  X,
} from 'lucide-react';
import { db } from '../../firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { useLang } from '../../lib/i18n';
import { useSettings } from '../../lib/settingsContext';
import { Field, inputClass, btnPrimary, btnSecondary, EmptyState, Modal } from '../../components/ui';
import ExportBar from '../../components/ExportBar';
import { getLocalPackingLists, saveLocalPackingLists, deleteLocalPackingList, getLocalStyles } from '../../lib/demoData';

const DEFAULT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

function createBlankPackingList() {
  return {
    id: `pack-${Date.now()}`,
    styleNo: '',
    styleName: '',
    buyer: '',
    poNo: '',
    invoiceNo: '',
    destination: '',
    countryOfOrigin: 'Bangladesh',
    cartonLengthCm: 60,
    cartonWidthCm: 40,
    cartonHeightCm: 30,
    cartonNetWeightKg: '',
    cartonGrossWeightKg: '',
    sizes: DEFAULT_SIZES,
    rows: [],
  };
}

function getSizeValue(row, sz) {
  if (row.sizeRatios && row.sizeRatios[sz] !== undefined) {
    return Number(row.sizeRatios[sz]) || 0;
  }
  const lower = sz.toLowerCase();
  if (row[lower] !== undefined) {
    return Number(row[lower]) || 0;
  }
  return 0;
}

export default function PackingListGenerator() {
  const { t, lang } = useLang();
  const { settings } = useSettings();

  const [savedLists, setSavedLists] = useState(getLocalPackingLists);
  const [activeTab, setActiveTab] = useState(() => (getLocalPackingLists().length > 0 ? 'list' : 'editor')); // 'list' | 'editor'
  const [stylesList, setStylesList] = useState(getLocalStyles);

  const [docData, setDocData] = useState(() => {
    const list = getLocalPackingLists();
    return list.length > 0 ? list[0] : createBlankPackingList();
  });

  const [isPrintView, setIsPrintView] = useState(false);
  const [newSizeInput, setNewSizeInput] = useState('');
  const [showAddSize, setShowAddSize] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [packingListToDelete, setPackingListToDelete] = useState(null);
  const [toastNotice, setToastNotice] = useState('');

  // Sync with Firestore styles
  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, 'styles'), (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setStylesList(list);
        }
      });
    } catch {}
    return () => unsub();
  }, []);

  // Sync with Firestore collection 'packingLists' when available
  useEffect(() => {
    try {
      const q = collection(db, 'packingLists');
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list = snapshot.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((p) => p.id !== 'pack-hm-01' && p.id !== 'pack-zr-02' && p.id !== 'demo-pack-01');
            list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
            setSavedLists(list);
            saveLocalPackingLists(list);
          } else {
            setSavedLists([]);
            saveLocalPackingLists([]);
          }
        },
        (err) => {
          console.warn('Firestore packingLists snapshot fallback:', err);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn('Firestore not ready for packingLists:', e);
    }
  }, []);

  // Search & Filter for Saved Lists Table
  const [listSearch, setListSearch] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('all');

  const companyName = lang === 'en' ? settings?.companyNameEn || settings?.companyName : settings?.companyName;
  const activeSizes = docData.sizes || DEFAULT_SIZES;

  // Single carton volume in CBM
  const singleCtnCbm = useMemo(() => {
    const l = Number(docData.cartonLengthCm) || 0;
    const w = Number(docData.cartonWidthCm) || 0;
    const h = Number(docData.cartonHeightCm) || 0;
    return (l * w * h) / 1000000;
  }, [docData.cartonLengthCm, docData.cartonWidthCm, docData.cartonHeightCm]);

  // Aggregate totals of active docData
  const summary = useMemo(() => {
    let totalCartons = 0;
    let totalPcs = 0;

    (docData.rows || []).forEach((r) => {
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

  // Unique buyers from saved lists
  const buyersList = useMemo(() => {
    const set = new Set(savedLists.map((i) => i.buyer).filter(Boolean));
    return Array.from(set).sort();
  }, [savedLists]);

  // Filtered saved lists for table view
  const filteredSavedLists = useMemo(() => {
    return savedLists.filter((item) => {
      const q = listSearch.toLowerCase();
      const matchSearch =
        !listSearch ||
        item.poNo?.toLowerCase().includes(q) ||
        item.styleNo?.toLowerCase().includes(q) ||
        item.styleName?.toLowerCase().includes(q) ||
        item.buyer?.toLowerCase().includes(q) ||
        item.destination?.toLowerCase().includes(q);

      const matchBuyer = buyerFilter === 'all' || item.buyer === buyerFilter;
      return matchSearch && matchBuyer;
    });
  }, [savedLists, listSearch, buyerFilter]);

  function handleAddRow() {
    const lastRow = docData.rows[docData.rows.length - 1];
    const nextFrom = lastRow ? Number(lastRow.ctnTo) + 1 : 1;
    const nextTo = nextFrom + 9;

    const initialRatios = {};
    activeSizes.forEach((sz) => {
      initialRatios[sz] = 0;
    });

    setDocData((prev) => ({
      ...prev,
      rows: [
        ...prev.rows,
        {
          id: Date.now(),
          ctnFrom: nextFrom,
          ctnTo: nextTo,
          color: lastRow?.color || '',
          sizeRatios: initialRatios,
          pcsPerCtn: 0,
        },
      ],
    }));
  }

  function handleRemoveRow(id) {
    setDocData((prev) => ({
      ...prev,
      rows: prev.rows.filter((r) => r.id !== id),
    }));
  }

  function handleRowRangeOrColor(id, field, value) {
    setDocData((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    }));
  }

  function handleSizeRatioChange(rowId, sz, value) {
    const num = Math.max(0, Number(value) || 0);
    setDocData((prev) => {
      const updatedRows = prev.rows.map((r) => {
        if (r.id !== rowId) return r;
        const currentRatios = { ...(r.sizeRatios || {}) };
        currentRatios[sz] = num;

        // Recalculate pcs per ctn
        const newTotalPcs = (prev.sizes || DEFAULT_SIZES).reduce(
          (sum, s) => sum + (s === sz ? num : Number(currentRatios[s] ?? getSizeValue(r, s))),
          0
        );

        return {
          ...r,
          sizeRatios: currentRatios,
          pcsPerCtn: newTotalPcs,
        };
      });

      return { ...prev, rows: updatedRows };
    });
  }

  function handleAddSize() {
    const sz = newSizeInput.trim().toUpperCase();
    if (!sz) return;
    if (activeSizes.includes(sz)) {
      alert(t('এই সাইজটি ইতিমধ্যে তালিকায় আছে।', 'This size is already in the list.'));
      return;
    }

    const updatedSizes = [...activeSizes, sz];
    setDocData((prev) => ({
      ...prev,
      sizes: updatedSizes,
      rows: prev.rows.map((r) => {
        const ratios = { ...(r.sizeRatios || {}) };
        ratios[sz] = 0;
        return { ...r, sizeRatios: ratios };
      }),
    }));

    setNewSizeInput('');
    setShowAddSize(false);
  }

  function handleRemoveSize(szToRemove) {
    if (activeSizes.length <= 1) {
      alert(t('কমপক্ষে একটি সাইজ থাকতে হবে।', 'At least one size column must remain.'));
      return;
    }
    const ok = window.confirm(
      t(
        `"${szToRemove}" সাইজের কলামটি মুছে ফেলতে চান? সব কার্টুন রেঞ্জ থেকে এর অনুপাত বাদ যাবে।`,
        `Remove size column "${szToRemove}"? Ratio will be removed from all carton ranges.`
      )
    );
    if (!ok) return;

    const updatedSizes = activeSizes.filter((s) => s !== szToRemove);
    setDocData((prev) => ({
      ...prev,
      sizes: updatedSizes,
      rows: prev.rows.map((r) => {
        const ratios = { ...(r.sizeRatios || {}) };
        delete ratios[szToRemove];
        const newPcsPerCtn = updatedSizes.reduce((s, sizeKey) => s + (Number(ratios[sizeKey]) || 0), 0);
        return {
          ...r,
          sizeRatios: ratios,
          pcsPerCtn: newPcsPerCtn,
        };
      }),
    }));
  }

  async function handleSaveCurrentList(goToList = false) {
    const listToSave = {
      ...docData,
      id: docData.id || `pack-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    const all = getLocalPackingLists();
    const exists = all.some((item) => item.id === listToSave.id);
    const updated = exists
      ? all.map((item) => (item.id === listToSave.id ? listToSave : item))
      : [listToSave, ...all];

    saveLocalPackingLists(updated);
    setSavedLists(updated);
    setDocData(listToSave);

    try {
      await setDoc(doc(db, 'packingLists', listToSave.id), listToSave, { merge: true });
    } catch (err) {
      console.warn('Firestore packing list save fallback:', err);
    }

    if (goToList) {
      setActiveTab('list');
    }

    const msg = t(
      `"${listToSave.poNo || listToSave.styleNo || 'নতুন'}" প্যাকিং লিস্ট সফলভাবে সেভ হয়েছে।`,
      `Packing list "${listToSave.poNo || listToSave.styleNo || 'New'}" saved successfully.`
    );
    setSaveNotice(msg);
    setToastNotice(msg);
    setTimeout(() => {
      setSaveNotice('');
      setToastNotice('');
    }, 4000);
  }

  function handleLoadList(l) {
    setDocData(l);
    setActiveTab('editor');
    setSaveNotice(t(`"${l.poNo || l.styleNo}" প্যাকিং লিস্ট এডিটরে লোড হয়েছে।`, `Loaded packing list "${l.poNo || l.styleNo}".`));
    setTimeout(() => setSaveNotice(''), 3000);
  }

  async function handleConfirmDeletePackingList() {
    if (!packingListToDelete) return;
    const target = packingListToDelete;
    const remaining = deleteLocalPackingList(target.id);
    setSavedLists(remaining);

    try {
      await deleteDoc(doc(db, 'packingLists', target.id));
    } catch (err) {
      console.warn('Firestore packing list delete fallback:', err);
    }

    if (docData.id === target.id) {
      if (remaining.length > 0) setDocData(remaining[0]);
      else handleResetNewList();
    }
    if (isPrintView && docData.id === target.id) {
      setIsPrintView(false);
    }
    setPackingListToDelete(null);

    const msg = t(
      `"${target.poNo || target.styleNo || 'প্যাকিং লিস্ট'}" সফলভাবে মুছে ফেলা হয়েছে।`,
      `Packing list permanently deleted.`
    );
    setToastNotice(msg);
    setTimeout(() => setToastNotice(''), 4000);
  }

  function handleResetNewList() {
    setDocData(createBlankPackingList());
    setActiveTab('editor');
  }

  // Download Standalone Packing List HTML Document
  function downloadPackingListDoc(targetDoc) {
    const item = targetDoc || docData;
    const sizes = item.sizes || DEFAULT_SIZES;
    const rows = item.rows || [];
    const l = Number(item.cartonLengthCm) || 0;
    const w = Number(item.cartonWidthCm) || 0;
    const h = Number(item.cartonHeightCm) || 0;
    const cbmSingle = (l * w * h) / 1000000;

    let totCtns = 0;
    let totPcs = 0;
    rows.forEach((r) => {
      const ctns = Math.max(0, Number(r.ctnTo) - Number(r.ctnFrom) + 1);
      const pcs = ctns * Number(r.pcsPerCtn || 0);
      totCtns += ctns;
      totPcs += pcs;
    });

    const totCbm = (totCtns * cbmSingle).toFixed(3);
    const totNW = (totCtns * Number(item.cartonNetWeightKg || 0)).toFixed(1);
    const totGW = (totCtns * Number(item.cartonGrossWeightKg || 0)).toFixed(1);

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>PackingList_${item.poNo || item.styleNo || 'export'}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #333; padding: 6px 8px; font-size: 11px; }
    th { background: #f0f0f0; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 15px; }
    .title { font-size: 20px; font-weight: bold; }
    .badge { display: inline-block; border: 2px solid #000; padding: 4px 16px; font-weight: bold; margin-top: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 11px; margin-bottom: 15px; border: 1px solid #ccc; padding: 10px; border-radius: 4px; }
    .signatures { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 50px; text-align: center; font-size: 11px; }
    .sig-line { border-top: 1px solid #000; padding-top: 4px; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 15px;">
    <button onclick="window.print()" style="padding: 6px 14px; background: #2B4570; color: #fff; border: 0; border-radius: 4px; cursor: pointer; font-weight: bold;">🖨️ Print Packing List</button>
  </div>
  <div class="header">
    <div class="title">${companyName || 'Factory ERP'}</div>
    <div style="font-size: 11px; color: #555;">${settings?.address || 'Kashimpur, Gazipur, Dhaka, Bangladesh'}</div>
    <div style="font-size: 11px; color: #555;">Phone: ${settings?.phone || '+880 1711-000000'} • Export License: EXP-BD-89021</div>
    <div class="badge">COMMERCIAL EXPORT PACKING LIST & WEIGHT NOTE</div>
  </div>
  <div class="grid">
    <div>
      <div><strong>Buyer / Consignee:</strong> ${item.buyer || '—'}</div>
      <div><strong>Style No:</strong> ${item.styleNo || '—'}</div>
      <div><strong>Style Name:</strong> ${item.styleName || '—'}</div>
      <div><strong>Country of Origin:</strong> ${item.countryOfOrigin || 'Bangladesh'}</div>
    </div>
    <div>
      <div><strong>PO Number:</strong> ${item.poNo || '—'}</div>
      <div><strong>Commercial Invoice No:</strong> ${item.invoiceNo || '—'}</div>
      <div><strong>Destination Port:</strong> ${item.destination || '—'}</div>
      <div><strong>Carton Size (L×W×H):</strong> ${item.cartonLengthCm}×${item.cartonWidthCm}×${item.cartonHeightCm} cm (${cbmSingle.toFixed(4)} CBM/ctn)</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Ctn No</th>
        <th>Color</th>
        ${sizes.map((s) => `<th class="text-center">${s}</th>`).join('')}
        <th class="text-right">Pcs/Ctn</th>
        <th class="text-right">Total Ctns</th>
        <th class="text-right">Total Pcs</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((r) => {
        const ctns = Math.max(0, Number(r.ctnTo) - Number(r.ctnFrom) + 1);
        const pcs = ctns * Number(r.pcsPerCtn || 0);
        return `
          <tr>
            <td class="text-center">${r.ctnFrom} - ${r.ctnTo}</td>
            <td><strong>${r.color}</strong></td>
            ${sizes.map((s) => `<td class="text-center">${getSizeValue(r, s)}</td>`).join('')}
            <td class="text-right">${r.pcsPerCtn}</td>
            <td class="text-right font-bold">${ctns}</td>
            <td class="text-right font-bold">${pcs.toLocaleString()}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
    <tfoot>
      <tr style="font-weight: bold; background: #fafafa;">
        <td colspan="${sizes.length + 3}" class="text-right">Total:</td>
        <td class="text-right">${totCtns}</td>
        <td class="text-right">${totPcs.toLocaleString()}</td>
      </tr>
    </tfoot>
  </table>
  <div style="margin-top: 15px; font-size: 11px;">
    <strong>Summary:</strong> Total Cartons: ${totCtns} ctns &nbsp;|&nbsp; Total Quantity: ${totPcs.toLocaleString()} pcs &nbsp;|&nbsp; Total Volume: ${totCbm} CBM &nbsp;|&nbsp; Total NW: ${totNW} KG &nbsp;|&nbsp; Total GW: ${totGW} KG
  </div>
  <div class="signatures">
    <div><div class="sig-line">Prepared By (Packing Dept)</div></div>
    <div><div class="sig-line">Quality Assurance (QA Head)</div></div>
    <div><div class="sig-line">Commercial / Shipping Incharge</div></div>
    <div><div class="sig-line">Factory General Manager</div></div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PackingList_${item.poNo || item.styleNo || 'export'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // Export Columns for ExportBar in Editor
  const exportColumns = useMemo(() => {
    return [
      { key: 'range', label: 'Carton Range', render: (r) => `${r.ctnFrom} - ${r.ctnTo}` },
      { key: 'color', label: 'Color' },
      ...activeSizes.map((sz) => ({
        key: `size_${sz}`,
        label: sz,
        render: (r) => getSizeValue(r, sz),
      })),
      { key: 'pcsPerCtn', label: 'Pcs/Ctn' },
      { key: 'totalCtns', label: 'Total Ctns', render: (r) => Math.max(0, Number(r.ctnTo) - Number(r.ctnFrom) + 1) },
      {
        key: 'totalPcs',
        label: 'Total Pcs',
        render: (r) => Math.max(0, Number(r.ctnTo) - Number(r.ctnFrom) + 1) * Number(r.pcsPerCtn || 0),
      },
    ];
  }, [activeSizes]);

  // Export Columns for All Saved Lists Table
  const savedListsExportColumns = useMemo(() => [
    { key: 'poNo', label: 'PO Number' },
    { key: 'invoiceNo', label: 'Invoice No' },
    { key: 'styleNo', label: 'Style No' },
    { key: 'styleName', label: 'Style Name' },
    { key: 'buyer', label: 'Buyer' },
    { key: 'destination', label: 'Destination Port' },
    {
      key: 'totalCartons',
      label: 'Total Cartons',
      render: (r) => (r.rows || []).reduce((s, row) => s + Math.max(0, Number(row.ctnTo) - Number(row.ctnFrom) + 1), 0),
    },
    {
      key: 'totalPcs',
      label: 'Total Pcs',
      render: (r) => (r.rows || []).reduce((s, row) => s + Math.max(0, Number(row.ctnTo) - Number(row.ctnFrom) + 1) * Number(r.pcsPerCtn || 0), 0),
    },
    { key: 'updatedAt', label: 'Date' },
  ], []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink flex items-center gap-2">
            <Boxes className="text-indigo" size={26} />
            {t('প্যাকিং লিস্ট ও কার্টুন সিবিএম জেনারেটর', 'Export Packing List & CBM Calculator')}
          </h1>
          <p className="mt-1 text-xs text-ink-soft">
            {t(
              'আন্তর্জাতিক বায়ারদের জন্য কার্টুন রেঞ্জ, সাইজ রেশিও ব্রেকডাউন, CBM ও নেট/গ্রস ওজনের চালান তৈরি, সংরক্ষণ ও ডাউনলোড করুন।',
              'Generate, manage, export, and download export packing lists with dynamic size ratio matrices and CBM volume notes.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleResetNewList}
            className={`${btnPrimary} flex items-center gap-1.5 !text-xs cursor-pointer`}
          >
            <Plus size={15} />
            {t('নতুন প্যাকিং লিস্ট তৈরি করুন', 'Create New Packing List')}
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className="rounded border border-green/40 bg-green-soft/40 p-3 text-xs font-medium text-green flex items-center gap-2">
          <CheckCircle2 size={16} />
          {saveNotice}
        </div>
      )}

      {/* TABS (SAVED LISTS vs FORM EDITOR) */}
      <div className="flex border-b border-line">
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition cursor-pointer ${
            activeTab === 'list'
              ? 'border-indigo text-indigo'
              : 'border-transparent text-ink-soft hover:text-ink'
          }`}
        >
          <List size={16} />
          {t('সংরক্ষিত প্যাকিং লিস্ট তালিকা', 'Saved Packing Lists')}
          <span className="rounded-full bg-indigo/10 px-2 py-0.5 text-xs text-indigo font-bold">
            {savedLists.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('editor')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition cursor-pointer ${
            activeTab === 'editor'
              ? 'border-indigo text-indigo'
              : 'border-transparent text-ink-soft hover:text-ink'
          }`}
        >
          <Pencil size={15} />
          {t('প্যাকিং লিস্ট ফর্ম / এডিটর', 'Packing List Editor Form')}
          {docData.poNo && (
            <span className="text-xs font-normal text-ink-soft">({docData.poNo})</span>
          )}
        </button>
      </div>

      {/* TAB 1: SAVED PACKING LISTS TABLE (CHALAN-STYLE) */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={`${inputClass} !py-1.5 !text-xs !w-auto`}
                value={buyerFilter}
                onChange={(e) => setBuyerFilter(e.target.value)}
              >
                <option value="all">{t('সব বায়ার (All Buyers)', 'All Buyers')}</option>
                {buyersList.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <ExportBar data={filteredSavedLists} columns={savedListsExportColumns} filename="All_Export_Packing_Lists" />
            </div>

            <div className="relative min-w-[240px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input
                type="text"
                placeholder={t('PO, স্টাইল বা বায়ার সার্চ…', 'Search PO, style, buyer, port…')}
                className={`${inputClass} !pl-8 !py-1.5 text-xs`}
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Table of Saved Packing Lists */}
          <div className="rounded-lg border border-line bg-surface p-5">
            {filteredSavedLists.length === 0 ? (
              <EmptyState
                title={t('কোনো সংরক্ষিত প্যাকিং লিস্ট পাওয়া যায়নি', 'No saved packing lists found')}
                description={t('নতুন প্যাকিং লিস্ট তৈরি করতে উপরের বাটনে ক্লিক করুন।', 'Click "+ Create New Packing List" to generate one.')}
              />
            ) : (
              <div className="scroll-thin overflow-x-auto">
                <table className="w-full min-w-[850px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium text-ink-soft">
                      <th className="py-2.5 pr-3">{t('PO ও তারিখ', 'PO No & Date')}</th>
                      <th className="py-2.5 pr-3">{t('স্টাইল বিবরণ', 'Style Details')}</th>
                      <th className="py-2.5 pr-3">{t('বায়ার ও গন্তব্য', 'Buyer & Port')}</th>
                      <th className="py-2.5 pr-3 text-right">{t('মোট কার্টুন', 'Total Cartons')}</th>
                      <th className="py-2.5 pr-3 text-right">{t('মোট পিস (Pcs)', 'Total Pcs')}</th>
                      <th className="py-2.5 pr-3 text-right">{t('CBM ও গ্রস ওজন', 'CBM & GW')}</th>
                      <th className="py-2.5 pr-2 text-right">{t('অ্যাকশন', 'Action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSavedLists.map((item) => {
                      let itemCtns = 0;
                      let itemPcs = 0;
                      (item.rows || []).forEach((r) => {
                        const ctns = Math.max(0, Number(r.ctnTo) - Number(r.ctnFrom) + 1);
                        itemCtns += ctns;
                        itemPcs += ctns * Number(r.pcsPerCtn || 0);
                      });

                      const singleCbm =
                        ((Number(item.cartonLengthCm) || 60) *
                          (Number(item.cartonWidthCm) || 40) *
                          (Number(item.cartonHeightCm) || 30)) /
                        1000000;
                      const itemCbm = (itemCtns * singleCbm).toFixed(2);
                      const itemGw = (itemCtns * Number(item.cartonGrossWeightKg || 13)).toFixed(1);

                      return (
                        <tr key={item.id} className="border-b border-line last:border-0 hover:bg-paper/50">
                          <td className="py-3 pr-3">
                            <p className="font-mono text-xs font-bold text-indigo">
                              {item.poNo || t('নামহীন PO', 'No PO')}
                            </p>
                            <p className="text-[11px] text-ink-soft">
                              {item.updatedAt ? item.updatedAt.slice(0, 10) : item.invoiceNo || 'Export'}
                            </p>
                          </td>
                          <td className="py-3 pr-3">
                            <p className="font-semibold text-ink">{item.styleNo || '—'}</p>
                            <p className="text-[11px] text-ink-soft truncate max-w-[200px]">
                              {item.styleName || '—'}
                            </p>
                          </td>
                          <td className="py-3 pr-3">
                            <p className="font-medium text-ink">{item.buyer || '—'}</p>
                            <p className="text-[11px] text-ink-soft truncate max-w-[180px]">
                              {item.destination || 'Chittagong Port'}
                            </p>
                          </td>
                          <td className="py-3 pr-3 text-right font-mono font-bold text-indigo">
                            {itemCtns.toLocaleString()}{' '}
                            <span className="text-[11px] font-normal text-ink-soft">ctns</span>
                          </td>
                          <td className="py-3 pr-3 text-right font-mono font-bold text-ink">
                            {itemPcs.toLocaleString()}{' '}
                            <span className="text-[11px] font-normal text-ink-soft">pcs</span>
                          </td>
                          <td className="py-3 pr-3 text-right font-mono text-xs text-ink-soft">
                            <p className="font-semibold text-ink">{itemCbm} CBM</p>
                            <p className="text-[11px]">{itemGw} kg GW</p>
                          </td>
                          <td className="py-3 pr-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setDocData(item);
                                  setIsPrintView(true);
                                }}
                                className="inline-flex items-center gap-1.5 rounded bg-indigo px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-deep cursor-pointer transition"
                                title={t('প্যাকিং লিস্ট দেখুন ও প্রিন্ট করুন', 'View & Print Packing List')}
                              >
                                <Printer size={13} />
                                <span>{t('দেখুন / প্রিন্ট', 'View & Print')}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => downloadPackingListDoc(item)}
                                className="inline-flex items-center gap-1 rounded border border-indigo/40 bg-indigo/5 px-2.5 py-1.5 text-xs font-semibold text-indigo hover:bg-indigo hover:text-white transition cursor-pointer"
                                title={t('ডাউনলোড ফাইল', 'Download Standalone HTML')}
                              >
                                <Download size={13} />
                                <span>{t('ডাউনলোড', 'Download')}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleLoadList(item)}
                                className="inline-flex items-center gap-1 rounded border border-indigo/30 bg-indigo/5 px-2.5 py-1.5 text-xs font-semibold text-indigo hover:bg-indigo hover:text-white transition cursor-pointer"
                                title={t('প্যাকিং লিস্ট সংশোধন / এডিট করুন', 'Edit Packing List')}
                              >
                                <Pencil size={13} />
                                <span>{t('এডিট', 'Edit')}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setPackingListToDelete(item)}
                                className="inline-flex items-center gap-1 rounded border border-red/40 bg-red/5 px-2.5 py-1.5 text-xs font-semibold text-red hover:bg-red hover:text-white transition cursor-pointer"
                                title={t('মুছে ফেলুন', 'Delete')}
                              >
                                <Trash2 size={13} />
                                <span>{t('ডিলিট', 'Delete')}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PACKING LIST EDITOR / FORM */}
      {activeTab === 'editor' && (
        <div className="space-y-6">
          {/* Editor Header Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-paper/60 p-3 rounded-lg border border-line">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="flex items-center gap-1 text-xs font-semibold text-indigo hover:underline cursor-pointer"
              >
                ← {t('সংরক্ষিত তালিকায় ফিরুন', 'Back to Saved Lists')}
              </button>
              <span className="text-ink-soft">•</span>
              <span className="text-xs font-medium text-ink-soft">
                {t('এডিট হচ্ছে:', 'Editing:')}{' '}
                <strong className="text-ink">{docData.poNo || docData.styleNo || t('নতুন ফর্ম', 'New Form')}</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSaveCurrentList(true)}
                className={`${btnPrimary} flex items-center gap-1.5 !text-xs cursor-pointer`}
                title={t('সেভ করে সরাসরি তালিকায় দেখুন', 'Save and view in saved lists table')}
              >
                <Save size={14} />
                {t('সেভ ও তালিকায় দেখুন', 'Save & View in List')}
              </button>

              <button
                type="button"
                onClick={() => handleSaveCurrentList(false)}
                className={`${btnSecondary} flex items-center gap-1.5 !text-xs cursor-pointer`}
                title={t('বর্তমান ফর্ম সেভ করুন', 'Save current form draft')}
              >
                <Save size={14} />
                {t('ড্রাফট সেভ', 'Save Draft')}
              </button>

              <button
                type="button"
                onClick={handleResetNewList}
                className={`${btnSecondary} flex items-center gap-1.5 !text-xs cursor-pointer`}
              >
                <RotateCcw size={14} />
                {t('নতুন খালি ফর্ম', 'New Blank Form')}
              </button>

              <button
                type="button"
                onClick={() => downloadPackingListDoc(docData)}
                className="flex items-center gap-1 rounded border border-indigo/40 px-3 py-1.5 text-xs font-semibold text-indigo hover:bg-indigo/5 cursor-pointer"
              >
                <Download size={14} />
                {t('ডাউনলোড ফাইল', 'Download File')}
              </button>

              <ExportBar
                data={docData.rows}
                columns={exportColumns}
                filename={`PackingList_${docData.poNo || docData.styleNo || 'Cartons'}`}
              />

              <button
                type="button"
                onClick={() => setIsPrintView(true)}
                className="flex items-center gap-1.5 rounded-md bg-indigo px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-deep cursor-pointer"
              >
                <Printer size={14} />
                {t('প্রিন্ট প্রিভিউ', 'Print Preview')}
              </button>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-lg border border-line bg-surface p-3 shadow-sm">
              <p className="text-[11px] font-medium text-ink-soft">{t('মোট কার্টুন সংখ্যা', 'Total Cartons')}</p>
              <p className="mt-1 font-display text-xl font-bold text-indigo">
                {summary.totalCartons.toLocaleString()}{' '}
                <span className="text-xs font-normal text-ink-soft">ctns</span>
              </p>
            </div>
            <div className="rounded-lg border border-line bg-surface p-3 shadow-sm">
              <p className="text-[11px] font-medium text-ink-soft">{t('মোট পিস সংখ্যা', 'Total Pieces')}</p>
              <p className="mt-1 font-display text-xl font-bold text-ink">
                {summary.totalPcs.toLocaleString()}{' '}
                <span className="text-xs font-normal text-ink-soft">pcs</span>
              </p>
            </div>
            <div className="rounded-lg border border-line bg-surface p-3 shadow-sm">
              <p className="text-[11px] font-medium text-ink-soft">{t('মোট ভলিউম (Total CBM)', 'Total CBM')}</p>
              <p className="mt-1 font-display text-xl font-bold text-indigo">
                {summary.totalCbm.toFixed(3)}{' '}
                <span className="text-xs font-normal text-ink-soft">m³</span>
              </p>
            </div>
            <div className="rounded-lg border border-line bg-surface p-3 shadow-sm">
              <p className="text-[11px] font-medium text-ink-soft">{t('মোট নেট ওজন (NW)', 'Net Weight')}</p>
              <p className="mt-1 font-display text-xl font-bold text-ink">
                {summary.totalNetWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
                <span className="text-xs font-normal text-ink-soft">kg</span>
              </p>
            </div>
            <div className="rounded-lg border border-line bg-surface p-3 shadow-sm">
              <p className="text-[11px] font-medium text-ink-soft">{t('মোট গ্রস ওজন (GW)', 'Gross Weight')}</p>
              <p className="mt-1 font-display text-xl font-bold text-amber">
                {summary.totalGrossWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
                <span className="text-xs font-normal text-ink-soft">kg</span>
              </p>
            </div>
          </div>

          {/* Master Carton Dimension Box */}
          <div className="rounded-lg border border-line bg-surface p-4 space-y-3">
            <h2 className="font-display text-sm font-semibold text-ink flex items-center gap-2">
              <Calculator size={16} className="text-indigo" />
              {t('মাস্টার কার্টুনের মাপ ও ওজন (Carton Dimension & Weight)', 'Master Carton Dimension & Weight')}
            </h2>
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
          <div className="rounded-lg border border-line bg-surface p-4 space-y-3">
            {stylesList && stylesList.length > 0 && (
              <Field label={t('বিদ্যমান স্টাইল থেকে তথ্য পূরণ করুন (ঐচ্ছিক)', 'Quick-fill from Factory Style (Optional)')}>
                <select
                  className={inputClass}
                  defaultValue=""
                  onChange={(e) => {
                    const s = stylesList.find((st) => st.id === e.target.value);
                    if (s) {
                      setDocData((prev) => ({
                        ...prev,
                        styleNo: s.styleNo || '',
                        styleName: s.styleName || '',
                        buyer: s.buyer || '',
                        poNo: s.poNo || prev.poNo || '',
                      }));
                    }
                  }}
                >
                  <option value="">{t('— স্টাইল নির্বাচন করুন (বা নিজে লিখুন) —', '— Select a Style to auto-fill (or type manually below) —')}</option>
                  {stylesList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.styleNo} {st.styleName ? `— ${st.styleName}` : ''} ({st.buyer || 'No Buyer'})
                    </option>
                  ))}
                </select>
              </Field>
            )}

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
              <Field label={t('স্টাইল নাম (Style Name)', 'Style Name')}>
                <input
                  type="text"
                  className={inputClass}
                  value={docData.styleName}
                  onChange={(e) => setDocData((d) => ({ ...d, styleName: e.target.value }))}
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
              <Field label={t('উৎপাদনকারী দেশ (Country of Origin)', 'Country of Origin')}>
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-semibold text-ink">
                  {t('কার্টুন রেঞ্জ ও ডায়নামিক সাইজ রেশিও ব্রেকডাউন', 'Carton Range & Dynamic Size Ratio Matrix')}
                </h2>
                <p className="text-xs text-ink-soft">
                  {t(
                    'প্রতিটি কার্টুন রেঞ্জের জন্য কালার এবং প্রতিটি সাইজের পিস সংখ্যা দিন। সাইজ কলাম প্রয়োজনমতো যুক্ত বা বাদ দিতে পারবেন।',
                    'Specify color and size ratio for each carton range. Add or remove size columns as needed.'
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {showAddSize ? (
                  <div className="flex items-center gap-1.5 bg-paper p-1.5 rounded border border-indigo/40">
                    <input
                      type="text"
                      placeholder="যেমন: 3XL বা 32"
                      className={`${inputClass} !py-1 !px-2 text-xs !w-24 uppercase font-semibold`}
                      value={newSizeInput}
                      onChange={(e) => setNewSizeInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSize()}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddSize}
                      className="rounded bg-indigo px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-deep cursor-pointer"
                    >
                      {t('যোগ', 'Add')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddSize(false)}
                      className="rounded px-1.5 py-1 text-xs text-ink-soft hover:bg-line cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddSize(true)}
                    className="flex items-center gap-1 rounded border border-indigo/40 bg-indigo/10 px-2.5 py-1.5 text-xs font-semibold text-indigo hover:bg-indigo hover:text-white transition cursor-pointer"
                    title={t('নতুন সাইজ কলাম যোগ করুন (যেমন 3XL, 4XL, 32, ইত্যাদি)', 'Add size column')}
                  >
                    <Plus size={14} />
                    {t('+ সাইজ কলাম যুক্ত করুন', '+ Add Size Column')}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleAddRow}
                  className="flex items-center gap-1 rounded bg-indigo px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-deep cursor-pointer"
                >
                  <Plus size={14} />
                  {t('+ নতুন কার্টুন রেঞ্জ যোগ করুন', '+ Add Carton Range')}
                </button>
              </div>
            </div>

            {/* Quick Size Expand Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-paper/60 p-2.5 rounded-md border border-line text-xs">
              <span className="font-semibold text-ink-soft mr-1">
                {t('দ্রুত সাইজ কলাম বৃদ্ধি করুন:', 'Quick Add Size Columns:')}
              </span>
              {['2XS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', '28', '30', '32', '34', '36', '38']
                .filter((sz) => !activeSizes.includes(sz))
                .slice(0, 8)
                .map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => {
                      const updatedSizes = [...activeSizes, sz];
                      setDocData((prev) => ({
                        ...prev,
                        sizes: updatedSizes,
                        rows: prev.rows.map((r) => {
                          const ratios = { ...(r.sizeRatios || {}) };
                          ratios[sz] = 0;
                          return { ...r, sizeRatios: ratios };
                        }),
                      }));
                    }}
                    className="inline-flex items-center gap-0.5 rounded border border-indigo/30 bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo hover:bg-indigo hover:text-white transition cursor-pointer"
                  >
                    + {sz}
                  </button>
                ))}
            </div>

            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[850px] text-xs">
                <thead>
                  <tr className="border-b border-line text-left font-semibold text-ink-soft">
                    <th className="py-2.5 pr-2 w-32">{t('কার্টুন রেঞ্জ', 'Ctn Range')}</th>
                    <th className="py-2.5 pr-2 w-32">{t('কালার', 'Color')}</th>
                    {activeSizes.map((sz) => (
                      <th key={sz} className="py-2.5 pr-1 text-center min-w-[56px]">
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-bold text-ink">{sz}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSize(sz)}
                            className="text-ink-soft/40 hover:text-red text-[10px] cursor-pointer"
                            title={t(`"${sz}" সাইজ কলাম মুছুন`, `Delete ${sz} column`)}
                          >
                            ✕
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="py-2.5 pr-2 text-right w-20">{t('পিস/Ctn', 'Pcs/Ctn')}</th>
                    <th className="py-2.5 pr-2 text-right w-20">{t('মোট Ctn', 'Ctns')}</th>
                    <th className="py-2.5 pr-2 text-right w-24">{t('মোট পিস', 'Total Pcs')}</th>
                    <th className="py-2.5 pr-1 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {docData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={activeSizes.length + 5} className="py-10 text-center text-xs text-ink-soft">
                        <p className="font-semibold text-ink text-sm">{t('কোনো কার্টুন রেঞ্জ এখনো যোগ করা হয়নি', 'No carton ranges added yet')}</p>
                        <p className="mt-1 text-ink-soft">{t('কার্টুন নম্বর, কালার ও সাইজ রেশিও ব্রেকডাউন দিতে নিচে ক্লিক করুন।', 'Click below to add a carton range with colors and size ratios.')}</p>
                        <button
                          type="button"
                          onClick={handleAddRow}
                          className={`${btnPrimary} !text-xs mt-3 inline-flex items-center gap-1.5 cursor-pointer`}
                        >
                          <Plus size={14} />
                          {t('প্রথম কার্টুন রেঞ্জ যোগ করুন', 'Add First Carton Range')}
                        </button>
                      </td>
                    </tr>
                  ) : (
                    docData.rows.map((row) => {
                    const ctns = Math.max(0, Number(row.ctnTo) - Number(row.ctnFrom) + 1);
                    const totalPcs = ctns * Number(row.pcsPerCtn || 0);

                    return (
                      <tr key={row.id} className="border-b border-line last:border-0 hover:bg-paper/50">
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-1 font-mono">
                            <input
                              type="number"
                              className={`${inputClass} !py-1 !px-1 text-center !w-14 text-xs`}
                              value={row.ctnFrom}
                              onChange={(e) => handleRowRangeOrColor(row.id, 'ctnFrom', e.target.value)}
                            />
                            <span>-</span>
                            <input
                              type="number"
                              className={`${inputClass} !py-1 !px-1 text-center !w-14 text-xs`}
                              value={row.ctnTo}
                              onChange={(e) => handleRowRangeOrColor(row.id, 'ctnTo', e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            className={`${inputClass} !py-1 text-xs`}
                            value={row.color}
                            onChange={(e) => handleRowRangeOrColor(row.id, 'color', e.target.value)}
                            placeholder="রং"
                          />
                        </td>
                        {activeSizes.map((sz) => (
                          <td key={sz} className="py-2 pr-1 text-center">
                            <input
                              type="number"
                              min="0"
                              className={`${inputClass} !py-1 text-center !w-12 text-xs font-mono`}
                              value={getSizeValue(row, sz)}
                              onChange={(e) => handleSizeRatioChange(row.id, sz, e.target.value)}
                            />
                          </td>
                        ))}
                        <td className="py-2 pr-2 text-right font-mono font-semibold text-ink">
                          {row.pcsPerCtn}
                        </td>
                        <td className="py-2 pr-2 text-right font-mono font-bold text-indigo">
                          {ctns}
                        </td>
                        <td className="py-2 pr-2 text-right font-mono font-bold text-ink">
                          {totalPcs.toLocaleString()}
                        </td>
                        <td className="py-2 pr-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id)}
                            className="text-ink-soft/40 hover:text-red cursor-pointer"
                            title={t('এই রেঞ্জ মুছুন', 'Delete this range')}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line bg-paper/80 font-bold text-ink">
                    <td colSpan={2} className="py-2.5 pr-2 text-right">
                      {t('সর্বমোট (Grand Total):', 'Grand Total:')}
                    </td>
                    {activeSizes.map((sz) => {
                      const totalSzPcs = docData.rows.reduce((sum, r) => {
                        const ctns = Math.max(0, Number(r.ctnTo) - Number(r.ctnFrom) + 1);
                        return sum + ctns * getSizeValue(r, sz);
                      }, 0);
                      return (
                        <td key={sz} className="py-2.5 pr-1 text-center font-mono text-xs">
                          {totalSzPcs.toLocaleString()}
                        </td>
                      );
                    })}
                    <td></td>
                    <td className="py-2.5 pr-2 text-right font-mono text-indigo font-bold">
                      {summary.totalCartons.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-2 text-right font-mono text-ink font-bold">
                      {summary.totalPcs.toLocaleString()}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Bottom Save & Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-paper p-4 rounded-lg border border-line">
              <span className="text-xs text-ink-soft">
                {t('মোট কার্টুন:', 'Total Cartons:')}{' '}
                <strong className="text-indigo font-mono">{summary.totalCartons.toLocaleString()}</strong> •{' '}
                {t('মোট পিস:', 'Total Pcs:')}{' '}
                <strong className="text-ink font-mono">{summary.totalPcs.toLocaleString()}</strong>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveCurrentList(true)}
                  className={`${btnPrimary} flex items-center gap-1.5 !text-xs cursor-pointer`}
                >
                  <Save size={14} />
                  {t('সেভ ও তালিকায় দেখুন', 'Save & View in List')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveCurrentList(false)}
                  className={`${btnSecondary} flex items-center gap-1.5 !text-xs cursor-pointer`}
                >
                  <Save size={14} />
                  {t('ড্রাফট সেভ', 'Save Draft')}
                </button>
                <button
                  type="button"
                  onClick={() => downloadPackingListDoc(docData)}
                  className="flex items-center gap-1 rounded border border-indigo/40 px-3 py-1.5 text-xs font-semibold text-indigo hover:bg-indigo/5 cursor-pointer"
                >
                  <Download size={14} />
                  {t('ডাউনলোড ফাইল', 'Download File')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintView(true)}
                  className="flex items-center gap-1.5 rounded-md bg-indigo px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-deep cursor-pointer"
                >
                  <Printer size={14} />
                  {t('প্রিন্ট প্রিভিউ', 'Print Preview')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE OFFICIAL EXPORT PACKING LIST MODAL */}
      {isPrintView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto print:fixed print:inset-0 print:bg-white print:p-0">
          <div className="relative w-full max-w-5xl rounded-lg bg-white p-8 text-black shadow-2xl print:p-0 print:shadow-none print:max-w-none max-h-[95vh] overflow-y-auto">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between border-b pb-4 mb-6 print:hidden">
              <span className="font-display font-semibold text-lg text-indigo-deep">
                {t('অফিশিয়াল এক্সপোর্ট প্যাকিং লিস্ট প্রিভিউ', 'Official Export Packing List Preview')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded bg-indigo px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-deep cursor-pointer"
                >
                  <Printer size={15} />
                  {t('প্রিন্ট করুন (Print Now)', 'Print Now')}
                </button>
                <button
                  type="button"
                  onClick={() => downloadPackingListDoc(docData)}
                  className="flex items-center gap-1.5 rounded border border-indigo px-3 py-2 text-xs font-semibold text-indigo hover:bg-indigo/5 cursor-pointer"
                >
                  <Download size={15} />
                  {t('ডাউনলোড ফাইল', 'Download File')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPrintView(false);
                    setActiveTab('editor');
                  }}
                  className="flex items-center gap-1 rounded border border-indigo/40 px-3 py-2 text-xs font-semibold text-indigo hover:bg-indigo/5 cursor-pointer"
                >
                  <Pencil size={14} />
                  {t('এডিট করুন', 'Edit Form')}
                </button>
                <button
                  type="button"
                  onClick={() => setPackingListToDelete(docData)}
                  className="flex items-center gap-1 rounded border border-red/40 bg-red/5 px-3 py-2 text-xs font-semibold text-red hover:bg-red hover:text-white cursor-pointer transition"
                >
                  <Trash2 size={14} />
                  {t('মুছে ফেলুন', 'Delete')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintView(false)}
                  className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 cursor-pointer"
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
                <p className="text-xs text-gray-600">Phone: {settings?.phone || '+880 1711-000000'} • Export License: EXP-BD-89021</p>
                <div className="inline-block mt-2 px-6 py-1 border-2 border-black font-bold uppercase tracking-widest text-sm bg-gray-50">
                  COMMERCIAL EXPORT PACKING LIST & WEIGHT NOTE
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs border border-gray-300 p-3 rounded">
                <div>
                  <div><strong>Buyer / Consignee:</strong> {docData.buyer || '—'}</div>
                  <div><strong>Style No:</strong> {docData.styleNo || '—'}</div>
                  <div><strong>Style Name:</strong> {docData.styleName || '—'}</div>
                  <div><strong>Country of Origin:</strong> {docData.countryOfOrigin || 'Bangladesh'}</div>
                </div>
                <div>
                  <div><strong>PO Number:</strong> {docData.poNo || '—'}</div>
                  <div><strong>Commercial Invoice No:</strong> {docData.invoiceNo || '—'}</div>
                  <div><strong>Destination Port:</strong> {docData.destination || '—'}</div>
                  <div>
                    <strong>Carton Size (L×W×H):</strong> {docData.cartonLengthCm}×{docData.cartonWidthCm}×{docData.cartonHeightCm} cm ({singleCtnCbm.toFixed(4)} CBM/ctn)
                  </div>
                </div>
              </div>

              {/* Breakdown Table */}
              <table className="w-full text-xs border-collapse border border-gray-400">
                <thead>
                  <tr className="bg-gray-100 text-left font-bold text-gray-800">
                    <th className="border border-gray-400 p-1.5 text-center">Ctn No</th>
                    <th className="border border-gray-400 p-1.5">Color</th>
                    {activeSizes.map((s) => (
                      <th key={s} className="border border-gray-400 p-1.5 text-center">{s}</th>
                    ))}
                    <th className="border border-gray-400 p-1.5 text-right">Pcs/Ctn</th>
                    <th className="border border-gray-400 p-1.5 text-right">Total Ctns</th>
                    <th className="border border-gray-400 p-1.5 text-right">Total Pcs</th>
                  </tr>
                </thead>
                <tbody>
                  {docData.rows.map((r, i) => {
                    const ctns = Math.max(0, Number(r.ctnTo) - Number(r.ctnFrom) + 1);
                    const pcs = ctns * Number(r.pcsPerCtn || 0);

                    return (
                      <tr key={i} className="border-b border-gray-300">
                        <td className="border border-gray-400 p-1.5 text-center font-mono">{r.ctnFrom} - {r.ctnTo}</td>
                        <td className="border border-gray-400 p-1.5 font-bold">{r.color}</td>
                        {activeSizes.map((s) => (
                          <td key={s} className="border border-gray-400 p-1.5 text-center font-mono">
                            {getSizeValue(r, s)}
                          </td>
                        ))}
                        <td className="border border-gray-400 p-1.5 text-right font-mono">{r.pcsPerCtn}</td>
                        <td className="border border-gray-400 p-1.5 text-right font-mono font-bold">{ctns}</td>
                        <td className="border border-gray-400 p-1.5 text-right font-mono font-bold">{pcs.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold border-t-2 border-gray-800">
                    <td colSpan={activeSizes.length + 3} className="border border-gray-400 p-1.5 text-right">Total Summary:</td>
                    <td className="border border-gray-400 p-1.5 text-right font-mono">{summary.totalCartons.toLocaleString()}</td>
                    <td className="border border-gray-400 p-1.5 text-right font-mono">{summary.totalPcs.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>

              {/* Weight & CBM Note */}
              <div className="grid grid-cols-2 gap-4 text-xs border border-gray-300 p-2.5 rounded bg-gray-50">
                <div>
                  <div><strong>Total Volume (CBM):</strong> {summary.totalCbm.toFixed(3)} m³</div>
                  <div><strong>Net Weight (NW):</strong> {summary.totalNetWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })} KG</div>
                </div>
                <div>
                  <div><strong>Gross Weight (GW):</strong> {summary.totalGrossWeight.toLocaleString(undefined, { maximumFractionDigits: 1 })} KG</div>
                  <div><strong>Total Shipping Units:</strong> {summary.totalCartons} Master Cartons</div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-4 gap-4 pt-16 text-center text-xs">
                <div className="border-t border-black pt-1">
                  <p className="font-semibold">Prepared By</p>
                  <p className="text-[10px] text-gray-500">Packing Dept Supervisor</p>
                </div>
                <div className="border-t border-black pt-1">
                  <p className="font-semibold">Quality Checked</p>
                  <p className="text-[10px] text-gray-500">QA / QC In-Charge</p>
                </div>
                <div className="border-t border-black pt-1">
                  <p className="font-semibold">Commercial Incharge</p>
                  <p className="text-[10px] text-gray-500">Export Documentation</p>
                </div>
                <div className="border-t border-black pt-1">
                  <p className="font-semibold">Authorized Signatory</p>
                  <p className="text-[10px] text-gray-500">Factory GM / Director</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {packingListToDelete && (
        <Modal
          title={t('প্যাকিং লিস্ট মুছে ফেলা নিশ্চিতকরণ', 'Confirm Delete Packing List')}
          onClose={() => setPackingListToDelete(null)}
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-red/30 bg-red/5 p-4 text-xs text-red">
              <AlertTriangle size={20} className="shrink-0 text-red mt-0.5" />
              <div>
                <p className="font-semibold text-sm mb-1">
                  {t('আপনি কি নিশ্চিত যে এই প্যাকিং লিস্টটি মুছে ফেলতে চান?', 'Are you sure you want to permanently delete this packing list?')}
                </p>
                <p className="text-ink-soft">
                  {t(
                    'এটি তালিকা থেকে স্থায়ীভাবে বাদ যাবে। এই অপারেশন ফিরিয়ে আনা যাবে না।',
                    'This packing list will be permanently removed from saved lists. This action cannot be undone.'
                  )}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-paper p-3 text-xs space-y-2">
              <div className="flex justify-between border-b border-line/60 pb-1.5">
                <span className="text-ink-soft">{t('PO নম্বর:', 'PO No:')}</span>
                <span className="font-mono font-bold text-indigo">{packingListToDelete.poNo || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-line/60 pb-1.5">
                <span className="text-ink-soft">{t('ইনভয়েস নম্বর:', 'Invoice No:')}</span>
                <span className="font-mono text-ink">{packingListToDelete.invoiceNo || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-line/60 pb-1.5">
                <span className="text-ink-soft">{t('স্টাইল নম্বর ও নাম:', 'Style No & Name:')}</span>
                <span className="font-semibold text-ink">{packingListToDelete.styleNo} {packingListToDelete.styleName ? `(${packingListToDelete.styleName})` : ''}</span>
              </div>
              <div className="flex justify-between border-b border-line/60 pb-1.5">
                <span className="text-ink-soft">{t('বায়ার ও গন্তব্য পোর্ট:', 'Buyer & Port:')}</span>
                <span className="text-ink">{packingListToDelete.buyer || '—'} • {packingListToDelete.destination || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">{t('কার্টুন ও পিস সংখ্যা:', 'Cartons & Pcs:')}</span>
                <span className="text-ink font-semibold">
                  {(packingListToDelete.rows || []).reduce((sum, r) => sum + Math.max(0, Number(r.ctnTo) - Number(r.ctnFrom) + 1), 0)} Cartons
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setPackingListToDelete(null)}
                className={btnSecondary}
              >
                {t('বাতিল', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePackingList}
                className="flex items-center gap-1.5 rounded-lg bg-red px-4 py-2 text-xs font-semibold text-white shadow hover:opacity-90 cursor-pointer transition"
              >
                <Trash2 size={14} />
                {t('হ্যাঁ, প্যাকিং লিস্টটি মুছে ফেলুন', 'Yes, Delete Packing List')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* TOAST NOTIFICATION */}
      {toastNotice && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-indigo/40 bg-surface shadow-2xl p-4 text-xs font-medium text-ink">
          <CheckCircle2 size={18} className="text-green shrink-0" />
          <span>{toastNotice}</span>
          <button
            type="button"
            onClick={() => setToastNotice('')}
            className="ml-2 text-ink-soft hover:text-ink font-bold cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
