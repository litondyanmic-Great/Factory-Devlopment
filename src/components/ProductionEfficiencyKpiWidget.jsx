import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  Clock,
  Target,
  Zap,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { useLang } from '../lib/i18n';
import { STAGES, stageLabel } from '../lib/constants';

const SHIFT_HOURS = [
  { hour: 8, label: '08:00 - 09:00' },
  { hour: 9, label: '09:00 - 10:00' },
  { hour: 10, label: '10:00 - 11:00' },
  { hour: 11, label: '11:00 - 12:00' },
  { hour: 12, label: '12:00 - 13:00' },
  { hour: 13, label: '13:00 - 14:00' }, // Lunch / Shift overlap
  { hour: 14, label: '14:00 - 15:00' },
  { hour: 15, label: '15:00 - 16:00' },
  { hour: 16, label: '16:00 - 17:00' },
  { hour: 17, label: '17:00 - 18:00' },
  { hour: 18, label: '18:00 - 19:00' },
  { hour: 19, label: '19:00 - 20:00' },
];

export default function ProductionEfficiencyKpiWidget({
  entries = [],
  styles = [],
  selectedDate,
}) {
  const { t, lang } = useLang();
  const [selectedStage, setSelectedStage] = useState('all');
  const [chartView, setChartView] = useState('hourly'); // 'hourly' | 'cumulative' | 'efficiency'
  const [filterDate, setFilterDate] = useState(() => {
    return selectedDate || new Date().toISOString().slice(0, 10);
  });

  // Collect recent distinct dates that have production entries
  const availableDates = useMemo(() => {
    const dates = new Set();
    (entries || []).forEach((e) => {
      if (e.date) dates.add(e.date);
    });
    return Array.from(dates).sort().reverse().slice(0, 5);
  }, [entries]);

  // Calculate Hourly Output vs Target dataset
  const { chartData, kpis } = useMemo(() => {
    const targetDate = filterDate || new Date().toISOString().slice(0, 10);

    // Filter entries for target date and stage
    const dayEntries = (entries || []).filter((e) => {
      const matchDate = e.date === targetDate;
      const matchStage = selectedStage === 'all' || e.stage === selectedStage;
      return matchDate && matchStage;
    });

    // Determine hourly base target from styles in production
    const totalOrderQty = (styles || []).reduce((sum, s) => sum + Number(s.orderQty || 0), 0);
    // Standard factory hourly target per stage: ~350 pcs overall, or proportional
    const baseHourlyTarget = Math.max(
      150,
      Math.round(totalOrderQty > 0 ? Math.min(450, totalOrderQty / 40) : 320)
    );
    const hourlyTarget = selectedStage === 'all' ? baseHourlyTarget : Math.round(baseHourlyTarget / 2);

    // Group entries into shift hours
    const hourBuckets = {};
    SHIFT_HOURS.forEach((h) => {
      hourBuckets[h.hour] = 0;
    });

    dayEntries.forEach((entry) => {
      const qty = Number(entry.quantity || 0);
      let entryHour = 10; // Default mid-morning if timestamp missing
      if (entry.createdAt) {
        try {
          const d = entry.createdAt.toDate ? entry.createdAt.toDate() : new Date(entry.createdAt);
          entryHour = d.getHours();
        } catch {
          entryHour = 10;
        }
      } else if (entry.time) {
        const parts = entry.time.split(':');
        if (parts.length > 0 && !isNaN(parseInt(parts[0], 10))) {
          entryHour = parseInt(parts[0], 10);
        }
      }

      // Constrain within shift or map to closest shift hour
      const clampedHour = Math.max(8, Math.min(19, entryHour));
      hourBuckets[clampedHour] = (hourBuckets[clampedHour] || 0) + qty;
    });

    let cumulativeActual = 0;
    let cumulativeTarget = 0;
    let peakOutput = 0;
    let peakHourLabel = '—';

    const currentHour = new Date().getHours();
    const isToday = targetDate === new Date().toISOString().slice(0, 10);

    const data = SHIFT_HOURS.map((sh) => {
      const actual = hourBuckets[sh.hour] || 0;
      cumulativeActual += actual;
      cumulativeTarget += hourlyTarget;

      if (actual > peakOutput) {
        peakOutput = actual;
        peakHourLabel = sh.label;
      }

      const efficiency = hourlyTarget > 0 ? Math.round((actual / hourlyTarget) * 100) : 0;
      const isPastOrCurrent = !isToday || sh.hour <= currentHour;

      return {
        hour: sh.hour,
        timeLabel: sh.label.split(' - ')[0], // short '08:00', '09:00'
        fullLabel: sh.label,
        actual: isPastOrCurrent ? actual : 0,
        target: hourlyTarget,
        cumulativeActual,
        cumulativeTarget,
        efficiency: isPastOrCurrent ? efficiency : null,
      };
    });

    const totalActual = data.reduce((sum, d) => sum + d.actual, 0);
    // Active working hours so far
    const elapsedShiftHours = isToday
      ? Math.max(1, Math.min(12, currentHour - 7))
      : 12;
    const activeTarget = hourlyTarget * elapsedShiftHours;
    const overallEfficiency = activeTarget > 0 ? Math.min(150, Math.round((totalActual / activeTarget) * 100)) : 0;
    const variance = totalActual - activeTarget;

    return {
      chartData: data,
      kpis: {
        totalActual,
        activeTarget,
        overallEfficiency,
        variance,
        peakOutput,
        peakHourLabel,
        hourlyTarget,
      },
    };
  }, [entries, styles, filterDate, selectedStage]);

  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-5">
      {/* Header and Filter Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div>
          <h2 className="font-display text-base font-semibold text-ink flex items-center gap-2">
            <Zap size={18} className="text-amber" />
            {t('উৎপাদন দক্ষতা ও ঘণ্টাভিত্তিক আউটপুট KPI', 'Production Efficiency KPI (Hourly vs Target)')}
          </h2>
          <p className="text-xs text-ink-soft mt-0.5">
            {t(
              'টার্গেটের বিপরীতে প্রতি ঘণ্টার লাইভ উৎপাদন গতি ও শিফট এফিশিয়েন্সি বিশ্লেষণ।',
              'Realtime hourly output monitoring against targets and floor efficiency run-rate.'
            )}
          </p>
        </div>

        {/* Filter selectors */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Stage Selector */}
          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 py-1.5">
            <Layers size={14} className="text-ink-soft shrink-0" />
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="bg-transparent text-xs font-medium text-ink focus:outline-none cursor-pointer"
            >
              <option value="all">{t('সকল সেকশন (All Floor)', 'All Floor Stages')}</option>
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {stageLabel(s.key, lang)}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 py-1.5">
            <Calendar size={14} className="text-ink-soft shrink-0" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-transparent text-xs font-medium text-ink focus:outline-none cursor-pointer"
            />
          </div>

          {filterDate !== new Date().toISOString().slice(0, 10) && (
            <button
              type="button"
              onClick={() => setFilterDate(new Date().toISOString().slice(0, 10))}
              className="rounded bg-indigo-soft px-2 py-1 text-[11px] font-semibold text-indigo hover:bg-indigo hover:text-white transition"
            >
              {t('আজকের দিন', 'Today')}
            </button>
          )}
        </div>
      </div>

      {/* 4 Key KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Actual Output */}
        <div className="rounded-lg border border-line bg-paper/60 p-3.5 space-y-1">
          <p className="text-[11px] font-medium text-ink-soft flex items-center justify-between">
            <span>{t('মোট আউটপুট (Actual)', 'Actual Output')}</span>
            <Target size={14} className="text-indigo" />
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-2xl font-bold text-ink">
              {kpis.totalActual.toLocaleString()}
            </span>
            <span className="text-xs text-ink-soft">/ {kpis.activeTarget.toLocaleString()} pcs</span>
          </div>
          <p className="text-[11px] text-ink-soft font-mono">
            {t('টার্গেট পেস:', 'Target Pace:')} {kpis.hourlyTarget} pcs/hr
          </p>
        </div>

        {/* Shift Efficiency */}
        <div className="rounded-lg border border-line bg-paper/60 p-3.5 space-y-1">
          <p className="text-[11px] font-medium text-ink-soft flex items-center justify-between">
            <span>{t('এফিশিয়েন্সি (Efficiency)', 'Shift Efficiency')}</span>
            <TrendingUp size={14} className={kpis.overallEfficiency >= 85 ? 'text-green' : 'text-amber'} />
          </p>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`font-display text-2xl font-bold ${
                kpis.overallEfficiency >= 85 ? 'text-green' : kpis.overallEfficiency >= 60 ? 'text-amber' : 'text-red'
              }`}
            >
              {kpis.overallEfficiency}%
            </span>
            <span className="text-xs text-ink-soft">({t('বেঞ্চমার্ক ৮৫%', '85% Target')})</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                kpis.overallEfficiency >= 85 ? 'bg-green' : kpis.overallEfficiency >= 60 ? 'bg-amber' : 'bg-red'
              }`}
              style={{ width: `${Math.min(100, kpis.overallEfficiency)}%` }}
            />
          </div>
        </div>

        {/* Variance (+/- pcs) */}
        <div className="rounded-lg border border-line bg-paper/60 p-3.5 space-y-1">
          <p className="text-[11px] font-medium text-ink-soft flex items-center justify-between">
            <span>{t('টার্গেট পার্থক্য (Variance)', 'Target Variance')}</span>
            {kpis.variance >= 0 ? (
              <CheckCircle2 size={14} className="text-green" />
            ) : (
              <AlertTriangle size={14} className="text-amber" />
            )}
          </p>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`font-display text-2xl font-bold font-mono ${
                kpis.variance >= 0 ? 'text-green' : 'text-amber'
              }`}
            >
              {kpis.variance > 0 ? `+${kpis.variance}` : kpis.variance}
            </span>
            <span className="text-xs text-ink-soft">pcs</span>
          </div>
          <p className="text-[11px] text-ink-soft">
            {kpis.variance >= 0 ? t('টার্গেটের উপরে রয়েছে', 'Ahead of target') : t('টার্গেটের চেয়ে কম', 'Behind pace')}
          </p>
        </div>

        {/* Peak Output Hour */}
        <div className="rounded-lg border border-line bg-paper/60 p-3.5 space-y-1">
          <p className="text-[11px] font-medium text-ink-soft flex items-center justify-between">
            <span>{t('সর্বোচ্চ ঘণ্টা (Peak Hour)', 'Peak Output Hour')}</span>
            <Clock size={14} className="text-sky-500" />
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-2xl font-bold text-ink">
              {kpis.peakOutput.toLocaleString()}
            </span>
            <span className="text-xs text-ink-soft">pcs</span>
          </div>
          <p className="text-[11px] text-sky-600 font-mono truncate">
            {kpis.peakHourLabel}
          </p>
        </div>
      </div>

      {/* Main Recharts Visualization with Multi-Mode Switcher */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex rounded-lg bg-paper p-1 border border-line">
            <button
              type="button"
              onClick={() => setChartView('hourly')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition cursor-pointer ${
                chartView === 'hourly'
                  ? 'bg-indigo text-white shadow-sm'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              {t('ঘণ্টাভিত্তিক আউটপুট', 'Hourly Output')}
            </button>
            <button
              type="button"
              onClick={() => setChartView('cumulative')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition cursor-pointer ${
                chartView === 'cumulative'
                  ? 'bg-indigo text-white shadow-sm'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              {t('ক্রমপুঞ্জিত অগ্রগতি', 'Cumulative Run')}
            </button>
            <button
              type="button"
              onClick={() => setChartView('efficiency')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition cursor-pointer ${
                chartView === 'efficiency'
                  ? 'bg-indigo text-white shadow-sm'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              {t('এফিশিয়েন্সি % ট্রেন্ড', 'Efficiency %')}
            </button>
          </div>

          <span className="font-mono text-[11px] text-ink-soft">
            {t('শিফট সময়: সকাল ৮:০০ - রাত ৮:০০ (১২ ঘণ্টা)', 'Shift: 08:00 - 20:00 (12 hrs)')}
          </span>
        </div>

        {kpis.totalActual === 0 && availableDates.length > 0 && availableDates[0] !== filterDate && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-soft/40 border border-amber/30 p-2.5 text-xs text-amber-800">
            <span className="font-semibold">{t('এই তারিখে এখনো এন্ট্রি নেই। পূর্ববর্তী তারিখের ডেটা দেখুন:', 'No entries on this date yet. View previous day:')}</span>
            {availableDates.map((dt) => (
              <button
                type="button"
                key={dt}
                onClick={() => setFilterDate(dt)}
                className="rounded bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo border border-indigo/20 hover:bg-indigo hover:text-white transition cursor-pointer"
              >
                {dt}
              </button>
            ))}
          </div>
        )}

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 15, right: 15, bottom: 5, left: -10 }}
            >
              <defs>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="cumulGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="effGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.2} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />

              <XAxis
                dataKey="timeLabel"
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => (chartView === 'efficiency' ? `${val}%` : `${val}`)}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0]?.payload;
                  if (!item) return null;

                  return (
                    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-xs space-y-1.5 font-sans">
                      <p className="font-bold text-slate-800 border-b pb-1">
                        ⏰ {item.fullLabel}
                      </p>
                      <div className="flex justify-between gap-4 text-indigo font-semibold">
                        <span>{t('ঘণ্টার উৎপাদন (Hourly):', 'Hourly Output:')}</span>
                        <span>{item.actual} pcs</span>
                      </div>
                      <div className="flex justify-between gap-4 text-amber font-semibold">
                        <span>{t('টার্গেট (Hourly Target):', 'Hourly Target:')}</span>
                        <span>{item.target} pcs</span>
                      </div>
                      <div className="flex justify-between gap-4 text-emerald-600 font-semibold border-t pt-1">
                        <span>{t('ক্রমপুঞ্জিত মোট (Cumulative):', 'Cumulative Total:')}</span>
                        <span>{item.cumulativeActual} / {item.cumulativeTarget} pcs</span>
                      </div>
                      {item.efficiency !== null && (
                        <div className="flex justify-between gap-4 border-t pt-1 font-bold">
                          <span>{t('এফিশিয়েন্সি:', 'Efficiency:')}</span>
                          <span
                            className={
                              item.efficiency >= 85
                                ? 'text-green'
                                : item.efficiency >= 60
                                ? 'text-amber'
                                : 'text-red'
                            }
                          >
                            {item.efficiency}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }}
              />

              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: 10, fontSize: 12 }}
                formatter={(val) => {
                  if (val === 'actual') return t('প্রকৃত উৎপাদন (Actual Pcs)', 'Actual Output (Pcs)');
                  if (val === 'target') return t('টার্গেট (Hourly Target)', 'Hourly Target (Pcs)');
                  if (val === 'cumulativeActual') return t('মোট সংগৃহীত উৎপাদন (Cumulative Actual)', 'Cumulative Output (Pcs)');
                  if (val === 'cumulativeTarget') return t('মোট সংগৃহীত লক্ষ্যমাত্রা (Cumulative Target)', 'Cumulative Target (Pcs)');
                  if (val === 'efficiency') return t('ঘণ্টাভিত্তিক এফিশিয়েন্সি %', 'Efficiency %');
                  return val;
                }}
              />

              {chartView === 'hourly' && (
                <>
                  <ReferenceLine
                    y={kpis.hourlyTarget}
                    stroke="#F59E0B"
                    strokeDasharray="4 4"
                    label={{
                      value: `${t('টার্গেট', 'Target')} ${kpis.hourlyTarget}`,
                      fill: '#D97706',
                      fontSize: 10,
                      position: 'top',
                    }}
                  />
                  <Bar
                    dataKey="actual"
                    name="actual"
                    fill="url(#actualGradient)"
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    name="target"
                    stroke="#F59E0B"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#F59E0B' }}
                    activeDot={{ r: 5 }}
                  />
                </>
              )}

              {chartView === 'cumulative' && (
                <>
                  <Area
                    type="monotone"
                    dataKey="cumulativeActual"
                    name="cumulativeActual"
                    stroke="#059669"
                    fill="url(#cumulGradient)"
                    strokeWidth={2.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativeTarget"
                    name="cumulativeTarget"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </>
              )}

              {chartView === 'efficiency' && (
                <>
                  <ReferenceLine
                    y={85}
                    stroke="#059669"
                    strokeDasharray="4 4"
                    label={{
                      value: `${t('বেঞ্চমার্ক ৮৫%', '85% Benchmark')}`,
                      fill: '#059669',
                      fontSize: 10,
                      position: 'top',
                    }}
                  />
                  <Bar
                    dataKey="efficiency"
                    name="efficiency"
                    fill="url(#effGradient)"
                    radius={[4, 4, 0, 0]}
                    barSize={22}
                  />
                  <Line
                    type="monotone"
                    dataKey="efficiency"
                    name="efficiency"
                    stroke="#0284C7"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#0284C7' }}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
