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
import { useLang } from '../../lib/i18n';
import { useSettings } from '../../lib/settingsContext';
import { STAGES, stageLabel } from '../../lib/constants';

export default function LiveFloorBoard() {
  const { t, lang } = useLang();
  const { settings } = useSettings();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [countdown, setCountdown] = useState(30);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const companyName = lang === 'en' ? settings?.companyNameEn || settings?.companyName : settings?.companyName;

  // Live Clock & Auto-refresh tick
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      if (autoRefresh) {
        setCountdown((c) => {
          if (c <= 1) {
            // trigger auto-refresh simulation
            return 30;
          }
          return c - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }

  // Simulated live production output data
  const floorData = useMemo(() => {
    return {
      dailyTarget: 3600,
      currentCompleted: 2480,
      hourlyRunRate: 310,
      overallEfficiency: 86.4,
      qualityPassRate: 97.2,
      activeStyles: [
        {
          styleNo: 'HM-2026/SW-01',
          name: "Men's Crew Neck Pullover",
          buyer: 'H&M',
          orderQty: 4800,
          todayTarget: 1400,
          todayProduced: 1120,
          currentBottleneck: 'Linking',
        },
        {
          styleNo: 'ZR-2026/CD-04',
          name: "Women's Cable Knit Cardigan",
          buyer: 'Zara',
          orderQty: 3200,
          todayTarget: 1100,
          todayProduced: 840,
          currentBottleneck: 'None',
        },
        {
          styleNo: 'NX-2026/HD-09',
          name: 'Jacquard Heavy Knit Hoodie',
          buyer: 'Next UK',
          orderQty: 2500,
          todayTarget: 1100,
          todayProduced: 520,
          currentBottleneck: 'Mending',
        },
      ],
      stageOutput: [
        { stage: 'knitting', label: 'নিটিং (Knitting)', target: 3600, actual: 3150, eff: 87.5 },
        { stage: 'linking', label: 'লিংকিং (Linking)', target: 3200, actual: 2680, eff: 83.7 },
        { stage: 'trimming', label: 'ট্রিমিং (Trimming)', target: 3000, actual: 2790, eff: 93.0 },
        { stage: 'mending', label: 'মেন্ডিং (Mending)', target: 2800, actual: 2420, eff: 86.4 },
        { stage: 'sewing', label: 'সুইং (Sewing)', target: 2700, actual: 2550, eff: 94.4 },
        { stage: 'wash', label: 'ওয়াশ (Washing)', target: 2600, actual: 2450, eff: 94.2 },
        { stage: 'iron', label: 'আয়রন (Ironing)', target: 2500, actual: 2310, eff: 92.4 },
        { stage: 'packing', label: 'প্যাকিং (Packing)', target: 2400, actual: 2190, eff: 91.2 },
      ],
    };
  }, []);

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
              {companyName || 'Factory ERP'} — {t('লাইভ ফ্লোর ড্যাশবোর্ড', 'Live Floor Monitor')}
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
            </h1>
            <p className="text-xs text-slate-400">
              {t('প্রোডাকশন ফ্লোর লাইভ মনিটরিং ডিসপ্লে • শিফট-এ (Shift A)', 'Floor TV Kiosk Mode • Shift A (Day Shift)')}
            </p>
          </div>
        </div>

        {/* Live Clock & Fullscreen Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-800 px-4 py-2 font-mono text-base font-bold text-amber-400">
            <Clock size={18} />
            <span>{currentTime.toLocaleTimeString()}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>
              {t('রিফ্রেশ:', 'Refresh in:')} <strong className="text-white">{countdown}s</strong>
            </span>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white"
              title={t('ফুলস্ক্রিন', 'Toggle Fullscreen')}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Top 4 Giant Floor KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Daily Target Progress */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t('দৈনিক মোট আউটপুট টার্গেট', 'Daily Target Progress')}
          </p>
          <div className="flex items-baseline justify-between">
            <span className="font-display text-4xl font-extrabold text-white">
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
            <span className="font-display text-4xl font-extrabold text-emerald-400">
              {floorData.hourlyRunRate}
            </span>
            <span className="text-sm font-medium text-slate-400">pcs / hour</span>
          </div>
          <p className="text-xs text-emerald-400/80 flex items-center gap-1 pt-1">
            <TrendingUp size={14} /> +8.4% {t('গত ঘণ্টার চেয়ে বৃদ্ধি', 'above plan pace')}
          </p>
        </div>

        {/* Live Efficiency */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t('সামগ্রিক ফ্যাক্টরি এফিশিয়েন্সি', 'Overall Efficiency')}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-extrabold text-sky-400">
              {floorData.overallEfficiency}%
            </span>
            <span className="text-xs font-medium text-slate-400">(SMV Benchmark)</span>
          </div>
          <p className="text-xs text-sky-400/80 flex items-center gap-1 pt-1">
            <Activity size={14} /> {t('লক্ষ্যমাত্রা: ৮৫%', 'Target: 85%')}
          </p>
        </div>

        {/* Quality Score */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t('কোয়ালিটি পাস রেট (Traffic Light)', 'Quality Pass Rate')}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-extrabold text-emerald-400">
              {floorData.qualityPassRate}%
            </span>
            <span className="flex h-3 w-3 rounded-full bg-emerald-400 shadow-lg shadow-emerald-500/50" />
          </div>
          <p className="text-xs text-emerald-400/80 flex items-center gap-1 pt-1">
            <CheckCircle2 size={14} /> {t('গ্রিন জোন (>৯৫% পাস)', 'Green Zone (>95% Pass)')}
          </p>
        </div>
      </div>

      {/* Bottleneck Alert Ribbon */}
      <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-300 text-sm font-medium">
        <AlertTriangle size={20} className="shrink-0 text-amber-400 animate-pulse" />
        <span>
          <strong>{t('ফ্লোর নোটিশ:', 'Floor Alert:')}</strong>{' '}
          {t(
            'লিংকিং সেকশনে আজকের টার্গেটের তুলনায় সাময়িক ধীরগতি দেখা গেছে (৮৩.৭%)। লাইন ৪ ও ৫-এ অতিরিক্ত অপারেটর সমন্বয় করা হচ্ছে।',
            'Linking section pace is slightly behind target (83.7%). Operator re-balancing underway on Lines 4 & 5.'
          )}
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
                  className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-2 hover:border-slate-700"
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
          <div className="border-b border-slate-800 pb-3">
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Gauge size={20} className="text-sky-400" />
              {t('চলমান অর্ডার স্ট্যাটাস', 'Active Running Styles')}
            </h2>
          </div>

          <div className="space-y-3">
            {floorData.activeStyles.map((st) => {
              const pct = Math.round((st.todayProduced / st.todayTarget) * 100);

              return (
                <div
                  key={st.styleNo}
                  className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-xs font-bold text-sky-400">{st.styleNo}</span>
                      <p className="text-sm font-semibold text-white leading-tight mt-0.5">{st.name}</p>
                      <p className="text-xs text-slate-400">{t('বায়ার', 'Buyer')}: {st.buyer}</p>
                    </div>
                    <span className="text-xs font-bold text-amber-400 font-mono">
                      {st.todayProduced} / {st.todayTarget} pcs
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>{t('আজকের লক্ষ্যমাত্রা অর্জন', "Today's Target")}</span>
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
