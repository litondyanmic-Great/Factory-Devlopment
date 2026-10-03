import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { db } from '../../firebase';
import { EmptyState, StatCard } from '../../components/ui';
import ExportBar from '../../components/ExportBar';
import { STAGES, stageLabel } from '../../lib/constants';
import { useLang } from '../../lib/i18n';
import {
  getLocalStyles,
  getLocalYarnLedger,
  getLocalAccLedger,
  getLocalProductionEntries,
} from '../../lib/demoData';

const YARN_TYPE_LABEL = {
  dyeingOrder: { bn: 'ডাইং অর্ডার', en: 'Dyeing Order' },
  receipt: { bn: 'রিসিভড', en: 'Received' },
  issueToWinding: { bn: 'ওয়াইন্ডিং-এ ইস্যু', en: 'Issued to Winding' },
  issueToKnitting: { bn: 'সরাসরি নিটিং-এ ইস্যু', en: 'Issued to Knitting' },
  windingToKnitting: { bn: 'ওয়াইন্ডিং থেকে নিটিং', en: 'Winding to Knitting' },
  consumption: { bn: 'নিটিং-এ খরচ', en: 'Consumed in Knitting' },
};

export default function StyleFullReport() {
  const { id } = useParams();
  const { t, lang } = useLang();

  const [style, setStyle] = useState(() => getLocalStyles().find((s) => s.id === id) || null);
  const [prodEntries, setProdEntries] = useState(() => getLocalProductionEntries().filter((e) => e.styleId === id));
  const [yarnLedger, setYarnLedger] = useState(() => getLocalYarnLedger().filter((e) => e.styleId === id));
  const [accLedger, setAccLedger] = useState(() => getLocalAccLedger().filter((e) => e.styleId === id));

  // 1. Live Firestore listener for Style Document
  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(
        doc(db, 'styles', id),
        (snap) => {
          if (snap.exists()) {
            setStyle({ id: snap.id, ...snap.data() });
          }
        },
        () => {}
      );
    } catch {}
    return () => unsub();
  }, [id]);

  // 2. Live Firestore listener for Production Entries
  useEffect(() => {
    let unsub = () => {};
    try {
      const q = query(collection(db, 'styles', id, 'productionEntries'), orderBy('date', 'desc'));
      unsub = onSnapshot(
        q,
        (snap) => {
          if (!snap.empty) {
            setProdEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          }
        },
        () => {}
      );
    } catch {}
    return () => unsub();
  }, [id]);

  // 3. Live Firestore listener for Yarn Ledger
  useEffect(() => {
    let unsub = () => {};
    try {
      const q = query(collection(db, 'styles', id, 'yarnLedger'), orderBy('date', 'asc'));
      unsub = onSnapshot(
        q,
        (snap) => {
          if (!snap.empty) {
            setYarnLedger(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          }
        },
        () => {}
      );
    } catch {}
    return () => unsub();
  }, [id]);

  // 4. Live Firestore listener for Accessory Ledger
  useEffect(() => {
    let unsub = () => {};
    try {
      const q = query(collection(db, 'styles', id, 'accessoryLedger'), orderBy('date', 'asc'));
      unsub = onSnapshot(
        q,
        (snap) => {
          if (!snap.empty) {
            setAccLedger(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          }
        },
        () => {}
      );
    } catch {}
    return () => unsub();
  }, [id]);

  // Single source of truth for stage counts:
  // Combines style.stages and actual live sum of all logged production entries
  const liveStages = useMemo(() => {
    const stageMap = { ...(style?.stages || {}) };
    STAGES.forEach((s) => {
      if (typeof stageMap[s.key] !== 'number') stageMap[s.key] = 0;
    });

    const entriesSumByStage = {};
    STAGES.forEach((s) => {
      entriesSumByStage[s.key] = 0;
    });

    (prodEntries || []).forEach((e) => {
      if (e.stage && typeof entriesSumByStage[e.stage] === 'number') {
        entriesSumByStage[e.stage] += Number(e.quantity || 0);
      }
    });

    STAGES.forEach((s) => {
      if (entriesSumByStage[s.key] > stageMap[s.key]) {
        stageMap[s.key] = entriesSumByStage[s.key];
      }
    });

    return stageMap;
  }, [style?.stages, prodEntries]);

  // Yarn Balances Summary
  const yarnBalances = useMemo(() => {
    const map = new Map();
    (yarnLedger || []).forEach((e) => {
      if (!map.has(e.yarnItemId)) {
        map.set(e.yarnItemId, {
          name: e.yarnItemName,
          ordered: 0,
          received: 0,
          issuedWinding: 0,
          issuedKnitting: 0,
          windingToKnitting: 0,
          consumed: 0,
        });
      }
      const b = map.get(e.yarnItemId);
      const q = Number(e.qty || 0);
      if (e.type === 'dyeingOrder') b.ordered += q;
      if (e.type === 'receipt') b.received += q;
      if (e.type === 'issueToWinding') b.issuedWinding += q;
      if (e.type === 'issueToKnitting') b.issuedKnitting += q;
      if (e.type === 'windingToKnitting') b.windingToKnitting += q;
      if (e.type === 'consumption') b.consumed += q;
    });
    return Array.from(map.values()).map((b) => ({
      ...b,
      atStore: b.received - b.issuedWinding - b.issuedKnitting,
      atWinding: b.issuedWinding - b.windingToKnitting,
      readyForKnitting: b.issuedKnitting + b.windingToKnitting - b.consumed,
    }));
  }, [yarnLedger]);

  // Accessory Balances Summary
  const accBalances = useMemo(() => {
    const map = new Map();
    (accLedger || []).forEach((e) => {
      if (!map.has(e.itemId)) {
        map.set(e.itemId, { name: e.itemName, unit: e.unit, ordered: 0, received: 0, issued: 0 });
      }
      const b = map.get(e.itemId);
      const q = Number(e.qty || 0);
      if (e.type === 'order') b.ordered += q;
      if (e.type === 'receipt') b.received += q;
      if (e.type === 'issue') b.issued += q;
    });
    return Array.from(map.values()).map((b) => ({ ...b, atStore: b.received - b.issued }));
  }, [accLedger]);

  // Stage-wise Progress Rows
  const stageRows = useMemo(() => {
    if (!style) return [];
    const orderQty = Number(style.orderQty || 0);
    return STAGES.map((s, i) => {
      const done = liveStages[s.key] || 0;
      const prevKey = i > 0 ? style.stagePrerequisites?.[s.key] || STAGES[i - 1].key : null;
      const prevDone = i > 0 ? liveStages[prevKey] || 0 : done;
      const wip = i > 0 ? Math.max(0, prevDone - done) : 0;
      const pct = orderQty > 0 ? Math.min(100, Math.round((done / orderQty) * 100)) : 0;
      const overQty = Math.max(0, done - orderQty);
      const overPct = orderQty > 0 && overQty > 0 ? Math.round((overQty / orderQty) * 100) : 0;
      const balance = Math.max(0, orderQty - done);

      return {
        stageKey: s.key,
        label: stageLabel(s.key, lang),
        done,
        target: orderQty,
        pct: `${pct}%`,
        wip,
        balance,
        overPct,
      };
    });
  }, [style, liveStages, lang]);

  // PO & Colour Breakdown Summary
  const poColourRows = useMemo(() => {
    const map = new Map();
    (prodEntries || []).forEach((e) => {
      if (!e.poNo) return;
      const key = `${e.poNo}||${e.colour || ''}`;
      if (!map.has(key)) {
        map.set(key, { poNo: e.poNo, colour: e.colour || t('মিশ্র', 'Mixed'), totalQty: 0, stages: {} });
      }
      const row = map.get(key);
      const q = Number(e.quantity || 0);
      row.totalQty += q;
      row.stages[e.stage] = (row.stages[e.stage] || 0) + q;
    });
    return Array.from(map.values());
  }, [prodEntries, t]);

  // Production Entries Detailed Log
  const productionEntriesLog = useMemo(() => {
    return (prodEntries || []).map((e) => ({
      id: e.id,
      date: e.date || '—',
      stageLabel: stageLabel(e.stage, lang),
      poNo: e.poNo || '—',
      colour: e.colour || '—',
      quantity: Number(e.quantity || 0),
      enteredBy: e.enteredBy || 'Admin',
      note: e.note || '—',
    }));
  }, [prodEntries, lang]);

  if (style === undefined) return <p className="text-sm text-ink-soft">{t('লোড হচ্ছে…', 'Loading…')}</p>;
  if (style === null) return <EmptyState title={t('স্টাইল পাওয়া যায়নি', 'Style not found')} />;

  const scopeLabel = `${style.styleNo}${style.styleName ? ' — ' + style.styleName : ''}`;
  const orderQtyNum = Number(style.orderQty || 0);
  const finalStageKey = STAGES[STAGES.length - 1].key;
  const completedPacking = liveStages[finalStageKey] || 0;
  const packingPct = orderQtyNum > 0 ? Math.min(100, Math.round((completedPacking / orderQtyNum) * 100)) : 0;
  const totalEntriesPcs = (prodEntries || []).reduce((sum, e) => sum + Number(e.quantity || 0), 0);

  const sections = [
    {
      heading: t('স্টাইল তথ্য ও অর্ডার স্পেসিফিকেশন', 'Style Info & Order Specifications'),
      columns: [
        { key: 'label', label: t('বিষয়', 'Field') },
        { key: 'value', label: t('মান', 'Value') },
      ],
      rows: [
        { label: t('বায়ার', 'Buyer'), value: style.buyer || '—' },
        { label: t('PO নং', 'PO No.'), value: style.poNo || '—' },
        { label: t('স্টাইল নং', 'Style No.'), value: style.styleNo || '—' },
        { label: t('স্টাইল নাম', 'Style Name'), value: style.styleName || '—' },
        { label: 'GG', value: style.gg || '—' },
        { label: t('অর্ডার কোয়ান্টিটি', 'Order Quantity'), value: `${orderQtyNum.toLocaleString()} pcs` },
        { label: t('শিপমেন্ট ডেট', 'Ship Date'), value: style.shipDate || '—' },
        { label: t('কালার', 'Colour'), value: style.colour || '—' },
        { label: t('ইয়ার্ন কম্পোজিশন', 'Yarn Composition'), value: style.yarnComposition || '—' },
      ],
    },
    {
      heading: t('স্টেজ-ভিত্তিক প্রোডাকশন স্ট্যাটাস (Stage-wise Progress)', 'Stage-wise Production Status'),
      columns: [
        { key: 'label', label: t('স্টেজ', 'Stage') },
        { key: 'done', label: t('উৎপাদিত (Done pcs)', 'Done (pcs)'), render: (r) => Number(r.done || 0).toLocaleString() },
        { key: 'target', label: t('অর্ডার লক্ষ্যমাত্রা (Target)', 'Order Target'), render: (r) => Number(r.target || 0).toLocaleString() },
        { key: 'pct', label: t('সম্পন্ন %', 'Progress %') },
        { key: 'wip', label: t('WIP (পরের স্টেজের ব্যালেন্স)', 'WIP Balance'), render: (r) => Number(r.wip || 0).toLocaleString() },
        { key: 'balance', label: t('অর্ডারের বাকি (Remaining)', 'Remaining to Order'), render: (r) => Number(r.balance || 0).toLocaleString() },
        { key: 'overPct', label: t('অতিরিক্ত %', 'Over %'), render: (r) => (r.overPct > 0 ? `+${r.overPct}%` : '—') },
      ],
      rows: stageRows,
    },
    {
      heading: t('তারিখ-ভিত্তিক প্রোডাকশন এন্ট্রি লগ (Production Entries History Log)', 'Production Entries History Log'),
      columns: [
        { key: 'date', label: t('তারিখ', 'Date') },
        { key: 'stageLabel', label: t('স্টেজ', 'Stage') },
        { key: 'poNo', label: 'PO' },
        { key: 'colour', label: t('কালার', 'Colour') },
        { key: 'quantity', label: t('উৎপাদিত পিস (Qty pcs)', 'Quantity (pcs)'), render: (r) => Number(r.quantity || 0).toLocaleString() },
        { key: 'enteredBy', label: t('এন্ট্রি গ্রহণকারী', 'Entered By') },
        { key: 'note', label: t('মন্তব্য / বান্ডেল', 'Note / Bundle') },
      ],
      rows: productionEntriesLog,
      emptyLabel: t('এখনো কোনো প্রোডাকশন এন্ট্রি লগ করা হয়নি', 'No production entries logged yet'),
    },
    ...(poColourRows.length > 0
      ? [
          {
            heading: t('PO ও কালার-ওয়াইজ প্রোডাকশন ব্রেকডাউন', 'PO & Colour-wise Breakdown'),
            columns: [
              { key: 'poNo', label: 'PO' },
              { key: 'colour', label: t('কালার', 'Colour') },
              ...STAGES.map((s) => ({
                key: `stage_${s.key}`,
                label: lang === 'en' ? s.labelEn : s.label,
                render: (r) => Number(r.stages[s.key] || 0).toLocaleString(),
              })),
            ],
            rows: poColourRows,
          },
        ]
      : []),
    {
      heading: t('ইয়ার্ন ব্যালেন্স সামারি (Yarn Balance Summary)', 'Yarn Balance Summary'),
      columns: [
        { key: 'name', label: t('ইয়ার্ন', 'Yarn') },
        { key: 'ordered', label: t('ডাইং অর্ডার (lb)', 'Dyeing Order (lb)'), render: (r) => Number(r.ordered || 0).toFixed(2) },
        { key: 'received', label: t('রিসিভড (lb)', 'Received (lb)'), render: (r) => Number(r.received || 0).toFixed(2) },
        { key: 'atStore', label: t('স্টোরে (lb)', 'At Store (lb)'), render: (r) => Number(r.atStore || 0).toFixed(2) },
        { key: 'atWinding', label: t('ওয়াইন্ডিং-এ (lb)', 'At Winding (lb)'), render: (r) => Number(r.atWinding || 0).toFixed(2) },
        { key: 'readyForKnitting', label: t('নিটিং-প্রস্তুত (lb)', 'Ready for Knitting (lb)'), render: (r) => Number(r.readyForKnitting || 0).toFixed(2) },
        { key: 'consumed', label: t('খরচ হয়েছে (lb)', 'Consumed (lb)'), render: (r) => Number(r.consumed || 0).toFixed(2) },
      ],
      rows: yarnBalances,
      emptyLabel: t('কোনো ইয়ার্ন ডেটা নেই', 'No yarn data'),
    },
    {
      heading: t('ইয়ার্ন লেজার (সম্পূর্ণ ইতিহাস)', 'Yarn Ledger (Full History)'),
      columns: [
        { key: 'date', label: t('তারিখ', 'Date') },
        { key: 'type', label: t('ধরন', 'Type'), render: (r) => t(YARN_TYPE_LABEL[r.type]?.bn, YARN_TYPE_LABEL[r.type]?.en) },
        { key: 'yarnItemName', label: t('ইয়ার্ন', 'Yarn') },
        { key: 'qty', label: t('কোয়ান্টিটি (lb)', 'Quantity (lb)'), render: (r) => Number(r.qty || 0).toFixed(2) },
        { key: 'block', label: t('ব্লক', 'Block') },
        { key: 'supplier', label: t('সাপ্লায়ার', 'Supplier') },
        { key: 'chalanNo', label: t('চালান', 'Chalan') },
      ],
      rows: yarnLedger || [],
      emptyLabel: t('কোনো এন্ট্রি নেই', 'No entries'),
    },
    {
      heading: t('এক্সেসরিজ ব্যালেন্স সামারি (Accessory Balance Summary)', 'Accessory Balance Summary'),
      columns: [
        { key: 'name', label: t('আইটেম', 'Item') },
        { key: 'ordered', label: t('অর্ডার', 'Ordered'), render: (r) => Number(r.ordered || 0).toLocaleString() },
        { key: 'received', label: t('রিসিভড', 'Received'), render: (r) => Number(r.received || 0).toLocaleString() },
        { key: 'issued', label: t('ইস্যু', 'Issued'), render: (r) => Number(r.issued || 0).toLocaleString() },
        { key: 'atStore', label: t('স্টোরে', 'At Store'), render: (r) => Number(r.atStore || 0).toLocaleString() },
      ],
      rows: accBalances,
      emptyLabel: t('কোনো এক্সেসরিজ ডেটা নেই', 'No accessory data'),
    },
    {
      heading: t('এক্সেসরিজ লেজার (সম্পূর্ণ ইতিহাস)', 'Accessory Ledger (Full History)'),
      columns: [
        { key: 'date', label: t('তারিখ', 'Date') },
        {
          key: 'type',
          label: t('ধরন', 'Type'),
          render: (r) => (r.type === 'order' ? t('অর্ডার', 'Ordered') : r.type === 'receipt' ? t('রিসিভড', 'Received') : t('ইস্যু', 'Issued')),
        },
        { key: 'itemName', label: t('আইটেম', 'Item') },
        { key: 'qty', label: t('কোয়ান্টিটি', 'Quantity'), render: (r) => Number(r.qty || 0).toLocaleString() },
        { key: 'section', label: t('সেকশন', 'Section'), render: (r) => (r.section ? stageLabel(r.section, lang) : '—') },
        { key: 'supplier', label: t('সাপ্লায়ার', 'Supplier') },
      ],
      rows: accLedger || [],
      emptyLabel: t('কোনো এন্ট্রি নেই', 'No entries'),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link to={`/production/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> {t('স্টাইল পাতায় ফিরে যান', 'Back to Style Page')}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{t('সম্পূর্ণ স্টাইল প্রোডাকশন রিপোর্ট', 'Full Style Production Report')}</h1>
          <p className="mt-1 text-sm text-ink-soft font-mono">{scopeLabel} · {style.buyer}</p>
        </div>
        <ExportBar
          title={t('সম্পূর্ণ স্টাইল রিপোর্ট', 'Full Style Report')}
          subtitle={`${scopeLabel} · ${style.buyer}`}
          filename={`style-full-report-${style.styleNo}`}
          sections={sections}
        />
      </div>

      {/* 4 Core Real-time KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label={t('মোট অর্ডার কোয়ান্টিটি', 'Order Quantity')}
          value={`${orderQtyNum.toLocaleString()} pcs`}
          subtitle={`PO: ${style.poNo || '—'}`}
        />
        <StatCard
          label={t('প্যাকিং সম্পন্ন (Finished)', 'Packing Finished')}
          value={`${completedPacking.toLocaleString()} pcs`}
          subtitle={`${packingPct}% ${t('অর্ডার সম্পন্ন', 'completed')}`}
        />
        <StatCard
          label={t('লগকৃত মোট এন্ট্রি', 'Total Entries Logged')}
          value={`${(prodEntries || []).length} ${t('টি', '')}`}
          subtitle={`${totalEntriesPcs.toLocaleString()} pcs ${t('সর্বমোট এন্ট্রি', 'total logged')}`}
        />
        <StatCard
          label={t('শিপমেন্ট বাকি (Balance)', 'Remaining to Ship')}
          value={`${Math.max(0, orderQtyNum - completedPacking).toLocaleString()} pcs`}
          subtitle={style.shipDate ? `${t('শিপমেন্ট তারিখ', 'Ship Date')}: ${style.shipDate}` : '—'}
        />
      </div>

      {/* Report Tables */}
      {sections.map((s) => (
        <div key={s.heading} className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
            <h2 className="font-display text-base font-semibold text-ink">{s.heading}</h2>
            <span className="text-xs text-ink-soft font-mono">
              {s.rows.length} {t('টি রেকর্ড', 'records')}
            </span>
          </div>
          {s.rows.length === 0 ? (
            <EmptyState title={s.emptyLabel || t('কোনো ডেটা নেই', 'No data')} />
          ) : (
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper/60 text-left text-xs font-semibold text-ink-soft">
                    {s.columns.map((c) => (
                      <th key={c.key} className="py-2.5 px-3 font-semibold">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {s.rows.map((r, i) => (
                    <tr key={i} className="hover:bg-paper/40 transition-colors">
                      {s.columns.map((c) => (
                        <td key={c.key} className="py-2.5 px-3 text-ink">
                          {c.render ? c.render(r) : r[c.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
