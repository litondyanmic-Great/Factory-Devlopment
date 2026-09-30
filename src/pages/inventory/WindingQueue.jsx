import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { Link } from 'react-router-dom';
import {
  PackageCheck,
  Send,
  History,
  Layers,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  Search,
  Plus,
  ArrowDownLeft,
  Truck,
  RotateCcw,
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Field, inputClass, btnPrimary, btnSecondary, EmptyState, Pill, Modal, StatCard } from '../../components/ui';
import ExportBar from '../../components/ExportBar';
import { WINDING_SECTION, STAGES, canEnterSection, BLOCKS } from '../../lib/constants';
import { useLang } from '../../lib/i18n';

const LOCAL_STORAGE_KEY = 'factory_erp_winding_custom_ledger';

// Default initial sample records for demo / offline experience
const INITIAL_DEMO_ENTRIES = [
  {
    id: 'demo-wind-01',
    styleId: 'style-demo-hm-01',
    styleNo: 'HM-2026/SW-01',
    styleLabel: "HM-2026/SW-01 — Men's Crew Neck Pullover",
    yarnItemId: 'yarn-demo-01',
    yarnItemName: '2/28 Nm 100% Acrylic Soft Yarn (Navy Blue)',
    type: 'issueToWinding',
    qty: 450.0,
    block: 'Block B',
    date: '2026-09-27',
    notes: 'Yarn store issue chalan #CH-8821 for body knitting',
    enteredBy: 'Store Manager (Kalam)',
    windingReceived: false,
    windingReceivedQty: 0,
  },
  {
    id: 'demo-wind-02',
    styleId: 'style-demo-zara-02',
    styleNo: 'ZR-2026/CD-04',
    styleLabel: "ZR-2026/CD-04 — Women's Cable Knit Cardigan",
    yarnItemId: 'yarn-demo-02',
    yarnItemName: '2/32 Nm Wool Blend Yarn (Ivory Heather)',
    type: 'issueToWinding',
    qty: 320.0,
    block: 'Block D',
    date: '2026-09-28',
    notes: 'Store issue chalan #CH-8834',
    enteredBy: 'Store Assistant (Mizan)',
    windingReceived: true,
    windingReceivedQty: 320.0,
    windingReceivedDate: '2026-09-28',
    windingReceivedBy: 'Winding Operator (Jalal)',
    windingLotNo: 'LOT-Z22',
    windingConeCount: 80,
  },
  {
    id: 'demo-wind-03',
    styleId: 'style-demo-zara-02',
    styleNo: 'ZR-2026/CD-04',
    styleLabel: "ZR-2026/CD-04 — Women's Cable Knit Cardigan",
    yarnItemId: 'yarn-demo-02',
    yarnItemName: '2/32 Nm Wool Blend Yarn (Ivory Heather)',
    type: 'windingToKnitting',
    qty: 150.0,
    coneCount: 38,
    lotNo: 'LOT-Z22',
    machineNo: 'W-03',
    destination: 'knitting',
    destinationSection: 'knitting',
    date: '2026-09-29',
    receiverName: 'Sujon (Knitting Floor Incharge)',
    notes: 'Shift A winding done, handed over to knitting line 4',
    enteredBy: 'Winding Operator (Jalal)',
  },
  {
    id: 'demo-wind-04',
    styleId: 'style-demo-next-03',
    styleNo: 'NX-2026/HD-09',
    styleLabel: 'NX-2026/HD-09 — Jacquard Heavy Knit Hoodie',
    yarnItemId: 'yarn-demo-03',
    yarnItemName: '100% Cotton Melange 20/2 (Charcoal Grey)',
    type: 'issueToWinding',
    qty: 550.0,
    block: 'Block A',
    date: '2026-09-26',
    notes: 'Store issue for sampling & production batch 1',
    enteredBy: 'Store Manager (Kalam)',
    windingReceived: true,
    windingReceivedQty: 550.0,
    windingReceivedDate: '2026-09-26',
    windingReceivedBy: 'Winding Supervisor (Rezaul)',
    windingLotNo: 'LOT-NX-01',
    windingConeCount: 140,
  },
  {
    id: 'demo-wind-05',
    styleId: 'style-demo-next-03',
    styleNo: 'NX-2026/HD-09',
    styleLabel: 'NX-2026/HD-09 — Jacquard Heavy Knit Hoodie',
    yarnItemId: 'yarn-demo-03',
    yarnItemName: '100% Cotton Melange 20/2 (Charcoal Grey)',
    type: 'sectionTransfer',
    fromSection: 'winding',
    toSection: 'linking',
    destinationSection: 'linking',
    qty: 40.0,
    coneCount: 10,
    lotNo: 'LOT-NX-01',
    machineNo: 'W-01',
    date: '2026-09-28',
    receiverName: 'Monir (Linking Master)',
    notes: 'Direct linking yarn requirement issued from winding',
    enteredBy: 'Winding Supervisor (Rezaul)',
  },
];

function getLocalWindingEntries() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveLocalWindingEntries(items) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export default function WindingQueue() {
  const { user, profile } = useAuth();
  const { t } = useLang();

  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming' | 'processing' | 'history'
  const [entries, setEntries] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals state
  const [receiveModalIssue, setReceiveModalIssue] = useState(null);
  const [receiveForm, setReceiveForm] = useState({
    receivedQty: '',
    coneCount: '',
    lotNo: '',
    date: new Date().toISOString().slice(0, 10),
    receiverName: '',
    notes: '',
  });

  const [issueModalRow, setIssueModalRow] = useState(null);
  const [issueForm, setIssueForm] = useState({
    destination: 'knitting',
    qty: '',
    coneCount: '',
    lotNo: '',
    machineNo: '',
    date: new Date().toISOString().slice(0, 10),
    receiverName: '',
    notes: '',
  });

  const [isBusy, setIsBusy] = useState(false);

  const canEnter = canEnterSection(profile, WINDING_SECTION.key) || profile?.role === 'admin' || profile?.role === 'store';

  // Load entries from Firestore and synchronize with local cache
  useEffect(() => {
    let localData = getLocalWindingEntries();
    if (!localData) {
      localData = INITIAL_DEMO_ENTRIES;
      saveLocalWindingEntries(localData);
    }

    try {
      const q = query(collectionGroup(db, 'yarnLedger'));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, styleId: d.ref?.parent?.parent?.id, ...d.data() }))
            .filter(
              (e) =>
                e.type === 'issueToWinding' ||
                e.type === 'windingReceipt' ||
                e.type === 'windingToKnitting' ||
                (e.type === 'sectionTransfer' && (e.fromSection === 'winding' || e.destinationSection))
            );

          // If Firestore has docs, merge with local data so user tests are never lost
          if (list.length > 0) {
            // merge unique by id
            const existingIds = new Set(list.map((x) => x.id));
            const merged = [...list];
            (localData || []).forEach((item) => {
              if (!existingIds.has(item.id)) merged.push(item);
            });
            setEntries(merged);
            saveLocalWindingEntries(merged);
          } else {
            setEntries(localData);
          }
        },
        () => {
          // If Firestore is offline or fails, use local data seamlessly
          setEntries(localData);
        }
      );
      return unsub;
    } catch {
      setEntries(localData);
    }
  }, []);

  // Section options for issuing wound yarn
  const DESTINATION_SECTIONS = [
    { key: 'knitting', label: t('নিটিং সেকশন', 'Knitting Section') },
    { key: 'linking', label: t('লিংকিং সেকশন', 'Linking Section') },
    { key: 'trimming', label: t('ট্রিমিং সেকশন', 'Trimming Section') },
    { key: 'mending', label: t('মেন্ডিং সেকশন', 'Mending Section') },
    { key: 'sampleRoom', label: t('স্যাম্পল রুম', 'Sample Room') },
    { key: 'sewing', label: t('সুইং সেকশন', 'Sewing Section') },
    { key: 'other', label: t('অন্যান্য', 'Other') },
  ];

  // 1. All Store-to-Winding Issue batches (for Receiving Queue)
  const incomingStoreIssues = useMemo(() => {
    return (entries || [])
      .filter((e) => e.type === 'issueToWinding')
      .map((issue) => {
        // Calculate how much has been received for this specific issue
        const alreadyReceived = Number(issue.windingReceivedQty || (issue.windingReceived ? issue.qty : 0) || 0);
        const remainingToReceive = Math.max(0, Number(issue.qty || 0) - alreadyReceived);
        let status = 'pending';
        if (remainingToReceive <= 0.001) status = 'completed';
        else if (alreadyReceived > 0.001) status = 'partial';

        return {
          ...issue,
          receivedQty: alreadyReceived,
          remainingToReceive,
          receiveStatus: status,
        };
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [entries]);

  // 2. Aggregated Style & Yarn balances currently in Winding
  const windingStockRows = useMemo(() => {
    const map = new Map();

    (entries || []).forEach((e) => {
      const styleId = e.styleId || 'general';
      const yarnId = e.yarnItemId || e.yarnItemName || 'unknown';
      const key = `${styleId}__${yarnId}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          styleId,
          styleNo: e.styleNo || '',
          styleLabel: e.styleLabel || e.styleNo || 'Unknown Style',
          yarnItemId: e.yarnItemId,
          yarnItemName: e.yarnItemName || 'Unknown Yarn',
          totalStoreIssued: 0,
          totalReceivedInWinding: 0,
          totalIssuedKnitting: 0,
          totalIssuedOther: 0,
        });
      }

      const row = map.get(key);
      const q = Number(e.qty || 0);

      if (e.type === 'issueToWinding') {
        row.totalStoreIssued += q;
        // if marked received on issue
        const rcv = Number(e.windingReceivedQty || (e.windingReceived ? q : 0) || 0);
        row.totalReceivedInWinding += rcv;
      } else if (e.type === 'windingReceipt') {
        // standalone receipt entry
        row.totalReceivedInWinding += q;
      } else if (e.type === 'windingToKnitting' || (e.destination === 'knitting' && e.type !== 'issueToKnitting')) {
        row.totalIssuedKnitting += q;
      } else if (
        e.type === 'sectionTransfer' &&
        (e.fromSection === 'winding' || e.destinationSection)
      ) {
        row.totalIssuedOther += q;
      }
    });

    return Array.from(map.values()).map((r) => {
      const totalIssuedOut = r.totalIssuedKnitting + r.totalIssuedOther;
      const currentBalance = Math.max(0, r.totalReceivedInWinding - totalIssuedOut);
      const pendingReceive = Math.max(0, r.totalStoreIssued - r.totalReceivedInWinding);
      return {
        ...r,
        totalIssuedOut,
        currentBalance,
        pendingReceive,
      };
    });
  }, [entries]);

  // 3. Winding Logs / History
  const windingHistory = useMemo(() => {
    return (entries || [])
      .filter(
        (e) =>
          e.type === 'windingToKnitting' ||
          e.type === 'windingReceipt' ||
          (e.type === 'sectionTransfer' && (e.fromSection === 'winding' || e.destinationSection)) ||
          (e.type === 'issueToWinding' && (e.windingReceived || e.windingReceivedQty > 0))
      )
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [entries]);

  // Overall Factory Winding KPIs
  const stats = useMemo(() => {
    let storeIssued = 0;
    let windingReceived = 0;
    let issuedToSections = 0;

    windingStockRows.forEach((r) => {
      storeIssued += r.totalStoreIssued;
      windingReceived += r.totalReceivedInWinding;
      issuedToSections += r.totalIssuedOut;
    });

    const inHandWinding = Math.max(0, windingReceived - issuedToSections);

    return {
      storeIssued,
      windingReceived,
      inHandWinding,
      issuedToSections,
    };
  }, [windingStockRows]);

  // Open Receive Modal
  function handleOpenReceiveModal(issue) {
    setError('');
    setSuccessMsg('');
    setReceiveModalIssue(issue);
    setReceiveForm({
      receivedQty: issue.remainingToReceive > 0 ? issue.remainingToReceive.toFixed(2) : issue.qty.toString(),
      coneCount: '',
      lotNo: issue.lotNo || '',
      date: new Date().toISOString().slice(0, 10),
      receiverName: profile?.name || user?.displayName || '',
      notes: '',
    });
  }

  // Submit Receive Yarn Form
  async function handleSubmitReceive(e) {
    e.preventDefault();
    if (!receiveModalIssue) return;
    setError('');
    setSuccessMsg('');

    const n = Number(receiveForm.receivedQty);
    if (!n || n <= 0) {
      setError(t('সঠিক কোয়ান্টিটি দিন।', 'Enter a valid quantity.'));
      return;
    }
    if (n > receiveModalIssue.remainingToReceive + 0.001) {
      setError(
        t(
          `বাকি থাকা ${receiveModalIssue.remainingToReceive.toFixed(2)} lb-এর বেশি রিসিভ করা যাবে না।`,
          `Cannot receive more than the remaining ${receiveModalIssue.remainingToReceive.toFixed(2)} lb.`
        )
      );
      return;
    }

    setIsBusy(true);
    const issue = receiveModalIssue;
    const newAlreadyReceived = (Number(issue.receivedQty) || 0) + n;
    const isNowFullyReceived = newAlreadyReceived >= Number(issue.qty) - 0.001;

    try {
      // 1. Try updating Firestore issue doc if styleId & id exist
      if (issue.styleId && issue.id && !issue.id.startsWith('demo-')) {
        try {
          await updateDoc(doc(db, 'styles', issue.styleId, 'yarnLedger', issue.id), {
            windingReceived: isNowFullyReceived,
            windingReceivedQty: newAlreadyReceived,
            windingReceivedDate: receiveForm.date,
            windingReceivedBy: receiveForm.receiverName || profile?.name || 'Winding',
            windingLotNo: receiveForm.lotNo || '',
            windingConeCount: Number(receiveForm.coneCount) || 0,
            windingNotes: receiveForm.notes || '',
          });
        } catch (err) {
          console.warn('Firestore updateDoc warning:', err);
        }
      }

      // 2. Update local state and cache
      const updatedList = (entries || []).map((item) => {
        if (item.id === issue.id) {
          return {
            ...item,
            windingReceived: isNowFullyReceived,
            windingReceivedQty: newAlreadyReceived,
            windingReceivedDate: receiveForm.date,
            windingReceivedBy: receiveForm.receiverName || profile?.name || 'Winding',
            windingLotNo: receiveForm.lotNo || '',
            windingConeCount: Number(receiveForm.coneCount) || 0,
            windingNotes: receiveForm.notes || '',
          };
        }
        return item;
      });

      setEntries(updatedList);
      saveLocalWindingEntries(updatedList);

      setSuccessMsg(
        t(
          `সফলভাবে ${n.toFixed(2)} lb ইয়ার্ন ওয়াইন্ডিং সেকশনে রিসিভ করা হয়েছে!`,
          `Successfully received ${n.toFixed(2)} lb yarn in Winding Section!`
        )
      );
      setReceiveModalIssue(null);
    } catch (err) {
      setError(t('রিসিভ সংরক্ষণ করা যায়নি।', 'Could not save receipt.'));
    } finally {
      setIsBusy(false);
    }
  }

  // Open Issue to Section Modal
  function handleOpenIssueModal(row) {
    setError('');
    setSuccessMsg('');
    setIssueModalRow(row);
    setIssueForm({
      destination: 'knitting',
      qty: row.currentBalance > 0 ? Math.min(row.currentBalance, 50).toFixed(2) : '',
      coneCount: '',
      lotNo: '',
      machineNo: '',
      date: new Date().toISOString().slice(0, 10),
      receiverName: '',
      notes: '',
    });
  }

  // Submit Issue Wound Yarn to Section
  async function handleSubmitIssue(e) {
    e.preventDefault();
    if (!issueModalRow) return;
    setError('');
    setSuccessMsg('');

    const n = Number(issueForm.qty);
    if (!n || n <= 0) {
      setError(t('সঠিক কোয়ান্টিটি দিন।', 'Enter a valid quantity.'));
      return;
    }
    if (n > issueModalRow.currentBalance + 0.001) {
      setError(
        t(
          `ওয়াইন্ডিং-এ মজুদের চেয়ে বেশি ইস্যু করা যাবে না (সর্বোচ্চ ${issueModalRow.currentBalance.toFixed(2)} lb)।`,
          `Cannot issue more than available winding stock (Max: ${issueModalRow.currentBalance.toFixed(2)} lb).`
        )
      );
      return;
    }

    setIsBusy(true);
    const row = issueModalRow;
    const dest = issueForm.destination;

    const newRecord = {
      id: `wind-issue-${Date.now()}`,
      styleId: row.styleId,
      styleNo: row.styleNo,
      styleLabel: row.styleLabel,
      yarnItemId: row.yarnItemId,
      yarnItemName: row.yarnItemName,
      type: dest === 'knitting' ? 'windingToKnitting' : 'sectionTransfer',
      destination: dest,
      destinationSection: dest,
      fromSection: 'winding',
      toSection: dest,
      qty: n,
      coneCount: Number(issueForm.coneCount) || 0,
      lotNo: issueForm.lotNo || '',
      machineNo: issueForm.machineNo || '',
      date: issueForm.date,
      receiverName: issueForm.receiverName || '',
      notes: issueForm.notes || '',
      enteredBy: profile?.name || user?.displayName || 'Winding Section',
      createdAt: new Date().toISOString(),
    };

    try {
      // 1. Try saving to Firestore if available
      if (row.styleId && !row.styleId.startsWith('style-demo-')) {
        try {
          await addDoc(collection(db, 'styles', row.styleId, 'yarnLedger'), {
            type: newRecord.type,
            destination: dest,
            destinationSection: dest,
            fromSection: 'winding',
            toSection: dest,
            yarnItemId: row.yarnItemId,
            yarnItemName: row.yarnItemName,
            styleNo: row.styleNo,
            styleLabel: row.styleLabel,
            qty: n,
            coneCount: newRecord.coneCount,
            lotNo: newRecord.lotNo,
            machineNo: newRecord.machineNo,
            date: issueForm.date,
            receiverName: newRecord.receiverName,
            notes: newRecord.notes,
            enteredBy: newRecord.enteredBy,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          console.warn('Firestore addDoc warning:', err);
        }
      }

      // 2. Save in local state and cache
      const updatedList = [newRecord, ...(entries || [])];
      setEntries(updatedList);
      saveLocalWindingEntries(updatedList);

      const destLabel = DESTINATION_SECTIONS.find((d) => d.key === dest)?.label || dest;
      setSuccessMsg(
        t(
          `সফলভাবে ${n.toFixed(2)} lb ইয়ার্ন ${destLabel}-এ হস্তান্তর/ইস্যু করা হয়েছে!`,
          `Successfully issued ${n.toFixed(2)} lb yarn to ${destLabel}!`
        )
      );
      setIssueModalRow(null);
    } catch (err) {
      setError(t('ইস্যু সংরক্ষণ করা যায়নি।', 'Could not save issue.'));
    } finally {
      setIsBusy(false);
    }
  }

  // Filter incoming issues
  const filteredIncoming = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return incomingStoreIssues;
    return incomingStoreIssues.filter(
      (item) =>
        (item.styleLabel || '').toLowerCase().includes(q) ||
        (item.yarnItemName || '').toLowerCase().includes(q) ||
        (item.block || '').toLowerCase().includes(q)
    );
  }, [incomingStoreIssues, searchQuery]);

  // Filter winding stock
  const filteredStock = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return windingStockRows;
    return windingStockRows.filter(
      (item) =>
        (item.styleLabel || '').toLowerCase().includes(q) ||
        (item.yarnItemName || '').toLowerCase().includes(q)
    );
  }, [windingStockRows, searchQuery]);

  // Export Columns for Tabs
  const exportStockColumns = [
    { key: 'styleLabel', label: t('স্টাইল', 'Style') },
    { key: 'yarnItemName', label: t('ইয়ার্ন', 'Yarn') },
    { key: 'totalStoreIssued', label: t('স্টোর থেকে ইস্যু (lb)', 'Store Issued (lb)') },
    { key: 'totalReceivedInWinding', label: t('ওয়াইন্ডিং রিসিভ (lb)', 'Winding Received (lb)') },
    { key: 'totalIssuedKnitting', label: t('নিটিং-এ ডেলিভারি (lb)', 'To Knitting (lb)') },
    { key: 'totalIssuedOther', label: t('অন্যান্য সেকশনে ডেলিভারি (lb)', 'To Other Sections (lb)') },
    { key: 'currentBalance', label: t('ওয়াইন্ডিং মজুদ (lb)', 'Winding Stock (lb)') },
  ];

  const exportHistoryColumns = [
    { key: 'date', label: t('তারিখ', 'Date') },
    {
      key: 'type',
      label: t('ধরন', 'Type'),
      render: (r) =>
        r.type === 'issueToWinding'
          ? t('রিসিভড (স্টোর থেকে)', 'Received (from Store)')
          : r.destination === 'knitting'
          ? t('নিটিং-এ ইস্যু', 'Issued to Knitting')
          : t(`${r.destinationSection || 'সেকশন'} ইস্যু`, `Issued to ${r.destinationSection || 'Section'}`),
    },
    { key: 'styleLabel', label: t('স্টাইল', 'Style') },
    { key: 'yarnItemName', label: t('ইয়ার্ন', 'Yarn') },
    { key: 'qty', label: t('কোয়ান্টিটি (lb)', 'Quantity (lb)') },
    { key: 'coneCount', label: t('কোণ', 'Cones') },
    { key: 'lotNo', label: t('লট', 'Lot') },
    { key: 'machineNo', label: t('মেশিন নং', 'Machine No.') },
    { key: 'receiverName', label: t('গ্রহীতা / হস্তান্তর', 'Receiver / Handover') },
    { key: 'notes', label: t('নোট', 'Notes') },
    { key: 'enteredBy', label: t('এন্ট্রি করেছেন', 'Entered By') },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {t('ওয়াইন্ডিং কিউ ও সেকশন ডেলিভারি', 'Winding Queue & Section Delivery')}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {t(
              'ইয়ার্ন স্টোর থেকে ওয়াইন্ডিং-এ রিসিভ করুন এবং ওয়াইন্ডিং শেষে নিটিং বা অন্যান্য সেকশনে ইস্যু/ডেলিভারি ট্র্যাক করুন।',
              'Receive yarn from Yarn Store into Winding, and issue wound yarn to Knitting or other sections.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/inventory/yarn-tracking"
            className={`${btnSecondary} text-xs`}
          >
            <Truck size={14} />
            {t('ইয়ার্ন স্টোর ট্র্যাকিং →', 'Yarn Store Tracking →')}
          </Link>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t('স্টোর থেকে প্রেরিত', 'Store Issued')}
          value={`${stats.storeIssued.toFixed(1)} lb`}
          sub={t('ওয়াইন্ডিং-এর জন্য বরাদ্দ', 'Allotted for winding')}
        />
        <StatCard
          label={t('ওয়াইন্ডিং-এ গৃহীত', 'Winding Received')}
          value={`${stats.windingReceived.toFixed(1)} lb`}
          tone="green"
          sub={t('রিসিভড ও প্রক্রিয়াজাত', 'Acknowledged & ready')}
        />
        <StatCard
          label={t('ওয়াইন্ডিং-এ বর্তমান মজুদ', 'In Winding Stock')}
          value={`${stats.inHandWinding.toFixed(1)} lb`}
          tone="amber"
          sub={t('ওয়াইন্ডিং চলছে / প্রস্তুত', 'Winding in process / ready')}
        />
        <StatCard
          label={t('সেকশনে ইস্যু সম্পন্ন', 'Issued to Sections')}
          value={`${stats.issuedToSections.toFixed(1)} lb`}
          tone="ink"
          sub={t('নিটিং ও অন্যান্য সেকশনে', 'Knitting & other lines')}
        />
      </div>

      {/* Alert Banners */}
      {error && (
        <div className="rounded-lg border border-red/30 bg-red-soft p-3 text-sm text-red">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-green/30 bg-green-soft p-3 text-sm font-medium text-green">
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}

      {/* Tab Navigation & Search */}
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('incoming')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === 'incoming'
                ? 'bg-indigo text-white shadow'
                : 'border border-line bg-paper text-ink hover:bg-line/40'
            }`}
          >
            <ArrowDownLeft size={14} />
            {t('১. ইনকামিং ইয়ার্ন রিসিভ', '1. Incoming Yarn Receive')}
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === 'incoming' ? 'bg-white text-indigo' : 'bg-line text-ink-soft'
              }`}
            >
              {incomingStoreIssues.filter((x) => x.receiveStatus !== 'completed').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('processing')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === 'processing'
                ? 'bg-indigo text-white shadow'
                : 'border border-line bg-paper text-ink hover:bg-line/40'
            }`}
          >
            <Layers size={14} />
            {t('২. ওয়াইন্ডিং ও সেকশনে ইস্যু', '2. Winding & Section Issue')}
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === 'processing' ? 'bg-white text-indigo' : 'bg-line text-ink-soft'
              }`}
            >
              {windingStockRows.filter((x) => x.currentBalance > 0.01).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-indigo text-white shadow'
                : 'border border-line bg-paper text-ink hover:bg-line/40'
            }`}
          >
            <History size={14} />
            {t('৩. অ্যাক্টিভিটি হিস্ট্রি ও লগ', '3. Activity History')}
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            type="text"
            className={`${inputClass} !pl-8 !py-1.5 text-xs`}
            placeholder={t('স্টাইল বা ইয়ার্ন সার্চ করুন…', 'Search style or yarn…')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* TAB 1: INCOMING YARN RECEIVE */}
      {activeTab === 'incoming' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-surface p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">
                  {t('স্টোর থেকে প্রেরিত ইয়ার্ন রিসিভ কিউ', 'Yarn Store Issue & Receive Queue')}
                </h2>
                <p className="text-xs text-ink-soft">
                  {t(
                    'ইয়ার্ন স্টোর যখন ওয়াইন্ডিং-এ ইয়ার্ন ইস্যু করে, তা এখানে জমা হয়। ওয়াইন্ডিং কর্মী "রিসিভ করুন" বোতাম চেপে রিসিভ নিশ্চিত করবেন।',
                    'When the store issues yarn to Winding, it appears here. Winding staff click "Receive" to confirm acceptance.'
                  )}
                </p>
              </div>

              <ExportBar
                small
                title={t('ওয়াইন্ডিং ইনকামিং রিসিভ কিউ', 'Winding Incoming Receive Queue')}
                filename="winding-incoming-queue"
                columns={[
                  { key: 'date', label: t('তারিখ', 'Date') },
                  { key: 'styleLabel', label: t('স্টাইল', 'Style') },
                  { key: 'yarnItemName', label: t('ইয়ার্ন', 'Yarn') },
                  { key: 'block', label: t('ব্লক', 'Block') },
                  { key: 'qty', label: t('ইস্যুকৃত (lb)', 'Issued (lb)') },
                  { key: 'receivedQty', label: t('রিসিভড (lb)', 'Received (lb)') },
                  { key: 'remainingToReceive', label: t('বাকি (lb)', 'Remaining (lb)') },
                ]}
                rows={filteredIncoming}
              />
            </div>

            {entries === null ? (
              <p className="py-6 text-center text-sm text-ink-soft">{t('লোড হচ্ছে…', 'Loading…')}</p>
            ) : filteredIncoming.length === 0 ? (
              <EmptyState
                title={t('ইনকামিং কোনো পেন্ডিং ইয়ার্ন নেই', 'No incoming yarn pending')}
                description={t('সব ইস্যু রিসিভ করা হয়ে গেছে।', 'All issued yarn has been received.')}
              />
            ) : (
              <div className="scroll-thin overflow-x-auto">
                <table className="w-full min-w-[750px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium text-ink-soft">
                      <th className="py-2.5 pr-3">{t('তারিখ', 'Date')}</th>
                      <th className="py-2.5 pr-3">{t('স্টাইল', 'Style')}</th>
                      <th className="py-2.5 pr-3">{t('ইয়ার্ন ও ব্লক', 'Yarn & Block')}</th>
                      <th className="py-2.5 pr-3 text-right">{t('স্টোর ইস্যু', 'Store Issued')}</th>
                      <th className="py-2.5 pr-3 text-right">{t('ওয়াইন্ডিং রিসিভ', 'Received')}</th>
                      <th className="py-2.5 pr-3 text-right">{t('বাকি রিসিভ', 'Remaining')}</th>
                      <th className="py-2.5 pr-3 text-center">{t('স্ট্যাটাস', 'Status')}</th>
                      {canEnter && <th className="py-2.5 pr-2 text-right">{t('অ্যাকশন', 'Action')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIncoming.map((item) => (
                      <tr key={item.id} className="border-b border-line last:border-0 hover:bg-paper/50">
                        <td className="py-3 pr-3 text-xs text-ink-soft">{item.date}</td>
                        <td className="py-3 pr-3">
                          <p className="font-medium text-ink">{item.styleLabel || item.styleNo}</p>
                          {item.enteredBy && (
                            <p className="text-[11px] text-ink-soft">
                              {t('ইস্যুকারী', 'Issued by')}: {item.enteredBy}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <p className="text-ink">{item.yarnItemName}</p>
                          {item.block && (
                            <span className="inline-block rounded bg-line px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
                              {item.block}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-right font-medium text-ink">
                          {Number(item.qty).toFixed(2)} lb
                        </td>
                        <td className="py-3 pr-3 text-right text-ink">
                          {item.receivedQty > 0 ? (
                            <span className="text-green font-medium">
                              {item.receivedQty.toFixed(2)} lb
                              {item.windingConeCount > 0 && ` (${item.windingConeCount} cones)`}
                            </span>
                          ) : (
                            <span className="text-ink-soft">0.00 lb</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-right text-ink">
                          {item.remainingToReceive > 0.001 ? (
                            <span className="text-amber font-semibold">{item.remainingToReceive.toFixed(2)} lb</span>
                          ) : (
                            <span className="text-ink-soft">0.00 lb</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-center">
                          {item.receiveStatus === 'completed' ? (
                            <Pill tone="green">{t('সম্পূর্ণ রিসিভড', 'Fully Received')}</Pill>
                          ) : item.receiveStatus === 'partial' ? (
                            <Pill tone="amber">{t('আংশিক রিসিভ', 'Partially Received')}</Pill>
                          ) : (
                            <Pill tone="red">{t('পেন্ডিং রিসিভ', 'Pending Receive')}</Pill>
                          )}
                        </td>
                        {canEnter && (
                          <td className="py-3 pr-2 text-right">
                            {item.remainingToReceive > 0.001 ? (
                              <button
                                type="button"
                                onClick={() => handleOpenReceiveModal(item)}
                                className="inline-flex items-center gap-1 rounded bg-indigo px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-deep"
                              >
                                <PackageCheck size={13} />
                                {t('রিসিভ করুন', 'Receive')}
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-green font-medium">
                                <CheckCircle2 size={14} />
                                {t('সম্পন্ন', 'Done')}
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: WINDING PROCESSING & ISSUE TO SECTIONS */}
      {activeTab === 'processing' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-surface p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">
                  {t('ওয়াইন্ডিং মজুদ ও সেকশনে হস্তান্তর/ইস্যু', 'Winding Stock & Issue to Sections')}
                </h2>
                <p className="text-xs text-ink-soft">
                  {t(
                    'ওয়াইন্ডিং-এ গৃহীত ইয়ার্ন ওয়াইন্ডিং সম্পন্ন হওয়ার পর নিটিং সেকশন বা লিংকিং/স্যাম্পল সেকশনে ডেলিভারি দিন।',
                    'Deliver completed wound yarn to Knitting or other production sections (Linking, Sample, etc.).'
                  )}
                </p>
              </div>

              <ExportBar
                small
                title={t('ওয়াইন্ডিং মজুদ ও সেকশন ডেলিভারি', 'Winding Stock & Section Deliveries')}
                filename="winding-stock-status"
                columns={exportStockColumns}
                rows={filteredStock}
              />
            </div>

            {filteredStock.length === 0 ? (
              <EmptyState
                title={t('কোনো ওয়াইন্ডিং স্টক নেই', 'No winding stock found')}
                description={t('আগে স্টোর থেকে আসা ইয়ার্ন রিসিভ করুন।', 'Please receive incoming store yarn first.')}
              />
            ) : (
              <div className="scroll-thin overflow-x-auto">
                <table className="w-full min-w-[780px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium text-ink-soft">
                      <th className="py-2.5 pr-3">{t('স্টাইল', 'Style')}</th>
                      <th className="py-2.5 pr-3">{t('ইয়ার্ন', 'Yarn')}</th>
                      <th className="py-2.5 pr-3 text-right">{t('রিসিভড (ওয়াইন্ডিং)', 'Received')}</th>
                      <th className="py-2.5 pr-3 text-right">{t('নিটিং-এ ডেলিভারি', 'To Knitting')}</th>
                      <th className="py-2.5 pr-3 text-right">{t('অন্য সেকশনে', 'Other Sections')}</th>
                      <th className="py-2.5 pr-3 text-right">{t('ওয়াইন্ডিং-এ বর্তমান মজুদ', 'In Winding Balance')}</th>
                      {canEnter && <th className="py-2.5 pr-2 text-right">{t('অ্যাকশন', 'Action')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStock.map((row) => (
                      <tr key={row.key} className="border-b border-line last:border-0 hover:bg-paper/50">
                        <td className="py-3 pr-3">
                          <p className="font-medium text-ink">{row.styleLabel}</p>
                          {row.pendingReceive > 0.001 && (
                            <p className="text-[11px] text-amber">
                              {t('স্টোর থেকে পেন্ডিং রিসিভ', 'Pending receive from store')}: {row.pendingReceive.toFixed(1)} lb
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-ink-soft">{row.yarnItemName}</td>
                        <td className="py-3 pr-3 text-right text-ink font-medium">
                          {row.totalReceivedInWinding.toFixed(2)} lb
                        </td>
                        <td className="py-3 pr-3 text-right text-ink">
                          {row.totalIssuedKnitting > 0 ? (
                            <span className="text-green font-medium">{row.totalIssuedKnitting.toFixed(2)} lb</span>
                          ) : (
                            '0.00 lb'
                          )}
                        </td>
                        <td className="py-3 pr-3 text-right text-ink">
                          {row.totalIssuedOther > 0 ? (
                            <span className="text-indigo font-medium">{row.totalIssuedOther.toFixed(2)} lb</span>
                          ) : (
                            '0.00 lb'
                          )}
                        </td>
                        <td className="py-3 pr-3 text-right">
                          <span
                            className={`font-display text-base font-semibold ${
                              row.currentBalance > 0.001 ? 'text-amber' : 'text-ink-soft'
                            }`}
                          >
                            {row.currentBalance.toFixed(2)} lb
                          </span>
                        </td>
                        {canEnter && (
                          <td className="py-3 pr-2 text-right">
                            {row.currentBalance > 0.001 ? (
                              <button
                                type="button"
                                onClick={() => handleOpenIssueModal(row)}
                                className="inline-flex items-center gap-1.5 rounded-md bg-green px-3 py-1.5 text-xs font-semibold text-white shadow hover:opacity-90"
                              >
                                <Send size={13} />
                                {t('সেকশনে ইস্যু করুন', 'Issue to Section')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="rounded-md border border-line bg-paper px-3 py-1.5 text-xs text-ink-soft opacity-60"
                              >
                                {t('মজুদ নেই', 'No stock')}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVITY HISTORY & LOGS */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-surface p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">
                  {t('ওয়াইন্ডিং লেনদেন ও অ্যাক্টিভিটি হিস্ট্রি', 'Winding Activity History & Ledger')}
                </h2>
                <p className="text-xs text-ink-soft">
                  {t(
                    'স্টোর থেকে রিসিভ এবং নিটিং/অন্যান্য সেকশনে হস্তান্তরকৃত সকল ওয়াইন্ডিং এন্ট্রি।',
                    'All completed winding receipts and deliveries to production sections.'
                  )}
                </p>
              </div>

              <ExportBar
                small
                title={t('ওয়াইন্ডিং লেনদেন হিস্ট্রি', 'Winding Activity History')}
                filename="winding-activity-history"
                columns={exportHistoryColumns}
                rows={windingHistory}
              />
            </div>

            {windingHistory.length === 0 ? (
              <EmptyState
                title={t('কোনো ওয়াইন্ডিং হিস্ট্রি পাওয়া যায়নি', 'No winding history yet')}
                description={t('রিসিভ বা ইস্যু করার সাথে সাথে হিস্ট্রি এখানে লিপিবদ্ধ হবে।', 'Transactions will be logged here as you receive or issue.')}
              />
            ) : (
              <div className="scroll-thin overflow-x-auto">
                <table className="w-full min-w-[850px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium text-ink-soft">
                      <th className="py-2.5 pr-3">{t('তারিখ', 'Date')}</th>
                      <th className="py-2.5 pr-3">{t('ধরন', 'Type')}</th>
                      <th className="py-2.5 pr-3">{t('স্টাইল', 'Style')}</th>
                      <th className="py-2.5 pr-3">{t('ইয়ার্ন', 'Yarn')}</th>
                      <th className="py-2.5 pr-3 text-right">{t('কোয়ান্টিটি', 'Quantity')}</th>
                      <th className="py-2.5 pr-3">{t('লট ও মেশিন', 'Lot & Machine')}</th>
                      <th className="py-2.5 pr-3">{t('গ্রহীতা / হস্তান্তর', 'Receiver / Handover')}</th>
                      <th className="py-2.5 pr-3">{t('নোট', 'Note')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {windingHistory.map((item) => {
                      const isReceive =
                        item.type === 'issueToWinding' || item.type === 'windingReceipt';
                      const isKnitting =
                        item.type === 'windingToKnitting' || item.destination === 'knitting';

                      return (
                        <tr key={item.id} className="border-b border-line last:border-0 hover:bg-paper/50">
                          <td className="py-3 pr-3 text-xs text-ink-soft">{item.date}</td>
                          <td className="py-3 pr-3">
                            {isReceive ? (
                              <Pill tone="green">
                                <ArrowDownLeft size={12} className="mr-1 inline" />
                                {t('ওয়াইন্ডিং রিসিভ', 'Winding Received')}
                              </Pill>
                            ) : isKnitting ? (
                              <Pill tone="indigo">
                                <Send size={12} className="mr-1 inline" />
                                {t('নিটিং-এ ইস্যু', 'To Knitting')}
                              </Pill>
                            ) : (
                              <Pill tone="amber">
                                <Send size={12} className="mr-1 inline" />
                                {t(`${item.destinationSection || 'সেকশন'} ইস্যু`, `To ${item.destinationSection || 'Section'}`)}
                              </Pill>
                            )}
                          </td>
                          <td className="py-3 pr-3 font-medium text-ink">{item.styleLabel || item.styleNo}</td>
                          <td className="py-3 pr-3 text-ink-soft">{item.yarnItemName}</td>
                          <td className="py-3 pr-3 text-right font-medium text-ink">
                            {Number(item.qty || item.windingReceivedQty || 0).toFixed(2)} lb
                            {item.coneCount > 0 && (
                              <span className="block text-[11px] text-ink-soft">
                                {item.coneCount} {t('কোণ', 'cones')}
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-xs text-ink">
                            {item.lotNo || item.windingLotNo ? (
                              <span className="font-mono text-ink">
                                Lot: {item.lotNo || item.windingLotNo}
                              </span>
                            ) : (
                              '—'
                            )}
                            {item.machineNo && (
                              <span className="block text-[11px] text-ink-soft">
                                M/C: {item.machineNo}
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-xs text-ink">
                            {item.receiverName || item.windingReceivedBy || item.enteredBy || '—'}
                          </td>
                          <td className="py-3 pr-3 text-xs text-ink-soft max-w-[200px] truncate">
                            {item.notes || item.windingNotes || '—'}
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

      {/* MODAL 1: RECEIVE YARN FROM STORE */}
      {receiveModalIssue && (
        <Modal
          title={t('ইয়ার্ন স্টোর থেকে ওয়াইন্ডিং-এ রিসিভ করুন', 'Receive Yarn in Winding Section')}
          onClose={() => setReceiveModalIssue(null)}
        >
          <form onSubmit={handleSubmitReceive} className="space-y-4">
            <div className="rounded-md border border-line bg-paper p-3 text-xs space-y-1">
              <p className="font-semibold text-ink">{receiveModalIssue.styleLabel || receiveModalIssue.styleNo}</p>
              <p className="text-ink-soft">{receiveModalIssue.yarnItemName}</p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-ink-soft">
                <span>{t('ব্লক', 'Block')}: <strong className="text-ink">{receiveModalIssue.block || '—'}</strong></span>
                <span>•</span>
                <span>{t('স্টোর ইস্যু', 'Store Issued')}: <strong className="text-ink">{Number(receiveModalIssue.qty).toFixed(2)} lb</strong></span>
                <span>•</span>
                <span>{t('বাকি রিসিভ', 'Remaining')}: <strong className="text-amber">{receiveModalIssue.remainingToReceive.toFixed(2)} lb</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('রিসিভড কোয়ান্টিটি (lb) *', 'Received Quantity (lb) *')}>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={receiveModalIssue.remainingToReceive + 0.001}
                  required
                  className={inputClass}
                  value={receiveForm.receivedQty}
                  onChange={(e) => setReceiveForm((f) => ({ ...f, receivedQty: e.target.value }))}
                />
              </Field>

              <Field label={t('কোণ / প্যাকেজ সংখ্যা', 'No. of Cones / Bags')}>
                <input
                  type="number"
                  min="0"
                  placeholder="যেমন: ৫০"
                  className={inputClass}
                  value={receiveForm.coneCount}
                  onChange={(e) => setReceiveForm((f) => ({ ...f, coneCount: e.target.value }))}
                />
              </Field>

              <Field label={t('লট নং (Lot No.)', 'Lot No.')}>
                <input
                  type="text"
                  placeholder="যেমন: LOT-45A"
                  className={inputClass}
                  value={receiveForm.lotNo}
                  onChange={(e) => setReceiveForm((f) => ({ ...f, lotNo: e.target.value }))}
                />
              </Field>

              <Field label={t('রিসিভ তারিখ *', 'Receive Date *')}>
                <input
                  type="date"
                  required
                  className={inputClass}
                  value={receiveForm.date}
                  onChange={(e) => setReceiveForm((f) => ({ ...f, date: e.target.value }))}
                />
              </Field>
            </div>

            <Field label={t('ওয়াইন্ডিং রিসিভার / অপারেটরের নাম', 'Received By / Operator Name')}>
              <input
                type="text"
                placeholder={t('কে রিসিভ করছেন', 'Operator Name')}
                className={inputClass}
                value={receiveForm.receiverName}
                onChange={(e) => setReceiveForm((f) => ({ ...f, receiverName: e.target.value }))}
              />
            </Field>

            <Field label={t('মন্তব্য / নোট', 'Remarks / Notes')}>
              <textarea
                rows={2}
                placeholder={t('ইয়ার্নের অবস্থা বা নোট লিখুন (ঐচ্ছিক)', 'Yarn condition or notes (optional)')}
                className={inputClass}
                value={receiveForm.notes}
                onChange={(e) => setReceiveForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </Field>

            {error && <p className="text-xs text-red">{error}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setReceiveModalIssue(null)}
                className={btnSecondary}
              >
                {t('বাতিল', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={isBusy}
                className={`${btnPrimary} !bg-indigo`}
              >
                <PackageCheck size={15} />
                {isBusy ? t('রিসিভ হচ্ছে…', 'Receiving…') : t('রিসিভ সম্পন্ন করুন', 'Confirm Receipt')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: ISSUE WOUND YARN TO SECTION */}
      {issueModalRow && (
        <Modal
          title={t('ওয়াইন্ডিং শেষে সেকশনে হস্তান্তর/ইস্যু', 'Issue Wound Yarn to Production Section')}
          onClose={() => setIssueModalRow(null)}
        >
          <form onSubmit={handleSubmitIssue} className="space-y-4">
            <div className="rounded-md border border-line bg-paper p-3 text-xs space-y-1">
              <p className="font-semibold text-ink">{issueModalRow.styleLabel}</p>
              <p className="text-ink-soft">{issueModalRow.yarnItemName}</p>
              <div className="pt-1 flex items-center gap-2">
                <span className="text-ink-soft">{t('ওয়াইন্ডিং-এ মজুদ আছে', 'Available in Winding')}:</span>
                <span className="font-semibold text-amber text-sm">{issueModalRow.currentBalance.toFixed(2)} lb</span>
              </div>
            </div>

            <Field label={t('কোথায় ইস্যু হবে (গন্তব্য সেকশন) *', 'Destination Section *')}>
              <select
                required
                className={inputClass}
                value={issueForm.destination}
                onChange={(e) => setIssueForm((f) => ({ ...f, destination: e.target.value }))}
              >
                {DESTINATION_SECTIONS.map((sec) => (
                  <option key={sec.key} value={sec.key}>
                    {sec.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('ইস্যু কোয়ান্টিটি (lb) *', 'Issue Quantity (lb) *')}>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={issueModalRow.currentBalance + 0.001}
                  required
                  className={inputClass}
                  value={issueForm.qty}
                  onChange={(e) => setIssueForm((f) => ({ ...f, qty: e.target.value }))}
                />
              </Field>

              <Field label={t('ওয়াইন্ডিং করা কোণ সংখ্যা', 'Wound Cone Count')}>
                <input
                  type="number"
                  min="0"
                  placeholder="যেমন: ৪০ কোণ"
                  className={inputClass}
                  value={issueForm.coneCount}
                  onChange={(e) => setIssueForm((f) => ({ ...f, coneCount: e.target.value }))}
                />
              </Field>

              <Field label={t('লট নং (Lot No.)', 'Lot No.')}>
                <input
                  type="text"
                  placeholder="যেমন: L-102"
                  className={inputClass}
                  value={issueForm.lotNo}
                  onChange={(e) => setIssueForm((f) => ({ ...f, lotNo: e.target.value }))}
                />
              </Field>

              <Field label={t('ওয়াইন্ডিং মেশিন নং', 'Winder Machine No.')}>
                <input
                  type="text"
                  placeholder="যেমন: W-02"
                  className={inputClass}
                  value={issueForm.machineNo}
                  onChange={(e) => setIssueForm((f) => ({ ...f, machineNo: e.target.value }))}
                />
              </Field>

              <Field label={t('হস্তান্তর তারিখ *', 'Issue Date *')}>
                <input
                  type="date"
                  required
                  className={inputClass}
                  value={issueForm.date}
                  onChange={(e) => setIssueForm((f) => ({ ...f, date: e.target.value }))}
                />
              </Field>

              <Field label={t('কার কাছে হস্তান্তর / গ্রহীতা', 'Handed Over To / Receiver')}>
                <input
                  type="text"
                  placeholder="যেমন: মো: রফিক (নিটিং মাস্টার)"
                  className={inputClass}
                  value={issueForm.receiverName}
                  onChange={(e) => setIssueForm((f) => ({ ...f, receiverName: e.target.value }))}
                />
              </Field>
            </div>

            <Field label={t('চালান নং বা মন্তব্য', 'Chalan No. or Remarks')}>
              <textarea
                rows={2}
                placeholder={t('কোনো বিশেষ নির্দেশনা বা নোট (ঐচ্ছিক)', 'Special instruction or notes (optional)')}
                className={inputClass}
                value={issueForm.notes}
                onChange={(e) => setIssueForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </Field>

            {error && <p className="text-xs text-red">{error}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setIssueModalRow(null)}
                className={btnSecondary}
              >
                {t('বাতিল', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={isBusy}
                className={`${btnPrimary} !bg-green`}
              >
                <Send size={15} />
                {isBusy ? t('ইস্যু হচ্ছে…', 'Issuing…') : t('সেকশনে ইস্যু সম্পন্ন করুন', 'Confirm Delivery')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
