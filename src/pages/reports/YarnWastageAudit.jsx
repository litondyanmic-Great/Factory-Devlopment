import { useState, useMemo } from 'react';
import {
  TrendingDown,
  TrendingUp,
  DollarSign,
  Scale,
  AlertTriangle,
  CheckCircle2,
  PieChart,
  Search,
  Filter,
} from 'lucide-react';
import { useLang } from '../../lib/i18n';
import { Field, inputClass, btnPrimary, btnSecondary, StatCard, Pill, ProgressBar } from '../../components/ui';
import ExportBar from '../../components/ExportBar';

const DEMO_WASTAGE_AUDIT_DATA = [
  {
    id: 'wst-01',
    styleNo: 'HM-2026/SW-01',
    styleName: "Men's Crew Neck Pullover",
    buyer: 'H&M',
    orderQty: 4800,
    yarnName: '2/28 Nm 100% Acrylic Soft Yarn',
    contactWeight: 8.5, // lb per dozen
    yarnCostPerLb: 3.2, // USD per lb
    totalYarnReceived: 3820, // lb
    totalYarnConsumedKnitting: 3680,
    netGarmentWeightOutput: 3410, // actual weight in finished garments
    leftoverReturned: 140, // returned to leftover bank
    notes: 'Good efficiency on Shima Seiki machines',
  },
  {
    id: 'wst-02',
    styleNo: 'ZR-2026/CD-04',
    styleName: "Women's Cable Knit Cardigan",
    buyer: 'Zara',
    orderQty: 3200,
    yarnName: '2/32 Nm Wool Blend Yarn',
    contactWeight: 10.8, // lb per dozen
    yarnCostPerLb: 5.4, // USD per lb
    totalYarnReceived: 3250,
    totalYarnConsumedKnitting: 3180,
    netGarmentWeightOutput: 2880,
    leftoverReturned: 70,
    notes: 'Cable knit pattern yarn tension breakage caused extra wastage',
  },
  {
    id: 'wst-03',
    styleNo: 'NX-2026/HD-09',
    styleName: 'Jacquard Heavy Knit Hoodie',
    buyer: 'Next UK',
    orderQty: 2500,
    yarnName: '100% Cotton Melange 20/2',
    contactWeight: 14.2, // lb per dozen
    yarnCostPerLb: 4.1, // USD per lb
    totalYarnReceived: 3300,
    totalYarnConsumedKnitting: 3250,
    netGarmentWeightOutput: 2950,
    leftoverReturned: 50,
    notes: 'Jacquard color float trimming loss within tolerance',
  },
  {
    id: 'wst-04',
    styleNo: 'MKS-2026/VT-12',
    styleName: "V-Neck Fine Gauge Sleeveless Vest",
    buyer: 'M&S',
    orderQty: 5000,
    yarnName: '100% Combed Cotton 2/30',
    contactWeight: 5.2, // lb per dozen
    yarnCostPerLb: 3.8, // USD per lb
    totalYarnReceived: 2350,
    totalYarnConsumedKnitting: 2310,
    netGarmentWeightOutput: 2160,
    leftoverReturned: 40,
    notes: 'Minimal linking wastage, very efficient',
  },
];

export default function YarnWastageAudit() {
  const { t, lang } = useLang();
  const [data, setData] = useState(DEMO_WASTAGE_AUDIT_DATA);
  const [search, setSearch] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('all');

  // Computed reconciliation numbers
  const reconciledRows = useMemo(() => {
    return data.map((item) => {
      // Standard required yarn: (Order / 12) * Contact weight
      const stdRequired = (Number(item.orderQty) / 12) * Number(item.contactWeight);
      const allowedBuffer = stdRequired * 1.1; // +10%

      // Actual Waste = Consumed in knitting - Finished garment net weight
      const actualWastedLb = Math.max(0, item.totalYarnConsumedKnitting - item.netGarmentWeightOutput);
      const wastagePct = item.totalYarnConsumedKnitting > 0 ? (actualWastedLb / item.totalYarnConsumedKnitting) * 100 : 0;

      // Variance vs Standard + 10%
      const totalIssuedAgainstBudget = item.totalYarnReceived - item.leftoverReturned;
      const budgetVarianceLb = totalIssuedAgainstBudget - allowedBuffer;

      // Financial cost of wastage
      const wastageCost = actualWastedLb * Number(item.yarnCostPerLb);
      const varianceCost = budgetVarianceLb * Number(item.yarnCostPerLb);

      const isOverBudget = budgetVarianceLb > 0.1;
      const isHighWastage = wastagePct > 8.5; // >8.5% is high in sweaters

      return {
        ...item,
        stdRequired,
        allowedBuffer,
        actualWastedLb,
        wastagePct,
        budgetVarianceLb,
        wastageCost,
        varianceCost,
        isOverBudget,
        isHighWastage,
      };
    });
  }, [data]);

  const filteredRows = useMemo(() => {
    return reconciledRows.filter((r) => {
      const matchSearch =
        r.styleNo.toLowerCase().includes(search.toLowerCase()) ||
        r.styleName.toLowerCase().includes(search.toLowerCase()) ||
        r.yarnName.toLowerCase().includes(search.toLowerCase()) ||
        r.buyer.toLowerCase().includes(search.toLowerCase());

      const matchBuyer = buyerFilter === 'all' || r.buyer === buyerFilter;
      return matchSearch && matchBuyer;
    });
  }, [reconciledRows, search, buyerFilter]);

  // Overall Factory Totals
  const totals = useMemo(() => {
    let totalConsumed = 0;
    let totalOutput = 0;
    let totalWasted = 0;
    let totalWastageCost = 0;
    let totalVarianceCost = 0;

    filteredRows.forEach((r) => {
      totalConsumed += r.totalYarnConsumedKnitting;
      totalOutput += r.netGarmentWeightOutput;
      totalWasted += r.actualWastedLb;
      totalWastageCost += r.wastageCost;
      totalVarianceCost += r.varianceCost;
    });

    const avgWastagePct = totalConsumed > 0 ? (totalWasted / totalConsumed) * 100 : 0;

    return {
      totalConsumed,
      totalOutput,
      totalWasted,
      avgWastagePct,
      totalWastageCost,
      totalVarianceCost,
    };
  }, [filteredRows]);

  const buyers = useMemo(() => {
    return Array.from(new Set(data.map((d) => d.buyer)));
  }, [data]);

  const exportColumns = [
    { key: 'styleNo', label: t('স্টাইল নং', 'Style No.') },
    { key: 'buyer', label: t('বায়ার', 'Buyer') },
    { key: 'yarnName', label: t('ইয়ার্ন বিবরণ', 'Yarn Name') },
    { key: 'totalYarnConsumedKnitting', label: t('মোট খরচ (lb)', 'Consumed (lb)') },
    { key: 'netGarmentWeightOutput', label: t('সোয়েটার ওজন (lb)', 'Garment Wt (lb)') },
    { key: 'actualWastedLb', label: t('অপচয় (lb)', 'Wastage (lb)') },
    { key: 'wastagePct', label: t('অপচয় %', 'Wastage %'), render: (r) => `${r.wastagePct.toFixed(2)}%` },
    { key: 'wastageCost', label: t('অপচয়ের খরচ ($)', 'Wastage Cost ($)'), render: (r) => `$${r.wastageCost.toFixed(2)}` },
    { key: 'budgetVarianceLb', label: t('বাফার ভ্যারিয়েন্স (lb)', 'Buffer Variance (lb)'), render: (r) => `${r.budgetVarianceLb.toFixed(1)} lb` },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink flex items-center gap-2">
            <Scale className="text-amber" size={26} />
            {t('ইয়ার্ন অপচয় বিশ্লেষণ ও কস্টিং অডিট', 'Yarn Wastage Analysis & Costing Audit')}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {t(
              'বরাদ্দকৃত ইয়ার্ন বনাম তৈরি হওয়া সোয়েটারের প্রকৃত ওজনের সমন্বয় — অপচয় হার ও আর্থিক ক্ষতি/সাশ্রয় হিসাব।',
              'Reconcile allocated yarn against finished garment weight to audit wastage rates and financial variances.'
            )}
          </p>
        </div>

        <ExportBar
          title={t('ইয়ার্ন অপচয় ও কস্টিং অডিট রিপোর্ট', 'Yarn Wastage & Costing Audit Report')}
          filename="yarn-wastage-costing-audit"
          columns={exportColumns}
          rows={filteredRows}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t('মোট অপচয়কৃত ইয়ার্ন', 'Total Wasted Yarn')}
          value={`${totals.totalWasted.toFixed(1)} lb`}
          sub={t('কাটিং, নিটিং ও ট্রিমিং লস', 'Knitting & trimming loss')}
        />
        <StatCard
          label={t('গড় অপচয় হার (%)', 'Average Wastage %')}
          value={`${totals.avgWastagePct.toFixed(2)}%`}
          tone={totals.avgWastagePct > 8.5 ? 'red' : 'green'}
          sub={t('স্ট্যান্ডার্ড সীমা: ৫ - ৮%', 'Tolerance range: 5 - 8%')}
        />
        <StatCard
          label={t('অপচয়ের মোট মূল্য', 'Wastage Material Cost')}
          value={`$${totals.totalWastageCost.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`}
          tone="amber"
          sub={t('অপচয়কৃত সুতার আর্থিক মূল্য', 'Financial loss on wastage')}
        />
        <StatCard
          label={t('বাফার বাজেট সাশ্রয় / লস', 'Budget Variance Impact')}
          value={totals.totalVarianceCost <= 0 ? `-$${Math.abs(totals.totalVarianceCost).toFixed(1)}` : `+$${totals.totalVarianceCost.toFixed(1)}`}
          tone={totals.totalVarianceCost <= 0 ? 'green' : 'red'}
          sub={totals.totalVarianceCost <= 0 ? t('বাজেটের মধ্যে সম্পন্ন (সাশ্রয়)', 'Within +10% budget (Saved)') : t('বাজেট অতিরিক্ত খরচ', 'Over allowed budget')}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center gap-2">
          <select
            className={`${inputClass} !py-1.5 !text-xs !w-auto`}
            value={buyerFilter}
            onChange={(e) => setBuyerFilter(e.target.value)}
          >
            <option value="all">{t('সব বায়ার', 'All Buyers')}</option>
            {buyers.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            type="text"
            placeholder={t('স্টাইল বা ইয়ার্ন সার্চ…', 'Search style or yarn…')}
            className={`${inputClass} !pl-8 !py-1.5 text-xs`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-lg border border-line bg-surface p-5">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium text-ink-soft">
                <th className="py-2.5 pr-3">{t('স্টাইল ও বায়ার', 'Style & Buyer')}</th>
                <th className="py-2.5 pr-3">{t('ইয়ার্ন বিবরণ', 'Yarn Name')}</th>
                <th className="py-2.5 pr-3 text-right">{t('কনজাম্পশন (lb)', 'Consumed')}</th>
                <th className="py-2.5 pr-3 text-right">{t('সোয়েটার ওজন (lb)', 'Garment Wt')}</th>
                <th className="py-2.5 pr-3 text-right">{t('অপচয় (lb)', 'Wastage')}</th>
                <th className="py-2.5 pr-3 text-right">{t('অপচয় হার (%)', 'Wastage %')}</th>
                <th className="py-2.5 pr-3 text-right">{t('অপচয় মূল্য ($)', 'Cost ($)')}</th>
                <th className="py-2.5 pr-3 text-center">{t('বাজেট স্ট্যাটাস', 'Budget Status')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-paper/50">
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-ink">{r.styleNo}</p>
                    <p className="text-[11px] text-ink-soft">{r.styleName} • {r.buyer}</p>
                  </td>
                  <td className="py-3 pr-3 text-xs text-ink">
                    <p>{r.yarnName}</p>
                    <p className="text-[11px] text-ink-soft">
                      ${r.yarnCostPerLb}/lb • Std: {r.contactWeight} lb/dz
                    </p>
                  </td>
                  <td className="py-3 pr-3 text-right font-medium text-ink">
                    {r.totalYarnConsumedKnitting.toFixed(1)}
                  </td>
                  <td className="py-3 pr-3 text-right text-ink">
                    {r.netGarmentWeightOutput.toFixed(1)}
                  </td>
                  <td className="py-3 pr-3 text-right font-bold text-amber">
                    {r.actualWastedLb.toFixed(1)} lb
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <span
                      className={`inline-block font-bold text-xs px-2 py-0.5 rounded ${
                        r.isHighWastage
                          ? 'bg-red-soft text-red'
                          : 'bg-green-soft text-green'
                      }`}
                    >
                      {r.wastagePct.toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-right font-medium text-ink">
                    ${r.wastageCost.toFixed(1)}
                  </td>
                  <td className="py-3 pr-3 text-center">
                    {r.isOverBudget ? (
                      <Pill tone="red">
                        <AlertTriangle size={12} className="inline mr-1" />
                        +{r.budgetVarianceLb.toFixed(1)} lb {t('ওভার বাজেট', 'Over')}
                      </Pill>
                    ) : (
                      <Pill tone="green">
                        <CheckCircle2 size={12} className="inline mr-1" />
                        {t('বাজেটে নিয়ন্ত্রিত', 'Under Budget')}
                      </Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
