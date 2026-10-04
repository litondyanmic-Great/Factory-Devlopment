import { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  addDoc,
  serverTimestamp,
  updateDoc,
  setDoc,
  increment,
  getDoc,
  doc,
} from 'firebase/firestore';
import QRCode from 'qrcode';
import {
  QrCode,
  Printer,
  CheckCircle2,
  Camera,
  Layers,
  ArrowRight,
  Search,
  Filter,
  RefreshCw,
  Plus,
  AlertCircle,
  Tag,
  Trash2,
  FileText,
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../lib/i18n';
import { Field, inputClass, btnPrimary, btnSecondary, EmptyState, Modal, Pill, StatCard } from '../../components/ui';
import CameraQrScanner from '../../components/CameraQrScanner';
import { STAGES, stageLabel } from '../../lib/constants';
import { isDemoDataCleared } from '../../lib/demoData';

const LOCAL_STORAGE_KEY = 'factory_erp_bundles_data';

const INITIAL_DEMO_BUNDLES = [
  {
    id: 'bnd-001',
    bundleNo: 'BND-SW01-M-001',
    styleId: 'style-hm-01',
    styleNo: 'HM-2026/SW-01',
    styleLabel: "HM-2026/SW-01 — Men's Crew Neck Pullover",
    buyer: 'H&M',
    size: 'M',
    color: 'Navy Blue',
    qty: 20,
    currentStage: 'linking',
    currentStageLabel: 'লিংকিং',
    status: 'in_progress',
    createdAt: '2026-09-28',
    history: [
      { stage: 'knitting', completedAt: '2026-09-28 11:30', operator: 'Rafiq' },
      { stage: 'linking', completedAt: '2026-09-29 14:15', operator: 'Monir' },
    ],
  },
  {
    id: 'bnd-002',
    bundleNo: 'BND-SW01-L-002',
    styleId: 'style-hm-01',
    styleNo: 'HM-2026/SW-01',
    styleLabel: "HM-2026/SW-01 — Men's Crew Neck Pullover",
    buyer: 'H&M',
    size: 'L',
    color: 'Navy Blue',
    qty: 20,
    currentStage: 'trimming',
    currentStageLabel: 'ট্রিমিং',
    status: 'in_progress',
    createdAt: '2026-09-28',
    history: [
      { stage: 'knitting', completedAt: '2026-09-28 12:00', operator: 'Rafiq' },
      { stage: 'linking', completedAt: '2026-09-29 10:20', operator: 'Sumon' },
      { stage: 'trimming', completedAt: '2026-09-29 16:45', operator: 'Fatema' },
    ],
  },
  {
    id: 'bnd-003',
    bundleNo: 'BND-SW01-XL-003',
    styleId: 'style-hm-01',
    styleNo: 'HM-2026/SW-01',
    styleLabel: "HM-2026/SW-01 — Men's Crew Neck Pullover",
    buyer: 'H&M',
    size: 'XL',
    color: 'Navy Blue',
    qty: 20,
    currentStage: 'knitting',
    currentStageLabel: 'নিটিং',
    status: 'in_progress',
    createdAt: '2026-09-29',
    history: [],
  },
  {
    id: 'bnd-004',
    bundleNo: 'BND-ZR04-S-001',
    styleId: 'style-zr-02',
    styleNo: 'ZR-2026/CD-04',
    styleLabel: "ZR-2026/CD-04 — Women's Cable Knit Cardigan",
    buyer: 'Zara',
    size: 'S',
    color: 'Ivory',
    qty: 15,
    currentStage: 'mending',
    currentStageLabel: 'মেন্ডিং',
    status: 'in_progress',
    createdAt: '2026-09-27',
    history: [
      { stage: 'knitting', completedAt: '2026-09-27 15:00', operator: 'Kamal' },
      { stage: 'linking', completedAt: '2026-09-28 11:10', operator: 'Salim' },
      { stage: 'trimming', completedAt: '2026-09-28 17:30', operator: 'Hasina' },
    ],
  },
  {
    id: 'bnd-005',
    bundleNo: 'BND-ZR04-M-002',
    styleId: 'style-zr-02',
    styleNo: 'ZR-2026/CD-04',
    styleLabel: "ZR-2026/CD-04 — Women's Cable Knit Cardigan",
    buyer: 'Zara',
    size: 'M',
    color: 'Ivory',
    qty: 15,
    currentStage: 'packing',
    currentStageLabel: 'প্যাকিং',
    status: 'completed',
    createdAt: '2026-09-26',
    history: [
      { stage: 'knitting', completedAt: '2026-09-26 10:00', operator: 'Kamal' },
      { stage: 'linking', completedAt: '2026-09-27 09:30', operator: 'Salim' },
      { stage: 'trimming', completedAt: '2026-09-27 14:00', operator: 'Hasina' },
      { stage: 'wash', completedAt: '2026-09-28 12:00', operator: 'Wash Incharge' },
      { stage: 'iron', completedAt: '2026-09-29 11:00', operator: 'Iron Master' },
      { stage: 'packing', completedAt: '2026-09-29 15:30', operator: 'Packer 1' },
    ],
  },
];

function getStoredBundles() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw !== null) return JSON.parse(raw);
    if (isDemoDataCleared()) return [];
  } catch {}
  return isDemoDataCleared() ? [] : INITIAL_DEMO_BUNDLES;
}

function saveStoredBundles(list) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('factory_erp_data_updated'));
  } catch {}
}

export default function BundleTracking() {
  const { profile, user } = useAuth();
  const { t, lang } = useLang();

  const [bundles, setBundles] = useState(getStoredBundles);
  const [styles, setStyles] = useState([]);
  const [selectedStyleId, setSelectedStyleId] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'print' | 'scan'

  // Modal State for Generating Bundles
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [genForm, setGenForm] = useState({
    styleId: '',
    color: '',
    size: 'M',
    totalPcs: 100,
    pcsPerBundle: 20,
  });

  // Scanner State
  const [scanInput, setScanInput] = useState('');
  const [scannedBundle, setScannedBundle] = useState(null);
  const [scanMessage, setScanMessage] = useState({ text: '', type: '' });
  const [operatorName, setOperatorName] = useState(profile?.name || '');
  const [useCamera, setUseCamera] = useState(false);

  // QR Code Cache for Print View
  const [qrCodeUrls, setQrCodeUrls] = useState({});

  useEffect(() => {
    function handleUpdate() {
      setBundles(getStoredBundles());
    }
    window.addEventListener('factory_erp_data_updated', handleUpdate);
    return () => window.removeEventListener('factory_erp_data_updated', handleUpdate);
  }, []);

  function handleDeleteBundle(id) {
    const ok = window.confirm(t('এই বান্ডেল টিকিটটি মুছে ফেলতে চান?', 'Delete this bundle ticket?'));
    if (!ok) return;
    const updated = bundles.filter((b) => b.id !== id);
    setBundles(updated);
    saveStoredBundles(updated);
  }

  function handleClearAllBundles() {
    const ok = window.confirm(
      t(
        '⚠️ সব ডেমো বান্ডেল মুছে ফেলতে চান?',
        '⚠️ Delete all demo bundles?'
      )
    );
    if (!ok) return;
    const updated = bundles.filter((b) => !b.id.startsWith('bnd-'));
    setBundles(updated);
    saveStoredBundles(updated);
  }

  useEffect(() => {
    // Sync bundles from Firestore in realtime across devices
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, 'bundles'), (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setBundles(list);
          saveStoredBundles(list);
        }
      });
    } catch {}
    return () => unsub();
  }, []);

  useEffect(() => {
    // Load styles
    try {
      const unsub = onSnapshot(collection(db, 'styles'), (snap) => {
        if (!snap.empty) {
          setStyles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } else {
          setStyles([
            { id: 'style-hm-01', styleNo: 'HM-2026/SW-01', styleName: "Men's Crew Neck Pullover", buyer: 'H&M' },
            { id: 'style-zr-02', styleNo: 'ZR-2026/CD-04', styleName: "Women's Cable Knit Cardigan", buyer: 'Zara' },
            { id: 'style-nx-03', styleNo: 'NX-2026/HD-09', styleName: 'Jacquard Heavy Knit Hoodie', buyer: 'Next UK' },
          ]);
        }
      });
      return unsub;
    } catch {
      setStyles([
        { id: 'style-hm-01', styleNo: 'HM-2026/SW-01', styleName: "Men's Crew Neck Pullover", buyer: 'H&M' },
        { id: 'style-zr-02', styleNo: 'ZR-2026/CD-04', styleName: "Women's Cable Knit Cardigan", buyer: 'Zara' },
        { id: 'style-nx-03', styleNo: 'NX-2026/HD-09', styleName: 'Jacquard Heavy Knit Hoodie', buyer: 'Next UK' },
      ]);
    }
  }, []);

  // Pre-generate QR codes for print
  useEffect(() => {
    bundles.forEach(async (b) => {
      if (!qrCodeUrls[b.bundleNo]) {
        try {
          const url = await QRCode.toDataURL(b.bundleNo, {
            width: 140,
            margin: 1,
            color: { dark: '#1B2C46', light: '#FFFFFF' },
          });
          setQrCodeUrls((prev) => ({ ...prev, [b.bundleNo]: url }));
        } catch (err) {
          console.error(err);
        }
      }
    });
  }, [bundles]);

  // Filtered bundles
  const filteredBundles = useMemo(() => {
    return bundles.filter((b) => {
      const matchSearch =
        b.bundleNo.toLowerCase().includes(search.toLowerCase()) ||
        b.styleLabel.toLowerCase().includes(search.toLowerCase()) ||
        (b.color && b.color.toLowerCase().includes(search.toLowerCase())) ||
        (b.size && b.size.toLowerCase().includes(search.toLowerCase()));

      const matchStyle = !selectedStyleId || b.styleId === selectedStyleId;
      const matchStage = stageFilter === 'all' || b.currentStage === stageFilter;

      return matchSearch && matchStyle && matchStage;
    });
  }, [bundles, search, selectedStyleId, stageFilter]);

  // Stage Metrics
  const stageStats = useMemo(() => {
    const stats = {};
    STAGES.forEach((s) => (stats[s.key] = 0));
    bundles.forEach((b) => {
      if (stats[b.currentStage] !== undefined) {
        stats[b.currentStage] += b.qty;
      }
    });
    return stats;
  }, [bundles]);

  // Handle Generate Bundles
  function handleGenerateBundles(e) {
    e.preventDefault();
    const styleObj = styles.find((s) => s.id === genForm.styleId);
    if (!styleObj) return;

    const count = Math.ceil(Number(genForm.totalPcs) / Number(genForm.pcsPerBundle));
    const newBundles = [];
    const dateStr = new Date().toISOString().slice(0, 10);
    const prefix = styleObj.styleNo.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();

    for (let i = 1; i <= count; i++) {
      const bundleSeq = String(i).padStart(3, '0');
      const bndNo = `BND-${prefix}-${genForm.size}-${bundleSeq}`;
      const qty = i === count ? Number(genForm.totalPcs) - (count - 1) * Number(genForm.pcsPerBundle) : Number(genForm.pcsPerBundle);

      newBundles.push({
        id: `bnd-${Date.now()}-${i}`,
        bundleNo: bndNo,
        styleId: styleObj.id,
        styleNo: styleObj.styleNo,
        styleLabel: `${styleObj.styleNo} ${styleObj.styleName ? '— ' + styleObj.styleName : ''}`,
        buyer: styleObj.buyer || 'General',
        size: genForm.size,
        color: genForm.color || 'Standard',
        qty: qty,
        currentStage: 'knitting',
        currentStageLabel: stageLabel('knitting', lang),
        status: 'in_progress',
        createdAt: dateStr,
        history: [],
      });
    }

    const updated = [...newBundles, ...bundles];
    setBundles(updated);
    saveStoredBundles(updated);
    setGenerateModalOpen(false);
  }

  // Handle Scanning or Code Lookup
  function handleLookup(codeToScan) {
    const targetCode = (codeToScan || scanInput).trim().toUpperCase();
    if (!targetCode) return;

    const found = bundles.find(
      (b) => b.bundleNo.toUpperCase() === targetCode || b.id === targetCode
    );

    if (found) {
      setScannedBundle(found);
      setScanMessage({ text: t('বান্ডেল পাওয়া গেছে!', 'Bundle found!'), type: 'success' });
    } else {
      setScannedBundle(null);
      setScanMessage({ text: t('কোনো বান্ডেল পাওয়া যায়নি। কোড চেক করুন।', 'No bundle found with this code.'), type: 'error' });
    }
  }

  // Advance Bundle to Next Stage
  function handleAdvanceStage(bundle) {
    const currentIndex = STAGES.findIndex((s) => s.key === bundle.currentStage);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + 1;
    const isCompleted = nextIndex >= STAGES.length;
    const nextStage = isCompleted ? STAGES[STAGES.length - 1].key : STAGES[nextIndex].key;

    const newHistory = [
      ...(bundle.history || []),
      {
        stage: bundle.currentStage,
        completedAt: new Date().toLocaleString(),
        operator: operatorName || profile?.name || 'Floor Operator',
      },
    ];

    const updatedBundle = {
      ...bundle,
      currentStage: nextStage,
      currentStageLabel: stageLabel(nextStage, lang),
      status: isCompleted ? 'completed' : 'in_progress',
      history: newHistory,
    };

    const updatedList = bundles.map((b) => (b.id === bundle.id ? updatedBundle : b));
    setBundles(updatedList);
    saveStoredBundles(updatedList);
    setScannedBundle(updatedBundle);

    // Sync updated bundle to Firestore
    try {
      setDoc(doc(db, 'bundles', bundle.id), updatedBundle, { merge: true }).catch(() => {});
    } catch {}

    // When advancing a stage on a bundle, record this completed stage in the style's productionEntries
    // and increment the style's stage counter in Firestore so stage-wise progress updates in realtime
    if (bundle.styleId && bundle.currentStage && Number(bundle.qty) > 0) {
      const stageDone = bundle.currentStage;
      const q = Number(bundle.qty);
      try {
        const entryData = {
          styleId: bundle.styleId,
          stage: stageDone,
          quantity: q,
          date: new Date().toISOString().slice(0, 10),
          enteredBy: operatorName || profile?.name || 'Bundle QR Scanner',
          note: `Bundle: ${bundle.bundleNo} (${bundle.size || ''} ${bundle.color || ''})`,
          createdAt: serverTimestamp(),
        };
        addDoc(collection(db, 'styles', bundle.styleId, 'productionEntries'), entryData).catch(() => {});
        updateDoc(doc(db, 'styles', bundle.styleId), {
          [`stages.${stageDone}`]: increment(q),
          productionStarted: true,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      } catch (err) {
        console.warn('Bundle progress sync notice:', err);
      }
    }

    setScanMessage({
      text: isCompleted
        ? t('অভিনন্দন! বান্ডেলটির সকল স্টেজ সম্পন্ন হয়েছে (Packing Complete)।', 'Bundle is completely finished through all stages!')
        : t(`স্টেজ আপডেট হয়েছে: ${stageLabel(nextStage, lang)}`, `Stage advanced to: ${stageLabel(nextStage, lang)}`),
      type: 'success',
    });
  }

  function handlePrintNow() {
    window.print();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      {/* Print isolation style */}
      <style>{`
        @media print {
          nav, header, aside, .print\\:hidden {
            display: none !important;
          }
          body {
            background: #fff !important;
            color: #000 !important;
          }
          .bundle-cards-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .bundle-cards-grid > div {
            border: 2px dashed #333 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: #fff !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink flex items-center gap-2">
            <QrCode className="text-indigo" size={26} />
            {t('কিউআর কোড ও বান্ডেল ট্র্যাকিং', 'QR Code & Bundle Tracking')}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {t(
              'সোয়েটার বান্ডেল কার্ড প্রিন্ট করুন এবং ফ্লোরে কিউআর কোড স্ক্যান করে লাইভ স্টেজ অগ্রতি রেকর্ড করুন।',
              'Generate & print bundle cards with QR codes and scan on the floor to advance production stages.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'scan' ? 'list' : 'scan')}
            className={`${btnSecondary} !text-xs flex items-center gap-1.5 ${
              viewMode === 'scan' ? '!bg-indigo !text-white' : ''
            }`}
          >
            <Camera size={15} />
            {viewMode === 'scan' ? t('তালিকায় ফিরুন', 'Back to List') : t('কিউআর স্ক্যানার / এন্ট্রি', 'QR Scanner / Entry')}
          </button>

          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'print' ? 'list' : 'print')}
            className={`${btnSecondary} !text-xs flex items-center gap-1.5 ${
              viewMode === 'print' ? '!bg-indigo !text-white' : ''
            }`}
          >
            <Printer size={15} />
            {viewMode === 'print' ? t('তালিকায় ফিরুন', 'Back to List') : t('বান্ডেল কার্ড প্রিন্ট ভিউ', 'Print Bundle Tickets')}
          </button>

          <button
            type="button"
            onClick={() => setGenerateModalOpen(true)}
            className={`${btnPrimary} !text-xs flex items-center gap-1.5`}
          >
            <Plus size={15} />
            {t('নতুন বান্ডেল তৈরি করুন', 'Create New Bundles')}
          </button>
        </div>
      </div>

      {/* Stage Live Pipeline Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 print:hidden">
        {STAGES.slice(0, 6).map((s) => (
          <div key={s.key} className="rounded-lg border border-line bg-surface p-3">
            <p className="text-[11px] font-medium text-ink-soft">{stageLabel(s.key, lang)}</p>
            <p className="mt-1 font-display text-xl font-bold text-indigo">
              {stageStats[s.key] || 0} <span className="text-xs font-normal text-ink-soft">pcs</span>
            </p>
          </div>
        ))}
      </div>

      {/* SCANNER VIEW */}
      {viewMode === 'scan' && (
        <div className="rounded-lg border-2 border-indigo/30 bg-surface p-6 shadow-sm max-w-2xl mx-auto space-y-5">
          <div className="flex items-center gap-3 border-b border-line pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo text-white">
              <Camera size={22} />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-ink">
                {t('কিউআর স্ক্যানার ও ফ্লোর এন্ট্রি', 'QR Code Floor Scanner & Advancement')}
              </h2>
              <p className="text-xs text-ink-soft">
                {t('বারকোড/কিউআর স্ক্যানার গান বা মোবাইলের ক্যামেরা দিয়ে স্ক্যান করুন অথবা সরাসরি বান্ডেল কোড লিখুন।', 'Scan using a barcode gun or live camera, or type bundle code below.')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 bg-paper p-2.5 rounded-lg border border-line">
            <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <Camera size={15} className="text-indigo" />
              {t('ক্যামেরা স্ক্যানিং মোড:', 'Camera Scanning Mode:')}
            </span>
            <button
              type="button"
              onClick={() => setUseCamera((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                useCamera
                  ? 'bg-red text-white hover:bg-red/90'
                  : 'bg-indigo text-white hover:bg-indigo-deep shadow-sm'
              }`}
            >
              <Camera size={14} />
              {useCamera ? t('ক্যামেরা বন্ধ করুন', 'Close Camera') : t('লাইভ ক্যামেরা চালু করুন', 'Open Camera Scanner')}
            </button>
          </div>

          {useCamera && (
            <CameraQrScanner
              onScan={(code) => {
                setScanInput(code);
                handleLookup(code);
              }}
              onClose={() => setUseCamera(false)}
            />
          )}

          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                placeholder="যেমন: BND-SW01-M-001"
                className={`${inputClass} !py-2.5 font-mono text-sm uppercase`}
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              />
              <button
                type="button"
                onClick={() => handleLookup()}
                className={`${btnPrimary} !px-4 shrink-0`}
              >
                <Search size={16} />
                {t('খুঁজুন', 'Lookup')}
              </button>
            </div>

            {scanMessage.text && (
              <p
                className={`text-xs font-medium rounded p-2.5 ${
                  scanMessage.type === 'success' ? 'bg-green-soft text-green' : 'bg-red-soft text-red'
                }`}
              >
                {scanMessage.text}
              </p>
            )}
          </div>

          {/* Quick Demo Scan Shortcuts */}
          <div className="rounded-md bg-paper p-3 text-xs">
            <span className="font-medium text-ink-soft">{t('দ্রুত পরীক্ষার জন্য ক্লিক করুন:', 'Quick test click:')} </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {bundles.slice(0, 4).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setScanInput(b.bundleNo);
                    handleLookup(b.bundleNo);
                  }}
                  className="rounded border border-line bg-surface px-2 py-1 font-mono text-[11px] text-indigo hover:border-indigo"
                >
                  {b.bundleNo}
                </button>
              ))}
            </div>
          </div>

          {/* Scanned Bundle Detail Card */}
          {scannedBundle && (
            <div className="rounded-lg border-2 border-green/30 bg-green-soft/20 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-indigo">{scannedBundle.bundleNo}</span>
                  <h3 className="font-display text-base font-semibold text-ink">{scannedBundle.styleLabel}</h3>
                  <p className="text-xs text-ink-soft">
                    {t('বায়ার', 'Buyer')}: {scannedBundle.buyer} • {t('সাইজ', 'Size')}: <strong>{scannedBundle.size}</strong> •{' '}
                    {t('রং', 'Color')}: <strong>{scannedBundle.color}</strong> • {t('কোয়ান্টিটি', 'Qty')}: <strong>{scannedBundle.qty} pcs</strong>
                  </p>
                </div>
                <Pill tone={scannedBundle.status === 'completed' ? 'green' : 'amber'}>
                  {scannedBundle.status === 'completed' ? t('সম্পূর্ণ', 'Completed') : stageLabel(scannedBundle.currentStage, lang)}
                </Pill>
              </div>

              <div className="flex items-center gap-3 rounded-md bg-surface p-3 border border-line">
                <span className="text-xs text-ink-soft">{t('বর্তমান স্টেজ:', 'Current Stage:')}</span>
                <span className="font-semibold text-indigo">{stageLabel(scannedBundle.currentStage, lang)}</span>
                <ArrowRight size={14} className="text-ink-soft" />
                <span className="text-xs text-ink-soft">{t('পরবর্তী স্টেজ:', 'Next Stage:')}</span>
                <span className="font-semibold text-green">
                  {(() => {
                    const idx = STAGES.findIndex((s) => s.key === scannedBundle.currentStage);
                    return idx < STAGES.length - 1 ? stageLabel(STAGES[idx + 1].key, lang) : t('ফাইনাল প্যাকিং', 'Packing Finished');
                  })()}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="w-full sm:w-1/2">
                  <input
                    type="text"
                    placeholder={t('অপারেটরের নাম / মেশিন নং', 'Operator Name / Machine #')}
                    className={`${inputClass} !py-1.5 text-xs`}
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleAdvanceStage(scannedBundle)}
                  className="flex items-center justify-center gap-2 rounded-md bg-green px-5 py-2 text-xs font-bold text-white shadow hover:opacity-90"
                >
                  <CheckCircle2 size={16} />
                  {t('পরবর্তী স্টেজে স্থানান্তর করুন', 'Advance to Next Stage')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PRINT VIEW */}
      {viewMode === 'print' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-line bg-surface p-4 print:hidden">
            <div>
              <h2 className="font-display text-sm font-semibold text-ink">
                {t('প্রিন্ট-রেডি বান্ডেল টিকিট শীট', 'Printable Bundle Cards')}
              </h2>
              <p className="text-xs text-ink-soft">
                {t('স্টিকার বা কাগজের বান্ডেল টিকিট প্রিন্ট করে কাটিং/নিটিং লটে সংযুক্ত করুন।', 'Print on sticker paper or cardstock to attach with garment bundles.')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintNow}
                className={`${btnPrimary} flex items-center gap-1.5 !text-xs`}
              >
                <Printer size={15} />
                {t('প্রিন্ট করুন (Print Now)', 'Print Now')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const printable = document.querySelector('.bundle-cards-grid');
                  if (!printable) return;
                  const docHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bundle_Cards</title><style>@page{size:A4 portrait;margin:8mm;}body{font-family:sans-serif;margin:0;padding:10px;}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}.card{border:2px dashed #000;border-radius:6px;padding:12px;background:#fff;}@media print{.no-print{display:none;}}</style></head><body><div class="no-print" style="margin-bottom:12px;"><button onclick="window.print()" style="padding:6px 14px;background:#2B4570;color:#fff;border:0;border-radius:4px;cursor:pointer;">🖨️ Print Tickets</button></div><div class="grid">${printable.innerHTML}</div></body></html>`;
                  const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Bundle_Tickets_${new Date().toISOString().slice(0, 10)}.html`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  setTimeout(() => URL.revokeObjectURL(url), 2000);
                }}
                className={`${btnSecondary} flex items-center gap-1.5 !text-xs`}
              >
                <FileText size={15} />
                {t('ডাউনলোড ফাইল', 'Download File')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-2 bundle-cards-grid">
            {filteredBundles.map((b) => (
              <div
                key={b.id}
                className="relative rounded-lg border-2 border-dashed border-line bg-surface p-4 shadow-sm print:border-black print:p-3"
              >
                <div className="flex justify-between items-start border-b border-line pb-2 mb-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-indigo">{b.bundleNo}</span>
                    <p className="text-[11px] font-semibold text-ink leading-tight truncate max-w-[140px]">
                      {b.styleNo}
                    </p>
                  </div>
                  <span className="rounded bg-amber-soft px-1.5 py-0.5 font-bold text-xs text-amber border border-amber/30">
                    {b.qty} PCS
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-20 w-20 shrink-0 bg-paper rounded flex items-center justify-center border border-line overflow-hidden">
                    {qrCodeUrls[b.bundleNo] ? (
                      <img src={qrCodeUrls[b.bundleNo]} alt="QR" className="h-full w-full object-contain" />
                    ) : (
                      <QrCode size={30} className="text-ink-soft opacity-40" />
                    )}
                  </div>

                  <div className="text-xs space-y-1 text-ink">
                    <p>
                      <span className="text-ink-soft">{t('সাইজ', 'Size')}:</span> <strong>{b.size}</strong>
                    </p>
                    <p>
                      <span className="text-ink-soft">{t('কালার', 'Color')}:</span> <strong>{b.color}</strong>
                    </p>
                    <p>
                      <span className="text-ink-soft">{t('বায়ার', 'Buyer')}:</span> {b.buyer}
                    </p>
                    <p className="text-[10px] text-ink-soft">
                      {t('তারিখ', 'Date')}: {b.createdAt}
                    </p>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-line text-[10px] text-ink-soft flex justify-between">
                  <span>Start: Knitting</span>
                  <span>Target: Packing</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STANDARD LIST VIEW */}
      {viewMode === 'list' && (
        <div className="rounded-lg border border-line bg-surface p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={`${inputClass} !py-1.5 !text-xs !w-auto`}
                value={selectedStyleId}
                onChange={(e) => setSelectedStyleId(e.target.value)}
              >
                <option value="">{t('সব স্টাইল', 'All Styles')}</option>
                {styles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.styleNo}
                  </option>
                ))}
              </select>

              <select
                className={`${inputClass} !py-1.5 !text-xs !w-auto`}
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
              >
                <option value="all">{t('সব স্টেজ', 'All Stages')}</option>
                {STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {stageLabel(s.key, lang)}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[200px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
              <input
                type="text"
                placeholder={t('বান্ডেল বা স্টাইল সার্চ…', 'Search bundle or style…')}
                className={`${inputClass} !pl-8 !py-1.5 text-xs`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium text-ink-soft">
                  <th className="py-2.5 pr-3">{t('বান্ডেল নং', 'Bundle No.')}</th>
                  <th className="py-2.5 pr-3">{t('স্টাইল ও বায়ার', 'Style & Buyer')}</th>
                  <th className="py-2.5 pr-3">{t('সাইজ ও কালার', 'Size & Color')}</th>
                  <th className="py-2.5 pr-3 text-right">{t('পিস', 'Qty')}</th>
                  <th className="py-2.5 pr-3 text-center">{t('বর্তমান স্টেজ', 'Current Stage')}</th>
                  <th className="py-2.5 pr-3 text-center">{t('স্ট্যাটাস', 'Status')}</th>
                  <th className="py-2.5 pr-2 text-right">{t('অ্যাকশন', 'Action')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredBundles.map((b) => (
                  <tr key={b.id} className="border-b border-line last:border-0 hover:bg-paper/50">
                    <td className="py-3 pr-3 font-mono text-xs font-semibold text-indigo">
                      {b.bundleNo}
                    </td>
                    <td className="py-3 pr-3">
                      <p className="font-medium text-ink">{b.styleLabel || b.styleNo}</p>
                      <p className="text-[11px] text-ink-soft">{b.buyer}</p>
                    </td>
                    <td className="py-3 pr-3 text-xs text-ink">
                      <span className="font-semibold">{b.size}</span> • {b.color}
                    </td>
                    <td className="py-3 pr-3 text-right font-medium text-ink">{b.qty}</td>
                    <td className="py-3 pr-3 text-center">
                      <span className="inline-block rounded bg-indigo-soft px-2 py-0.5 text-xs font-medium text-indigo">
                        {stageLabel(b.currentStage, lang)}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-center">
                      <Pill tone={b.status === 'completed' ? 'green' : 'amber'}>
                        {b.status === 'completed' ? t('সম্পূর্ণ', 'Completed') : t('চলমান', 'In Progress')}
                      </Pill>
                    </td>
                    <td className="py-3 pr-2 text-right">
                      {b.status !== 'completed' ? (
                        <button
                          type="button"
                          onClick={() => handleAdvanceStage(b)}
                          className="inline-flex items-center gap-1 rounded bg-green px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
                        >
                          <ArrowRight size={13} />
                          {t('পরবর্তী স্টেজ', 'Next Stage')}
                        </button>
                      ) : (
                        <span className="text-xs text-green font-medium">✓ Done</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE BUNDLE MODAL */}
      {generateModalOpen && (
        <Modal
          title={t('নতুন বান্ডেল টিকিট তৈরি করুন', 'Create New Bundle Tickets')}
          onClose={() => setGenerateModalOpen(false)}
        >
          <form onSubmit={handleGenerateBundles} className="space-y-4">
            <Field label={t('স্টাইল নির্বাচন করুন *', 'Select Style *')}>
              <select
                required
                className={inputClass}
                value={genForm.styleId}
                onChange={(e) => setGenForm((f) => ({ ...f, styleId: e.target.value }))}
              >
                <option value="">{t('নির্বাচন করুন', 'Select')}</option>
                {styles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.styleNo} — {s.buyer}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('সাইজ (Size) *', 'Size *')}>
                <select
                  className={inputClass}
                  value={genForm.size}
                  onChange={(e) => setGenForm((f) => ({ ...f, size: e.target.value }))}
                >
                  <option value="XS">XS</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="XXL">XXL</option>
                </select>
              </Field>

              <Field label={t('কালার (Color)', 'Color')}>
                <input
                  type="text"
                  placeholder="Navy / Black / Red"
                  className={inputClass}
                  value={genForm.color}
                  onChange={(e) => setGenForm((f) => ({ ...f, color: e.target.value }))}
                />
              </Field>

              <Field label={t('মোট কোয়ান্টিটি (Pcs) *', 'Total Pcs *')}>
                <input
                  type="number"
                  min="1"
                  required
                  className={inputClass}
                  value={genForm.totalPcs}
                  onChange={(e) => setGenForm((f) => ({ ...f, totalPcs: e.target.value }))}
                />
              </Field>

              <Field label={t('প্রতি বান্ডেলে পিস সংখ্যা *', 'Pcs Per Bundle *')}>
                <input
                  type="number"
                  min="1"
                  required
                  className={inputClass}
                  value={genForm.pcsPerBundle}
                  onChange={(e) => setGenForm((f) => ({ ...f, pcsPerBundle: e.target.value }))}
                />
              </Field>
            </div>

            <div className="rounded bg-paper p-3 text-xs text-ink-soft">
              {t('আনুমানিক তৈরি হবে:', 'Estimated bundles:')}{' '}
              <strong className="text-indigo">
                {Math.ceil(Number(genForm.totalPcs || 0) / Number(genForm.pcsPerBundle || 1))} {t('টি বান্ডেল', 'bundles')}
              </strong>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setGenerateModalOpen(false)}
                className={btnSecondary}
              >
                {t('বাতিল', 'Cancel')}
              </button>
              <button type="submit" className={btnPrimary}>
                {t('বান্ডেল তৈরি করুন', 'Generate Bundles')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
