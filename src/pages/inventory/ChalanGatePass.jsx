import { useState, useMemo } from 'react';
import {
  FileText,
  Printer,
  Plus,
  Truck,
  CheckCircle2,
  Calendar,
  Building,
  User,
  Shield,
  ArrowRight,
  Search,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../lib/i18n';
import { useSettings } from '../../lib/settingsContext';
import { Field, inputClass, btnPrimary, btnSecondary, EmptyState, Modal, Pill } from '../../components/ui';

const LOCAL_STORAGE_KEY = 'factory_erp_chalans_data';

const INITIAL_DEMO_CHALANS = [
  {
    id: 'ch-001',
    chalanNo: 'CH-2026-0082',
    gatePassNo: 'GP-2026-0082',
    type: 'subcontract',
    typeLabel: 'ওয়াশিং সাবকন্ট্রাক্ট চালান',
    date: '2026-09-28',
    time: '14:30',
    receiverName: 'Apex Washing & Dyeing Mills Ltd.',
    receiverAddress: 'Plot 44, BSCIC Industrial Area, Konabari, Gazipur',
    vehicleNo: 'Dhaka Metro-Ta 14-8832',
    driverName: 'Md. Monir Hossain',
    driverPhone: '01711-234567',
    purpose: 'Bulk garment enzyme wash & softening treatment',
    isReturnable: true,
    status: 'dispatched',
    items: [
      { id: 1, desc: "Men's Crew Neck Pullover (HM-2026/SW-01)", colorLot: 'Navy Blue', qty: 1200, unit: 'pcs', bags: '24 bags', notes: 'Wash recipe #W-12' },
      { id: 2, desc: "Women's Cable Knit Cardigan (ZR-2026/CD-04)", colorLot: 'Ivory', qty: 800, unit: 'pcs', bags: '16 bags', notes: 'Handle gently' },
    ],
    preparedBy: 'Store Officer (Kalam)',
    approvedBy: 'Production Manager (Azad)',
  },
  {
    id: 'ch-002',
    chalanNo: 'CH-2026-0083',
    gatePassNo: 'GP-2026-0083',
    type: 'yarn_delivery',
    typeLabel: 'ইয়ার্ন ইস্যু চালান (ফ্লোর ডেলিভারি)',
    date: '2026-09-29',
    time: '10:15',
    receiverName: 'Knitting Floor Unit 2 (Inter-floor)',
    receiverAddress: 'Floor 3, Building B, Main Factory Complex',
    vehicleNo: 'Internal Trolley #04',
    driverName: 'Sujan (Trolley Operator)',
    driverPhone: 'N/A',
    purpose: 'Daily knitting yarn allocation for H&M order',
    isReturnable: false,
    status: 'received',
    items: [
      { id: 1, desc: '2/28 Nm 100% Acrylic Soft Yarn', colorLot: 'Lot #22B (Navy)', qty: 450, unit: 'lb', bags: '15 bags / 120 cones', notes: 'Checked moisture ok' },
    ],
    preparedBy: 'Yarn Store Manager',
    approvedBy: 'DGM Merchandising',
  },
  {
    id: 'ch-003',
    chalanNo: 'CH-2026-0084',
    gatePassNo: 'GP-2026-0084',
    type: 'shipment',
    typeLabel: 'ফিনিশড গুডস এক্সপোর্ট চালান',
    date: '2026-09-29',
    time: '16:00',
    receiverName: 'Damco Logistics Ltd. (Chittagong Port CFS)',
    receiverAddress: 'Depot Gate 2, Chittagong Port Yard',
    vehicleNo: 'Chatto Metro-U 11-2094 (Covered Van)',
    driverName: 'Abul Kashem',
    driverPhone: '01819-987654',
    purpose: 'Final export shipment for H&M EU order',
    isReturnable: false,
    status: 'dispatched',
    items: [
      { id: 1, desc: 'Export Sweaters (Style HM-2026/SW-01)', colorLot: 'Solid Navy', qty: 2400, unit: 'pcs', bags: '120 Cartons', notes: 'Master carton packing' },
    ],
    preparedBy: 'Commercial / Shipping Incharge',
    approvedBy: 'Factory GM',
  },
];

function getStoredChalans() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return INITIAL_DEMO_CHALANS;
}

function saveStoredChalans(items) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export default function ChalanGatePass() {
  const { user, profile } = useAuth();
  const { t, lang } = useLang();
  const { settings } = useSettings();

  const [chalans, setChalans] = useState(getStoredChalans);
  const [selectedChalan, setSelectedChalan] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Chalan Form State
  const [form, setForm] = useState({
    type: 'subcontract',
    receiverName: '',
    receiverAddress: '',
    vehicleNo: '',
    driverName: '',
    driverPhone: '',
    purpose: '',
    isReturnable: false,
    items: [{ desc: '', colorLot: '', qty: '', unit: 'pcs', bags: '', notes: '' }],
  });

  const companyName = lang === 'en' ? settings?.companyNameEn || settings?.companyName : settings?.companyName;

  const CHALAN_TYPES = [
    { key: 'subcontract', label: t('ওয়াশিং / ডাইং সাবকন্ট্রাক্ট চালান', 'Washing / Subcontract Chalan') },
    { key: 'yarn_delivery', label: t('ইয়ার্ন ডেলিভারি চালান', 'Yarn Delivery Chalan') },
    { key: 'accessories', label: t('এক্সেসরিজ ডেলিভারি', 'Accessories Delivery') },
    { key: 'shipment', label: t('ফিনিশড গুডস এক্সপোর্ট চালান', 'Finished Goods Export Chalan') },
    { key: 'supplier_return', label: t('সাপ্লায়ার রিটার্ন গেটপাস', 'Supplier Return Pass') },
    { key: 'sample', label: t('স্যাম্পল ও অন্যান্য গেটপাস', 'Sample / General Gate Pass') },
  ];

  const filteredChalans = useMemo(() => {
    return chalans.filter((c) => {
      const matchSearch =
        c.chalanNo.toLowerCase().includes(search.toLowerCase()) ||
        c.gatePassNo.toLowerCase().includes(search.toLowerCase()) ||
        c.receiverName.toLowerCase().includes(search.toLowerCase()) ||
        c.vehicleNo.toLowerCase().includes(search.toLowerCase());

      const matchType = typeFilter === 'all' || c.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [chalans, search, typeFilter]);

  function handleAddItem() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { desc: '', colorLot: '', qty: '', unit: 'pcs', bags: '', notes: '' }],
    }));
  }

  function handleRemoveItem(idx) {
    if (form.items.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  }

  function handleItemChange(idx, field, value) {
    setForm((prev) => {
      const updated = [...prev.items];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, items: updated };
    });
  }

  function handleCreateChalan(e) {
    e.preventDefault();
    const typeObj = CHALAN_TYPES.find((t) => t.key === form.type);
    const num = Math.floor(1000 + Math.random() * 9000);
    const chalanNo = `CH-2026-${num}`;
    const gatePassNo = `GP-2026-${num}`;
    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toTimeString().slice(0, 5);

    const newChalan = {
      id: `ch-${Date.now()}`,
      chalanNo,
      gatePassNo,
      type: form.type,
      typeLabel: typeObj?.label || 'Chalan',
      date: dateStr,
      time: timeStr,
      receiverName: form.receiverName,
      receiverAddress: form.receiverAddress || 'N/A',
      vehicleNo: form.vehicleNo || 'N/A',
      driverName: form.driverName || 'N/A',
      driverPhone: form.driverPhone || 'N/A',
      purpose: form.purpose || 'Official Delivery',
      isReturnable: form.isReturnable,
      status: 'dispatched',
      items: form.items.map((it, idx) => ({ ...it, id: idx + 1 })),
      preparedBy: profile?.name || user?.displayName || 'Store Incharge',
      approvedBy: 'Authorized Signatory',
    };

    const updated = [newChalan, ...chalans];
    setChalans(updated);
    saveStoredChalans(updated);
    setIsModalOpen(false);
    setSelectedChalan(newChalan);
  }

  function downloadChalanDoc() {
    if (!selectedChalan) return;
    const chalanHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Chalan_${selectedChalan.chalanNo}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #333; padding: 6px 10px; font-size: 12px; }
    th { background: #f0f0f0; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 15px; }
    .title { font-size: 20px; font-weight: bold; }
    .badge { display: inline-block; border: 2px solid #000; padding: 4px 16px; font-weight: bold; margin-top: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 12px; margin-bottom: 15px; }
    .signatures { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 60px; text-align: center; font-size: 11px; }
    .sig-line { border-top: 1px solid #000; padding-top: 4px; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 15px;">
    <button onclick="window.print()" style="padding: 6px 14px; background: #2B4570; color: #fff; border: 0; border-radius: 4px; cursor: pointer; font-weight: bold;">🖨️ Print Chalan</button>
  </div>
  <div class="header">
    <div class="title">${companyName || 'Factory ERP'}</div>
    <div style="font-size: 11px; color: #555;">${settings?.address || 'Kashimpur, Gazipur, Dhaka, Bangladesh'}</div>
    <div style="font-size: 11px; color: #555;">Phone: ${settings?.phone || '+880 1711-000000'}</div>
    <div class="badge">${selectedChalan.typeLabel}</div>
  </div>
  <div class="grid">
    <div>
      <div><strong>Chalan No:</strong> ${selectedChalan.chalanNo}</div>
      <div><strong>Date:</strong> ${selectedChalan.date}</div>
      <div><strong>To / Receiver:</strong> ${selectedChalan.receiver}</div>
      <div><strong>Destination:</strong> ${selectedChalan.destination || 'Factory Unit'}</div>
    </div>
    <div>
      <div><strong>Vehicle / Transport:</strong> ${selectedChalan.vehicleNo || 'N/A'}</div>
      <div><strong>Driver:</strong> ${selectedChalan.driverName || 'N/A'} (${selectedChalan.driverPhone || 'N/A'})</div>
      <div><strong>Gate Pass ID:</strong> ${selectedChalan.gatePassNo}</div>
      <div><strong>Security Status:</strong> Gate Out Verified</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 40px;">SL</th>
        <th>Item Description & Specification</th>
        <th>Style / Order No</th>
        <th>Lot / Cone Info</th>
        <th class="text-right">Quantity</th>
        <th>Unit</th>
      </tr>
    </thead>
    <tbody>
      ${selectedChalan.items.map((item, idx) => `
        <tr>
          <td class="text-center">${idx + 1}</td>
          <td><strong>${item.name}</strong></td>
          <td>${item.styleNo || '—'}</td>
          <td>${item.lotNo || '—'} ${item.coneCount ? '(' + item.coneCount + ' cones)' : ''}</td>
          <td class="text-right"><strong>${Number(item.qty).toLocaleString()}</strong></td>
          <td>${item.unit}</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr>
        <th colspan="4" class="text-right">Grand Total:</th>
        <th class="text-right">${selectedChalan.items.reduce((sum, i) => sum + Number(i.qty || 0), 0).toLocaleString()}</th>
        <th></th>
      </tr>
    </tfoot>
  </table>
  <div style="margin-top: 15px; font-size: 12px;"><strong>Remarks:</strong> ${selectedChalan.remarks || 'Goods delivered in sound condition.'}</div>
  <div class="signatures">
    <div><div class="sig-line">Prepared By<br/><span style="color:#555">${selectedChalan.preparedBy}</span></div></div>
    <div><div class="sig-line">Store Incharge<br/><span style="color:#555">Store Dept</span></div></div>
    <div><div class="sig-line">Security Gate<br/><span style="color:#555">Verified Gate Out</span></div></div>
    <div><div class="sig-line">Authorized Signatory<br/><span style="color:#555">${selectedChalan.approvedBy}</span></div></div>
  </div>
</body>
</html>`;

    const blob = new Blob([chalanHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Chalan_${selectedChalan.chalanNo}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      {/* Printable Chalan Overlay Modal */}
      {selectedChalan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto print:fixed print:inset-0 print:bg-white print:p-0">
          <div className="relative w-full max-w-3xl rounded-lg bg-white p-8 text-black shadow-2xl print:p-0 print:shadow-none print:max-w-none max-h-[95vh] overflow-y-auto">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between border-b pb-4 mb-6 print:hidden">
              <span className="font-display font-semibold text-lg text-indigo-deep">
                {t('অফিশিয়াল চালান ও গেটপাস প্রিভিউ', 'Official Chalan & Gate Pass')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded bg-indigo px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-deep"
                >
                  <Printer size={15} />
                  {t('প্রিন্ট চালান (Print)', 'Print Chalan')}
                </button>
                <button
                  type="button"
                  onClick={downloadChalanDoc}
                  className="flex items-center gap-1.5 rounded border border-indigo px-3 py-2 text-xs font-semibold text-indigo hover:bg-indigo/5"
                >
                  <FileText size={15} />
                  {t('ডাউনলোড ফাইল', 'Download File')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedChalan(null)}
                  className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100"
                >
                  ✕ {t('বন্ধ করুন', 'Close')}
                </button>
              </div>
            </div>

            {/* PRINT DOCUMENT CONTAINER */}
            <div className="print:m-0 space-y-6 text-sm text-gray-900 leading-relaxed font-sans">
              {/* Company Letterhead */}
              <div className="text-center border-b-2 border-gray-800 pb-4">
                <h1 className="text-2xl font-bold uppercase tracking-wider">{companyName || 'Factory ERP'}</h1>
                <p className="text-xs text-gray-600 mt-1">{settings?.address || 'Kashimpur, Gazipur, Dhaka, Bangladesh'}</p>
                <p className="text-xs text-gray-600">Phone: {settings?.phone || '+880 1711-000000'} • Email: info@factory.com</p>
                <div className="inline-block mt-3 px-6 py-1 border-2 border-black font-bold uppercase tracking-widest text-sm bg-gray-50">
                  {selectedChalan.typeLabel}
                </div>
              </div>

              {/* Chalan Details Meta Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs border border-gray-300 p-3 rounded bg-gray-50/50">
                <div className="space-y-1">
                  <p><strong className="text-gray-700">{t('চালান নম্বর', 'Chalan No')}:</strong> <span className="font-mono font-bold text-black">{selectedChalan.chalanNo}</span></p>
                  <p><strong className="text-gray-700">{t('গেটপাস নম্বর', 'Gate Pass No')}:</strong> <span className="font-mono font-bold text-black">{selectedChalan.gatePassNo}</span></p>
                  <p><strong className="text-gray-700">{t('তারিখ ও সময়', 'Date & Time')}:</strong> {selectedChalan.date} at {selectedChalan.time}</p>
                  <p><strong className="text-gray-700">{t('ধরন', 'Type')}:</strong> {selectedChalan.isReturnable ? 'Returnable (ফেরতযোগ্য)' : 'Non-Returnable (অফেরতযোগ্য)'}</p>
                </div>
                <div className="space-y-1">
                  <p><strong className="text-gray-700">{t('প্রাপক / ডেলিভারি ঠিকানা', 'Delivered To')}:</strong></p>
                  <p className="font-bold text-black">{selectedChalan.receiverName}</p>
                  <p className="text-gray-600">{selectedChalan.receiverAddress}</p>
                  <p className="mt-1"><strong className="text-gray-700">{t('গাড়ি নং', 'Vehicle No')}:</strong> {selectedChalan.vehicleNo}</p>
                  <p><strong className="text-gray-700">{t('ড্রাইভারের নাম ও ফোন', 'Driver')}:</strong> {selectedChalan.driverName} ({selectedChalan.driverPhone})</p>
                </div>
              </div>

              {/* Line Items Table */}
              <table className="w-full border-collapse border border-gray-400 text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-400 text-left">
                    <th className="border border-gray-400 p-2 text-center w-10">SL</th>
                    <th className="border border-gray-400 p-2">{t('বিবরণ / মালামালের নাম', 'Description')}</th>
                    <th className="border border-gray-400 p-2">{t('কালার / লট', 'Color / Lot')}</th>
                    <th className="border border-gray-400 p-2 text-right">{t('পরিমাণ', 'Quantity')}</th>
                    <th className="border border-gray-400 p-2 text-center">{t('প্যাকেজ / বস্তা', 'Package')}</th>
                    <th className="border border-gray-400 p-2">{t('মন্তব্য', 'Remarks')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedChalan.items.map((item, idx) => (
                    <tr key={item.id} className="border-b border-gray-300">
                      <td className="border border-gray-400 p-2 text-center">{idx + 1}</td>
                      <td className="border border-gray-400 p-2 font-medium">{item.desc}</td>
                      <td className="border border-gray-400 p-2">{item.colorLot || '—'}</td>
                      <td className="border border-gray-400 p-2 text-right font-bold">
                        {item.qty} {item.unit}
                      </td>
                      <td className="border border-gray-400 p-2 text-center">{item.bags || '—'}</td>
                      <td className="border border-gray-400 p-2 text-gray-600">{item.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Purpose & Terms */}
              <div className="text-xs text-gray-700 border-t pt-2 space-y-1">
                <p><strong>{t('উদ্দেশ্য / কারণ', 'Purpose')}:</strong> {selectedChalan.purpose}</p>
                <p className="text-[11px] text-gray-500">
                  * মালামাল বুঝে পাওয়ার সাথে সাথে চালানের কপি স্বাক্ষর করে ফেরত পাঠানোর জন্য অনুরোধ করা হলো।
                </p>
              </div>

              {/* Four Signature Blocks */}
              <div className="grid grid-cols-4 gap-4 pt-16 text-center text-xs">
                <div className="border-t border-black pt-1">
                  <p className="font-semibold">{selectedChalan.preparedBy}</p>
                  <p className="text-[10px] text-gray-500">{t('প্রস্তুতকারী (Prepared By)', 'Prepared By')}</p>
                </div>
                <div className="border-t border-black pt-1">
                  <p className="font-semibold">{t('স্টোর ইনচার্জ', 'Store Incharge')}</p>
                  <p className="text-[10px] text-gray-500">{t('স্টোর ডিপার্টমেন্ট', 'Store Dept')}</p>
                </div>
                <div className="border-t border-black pt-1">
                  <p className="font-semibold">{t('সিকিউরিটি গেট', 'Security Gate')}</p>
                  <p className="text-[10px] text-gray-500">{t('গেট আউট ভেরিফায়েড', 'Verified & Gate Out')}</p>
                </div>
                <div className="border-t border-black pt-1">
                  <p className="font-semibold">{selectedChalan.approvedBy}</p>
                  <p className="text-[10px] text-gray-500">{t('অনুমোদনকারী (Authorized)', 'Authorized Signature')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Page Content */}
      <div className={`space-y-6 ${selectedChalan ? 'print:hidden' : ''}`}>
        {/* Main Page Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink flex items-center gap-2">
            <FileText className="text-indigo" size={26} />
            {t('অফিশিয়াল চালান ও ডিজিটাল গেটপাস', 'Official Chalan & Digital Gate Pass')}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {t(
              'ইয়ার্ন ডেলিভারি, সাবকন্ট্রাক্ট ওয়াশিং, ও ফিনিশড গুডস এক্সপোর্টের জন্য অফিশিয়াল চালান তৈরি ও প্রিন্ট করুন।',
              'Generate & print official chalans and gate passes for yarn issues, washing subcontracts, and export shipments.'
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className={`${btnPrimary} flex items-center gap-1.5 !text-xs`}
        >
          <Plus size={15} />
          {t('নতুন চালান তৈরি করুন', 'Create New Chalan')}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={`${inputClass} !py-1.5 !text-xs !w-auto`}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">{t('সব ধরনের চালান', 'All Types')}</option>
            {CHALAN_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            type="text"
            placeholder={t('চালান বা প্রাপকের নাম সার্চ…', 'Search chalan or receiver…')}
            className={`${inputClass} !pl-8 !py-1.5 text-xs`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Chalans Table */}
      <div className="rounded-lg border border-line bg-surface p-5">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[750px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium text-ink-soft">
                <th className="py-2.5 pr-3">{t('চালান নং ও তারিখ', 'Chalan No & Date')}</th>
                <th className="py-2.5 pr-3">{t('চালানের ধরন', 'Type')}</th>
                <th className="py-2.5 pr-3">{t('প্রাপক / গন্তব্য', 'Delivered To')}</th>
                <th className="py-2.5 pr-3">{t('গাড়ি ও পরিবহন', 'Vehicle & Transport')}</th>
                <th className="py-2.5 pr-3 text-right">{t('আইটেম সংখ্যা', 'Items')}</th>
                <th className="py-2.5 pr-3 text-center">{t('গেটপাস', 'Gate Pass')}</th>
                <th className="py-2.5 pr-2 text-right">{t('অ্যাকশন', 'Action')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredChalans.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-paper/50">
                  <td className="py-3 pr-3">
                    <p className="font-mono text-xs font-bold text-indigo">{c.chalanNo}</p>
                    <p className="text-[11px] text-ink-soft">{c.date} • {c.time}</p>
                  </td>
                  <td className="py-3 pr-3 text-xs">
                    <span className="font-medium text-ink">{c.typeLabel}</span>
                    {c.isReturnable && (
                      <span className="block text-[10px] text-amber">
                        {t('ফেরতযোগ্য (Returnable)', 'Returnable')}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <p className="font-medium text-ink">{c.receiverName}</p>
                    <p className="text-[11px] text-ink-soft truncate max-w-[200px]">{c.receiverAddress}</p>
                  </td>
                  <td className="py-3 pr-3 text-xs text-ink">
                    <p>{c.vehicleNo}</p>
                    <p className="text-[11px] text-ink-soft">{c.driverName}</p>
                  </td>
                  <td className="py-3 pr-3 text-right font-medium text-ink">
                    {c.items.length} {t('প্রকার', 'items')}
                  </td>
                  <td className="py-3 pr-3 text-center font-mono text-xs text-ink-soft">
                    {c.gatePassNo}
                  </td>
                  <td className="py-3 pr-2 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedChalan(c)}
                      className="inline-flex items-center gap-1 rounded bg-indigo px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-deep"
                    >
                      <Printer size={13} />
                      {t('চালান দেখুন / প্রিন্ট', 'View & Print')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {/* CREATE CHALAN MODAL */}
      {isModalOpen && (
        <Modal
          title={t('নতুন অফিশিয়াল চালান তৈরি করুন', 'Create Official Chalan & Gate Pass')}
          onClose={() => setIsModalOpen(false)}
          wide
        >
          <form onSubmit={handleCreateChalan} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t('চালানের ধরন *', 'Chalan Type *')}>
                <select
                  required
                  className={inputClass}
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                >
                  {CHALAN_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t('প্রাপকের নাম (Receiver Name) *', 'Receiver Name *')}>
                <input
                  type="text"
                  required
                  placeholder="Apex Washing / Chittagong Port CFS"
                  className={inputClass}
                  value={form.receiverName}
                  onChange={(e) => setForm((f) => ({ ...f, receiverName: e.target.value }))}
                />
              </Field>
            </div>

            <Field label={t('প্রাপকের ঠিকানা', 'Receiver Address')}>
              <input
                type="text"
                placeholder="Plot #, Road #, City / Area"
                className={inputClass}
                value={form.receiverAddress}
                onChange={(e) => setForm((f) => ({ ...f, receiverAddress: e.target.value }))}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label={t('গাড়ির নম্বর', 'Vehicle No.')}>
                <input
                  type="text"
                  placeholder="ঢাকা মেট্রো-ট ১১-২২৩৩"
                  className={inputClass}
                  value={form.vehicleNo}
                  onChange={(e) => setForm((f) => ({ ...f, vehicleNo: e.target.value }))}
                />
              </Field>
              <Field label={t('ড্রাইভারের নাম', 'Driver Name')}>
                <input
                  type="text"
                  placeholder="মো: রফিক"
                  className={inputClass}
                  value={form.driverName}
                  onChange={(e) => setForm((f) => ({ ...f, driverName: e.target.value }))}
                />
              </Field>
              <Field label={t('ড্রাইভারের ফোন', 'Driver Phone')}>
                <input
                  type="text"
                  placeholder="017xxxxxxxx"
                  className={inputClass}
                  value={form.driverPhone}
                  onChange={(e) => setForm((f) => ({ ...f, driverPhone: e.target.value }))}
                />
              </Field>
            </div>

            {/* Line Items Builder */}
            <div className="rounded-lg border border-line p-3 space-y-3 bg-paper">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink">{t('চালানের আইটেম বিবরণ', 'Line Items')}</span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs font-bold text-indigo hover:underline flex items-center gap-1"
                >
                  <Plus size={13} /> {t('+ নতুন আইটেম যোগ করুন', '+ Add Item')}
                </button>
              </div>

              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-surface p-2.5 rounded border border-line">
                  <div className="col-span-12 sm:col-span-4">
                    <input
                      type="text"
                      required
                      placeholder={t('পণ্যের বিবরণ / স্টাইল', 'Item Description / Style')}
                      className={`${inputClass} !py-1 text-xs`}
                      value={item.desc}
                      onChange={(e) => handleItemChange(idx, 'desc', e.target.value)}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <input
                      type="text"
                      placeholder={t('কালার/লট', 'Color/Lot')}
                      className={`${inputClass} !py-1 text-xs`}
                      value={item.colorLot}
                      onChange={(e) => handleItemChange(idx, 'colorLot', e.target.value)}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <input
                      type="number"
                      required
                      placeholder={t('পরিমাণ', 'Qty')}
                      className={`${inputClass} !py-1 text-xs`}
                      value={item.qty}
                      onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <select
                      className={`${inputClass} !py-1 text-xs`}
                      value={item.unit}
                      onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                    >
                      <option value="pcs">pcs</option>
                      <option value="lb">lb</option>
                      <option value="kg">kg</option>
                      <option value="bags">bags</option>
                      <option value="cartons">cartons</option>
                    </select>
                  </div>
                  <div className="col-span-4 sm:col-span-1">
                    <input
                      type="text"
                      placeholder={t('বস্তা/ব্যাগ', 'Bags')}
                      className={`${inputClass} !py-1 text-xs`}
                      value={item.bags}
                      onChange={(e) => handleItemChange(idx, 'bags', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={form.items.length <= 1}
                      className="text-red hover:opacity-80 text-sm font-bold disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isReturnable}
                  onChange={(e) => setForm((f) => ({ ...f, isReturnable: e.target.checked }))}
                  className="rounded text-indigo"
                />
                {t('এই মালামাল ফেরতযোগ্য (Returnable Gate Pass)', 'This material is returnable')}
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className={btnSecondary}
              >
                {t('বাতিল', 'Cancel')}
              </button>
              <button type="submit" className={btnPrimary}>
                {t('চালান সেভ ও প্রিন্ট প্রিভিউ', 'Save & Preview Chalan')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
