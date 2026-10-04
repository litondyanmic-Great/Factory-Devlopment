import { useState } from 'react';
import { collection, collectionGroup, getDocs, doc, updateDoc, deleteField, query, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { AlertTriangle, Search, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { db } from '../../firebase';
import { btnPrimary, btnDanger, EmptyState } from '../../components/ui';
import { useLang } from '../../lib/i18n';
import { STAGES } from '../../lib/constants';
import { getLocalStyles, saveLocalStyles } from '../../lib/demoData';

const SUBCOLLECTIONS = [
  { key: 'yarnLedger', bn: 'ইয়ার্ন লেজার', en: 'Yarn Ledger' },
  { key: 'accessoryLedger', bn: 'এক্সেসরিজ লেজার', en: 'Accessory Ledger' },
  { key: 'productionEntries', bn: 'প্রোডাকশন এন্ট্রি', en: 'Production Entries' },
];

export default function DataCleanup() {
  const { t } = useLang();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [orphans, setOrphans] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState('');

  // Repair State
  const [repairing, setRepairing] = useState(false);
  const [repairedCount, setRepairedCount] = useState(null);
  const [repairMsg, setRepairMsg] = useState('');

  async function handleScan() {
    setScanning(true);
    setScanned(false);
    setError('');
    setOrphans([]);
    try {
      const styleSnap = await getDocs(collection(db, 'styles'));
      const validStyleIds = new Set(styleSnap.docs.map((d) => d.id));

      const found = [];
      for (const sub of SUBCOLLECTIONS) {
        const snap = await getDocs(query(collectionGroup(db, sub.key)));
        snap.docs.forEach((d) => {
          const styleId = d.ref.parent.parent?.id;
          if (styleId && !validStyleIds.has(styleId)) {
            found.push({
              ref: d.ref,
              subKey: sub.key,
              styleId,
              styleLabel: d.data().styleLabel || d.data().styleNo || styleId,
              date: d.data().date || '',
            });
          }
        });
      }
      setOrphans(found);
      setScanned(true);
    } catch (err) {
      setError(t('স্ক্যান করা যায়নি।', 'Could not scan.'));
    } finally {
      setScanning(false);
    }
  }

  async function handleDeleteAll() {
    const ok = window.confirm(
      t(
        `⚠️ ${orphans.length}টি orphan এন্ট্রি স্থায়ীভাবে মুছে ফেলতে চান? এগুলো এমন স্টাইলের ডেটা যা আর নেই — মোছার পর ফিরিয়ে আনা যাবে না।`,
        `⚠️ Permanently delete ${orphans.length} orphan entries? These belong to styles that no longer exist — this cannot be undone.`
      )
    );
    if (!ok) return;
    setDeleting(true);
    setDone(0);
    try {
      for (let i = 0; i < orphans.length; i += 400) {
        const chunk = orphans.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((o) => batch.delete(o.ref));
        await batch.commit();
        setDone((d) => d + chunk.length);
      }
      setOrphans([]);
      setScanned(true);
    } catch (err) {
      setError(t('মুছে ফেলা যায়নি, আবার চেষ্টা করুন।', 'Could not delete, please try again.'));
    } finally {
      setDeleting(false);
    }
  }

  // Recalculate Stage Totals for all styles
  async function handleRecalculateStages() {
    setRepairing(true);
    setRepairMsg('');
    setError('');
    try {
      const stylesSnap = await getDocs(collection(db, 'styles'));
      let count = 0;
      const localList = getLocalStyles();
      const updatedLocalList = [...localList];

      for (const styleDoc of stylesSnap.docs) {
        const styleId = styleDoc.id;
        const styleData = styleDoc.data();

        // Fetch all production entries for this style
        const entriesSnap = await getDocs(collection(db, 'styles', styleId, 'productionEntries'));
        const stageSums = {};
        STAGES.forEach((s) => {
          stageSums[s.key] = 0;
        });

        entriesSnap.docs.forEach((ed) => {
          const e = ed.data();
          if (e.stage && typeof stageSums[e.stage] === 'number') {
            stageSums[e.stage] += Number(e.quantity || 0);
          }
        });

        // Clean up rogue dotted keys like "stages.knitting"
        const updatePayload = {
          stages: stageSums,
          productionStarted: Object.values(stageSums).some((v) => v > 0),
          updatedAt: serverTimestamp(),
        };

        // If doc had corrupted dotted field names at root level, remove them
        STAGES.forEach((s) => {
          if (`stages.${s.key}` in styleData) {
            updatePayload[`stages.${s.key}`] = deleteField();
          }
        });

        await updateDoc(doc(db, 'styles', styleId), updatePayload);
        count++;

        // Update local list too
        const idx = updatedLocalList.findIndex((s) => s.id === styleId);
        if (idx !== -1) {
          updatedLocalList[idx] = {
            ...updatedLocalList[idx],
            stages: stageSums,
            productionStarted: updatePayload.productionStarted,
          };
        }
      }

      saveLocalStyles(updatedLocalList);
      setRepairedCount(count);
      setRepairMsg(
        t(
          `মোট ${count}টি স্টাইলের প্রতিটি স্টেজের উৎপাদন সংখ্যা বাস্তব এন্ট্রিগুলো থেকে সঠিকভাবে রিক্যালকুলেট ও মেরামত করা হয়েছে!`,
          `Successfully recalculated and repaired stage progress totals for ${count} styles from real production entries!`
        )
      );
    } catch (err) {
      console.error('Repair error:', err);
      setError(t('স্টেজ রিক্যালকুলেট করা যায়নি।', 'Could not recalculate stages.'));
    } finally {
      setRepairing(false);
    }
  }

  const bySub = SUBCOLLECTIONS.map((sub) => ({
    ...sub,
    count: orphans.filter((o) => o.subKey === sub.key).length,
  }));
  const byStyle = Array.from(new Set(orphans.map((o) => o.styleLabel))).slice(0, 20);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">{t('ডেটা ক্লিনআপ ও মেরামত', 'Data Cleanup & Repair Tools')}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {t(
            'সিস্টেমের ডেটাবেস সুস্থতা বজায় রাখার জন্য এই টুলগুলো ব্যবহার করুন — স্টেজ প্রোডাকশন রিক্যালকুলেট করুন অথবা অপ্রয়োজনীয় অরফান ডেটা মুছে ফেলুন।',
            'Use these maintenance tools to recalculate stage progress from entries or clean up leftover data.'
          )}
        </p>
      </div>

      {/* Recalculate Stage Totals Tool */}
      <div className="rounded-lg border border-line bg-surface p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-ink flex items-center gap-2">
              <RefreshCw size={18} className="text-indigo" />
              {t('স্টাইলের স্টেজ প্রগ্রেস রিক্যালকুলেট ও মেরামত করুন', 'Recalculate & Repair Style Stage Totals')}
            </h2>
            <p className="mt-1 text-xs text-ink-soft">
              {t(
                'যদি কোনো স্টাইলে প্রোডাকশন এন্ট্রি যোগ/বিয়োগ করার পর ড্যাশবোর্ড বা স্টাইল লিস্টে মোট সংখ্যার গরমিল দেখা যায়, তবে এই বাটনে চাপ দিন। সিস্টেম প্রতিটি স্টাইলের প্রতিটি স্টেজের আসল এন্ট্রিগুলো পুনরায় যোগ করে শতভাগ নির্ভুল করে দিবে।',
                'Recalculates every stage count directly from actual production entry documents to fix any desync.'
              )}
            </p>
          </div>
          <button
            type="button"
            disabled={repairing}
            onClick={handleRecalculateStages}
            className={`${btnPrimary} shrink-0 flex items-center gap-1.5 !text-xs`}
          >
            <RefreshCw size={14} className={repairing ? 'animate-spin' : ''} />
            {repairing ? t('মেরামত হচ্ছে…', 'Repairing…') : t('রিক্যালকুলেট করুন', 'Recalculate Stages')}
          </button>
        </div>

        {repairMsg && (
          <div className="flex items-center gap-2 rounded-lg bg-green/10 p-3 text-xs font-semibold text-green">
            <CheckCircle2 size={16} />
            {repairMsg}
          </div>
        )}
      </div>

      {/* Orphan Cleanup Tool */}
      <div className="rounded-lg border border-amber bg-amber-soft/30 p-4 text-sm text-ink">
        <p className="flex items-center gap-2 font-medium">
          <AlertTriangle size={16} className="text-amber" />
          {t('অরফান (Orphaned) ডেটা মোছা', 'Orphaned Data Cleanup')}
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          {t(
            'ডিলিট হয়ে যাওয়া পুরনো স্টাইলের কোনো অবশিষ্ট সাব-কালেকশন থেকে থাকলে সেগুলো খুঁজে মুছে ফেলুন।',
            'Find and permanently remove leftover subcollections from deleted styles.'
          )}
        </p>
      </div>

      {error && <p className="text-sm text-red">{error}</p>}

      <div className="rounded-lg border border-line bg-surface p-5">
        <button onClick={handleScan} disabled={scanning || deleting} className={btnPrimary}>
          <Search size={16} /> {scanning ? t('স্ক্যান হচ্ছে…', 'Scanning…') : t('স্ক্যান করুন', 'Scan for Orphaned Data')}
        </button>

        {scanned && (
          <div className="mt-5">
            {orphans.length === 0 ? (
              <EmptyState title={t('কোনো orphan ডেটা পাওয়া যায়নি — সব পরিষ্কার!', 'No orphaned data found — everything is clean!')} />
            ) : (
              <>
                <p className="mb-3 text-sm text-ink">
                  {t(`মোট ${orphans.length}টি orphan এন্ট্রি পাওয়া গেছে:`, `Found ${orphans.length} orphaned entries in total:`)}
                </p>
                <div className="mb-4 grid grid-cols-3 gap-3">
                  {bySub.map((s) => (
                    <div key={s.key} className="rounded-md border border-line bg-paper p-3 text-center">
                      <p className="font-display text-lg font-semibold text-ink">{s.count}</p>
                      <p className="text-xs text-ink-soft">{t(s.bn, s.en)}</p>
                    </div>
                  ))}
                </div>
                {byStyle.length > 0 && (
                  <div className="mb-4 rounded-md border border-line bg-paper p-3">
                    <p className="mb-1 text-xs font-medium text-ink-soft">
                      {t('যেসব (আর-অস্তিত্বহীন) স্টাইলের ডেটা পাওয়া গেছে:', 'Data found for these (no-longer-existing) styles:')}
                    </p>
                    <p className="text-xs text-ink-soft">{byStyle.join(', ')}{orphans.length > byStyle.length ? '…' : ''}</p>
                  </div>
                )}
                <button onClick={handleDeleteAll} disabled={deleting} className={btnDanger}>
                  <Trash2 size={16} />
                  {deleting ? t(`মুছে ফেলা হচ্ছে… (${done}/${orphans.length})`, `Deleting… (${done}/${orphans.length})`) : t('সব orphan এন্ট্রি মুছে ফেলুন', 'Delete All Orphaned Entries')}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <Link to="/admin/settings" className="inline-block text-sm font-medium text-indigo hover:underline">
        ← {t('সেটিংসে ফিরে যান', 'Back to Settings')}
      </Link>
    </div>
  );
}
