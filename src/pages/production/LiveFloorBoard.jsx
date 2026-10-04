import { useState, useEffect, useMemo } from 'react';
import {
  Monitor,
  Maximize,
  Minimize,
  RefreshCw,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Flame,
  Gauge,
  Factory,
} from 'lucide-react';
import { collection, collectionGroup, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLang } from '../../lib/i18n';
import { useSettings } from '../../lib/settingsContext';
import { STAGES, stageLabel } from '../../lib/constants';
import {
  getLocalStyles,
  getLocalProductionEntries,
  getLocalQualityChecks,
  getLocalIETargets,
} from '../../lib/demoData';

export default function LiveFloorBoard() {
  const { t, lang } = useLang();
  const { settings } = useSettings();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [countdown, setCountdown] = useState(30);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Live Database States
  const [styles, setStyles] = useState(getLocalStyles);
  const [entries, setEntries] = useState(getLocalProductionEntries);
  const [qualityChecks, setQualityChecks] = useState(getLocalQualityChecks);
  const [ieTargets, setIeTargets] = useState(getLocalIETargets);
  const [viewScope, setViewScope] = useState('today'); // 'today' or 'all'

  const companyName = lang === 'en' ? settings?.companyNameEn || settings?.companyName : settings?.companyName;

  // Helper to re-sync latest local entries
  function syncWithLocalCache() {
    const localStyles = getLocalStyles();
    const localEntries = getLocalProductionEntries();
    setStyles((prev) => {
      if (!prev || prev.length === 0) return localStyles;
      const remoteIds = new Set(prev.map((s) => s.id));
      const extras = localStyles.filter((s) => !remoteIds.has(s.id));
      return [...prev, ...extras];
    });
    setEntries((prev) => {
      if (!prev || prev.length === 0) return localEntries;
      const remoteIds = new Set(prev.map((e) => e.id));
      const extras = localEntries.filter((e) => !remoteIds.has(e.id));
      return [...prev, ...extras];
    });
  }

  // 1. Listen to Styles in Firestore
  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, 'styles'), (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (list.length > 0) {
          const localStyles = getLocalStyles();
          const remoteIds = new Set(list.map((s) => s.id));
          const extras = localStyles.filter((s) => !remoteIds.has(s.id));
          setStyles([...list, ...extras]);
        } else {
          setStyles(getLocalStyles());
        }
      });
    } catch {
      setStyles(getLocalStyles());
    }
    return () => unsub();
  }, []);

  // 2. Listen to Production Entries across all styles in Firestore (Collection Group)
  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(
        query(collectionGroup(db, 'productionEntries')),
        (snap) => {
          const list = snap.docs.map((d) => ({
            ...d.data(),
            id: d.id,
            styleId: d.data().styleId || d.ref.parent?.parent?.id,
          }));
          const localEntries = getLocalProductionEntries();
          const remoteIds = new Set(list.map((e) => e.id));
          const extras = localEntries.filter((e) => !remoteIds.has(e.id));
          setEntries([...list, ...extras]);
        },
        (err) => {
          console.warn('CollectionGroup productionEntries notice:', err);
          setEntries(getLocalProductionEntries());
        }
      );
    } catch {
      setEntries(getLocalProductionEntries());
    }
    return () => unsub();
  }, []);

  // 3. Listen to Quality Checks in Firestore
  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, 'qualityChecks'), (snap) => {
        setQualityChecks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    } catch {
      setQualityChecks(getLocalQualityChecks());
    }
    return () => unsub();
  }, []);

  // 4. Listen to IE Targets in Firestore
  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, 'ieTargets'), (snap) => {
        setIeTargets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    } catch {
      setIeTargets(getLocalIETargets());
    }
    return () => unsub();
  }, []);

  // 5. Instant Event Listeners for local and cross-tab real-time updates
  useEffect(() => {
    function handleUpdate() {
      syncWithLocalCache();
    }
    window.addEventListener('factory_erp_data_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('factory_erp_data_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Live Clock & Auto-refresh tick
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      if (autoRefresh) {
        setCountdown((c) => {
          if (c <= 1) {
            syncWithLocalCache();
            return 30;
          }
          return c - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  function handleManualRefresh() {
    setCountdown(30);
    syncWithLocalCache();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }

  // Derive Real-time Floor Metrics fully connected to input data
  const floorData = useMemo(() => {
    const todayUtc = new Date().toISOString().slice(0, 10);
    const todayLocal = new Date().toLocaleDateString('en-CA');

    const isTodayEntry = (e) => {
      if (!e) return false;
      if (e.date === todayUtc || e.date === todayLocal) return true;
      if (e.createdAt) {
        try {
          const d = e.createdAt.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
          const iso = d.toISOString().slice(0, 10);
          return iso === todayUtc || iso === todayLocal;
        } catch {
          return false;
        }
      }
      return false;
    };

    const scopedEntries = viewScope === 'today'
      ? (entries || []).filter(isTodayEntry)
      : (entries || []);

    // Active styles in production
    const runningStyles = (styles || []).filter((s) => s.productionStarted || Number(s.orderQty || 0) > 0);
    const activeList = runningStyles.length > 0 ? runningStyles : (styles || []).slice(0, 6);

    // Compute Style-by-Style live stats
    const activeStylesData = activeList.map((st) => {
      const stEntries = (entries || []).filter((e) => e.styleId === st.id || (st.styleNo && e.styleNo === st.styleNo));
      const stTodayEntries = stEntries.filter(isTodayEntry);

      const todayPcs = stTodayEntries.reduce((sum, e) => sum + Number(e.quantity || 0), 0);
      const totalFromEntries = stEntries.reduce((sum, e) => sum + Number(e.quantity || 0), 0);
      const totalFromStages = Object.values(st.stages || {}).reduce((sum, v) => sum + Number(v || 0), 0);
      const totalPcs = Math.max(totalFromEntries, totalFromStages);
      const producedPcs = viewScope === 'today' ? todayPcs : totalPcs;

      // Target: from IE target or orderQty
      const targetObj = (ieTargets || []).find((t) => t.styleId === st.id);
      const displayTarget = targetObj?.dailyTarget || Math.min(1800, Math.max(500, Math.round(Number(st.orderQty || 2000) / 4)));

      // Find real bottleneck stage: examine WIP buildup between stages
      let maxBacklog = 0;
      let bottleneckStage = 'None';
      const stageMap = { ...(st.stages || {}) };
      STAGES.forEach((s) => {
        if (typeof stageMap[s.key] !== 'number') stageMap[s.key] = 0;
      });
      stEntries.forEach((e) => {
        if (e.stage) stageMap[e.stage] = Math.max(stageMap[e.stage] || 0, (stageMap[e.stage] || 0) + Number(e.quantity || 0));
      });

      for (let i = 1; i < STAGES.length; i++) {
        const prevKey = STAGES[i - 1].key;
        const currKey = STAGES[i].key;
        const prevDone = stageMap[prevKey] || 0;
        const currDone = stageMap[currKey] || 0;
        const backlog = Math.max(0, prevDone - currDone);
        if (backlog > maxBacklog && backlog > 50) {
          maxBacklog = backlog;
          bottleneckStage = stageLabel(currKey, lang);
        }
      }

      return {
        id: st.id,
        styleNo: st.styleNo || '—',
        name: st.styleName || st.styleNo || 'Sweater',
        buyer: st.buyer || 'Export',
        orderQty: Number(st.orderQty || 0),
        todayProduced: producedPcs,
        todayActual: todayPcs,
        totalProduced: totalPcs,
        todayTarget: displayTarget,
        currentBottleneck: bottleneckStage,
      };
    });

    // Stage outputs across the entire floor
    const stageOutput = STAGES.map((s) => {
      const stageScoped = scopedEntries.filter((e) => e.stage === s.key);
      let stageActual = stageScoped.reduce((sum, e) => sum + Number(e.quantity || 0), 0);
      if (viewScope === 'all') {
        const stageFromStyles = activeStylesData.reduce((sum, st) => {
          const matchedStyle = (styles || []).find((s) => s.id === st.id);
          return sum + Number(matchedStyle?.stages?.[s.key] || 0);
        }, 0);
        stageActual = Math.max(stageActual, stageFromStyles);
      }

      const baselineTarget = activeStylesData.reduce((sum, st) => sum + Math.round(st.todayTarget / 2), 0) || 1000;
      const eff = baselineTarget > 0 ? Math.min(100, Math.round((stageActual / baselineTarget) * 100)) : 0;

      return {
        stage: s.key,
        label: stageLabel(s.key, lang),
        target: baselineTarget,
        actual: stageActual,
        eff,
      };
    });

    // Floor Totals
    const dailyTarget = activeStylesData.reduce((sum, st) => sum + st.todayTarget, 0) || 1000;
    const packingStage = stageOutput.find((s) => s.stage === 'packing');
    const currentCompleted = packingStage && packingStage.actual > 0
      ? packingStage.actual
      : activeStylesData.reduce((sum, st) => sum + st.todayProduced, 0);

    // Hourly Output Run-Rate
    const currentHour = new Date().getHours();
    const elapsedWorkingHours = Math.max(1, Math.min(9, currentHour - 8));
    const hourlyRunRate = Math.round(currentCompleted / elapsedWorkingHours);

    // Overall Factory Efficiency: average of active stages
    const activeStages = stageOutput.filter((s) => s.actual > 0);
    const overallEfficiency = activeStages.length > 0
      ? Number((activeStages.reduce((sum, s) => sum + s.eff, 0) / activeStages.length).toFixed(1))
      : (currentCompleted > 0 ? Math.min(100, Math.round((currentCompleted / dailyTarget) * 100)) : 0);

    // Quality Pass Rate from real Quality Checks
    let qualityPassRate = 100;
    if (qualityChecks && qualityChecks.length > 0) {
      let totalChecked = 0;
      let totalDefects = 0;
      qualityChecks.forEach((qc) => {
        totalChecked += Number(qc.checkedQty || qc.checked || 0);
        totalDefects += Number(qc.defectQty || qc.defects || 0);
      });
      if (totalChecked > 0) {
        qualityPassRate = Number((((totalChecked - totalDefects) / totalChecked) * 100).toFixed(1));
      }
    }

    // Floor Bottleneck Detection
    const laggingStages = stageOutput.filter((s) => s.actual > 0 && s.eff < 85);
    let floorAlert = null;
    if (laggingStages.length > 0) {
      const worst = laggingStages.sort((a, b) => a.eff - b.eff)[0];
      floorAlert = t(
        `${worst.label} সেকশনে আউটপুট পেস কিছুটা কম (${worst.eff}% লক্ষ্যমাত্রা অর্জিত)।`,
        `${worst.label} section output is slightly behind target (${worst.eff}% achieved).`
      );
    } else {
      floorAlert = t(
        'সকল সেকশনে উৎপাদন কার্যক্রম নির্ধারিত গতি ও মান অনুযায়ী সুষ্ঠুভাবে চলমান রয়েছে।',
        'All factory sections are running smoothly according to plan and quality benchmarks.'
      );
    }

    return {
      dailyTarget,
      currentCompleted,
      hourlyRunRate,
      overallEfficiency,
      qualityPassRate,
      activeStyles: activeStylesData,
      stageOutput,
      floorAlert,
    };
  }, [styles, entries, qualityChecks, ieTargets, lang, t, viewScope]);

  const progressPct = Math.min(100, Math.round((floorData.currentCompleted / floorData.dailyTarget) * 100));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 font-sans select-none">
      {/* Top TV Header Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-bold text-xl shadow-lg shadow-amber-500/20">
            <Factory size={28} />
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              {companyName || 'Factory ERP'} — {t('লাইভ ফ্লোর মনিটর (Live Floor Monitor)', 'Live Floor Monitor')}
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
            </h1>
            <p className="text-xs text-slate-400">
              {t('প্রোডাকশন ফ্লোর লাইভ মনিটরিং ডিসপ্লে • শিফট-এ (Shift A)', 'Floor TV Kiosk Mode • Shift A (Day Shift)')}
            </p>
          </div>
        </div>

        {/* Controls: Scope Switcher + Live Clock & Fullscreen */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Scope Switcher */}
          <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setViewScope('today')}
              className={`rounded-md px-3 py-1.5 font-semibold transition cursor-pointer ${
                viewScope === 'today'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t('আজকের শিফট', "Today's Shift")}
            </button>
            <button
              type="button"
              onClick={() => setViewScope('all')}
              className={`rounded-md px-3 py-1.5 font-semibold transition cursor-pointer ${
                viewScope === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t('সব সময়ের মোট', 'All-Time Total')}
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-1.5 font-mono text-sm font-bold text-amber-400">
            <Clock size={16} />
            <span>{currentTime.toLocaleTimeString()}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <button
              type="button"
              onClick={handleManualRefresh}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 text-xs text-slate-200 transition cursor-pointer border border-slate-700"
              title={t('এখনই রিফ্রেশ করুন', 'Refresh Now')}
            >
              <RefreshCw size={13} className={countdown === 30 ? 'animate-spin' : ''} />
              <span>{countdown}s</span>
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer border border-slate-700"
              title={t('ফুলস্ক্রিন', 'Toggle Fullscreen')}
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Top 4 Giant Floor KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Daily Target Progress */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t('দৈনিক মোট আউটপুট অগ্রগতি', 'Daily Output Progress')}
          </p>
          <div className="flex items-baseline justify-between">
            <span className="font-display text-3xl sm:text-4xl font-extrabold text-white">
              {floorData.currentCompleted.toLocaleString()}{' '}
              <span className="text-sm font-normal text-slate-400">/ {floorData.dailyTarget.toLocaleString()} pcs</span>
            </span>
            <span className="text-lg font-bold text-amber-400">{progressPct}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Hourly Output Rate */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t('প্রতি ঘণ্টার রান-রেট', 'Hourly Output Run-Rate')}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl sm:text-4xl font-extrabold text-emerald-400">
              {floorData.hourlyRunRate}
            </span>
            <span className="text-sm font-medium text-slate-400">pcs / hour</span>
          </div>
          <p className="text-xs text-emerald-400/80 flex items-center gap-1 pt-1 font-mono">
            <TrendingUp size={14} /> {t('ফ্লোর ক্যাপাসিটি পেস', 'Floor Capacity Pace')}
          </p>
        </div>

        {/* Live Efficiency */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t('সামগ্রিক ফ্যাক্টরি এফিশিয়েন্সি', 'Overall Efficiency')}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl sm:text-4xl font-extrabold text-sky-400">
              {floorData.overallEfficiency}%
            </span>
            <span className="text-xs font-medium text-slate-400">(SMV Benchmark)</span>
          </div>
          <p className="text-xs text-sky-400/80 flex items-center gap-1 pt-1 font-mono">
            <Activity size={14} /> {t('টার্গেট এফিশিয়েন্সি: ৮৫%', 'Target: 85%')}
          </p>
        </div>

        {/* Quality Score */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t('কোয়ালিটি পাস রেট (Traffic Light)', 'Quality Pass Rate')}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl sm:text-4xl font-extrabold text-emerald-400">
              {floorData.qualityPassRate}%
            </span>
            <span className="flex h-3 w-3 rounded-full bg-emerald-400 shadow-lg shadow-emerald-500/50" />
          </div>
          <p className="text-xs text-emerald-400/80 flex items-center gap-1 pt-1">
            <CheckCircle2 size={14} /> {floorData.qualityPassRate >= 95 ? t('গ্রিন জোন (>৯৫% পাস)', 'Green Zone (>95% Pass)') : t('পর্যবেক্ষণ জোন', 'Watch Zone')}
          </p>
        </div>
      </div>

      {/* Dynamic Bottleneck Alert Ribbon */}
      <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-300 text-sm font-medium">
        <AlertTriangle size={20} className="shrink-0 text-amber-400 animate-pulse" />
        <span>
          <strong>{t('ফ্লোর স্ট্যাটাস নোটিশ:', 'Floor Status Alert:')}</strong> {floorData.floorAlert}
        </span>
      </div>

      {/* Grid: Realtime Section Pipeline vs Active Style Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Realtime Stage Outputs (2 columns wide) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Flame size={20} className="text-amber-500" />
              {t('সেকশন-ভিত্তিক লাইভ আউটপুট ও এফিশিয়েন্সি', 'Realtime Pipeline Stage Output')}
            </h2>
            <span className="text-xs font-mono text-slate-400">{t('টার্গেট বনাম বাস্তবায়ন', 'Target vs Actual')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {floorData.stageOutput.map((stg) => {
              const pct = Math.min(100, Math.round((stg.actual / stg.target) * 100));
              const isLagging = stg.eff < 85;

              return (
                <div
                  key={stg.stage}
                  className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-2 hover:border-slate-700 transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm text-slate-200">{stg.label}</p>
                      <p className="text-xs font-mono text-slate-400">
                        {stg.actual.toLocaleString()} / {stg.target.toLocaleString()} pcs
                      </p>
                    </div>
                    <span
                      className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                        isLagging ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {stg.eff}% Eff.
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>{t('সম্পন্ন', 'Done')}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isLagging ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Styles Running Cards */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Gauge size={20} className="text-sky-400" />
              {t('চলমান অর্ডার স্ট্যাটাস', 'Active Running Styles')}
            </h2>
            <span className="text-xs font-mono text-slate-400">{floorData.activeStyles.length} {t('টি স্টাইল', 'styles')}</span>
          </div>

          <div className="space-y-3">
            {floorData.activeStyles.map((st) => {
              const pct = st.todayTarget > 0 ? Math.min(100, Math.round((st.todayProduced / st.todayTarget) * 100)) : 0;

              return (
                <div
                  key={st.id || st.styleNo}
                  className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-3 hover:border-slate-700 transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-xs font-bold text-sky-400">{st.styleNo}</span>
                      <p className="text-sm font-semibold text-white leading-tight mt-0.5">{st.name}</p>
                      <p className="text-xs text-slate-400">{t('বায়ার', 'Buyer')}: {st.buyer}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-amber-400 font-mono">
                        {st.todayProduced.toLocaleString()} / {st.todayTarget.toLocaleString()} pcs
                      </span>
                      {st.totalProduced > 0 && viewScope === 'today' && (
                        <p className="text-[10px] text-slate-400 font-mono">
                          {t('মোট:', 'Total:')} {st.totalProduced.toLocaleString()} pcs
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>{viewScope === 'today' ? t('আজকের লক্ষ্যমাত্রা অর্জন', "Today's Target") : t('মোট উৎপাদন অগ্রগতি', 'Total Output Progress')}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-sky-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {st.currentBottleneck !== 'None' ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                      <AlertTriangle size={12} />
                      {t('বোটলনেক স্টেজ:', 'Bottleneck Stage:')} <strong>{st.currentBottleneck}</strong>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                      <CheckCircle2 size={12} />
                      {t('স্মুথ ফ্লো চলছে', 'Running on plan')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
