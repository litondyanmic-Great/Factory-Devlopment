import { useEffect, useMemo, useState } from 'react';
import { collectionGroup, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { ClipboardCheck, ShieldAlert, Check, X, PackageSearch } from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Field, inputClass, btnPrimary, btnSecondary, EmptyState, Modal, InspectionBadge } from '../../components/ui';
import ExportBar from '../../components/ExportBar';
import { can, canDecideInspectionHold } from '../../lib/constants';
import { useLang } from '../../lib/i18n';
import {
  getLocalStyles,
  getLocalYarnLedger,
  saveLocalYarnLedger,
  getLocalAccLedger,
  saveLocalAccLedger,
} from '../../lib/demoData';

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Both yarn and accessory receipts get the exact same 10%-sample QC gate,
// they just live in different subcollections with slightly different field
// names — this small map is the only thing that differs between the two
// tabs, everything else below reads through it instead of branching.
const KINDS = {
  yarn: {
    collectionName: 'yarnLedger',
    idField: 'yarnItemId',
    nameField: 'yarnItemName',
    unit: 'lb',
    label: { bn: 'ইয়ার্ন', en: 'Yarn' },
  },
  accessory: {
    collectionName: 'accessoryLedger',
    idField: 'itemId',
    nameField: 'itemName',
    unit: '',
    label: { bn: 'এক্সেসরিজ', en: 'Accessories' },
  },
};

export default function ReceivingInspection() {
  const { user, profile } = useAuth();
  const { t } = useLang();
  const [kind, setKind] = useState('yarn');
  const [pending, setPending] = useState(null);
  const [onHold, setOnHold] = useState(null);
  const [allReceipts, setAllReceipts] = useState(null);
  const [inspecting, setInspecting] = useState(null);
  const [buyerFilter, setBuyerFilter] = useState('all');
  const [busyId, setBusyId] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  const canInspect = can(profile?.role, 'quality:entry');
  const canDecide = canDecideInspectionHold(profile);
  const cfg = KINDS[kind];

  useEffect(() => {
    const col = collectionGroup(db, cfg.collectionName);
    const unsubPending = onSnapshot(query(col, where('inspectionStatus', '==', 'pending')), (snap) =>
      setPending(snap.docs.map((d) => ({ ...d.data(), id: d.id, styleId: d.data().styleId || d.ref.parent?.parent?.id, docPath: d.ref.path })))
    );
    const unsubHold = onSnapshot(query(col, where('inspectionStatus', '==', 'hold')), (snap) =>
      setOnHold(snap.docs.map((d) => ({ ...d.data(), id: d.id, styleId: d.data().styleId || d.ref.parent?.parent?.id, docPath: d.ref.path })))
    );
    const unsubAll = onSnapshot(query(col, where('type', '==', 'receipt')), (snap) =>
      setAllReceipts(snap.docs.map((d) => ({ ...d.data(), id: d.id, styleId: d.data().styleId || d.ref.parent?.parent?.id, docPath: d.ref.path })))
    );
    return () => {
      unsubPending();
      unsubHold();
      unsubAll();
    };
  }, [cfg.collectionName]);

  const buyers = useMemo(() => Array.from(new Set((allReceipts || []).map((r) => r.buyer).filter(Boolean))).sort(), [allReceipts]);
  const filteredHistory = (allReceipts || [])
    .filter((r) => buyerFilter === 'all' || r.buyer === buyerFilter)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  async function saveInspection({ entry, checkedQty, hasIssue, note }) {
    setBusyId(entry.id);
    const resolvedStyleId = entry.styleId || (entry.styleNo ? getLocalStyles().find((s) => s.styleNo === entry.styleNo)?.id : '') || 'general';

    const patch = hasIssue
      ? {
          inspectionStatus: 'hold',
          inspectedQty: checkedQty,
          inspectionResult: 'issue',
          inspectionNotes: note,
          inspectedBy: profile?.name || user?.displayName || user?.email || 'Quality Inspector',
          inspectionDate: today(),
        }
      : {
          inspectionStatus: 'passed',
          inspectedQty: checkedQty,
          inspectionResult: 'pass',
          inspectionNotes: note || '',
          inspectedBy: profile?.name || user?.displayName || user?.email || 'Quality Inspector',
          inspectionDate: today(),
        };

    try {
      if (entry.docPath) {
        try {
          await updateDoc(doc(db, entry.docPath), patch);
        } catch (err) {
          console.warn('Firestore updateDoc path notice:', err);
        }
      } else if (resolvedStyleId && resolvedStyleId !== 'general') {
        try {
          const ref = doc(db, 'styles', resolvedStyleId, cfg.collectionName, entry.id);
          await updateDoc(ref, patch);
        } catch (err) {
          console.warn('Firestore updateDoc notice:', err);
        }
      }

      // Sync local ledger
      try {
        if (kind === 'yarn') {
          const localYarn = getLocalYarnLedger();
          const updated = localYarn.map((e) => (e.id === entry.id ? { ...e, ...patch } : e));
          saveLocalYarnLedger(updated);
        } else {
          const localAcc = getLocalAccLedger();
          const updated = localAcc.map((e) => (e.id === entry.id ? { ...e, ...patch } : e));
          saveLocalAccLedger(updated);
        }
      } catch {}

      // Optimistically update memory lists
      setPending((prev) => (prev || []).filter((p) => p.id !== entry.id));
      if (hasIssue) {
        setOnHold((prev) => [{ ...entry, ...patch }, ...(prev || [])]);
      }
      setAllReceipts((prev) => (prev || []).map((p) => (p.id === entry.id ? { ...p, ...patch } : p)));

      setSuccessNotice(
        hasIssue
          ? t('ইন্সপেকশনে ত্রুটি চিহ্নিত হয়েছে — লটটি হোল্ড (Hold)-এ পাঠানো হয়েছে।', 'Issue recorded — lot placed on Hold.')
          : t('ইন্সপেকশন সফল! লটটি যাচাইপূর্বক স্টকে ব্যবহারের জন্য পাস করা হয়েছে।', 'Inspection passed! Lot verified and approved for production.')
      );
      setInspecting(null);
      setTimeout(() => setSuccessNotice(''), 4500);
    } catch (e) {
      console.error('Inspection save error:', e);
    } finally {
      setBusyId('');
    }
  }

  async function decideHold(entry, decision, reason) {
    setBusyId(entry.id);
    const resolvedStyleId = entry.styleId || entry.ref?.parent?.parent?.id || (entry.styleNo ? getLocalStyles().find((s) => s.styleNo === entry.styleNo)?.id : '') || 'general';

    const patch = decision === 'approve'
      ? {
          inspectionStatus: 'approved',
          approvedBy: profile?.name || user?.displayName || user?.email || 'Quality Authority',
          approvedAt: new Date().toISOString(),
        }
      : {
          inspectionStatus: 'rejected',
          rejectedBy: profile?.name || user?.displayName || user?.email || 'Quality Authority',
          rejectedAt: new Date().toISOString(),
          rejectionReason: reason || '',
        };

    try {
      if (resolvedStyleId && resolvedStyleId !== 'general') {
        try {
          const ref = doc(db, 'styles', resolvedStyleId, cfg.collectionName, entry.id);
          await updateDoc(ref, patch);
        } catch (err) {
          console.warn('Firestore decideHold notice:', err);
        }
      }

      // Sync local ledger
      try {
        if (kind === 'yarn') {
          const localYarn = getLocalYarnLedger();
          const updated = localYarn.map((e) => (e.id === entry.id ? { ...e, ...patch } : e));
          saveLocalYarnLedger(updated);
        } else {
          const localAcc = getLocalAccLedger();
          const updated = localAcc.map((e) => (e.id === entry.id ? { ...e, ...patch } : e));
          saveLocalAccLedger(updated);
        }
      } catch {}

      setOnHold((prev) => (prev || []).filter((h) => h.id !== entry.id));
      setAllReceipts((prev) => (prev || []).map((p) => (p.id === entry.id ? { ...p, ...patch } : p)));

      setSuccessNotice(
        decision === 'approve'
          ? t('হোল্ড লটটি হায়ার অথরিটি দ্বারা পাস ও অনুমোদন করা হয়েছে।', 'Hold lot approved by Higher Authority.')
          : t('হোল্ড লটটি রিজেক্ট করা হয়েছে।', 'Hold lot rejected.')
      );
      setTimeout(() => setSuccessNotice(''), 4500);
    } catch (e) {
      console.error('Decide hold error:', e);
    } finally {
      setBusyId('');
    }
  }

  function handleReject(entry) {
    const reason = window.prompt(t('বাতিলের কারণ লিখুন (ঐচ্ছিক):', 'Enter reason for rejecting (optional):'));
    decideHold(entry, 'reject', reason);
  }

  const historyColumns = [
    { key: 'date', label: t('তারিখ', 'Date') },
    { key: 'styleNo', label: t('স্টাইল', 'Style') },
    { key: 'buyer', label: t('বায়ার', 'Buyer') },
    { key: cfg.nameField, label: t(cfg.label.bn, cfg.label.en) },
    { key: 'chalanNo', label: t('চালান নং', 'Chalan No.') },
    { key: 'qty', label: t('রিসিভড কোয়ান্টিটি', 'Received Qty') },
    { key: 'inspectionSuggestedQty', label: t('সাজেস্টেড চেক (১০%)', 'Suggested Check (10%)') },
    { key: 'inspectedQty', label: t('চেক করা হয়েছে', 'Checked Qty') },
    {
      key: 'inspectionStatus',
      label: t('স্ট্যাটাস', 'Status'),
      render: (r) => t(
        { pending: 'অপেক্ষমাণ', passed: 'পাস', hold: 'হোল্ড', approved: 'অনুমোদিত', rejected: 'বাতিল' }[r.inspectionStatus || 'pending'],
        { pending: 'Pending', passed: 'Passed', hold: 'Hold', approved: 'Approved', rejected: 'Rejected' }[r.inspectionStatus || 'pending']
      ),
    },
    { key: 'inspectionNotes', label: t('সমস্যার নোট', 'Issue Note') },
    { key: 'inspectedBy', label: t('ইন্সপেকশন করেছেন', 'Inspected By') },
    { key: 'approvedBy', label: t('অনুমোদন করেছেন', 'Approved By') },
    { key: 'rejectedBy', label: t('বাতিল করেছেন', 'Rejected By') },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">{t('রিসিভিং ইন্সপেকশন', 'Receiving Inspection')}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {t(
            'প্রতিটি রিসিভড চালানের অন্তত ১০% QC ইন্সপেকশন করতে হবে — পাস হওয়ার আগ পর্যন্ত ইয়ার্ন/এক্সেসরিজ স্টোর থেকে ইস্যু করা যাবে না। সমস্যা পেলে কারণ লিখে হোল্ডে পাঠানো যাবে, তখন কোয়ালিটি ম্যানেজার/হায়ার অথরিটির অনুমোদনের পর সিদ্ধান্ত হবে।',
            "At least 10% of every received chalan must be QC-inspected — it can't be issued from Yarn/Accessories Store until it passes. If there's a problem, note it and send it to hold; a Quality Manager/Higher Authority then decides whether it can proceed."
          )}
        </p>
      </div>

      <div className="flex gap-2">
        {Object.entries(KINDS).map(([key, k]) => (
          <button
            key={key}
            onClick={() => setKind(key)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              kind === key ? 'border-indigo bg-indigo text-white' : 'border-line bg-surface text-ink-soft hover:bg-paper'
            }`}
          >
            {t(k.label.bn, k.label.en)}
          </button>
        ))}
      </div>

      {successNotice && (
        <div className="rounded-lg border border-green/40 bg-green/10 p-3.5 text-sm font-semibold text-green flex items-center gap-2 shadow-sm animate-pulse">
          <Check size={18} />
          <span>{successNotice}</span>
        </div>
      )}

      {canDecide && onHold && onHold.length > 0 && (
        <div className="rounded-lg border border-red/30 bg-red-soft/40 p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-ink">
            <ShieldAlert size={16} className="text-red" />
            {t('হোল্ডে থাকা লট — অনুমোদনের অপেক্ষায়', 'Lots on Hold — Awaiting Approval')}
            <span className="rounded-full bg-red px-2 py-0.5 text-xs text-white">{onHold.length}</span>
          </h2>
          <div className="space-y-2">
            {onHold.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface p-3 text-sm">
                <div>
                  <p className="font-medium text-ink">
                    {entry.styleNo} · {entry[cfg.nameField]} — {entry.qty} {cfg.unit} {t('রিসিভড', 'received')}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {t('চেক করা হয়েছে', 'Checked')}: {entry.inspectedQty} {cfg.unit} · {t('চালান', 'Chalan')}: {entry.chalanNo || '—'} ·{' '}
                    {entry.inspectedBy} · {entry.inspectionDate}
                  </p>
                  <p className="mt-1 text-xs text-red">{t('সমস্যা', 'Issue')}: {entry.inspectionNotes}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => decideHold(entry, 'approve')}
                    disabled={busyId === entry.id}
                    className="inline-flex items-center gap-1 rounded-md bg-green px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    <Check size={13} /> {t('তবুও অনুমোদন করুন', 'Approve anyway')}
                  </button>
                  <button
                    onClick={() => handleReject(entry)}
                    disabled={busyId === entry.id}
                    className="inline-flex items-center gap-1 rounded-md border border-red/30 bg-red-soft px-3 py-1.5 text-xs font-medium text-red hover:bg-red/10 disabled:opacity-50"
                  >
                    <X size={13} /> {t('বাতিল করুন', 'Reject')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold text-ink">
          <PackageSearch size={16} />
          {t('ইন্সপেকশনের অপেক্ষায় থাকা রিসিভড লট', 'Receipts Awaiting Inspection')}
          {pending && <span className="rounded-full bg-line px-2 py-0.5 text-xs text-ink-soft">{pending.length}</span>}
        </h2>
        {pending === null ? (
          <p className="text-sm text-ink-soft">{t('লোড হচ্ছে…', 'Loading…')}</p>
        ) : pending.length === 0 ? (
          <EmptyState title={t('সব রিসিভড লট ইন্সপেকশন করা আছে', 'Every receipt has been inspected')} />
        ) : (
          <div className="space-y-2">
            {pending.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-paper p-3 text-sm">
                <div>
                  <p className="font-medium text-ink">
                    {entry.styleNo} · {entry[cfg.nameField]} — {entry.qty} {cfg.unit}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {t('চালান', 'Chalan')}: {entry.chalanNo || '—'} {entry.block && `· ${t('ব্লক', 'Block')}: ${entry.block}`}
                    {entry.supplier && ` · ${entry.supplier}`} · {entry.date}
                  </p>
                  <p className="text-xs text-indigo">
                    {t('সাজেস্টেড চেক কোয়ান্টিটি (১০%)', 'Suggested check quantity (10%)')}: {entry.inspectionSuggestedQty} {cfg.unit}
                  </p>
                </div>
                {canInspect && (
                  <button onClick={() => setInspecting(entry)} className={btnPrimary}>
                    <ClipboardCheck size={15} /> {t('ইন্সপেক্ট করুন', 'Inspect')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-line bg-surface p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-sm font-semibold text-ink">{t('ইন্সপেকশন রিপোর্ট (সব স্টাইল)', 'Inspection Report (All Styles)')}</h2>
          <div className="flex items-center gap-2">
            <Field label="">
              <select value={buyerFilter} onChange={(e) => setBuyerFilter(e.target.value)} className={`${inputClass} !py-1.5 text-xs`}>
                <option value="all">{t('সব বায়ার', 'All Buyers')}</option>
                {buyers.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </Field>
            <ExportBar
              small
              title={t(`${cfg.label.bn} ইন্সপেকশন রিপোর্ট`, `${cfg.label.en} Inspection Report`)}
              filename={`${kind}-inspection-report`}
              columns={historyColumns}
              rows={filteredHistory}
            />
          </div>
        </div>
        {allReceipts === null ? (
          <p className="text-sm text-ink-soft">{t('লোড হচ্ছে…', 'Loading…')}</p>
        ) : filteredHistory.length === 0 ? (
          <EmptyState title={t('এখনো কোনো রিসিভড এন্ট্রি নেই', 'No receipts yet')} />
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-soft">
                  <th className="py-2 pr-4 font-medium">{t('তারিখ', 'Date')}</th>
                  <th className="py-2 pr-4 font-medium">{t('স্টাইল', 'Style')}</th>
                  <th className="py-2 pr-4 font-medium">{t(cfg.label.bn, cfg.label.en)}</th>
                  <th className="py-2 pr-4 font-medium">{t('রিসিভড', 'Received')}</th>
                  <th className="py-2 pr-4 font-medium">{t('চেক করা হয়েছে', 'Checked')}</th>
                  <th className="py-2 pr-4 font-medium">{t('স্ট্যাটাস', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4 text-ink-soft">{r.date}</td>
                    <td className="py-2 pr-4 text-ink">{r.styleNo}</td>
                    <td className="py-2 pr-4 text-ink-soft">{r[cfg.nameField]}</td>
                    <td className="py-2 pr-4 text-ink-soft">{r.qty} {cfg.unit}</td>
                    <td className="py-2 pr-4 text-ink-soft">{r.inspectedQty ?? '—'} {r.inspectedQty ? cfg.unit : ''}</td>
                    <td className="py-2 pr-4"><InspectionBadge status={r.inspectionStatus} t={t} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {inspecting && (
        <InspectModal
          entry={inspecting}
          cfg={cfg}
          t={t}
          busy={busyId === inspecting.id}
          onSave={saveInspection}
          onClose={() => setInspecting(null)}
        />
      )}
    </div>
  );
}

function InspectModal({ entry, cfg, t, busy, onSave, onClose }) {
  const [checkedQty, setCheckedQty] = useState(String(entry.inspectionSuggestedQty ?? ''));
  const [hasIssue, setHasIssue] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    setError('');
    const n = Number(checkedQty);
    if (!n || n <= 0) {
      setError(t('চেক করা কোয়ান্টিটি দিন।', 'Enter the quantity checked.'));
      return;
    }
    if (hasIssue && !note.trim()) {
      setError(t('সমস্যার বিবরণ লিখুন।', 'Describe the issue found.'));
      return;
    }
    onSave({ entry, checkedQty: n, hasIssue, note: note.trim() });
  }

  return (
    <Modal title={t('ইন্সপেকশন', 'Inspection')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink">
          {entry.styleNo} · {entry[cfg.nameField]} — {t('রিসিভড', 'Received')}: {entry.qty} {cfg.unit}
        </p>
        <Field label={t('চেক করা কোয়ান্টিটি *', 'Quantity Checked *')}>
          <input type="number" min="0" step="0.01" className={`${inputClass} text-base sm:text-sm`} value={checkedQty} onChange={(e) => setCheckedQty(e.target.value)} />
        </Field>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setHasIssue(false)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${!hasIssue ? 'border-green bg-green/10 text-green' : 'border-line bg-surface text-ink-soft'}`}
          >
            {t('✓ পাস, কোনো সমস্যা নেই', '✓ Pass, no issue')}
          </button>
          <button
            type="button"
            onClick={() => setHasIssue(true)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${hasIssue ? 'border-red bg-red-soft text-red' : 'border-line bg-surface text-ink-soft'}`}
          >
            {t('✕ সমস্যা পাওয়া গেছে', '✕ Issue found')}
          </button>
        </div>
        {hasIssue && (
          <Field label={t('সমস্যার বিবরণ *', 'Issue Details *')}>
            <textarea
              className={`${inputClass} text-base sm:text-sm`}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('কী সমস্যা পাওয়া গেছে লিখুন…', 'Describe what was found…')}
            />
            <p className="mt-1 text-xs text-amber">
              {t(
                'এটি সেভ করলে এই লট "হোল্ড"-এ যাবে — কোয়ালিটি ম্যানেজার/হায়ার অথরিটি অনুমোদন না দেওয়া পর্যন্ত ইস্যু করা যাবে না।',
                'Saving this puts the lot on "Hold" — it cannot be issued until a Quality Manager/Higher Authority approves it.'
              )}
            </p>
          </Field>
        )}
        {error && <p className="text-sm text-red">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? t('সেভ হচ্ছে…', 'Saving…') : t('সেভ করুন', 'Save')}
          </button>
          <button type="button" className={btnSecondary} onClick={onClose}>
            {t('বাতিল', 'Cancel')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
