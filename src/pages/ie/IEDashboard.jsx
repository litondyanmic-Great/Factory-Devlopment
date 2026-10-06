import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  Gauge,
  Trash2,
  Pencil,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Printer,
  Search,
  Filter,
  FileSpreadsheet,
  Calendar,
  X,
  RefreshCw,
  Layers,
  Award,
  BarChart3,
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../lib/settingsContext';
import { Field, inputClass, btnPrimary, btnSecondary, EmptyState, Modal, Pill } from '../../components/ui';
import ExportBar from '../../components/ExportBar';
import StyleSearchSelect from '../../components/StyleSearchSelect';
import { STAGES, can, hasAreaAdmin, stageLabel } from '../../lib/constants';
import { useLang } from '../../lib/i18n';
import {
  getLocalStyles,
  saveLocalStyles,
  getLocalIETargets,
  saveLocalIETargets,
  deleteLocalIETarget,
  getLocalIERecords,
  saveLocalIERecords,
  deleteLocalIERecord,
  updateLocalIERecord,
  getLocalProductionEntries,
} from '../../lib/demoData';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function efficiencyTone(pct) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return 'grey';
  if (pct >= 90) return 'green';
  if (pct >= 75) return 'amber';
  return 'red';
}

function achievementTone(pct) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return 'grey';
  if (pct >= 100) return 'green';
  if (pct >= 75) return 'amber';
  return 'red';
}

const TONE_CLASSES = {
  green: 'text-green bg-green-soft border border-green/20',
  amber: 'text-amber bg-amber-soft border border-amber/20',
  red: 'text-red bg-red-soft border border-red/20',
  grey: 'text-ink-soft bg-line/40 border border-line',
};

export default function IEDashboard() {
  const { user, profile } = useAuth();
  const { t, lang } = useLang();
  const { settings } = useSettings();

  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' | 'report' | 'entry'

  const [styles, setStyles] = useState(getLocalStyles);
  const [ieTargets, setIeTargets] = useState(getLocalIETargets);
  const [localEntries, setLocalEntries] = useState(getLocalProductionEntries);
  const [allRecords, setAllRecords] = useState(getLocalIERecords);

  const [styleId, setStyleId] = useState('');
  const [style, setStyle] = useState(null);
  const [records, setRecords] = useState(null);
  const [productionEntries, setProductionEntries] = useState([]);

  // Form for detailed IE calculation log
  const [form, setForm] = useState({
    date: today(),
    stage: 'knitting',
    smv: '',
    manpower: '',
    workingHours: '8',
    targetEfficiencyPct: '80',
    notes: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Modals state
  const [editingRecord, setEditingRecord] = useState(null);
  const [editingTargetStyle, setEditingTargetStyle] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Filters for Report Tab
  const [reportSearch, setReportSearch] = useState('');
  const [reportBuyerFilter, setReportBuyerFilter] = useState('all');
  const [reportStageFilter, setReportStageFilter] = useState('all');
  const [reportStatusFilter, setReportStatusFilter] = useState('all'); // 'all' | 'met' | 'track' | 'behind'
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');

  const companyName = lang === 'en' ? settings?.companyNameEn || settings?.companyName : settings?.companyName;
  const canEnter = can(profile?.role, 'ie:entry') || hasAreaAdmin(profile, 'production') || profile?.role === 'admin';

  // Listen to local storage & Firestore styles collection
  useEffect(() => {
    function handleUpdate() {
      setStyles(getLocalStyles());
      setIeTargets(getLocalIETargets());
      setLocalEntries(getLocalProductionEntries());
      setAllRecords(getLocalIERecords());
    }
    window.addEventListener('factory_erp_data_updated', handleUpdate);

    let unsub = () => {};
    try {
      unsub = onSnapshot(
        collection(db, 'styles'),
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            const seen = new Set();
            const unique = list.filter((s) => {
              if (!s.id || seen.has(s.id)) return false;
              seen.add(s.id);
              return true;
            });
            setStyles(unique);
            saveLocalStyles(unique);
          }
        },
        () => {}
      );
    } catch {}

    return () => {
      unsub();
      window.removeEventListener('factory_erp_data_updated', handleUpdate);
    };
  }, []);

  // Listen to selected style
  useEffect(() => {
    if (!styleId) {
      setStyle(null);
      setRecords(null);
      setProductionEntries([]);
      return;
    }
    const localSt = styles.find((s) => s.id === styleId);
    if (localSt) setStyle(localSt);

    const unsub = onSnapshot(doc(db, 'styles', styleId), (snap) => {
      if (snap.exists()) setStyle({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [styleId, styles]);

  // Listen to style records
  useEffect(() => {
    if (!styleId) return;
    const q = query(collection(db, 'styles', styleId, 'ieRecords'), orderBy('date', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } else {
          // fallback to local records for this style
          const localRecs = getLocalIERecords().filter((r) => r.styleId === styleId);
          setRecords(localRecs);
        }
      },
      () => {
        const localRecs = getLocalIERecords().filter((r) => r.styleId === styleId);
        setRecords(localRecs);
      }
    );
    return unsub;
  }, [styleId]);

  // Listen to style production entries
  useEffect(() => {
    if (!styleId) return;
    const q = query(collection(db, 'styles', styleId, 'productionEntries'), orderBy('date', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) setProductionEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => {}
    );
    return unsub;
  }, [styleId]);

  // Cross-style report — Firestore collectionGroup with fallback to local storage
  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(
        query(collectionGroup(db, 'ieRecords'), orderBy('date', 'desc')),
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setAllRecords(list);
            saveLocalIERecords(list);
          } else {
            setAllRecords(getLocalIERecords());
          }
        },
        () => {
          setAllRecords(getLocalIERecords());
        }
      );
    } catch {
      setAllRecords(getLocalIERecords());
    }
    return () => unsub();
  }, []);

  const buyers = useMemo(() => {
    const fromRecords = (allRecords || []).map((r) => r.buyer);
    const fromStyles = (styles || []).map((s) => s.buyer);
    const set = new Set([...fromRecords, ...fromStyles].filter(Boolean));
    return Array.from(set).sort();
  }, [allRecords, styles]);

  // Live actual-output suggestion for form's stage+date
  const suggestedActual = useMemo(() => {
    const fromFirestore = productionEntries
      .filter((e) => e.stage === form.stage && e.date === form.date)
      .reduce((sum, e) => sum + Number(e.quantity || 0), 0);

    if (fromFirestore > 0) return fromFirestore;

    // Fallback to local entries
    return localEntries
      .filter((e) => e.styleId === styleId && e.stage === form.stage && e.date === form.date)
      .reduce((sum, e) => sum + Number(e.quantity || 0), 0);
  }, [productionEntries, localEntries, styleId, form.stage, form.date]);

  const smv = Number(form.smv) || 0;
  const manpower = Number(form.manpower) || 0;
  const workingHours = Number(form.workingHours) || 0;
  const targetEfficiencyPct = Number(form.targetEfficiencyPct) || 0;
  const workingMinutes = manpower * workingHours * 60;
  const standardTargetQty = smv > 0 ? workingMinutes / smv : 0; // at 100% efficiency
  const targetQty = standardTargetQty * (targetEfficiencyPct / 100);
  const achievedEfficiencyPct = smv > 0 && workingMinutes > 0 ? (suggestedActual * smv * 100) / workingMinutes : null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!smv || !manpower || !workingHours) {
      setError(t('SMV, জনবল ও কর্মঘণ্টা দিন।', 'Enter SMV, manpower, and working hours.'));
      return;
    }
    setBusy(true);

    const newRecord = {
      id: `ie-${Date.now()}`,
      styleId,
      styleNo: style?.styleNo || '',
      styleName: style?.styleName || '',
      buyer: style?.buyer || '',
      date: form.date,
      stage: form.stage,
      smv,
      manpower,
      workingHours,
      targetEfficiencyPct,
      standardTargetQty: Number(standardTargetQty.toFixed(2)),
      targetQty: Number(targetQty.toFixed(2)),
      actualQty: suggestedActual,
      achievedEfficiencyPct: achievedEfficiencyPct === null ? null : Number(achievedEfficiencyPct.toFixed(1)),
      notes: form.notes || '',
      enteredBy: profile?.name || user?.email || 'IE Team',
      createdAt: new Date().toISOString(),
    };

    // Update local storage and UI immediately
    const updatedAll = [newRecord, ...(allRecords || [])];
    setAllRecords(updatedAll);
    saveLocalIERecords(updatedAll);
    setRecords((prev) => [newRecord, ...(prev || [])]);

    try {
      await addDoc(collection(db, 'styles', styleId, 'ieRecords'), {
        ...newRecord,
        createdAt: serverTimestamp(),
      });
      setForm((f) => ({ ...f, smv: '', manpower: '', notes: '' }));
    } catch (err) {
      console.warn('Firestore IE record notice:', err);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(rec) {
    const ok = window.confirm(t('এই IE রেকর্ড মুছে ফেলতে চান?', 'Delete this IE record?'));
    if (!ok) return;

    deleteLocalIERecord(rec.id);
    setRecords((prev) => (prev ? prev.filter((r) => r.id !== rec.id) : []));
    setAllRecords((prev) => prev.filter((r) => r.id !== rec.id));

    try {
      await deleteDoc(doc(db, 'styles', rec.styleId || styleId, 'ieRecords', rec.id));
    } catch (err) {
      console.warn('Delete IE notice:', err);
    }
  }

  // Handle saving direct style target
  async function handleSaveStyleTarget(stId, targetData) {
    const updatedStyles = styles.map((s) => (s.id === stId ? { ...s, ieTarget: targetData } : s));
    setStyles(updatedStyles);
    saveLocalStyles(updatedStyles);

    const existingTargets = getLocalIETargets();
    const updatedTargets = [
      { styleId: stId, ...targetData, updatedAt: new Date().toISOString() },
      ...existingTargets.filter((t) => t.styleId !== stId),
    ];
    saveLocalIETargets(updatedTargets);
    setIeTargets(updatedTargets);

    // Also auto-generate or update an IE record for today so the report immediately reflects it!
    const stObj = updatedStyles.find((s) => s.id === stId);
    if (stObj) {
      const todayStr = today();
      const existingTodayRec = (allRecords || []).find((r) => r.styleId === stId && r.date === todayStr && r.stage === targetData.stage);
      
      const todayOutput = localEntries
        .filter((e) => e.styleId === stId && e.stage === targetData.stage && e.date === todayStr)
        .reduce((sum, e) => sum + Number(e.quantity || 0), 0);

      const smvVal = Number(targetData.smv) || 8.5;
      const mpVal = Number(targetData.manpower) || 12;
      const whVal = Number(targetData.workingHours) || 8;
      const teVal = Number(targetData.targetEfficiency) || 80;
      const totalMins = mpVal * whVal * 60;
      const effPct = smvVal > 0 && totalMins > 0 ? (todayOutput * smvVal * 100) / totalMins : 0;

      if (!existingTodayRec) {
        const autoRec = {
          id: `ie-auto-${Date.now()}`,
          styleId: stId,
          styleNo: stObj.styleNo,
          styleName: stObj.styleName,
          buyer: stObj.buyer,
          date: todayStr,
          stage: targetData.stage,
          smv: smvVal,
          manpower: mpVal,
          workingHours: whVal,
          targetEfficiencyPct: teVal,
          standardTargetQty: Number(targetData.dailyTarget || 0),
          targetQty: Number(targetData.dailyTarget || 0),
          actualQty: todayOutput,
          achievedEfficiencyPct: Number(effPct.toFixed(1)),
          notes: targetData.notes || 'Target assigned by IE department',
          enteredBy: profile?.name || 'IE Team',
          createdAt: new Date().toISOString(),
        };
        const updatedAll = [autoRec, ...(allRecords || [])];
        setAllRecords(updatedAll);
        saveLocalIERecords(updatedAll);
      }
    }

    try {
      await updateDoc(doc(db, 'styles', stId), {
        ieTarget: targetData,
      });
    } catch (fbErr) {
      console.warn('Firestore update style target notice:', fbErr);
    }

    setEditingTargetStyle(null);
  }

  // Handle removing style target
  async function handleDeleteStyleTarget(stId) {
    const ok = window.confirm(t('এই স্টাইলের নির্ধারিত টার্গেট মুছে ফেলতে চান?', 'Delete this style target?'));
    if (!ok) return;

    const updatedStyles = styles.map((s) => {
      if (s.id === stId) {
        const copy = { ...s };
        delete copy.ieTarget;
        return copy;
      }
      return s;
    });
    setStyles(updatedStyles);
    saveLocalStyles(updatedStyles);

    deleteLocalIETarget(stId);
    setIeTargets(getLocalIETargets());

    try {
      await updateDoc(doc(db, 'styles', stId), {
        ieTarget: null,
      });
    } catch {}
  }

  // Style Target Matrix calculation
  const styleTargetMatrix = useMemo(() => {
    const todayStr = today();
    return styles.map((st) => {
      const targetConfig = st.ieTarget || ieTargets.find((t) => t.styleId === st.id) || null;
      const targetDaily = Number(targetConfig?.dailyTarget || 0);
      const targetStage = targetConfig?.stage || 'knitting';

      // Today's actual production for this style and stage
      const todayActual = localEntries
        .filter((e) => e.styleId === st.id && e.stage === targetStage && e.date === todayStr)
        .reduce((sum, e) => sum + Number(e.quantity || 0), 0);

      // Cumulative stage production
      const totalStageActual = Number(st.stages?.[targetStage] || 0);

      const achievementRate = targetDaily > 0 ? (todayActual / targetDaily) * 100 : null;
      const variance = targetDaily > 0 ? todayActual - targetDaily : 0;

      return {
        id: st.id,
        styleNo: st.styleNo,
        styleName: st.styleName,
        buyer: st.buyer,
        orderQty: Number(st.orderQty || 0),
        targetStage,
        targetDaily,
        hourlyTarget: Number(targetConfig?.hourlyTarget || 0),
        smv: targetConfig?.smv || '—',
        manpower: targetConfig?.manpower || 10,
        workingHours: targetConfig?.workingHours || 8,
        targetEfficiency: targetConfig?.targetEfficiency || 80,
        notes: targetConfig?.notes || '',
        todayActual,
        totalStageActual,
        achievementRate,
        variance,
        hasTarget: Boolean(targetDaily > 0),
      };
    });
  }, [styles, ieTargets, localEntries]);

  // Overall KPI Metrics for Factory Overview
  const factorySummary = useMemo(() => {
    const targetStyles = styleTargetMatrix.filter((s) => s.hasTarget);
    const totalDailyTarget = targetStyles.reduce((sum, s) => sum + s.targetDaily, 0);
    const totalTodayActual = targetStyles.reduce((sum, s) => sum + s.todayActual, 0);
    const totalVariance = totalTodayActual - totalDailyTarget;
    const overallAchievement = totalDailyTarget > 0 ? (totalTodayActual / totalDailyTarget) * 100 : 0;

    let metCount = 0;
    let onTrackCount = 0;
    let behindCount = 0;

    targetStyles.forEach((s) => {
      if (s.achievementRate >= 100) metCount++;
      else if (s.achievementRate >= 75) onTrackCount++;
      else behindCount++;
    });

    return {
      totalMonitoredStyles: targetStyles.length,
      totalDailyTarget,
      totalTodayActual,
      totalVariance,
      overallAchievement,
      metCount,
      onTrackCount,
      behindCount,
    };
  }, [styleTargetMatrix]);

  // Filtered Records for the Comprehensive Report Tab
  const filteredReportRecords = useMemo(() => {
    return (allRecords || []).filter((r) => {
      const matchSearch =
        !reportSearch ||
        r.styleNo?.toLowerCase().includes(reportSearch.toLowerCase()) ||
        r.styleName?.toLowerCase().includes(reportSearch.toLowerCase()) ||
        r.notes?.toLowerCase().includes(reportSearch.toLowerCase());

      const matchBuyer = reportBuyerFilter === 'all' || r.buyer === reportBuyerFilter;
      const matchStage = reportStageFilter === 'all' || r.stage === reportStageFilter;
      const matchFrom = !reportDateFrom || r.date >= reportDateFrom;
      const matchTo = !reportDateTo || r.date <= reportDateTo;

      const achPct = r.targetQty > 0 ? (r.actualQty / r.targetQty) * 100 : null;
      let matchStatus = true;
      if (reportStatusFilter === 'met') {
        matchStatus = achPct !== null && achPct >= 100;
      } else if (reportStatusFilter === 'track') {
        matchStatus = achPct !== null && achPct >= 75 && achPct < 100;
      } else if (reportStatusFilter === 'behind') {
        matchStatus = achPct === null || achPct < 75;
      }

      return matchSearch && matchBuyer && matchStage && matchFrom && matchTo && matchStatus;
    });
  }, [allRecords, reportSearch, reportBuyerFilter, reportStageFilter, reportDateFrom, reportDateTo, reportStatusFilter]);

  // Report Summary Statistics for the Filtered Results
  const reportTotals = useMemo(() => {
    let targetSum = 0;
    let actualSum = 0;
    let effSum = 0;
    let effCount = 0;

    filteredReportRecords.forEach((r) => {
      targetSum += Number(r.targetQty || 0);
      actualSum += Number(r.actualQty || 0);
      if (r.achievedEfficiencyPct !== null && r.achievedEfficiencyPct !== undefined && !Number.isNaN(Number(r.achievedEfficiencyPct))) {
        effSum += Number(r.achievedEfficiencyPct);
        effCount++;
      }
    });

    const varianceSum = actualSum - targetSum;
    const avgAchievement = targetSum > 0 ? (actualSum / targetSum) * 100 : 0;
    const avgEfficiency = effCount > 0 ? effSum / effCount : 0;

    return {
      targetSum,
      actualSum,
      varianceSum,
      avgAchievement,
      avgEfficiency,
      recordCount: filteredReportRecords.length,
    };
  }, [filteredReportRecords]);

  // Export Columns for the Report
  const reportExportColumns = [
    { key: 'date', label: t('তারিখ', 'Date') },
    { key: 'styleNo', label: t('স্টাইল নম্বর', 'Style No') },
    { key: 'buyer', label: t('বায়ার', 'Buyer') },
    { key: 'stage', label: t('স্টেজ', 'Stage'), render: (r) => stageLabel(r.stage, lang) },
    { key: 'targetQty', label: t('টার্গেট পিস', 'Target Pcs') },
    { key: 'actualQty', label: t('বাস্তব উৎপাদন', 'Actual Output') },
    {
      key: 'variance',
      label: t('ঘাটতি / উদ্বৃত্ত', 'Variance'),
      render: (r) => Number(r.actualQty || 0) - Number(r.targetQty || 0),
    },
    {
      key: 'achievementRate',
      label: t('টার্গেট অর্জন %', 'Achievement %'),
      render: (r) => (r.targetQty > 0 ? `${((r.actualQty / r.targetQty) * 100).toFixed(1)}%` : '—'),
    },
    { key: 'smv', label: 'SMV' },
    { key: 'manpower', label: t('জনবল', 'Manpower') },
    { key: 'workingHours', label: t('কর্মঘণ্টা', 'Hours') },
    {
      key: 'achievedEfficiencyPct',
      label: t('লাইন এফিসিয়েন্সি %', 'Line Efficiency %'),
      render: (r) => (r.achievedEfficiencyPct ? `${r.achievedEfficiencyPct}%` : '—'),
    },
    { key: 'notes', label: t('নোট / মন্তব্য', 'Remarks') },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink flex items-center gap-2">
            <Target className="text-indigo" size={26} />
            {t('IE — স্টাইল টার্গেট মনিটরিং ও পারফরম্যান্স রিপোর্ট', 'IE — Style Target Monitoring & Performance Report')}
          </h1>
          <p className="mt-1 text-xs text-ink-soft">
            {t(
              'প্রতিটি স্টাইলের জন্য নির্ধারিত দৈনিক/ঘণ্টাপ্রতি লক্ষ্যমাত্রা এবং ফ্লোরের বাস্তব উৎপাদন অর্জনের স্ট্যান্ডার্ড রিপোর্ট ও লাইভ ট্র্যাকিং।',
              'Set style targets and track standard daily/hourly production achievement vs IE expectations with official reporting.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-1.5 rounded-md bg-indigo px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-deep transition cursor-pointer"
          >
            <Printer size={15} />
            {t('অফিশিয়াল প্রিন্ট রিপোর্ট', 'Official Print Report')}
          </button>

          <ExportBar
            title={t('IE টার্গেট বনাম বাস্তব উৎপাদন রিপোর্ট', 'IE Target vs Actual Production Report')}
            filename={`ie-target-vs-actual-${today()}`}
            columns={reportExportColumns}
            rows={filteredReportRecords}
          />

          <button
            type="button"
            onClick={() => setEditingTargetStyle({})}
            className={`${btnPrimary} flex items-center gap-1.5 !text-xs !py-2`}
          >
            <Plus size={15} />
            {t('+ নতুন স্টাইল টার্গেট সেট করুন', '+ Set Style Target')}
          </button>
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-line bg-surface p-3.5 shadow-sm">
          <p className="text-[11px] font-medium text-ink-soft flex items-center gap-1">
            <Layers size={13} className="text-indigo" />
            {t('টার্গেট প্রাপ্ত স্টাইল', 'Targeted Styles')}
          </p>
          <p className="mt-1 font-display text-xl font-bold text-ink">
            {factorySummary.totalMonitoredStyles}{' '}
            <span className="text-xs font-normal text-ink-soft">{t('টি', 'styles')}</span>
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-3.5 shadow-sm">
          <p className="text-[11px] font-medium text-ink-soft flex items-center gap-1">
            <Target size={13} className="text-indigo" />
            {t('আজকের মোট টার্গেট', 'Today Total Target')}
          </p>
          <p className="mt-1 font-display text-xl font-bold text-indigo">
            {factorySummary.totalDailyTarget.toLocaleString()}{' '}
            <span className="text-xs font-normal text-ink-soft">pcs</span>
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-3.5 shadow-sm">
          <p className="text-[11px] font-medium text-ink-soft flex items-center gap-1">
            <TrendingUp size={13} className="text-green" />
            {t('আজকের বাস্তব উৎপাদন', 'Today Actual Output')}
          </p>
          <p className="mt-1 font-display text-xl font-bold text-ink">
            {factorySummary.totalTodayActual.toLocaleString()}{' '}
            <span className="text-xs font-normal text-ink-soft">pcs</span>
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-3.5 shadow-sm">
          <p className="text-[11px] font-medium text-ink-soft flex items-center gap-1">
            <Award size={13} className="text-amber" />
            {t('টার্গেট অর্জনের হার', 'Achievement Rate')}
          </p>
          <p
            className={`mt-1 font-display text-xl font-bold ${
              factorySummary.overallAchievement >= 100
                ? 'text-green'
                : factorySummary.overallAchievement >= 75
                ? 'text-amber'
                : 'text-red'
            }`}
          >
            {factorySummary.overallAchievement.toFixed(1)}%
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-3.5 shadow-sm">
          <p className="text-[11px] font-medium text-ink-soft">
            {t('ঘাটতি / উদ্বৃত্ত (Variance)', 'Variance (+/-)')}
          </p>
          <p
            className={`mt-1 font-display text-xl font-bold font-mono ${
              factorySummary.totalVariance >= 0 ? 'text-green' : 'text-red'
            }`}
          >
            {factorySummary.totalVariance > 0
              ? `+${factorySummary.totalVariance.toLocaleString()}`
              : factorySummary.totalVariance.toLocaleString()}{' '}
            <span className="text-xs font-normal text-ink-soft">pcs</span>
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-3.5 shadow-sm">
          <p className="text-[11px] font-medium text-ink-soft">
            {t('টার্গেট স্ট্যাটাস', 'Target Breakdown')}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-bold">
            <span className="text-green" title={t('লক্ষ্যমাত্রা পূর্ণ', 'Met')}>
              🟢 {factorySummary.metCount}
            </span>
            <span className="text-ink-soft">/</span>
            <span className="text-amber" title={t('চলমান', 'On Track')}>
              🟡 {factorySummary.onTrackCount}
            </span>
            <span className="text-ink-soft">/</span>
            <span className="text-red" title={t('টার্গেটের নিচে', 'Behind')}>
              🔴 {factorySummary.behindCount}
            </span>
          </div>
        </div>
      </div>

      {/* VIEW TABS */}
      <div className="flex border-b border-line">
        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition cursor-pointer ${
            activeTab === 'matrix'
              ? 'border-indigo text-indigo'
              : 'border-transparent text-ink-soft hover:text-ink'
          }`}
        >
          <TrendingUp size={16} />
          {t('স্টাইল টার্গেট ও লাইভ ট্র্যাকিং', 'Style Target & Live Tracking')}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('report')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition cursor-pointer ${
            activeTab === 'report'
              ? 'border-indigo text-indigo'
              : 'border-transparent text-ink-soft hover:text-ink'
          }`}
        >
          <BarChart3 size={16} />
          {t('পূর্ণাঙ্গ IE টার্গেট বনাম বাস্তব উৎপাদন রিপোর্ট', 'Target vs Actual Production Report')}
          <span className="rounded-full bg-indigo/10 px-2 py-0.5 text-xs text-indigo font-bold">
            {filteredReportRecords.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('entry')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition cursor-pointer ${
            activeTab === 'entry'
              ? 'border-indigo text-indigo'
              : 'border-transparent text-ink-soft hover:text-ink'
          }`}
        >
          <Gauge size={16} />
          {t('বিস্তারিত IE লগ এন্ট্রি ও ক্যালকুলেটর', 'Detailed IE Log & Calculator')}
        </button>
      </div>

      {/* TAB 1: STYLE TARGET & LIVE TRACKING MATRIX */}
      {activeTab === 'matrix' && (
        <section className="rounded-lg border border-line bg-surface p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-ink flex items-center gap-2">
                <Target size={18} className="text-indigo" />
                {t('স্টাইল-ভিত্তিক লক্ষ্যমাত্রা ও বাস্তব আউটপুট ট্র্যাকিং', 'Style Target vs Actual Output Tracking')}
              </h2>
              <p className="text-xs text-ink-soft">
                {t(
                  'আজকের তারিখে কোন স্টাইলে কত টার্গেট দেওয়া হয়েছে এবং ফ্লোরে সে অনুযায়ী কতটুকু উৎপাদন হচ্ছে তার সরাসরি তুলনা।',
                  "Direct comparison of today's target set by IE vs actual production received from floor."
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-indigo bg-indigo/10 px-3 py-1 rounded-full font-semibold border border-indigo/20">
                {t('আজকের তারিখ:', "Today's Date:")} {today()}
              </span>
            </div>
          </div>

          {styleTargetMatrix.length === 0 ? (
            <EmptyState title={t('কোনো সক্রিয় স্টাইল পাওয়া যায়নি', 'No active styles found')} />
          ) : (
            <div className="scroll-thin overflow-x-auto rounded-md border border-line">
              <table className="w-full min-w-[850px] text-xs">
                <thead>
                  <tr className="border-b border-line bg-paper text-left font-semibold text-ink-soft">
                    <th className="py-2.5 px-3">{t('স্টাইল ও বায়ার', 'Style & Buyer')}</th>
                    <th className="py-2.5 px-3">{t('টার্গেট স্টেজ', 'Target Stage')}</th>
                    <th className="py-2.5 px-3">{t('দৈনিক টার্গেট', 'Daily Target')}</th>
                    <th className="py-2.5 px-3">{t('আজকের উৎপাদন', 'Today Output')}</th>
                    <th className="py-2.5 px-3">{t('ঘাটতি / বাড়তি', 'Variance (+/-)')}</th>
                    <th className="py-2.5 px-3">{t('টার্গেট অর্জনের হার', 'Achievement %')}</th>
                    <th className="py-2.5 px-3">{t('স্ট্যাটাস', 'Status')}</th>
                    <th className="py-2.5 px-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {styleTargetMatrix.map((item, idx) => (
                    <tr key={`${item.id || 'matrix'}-${idx}`} className="border-b border-line last:border-0 hover:bg-paper/50">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-ink">{item.styleNo}</div>
                        <div className="text-[11px] text-ink-soft">
                          {item.buyer} {item.styleName ? `• ${item.styleName}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="rounded bg-paper px-2 py-0.5 text-ink font-medium border border-line">
                          {stageLabel(item.targetStage, lang)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {item.hasTarget ? (
                          <div>
                            <span className="font-bold text-indigo font-display text-sm">
                              {item.targetDaily.toLocaleString()}
                            </span>{' '}
                            <span className="text-[11px] text-ink-soft">pcs/day</span>
                            {item.hourlyTarget > 0 && (
                              <div className="text-[10px] text-ink-soft">
                                ({item.hourlyTarget} pcs/hr • SMV: {item.smv})
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-ink-soft italic">{t('টার্গেট সেট করা নেই', 'No target set')}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-ink font-display text-sm">
                          {item.todayActual.toLocaleString()}
                        </span>{' '}
                        <span className="text-[11px] text-ink-soft">pcs</span>
                        <div className="text-[10px] text-ink-soft">
                          {t('মোট সম্পন্ন:', 'Total:')} {item.totalStageActual.toLocaleString()} pcs
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {item.hasTarget ? (
                          <span
                            className={`font-semibold font-mono ${
                              item.variance >= 0 ? 'text-green' : 'text-red'
                            }`}
                          >
                            {item.variance > 0 ? `+${item.variance}` : item.variance} pcs
                          </span>
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {item.achievementRate !== null ? (
                          <div className="space-y-1">
                            <span
                              className={`rounded px-1.5 py-0.5 font-bold font-mono text-xs ${
                                TONE_CLASSES[achievementTone(item.achievementRate)]
                              }`}
                            >
                              {item.achievementRate.toFixed(1)}%
                            </span>
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line">
                              <div
                                className={`h-full rounded-full ${
                                  item.achievementRate >= 100
                                    ? 'bg-green'
                                    : item.achievementRate >= 75
                                    ? 'bg-amber'
                                    : 'bg-red'
                                }`}
                                style={{ width: `${Math.min(100, item.achievementRate)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {item.hasTarget ? (
                          item.achievementRate >= 100 ? (
                            <span className="inline-flex items-center gap-1 rounded bg-green-soft px-2 py-0.5 text-[11px] font-bold text-green border border-green/20">
                              <CheckCircle2 size={12} /> {t('লক্ষ্যমাত্রা পূর্ণ', 'Target Met')}
                            </span>
                          ) : item.achievementRate >= 75 ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-soft px-2 py-0.5 text-[11px] font-bold text-amber border border-amber/20">
                              <Clock size={12} /> {t('চলমান / কাছাকাছি', 'On Track')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-red-soft px-2 py-0.5 text-[11px] font-bold text-red border border-red/20">
                              <AlertTriangle size={12} /> {t('টার্গেটের নিচে', 'Behind Target')}
                            </span>
                          )
                        ) : (
                          <span className="text-ink-soft text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingTargetStyle(item)}
                            className="rounded border border-indigo/40 bg-indigo/10 px-2.5 py-1 text-xs font-semibold text-indigo hover:bg-indigo hover:text-white transition cursor-pointer"
                          >
                            {item.hasTarget ? t('টার্গেট এডিট', 'Edit Target') : t('+ টার্গেট দিন', '+ Set Target')}
                          </button>
                          {item.hasTarget && (
                            <button
                              type="button"
                              onClick={() => handleDeleteStyleTarget(item.id)}
                              className="p-1 text-ink-soft hover:text-red transition cursor-pointer"
                              title={t('টার্গেট মুছুন', 'Delete target')}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: COMPREHENSIVE IE TARGET VS ACTUAL PRODUCTION REPORT */}
      {activeTab === 'report' && (
        <section className="rounded-lg border border-line bg-surface p-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3">
            <div>
              <h2 className="font-display text-base font-semibold text-ink flex items-center gap-2">
                <BarChart3 size={18} className="text-indigo" />
                {t('পূর্ণাঙ্গ IE টার্গেট বনাম অর্জন রিপোর্ট (Daily & Style-Wise Breakdown)', 'Comprehensive IE Target vs Achievement Report')}
              </h2>
              <p className="text-xs text-ink-soft">
                {t(
                  'IE কর্তৃক প্রদত্ত টার্গেট এবং ফ্লোরে সে অনুযায়ী কতটুকু অর্জিত হয়েছে তার তারিখ ও স্টাইল-ভিত্তিক বিস্তারিত প্রতিবেদন।',
                  'Detailed audit report comparing planned targets vs verified factory output by date, style and stage.'
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                className="flex items-center gap-1.5 rounded bg-indigo px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-deep cursor-pointer"
              >
                <Printer size={14} />
                {t('প্রিন্ট রিপোর্ট', 'Print Report')}
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 gap-2.5 rounded-lg border border-line bg-paper/60 p-3 sm:grid-cols-2 md:grid-cols-5 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-ink-soft mb-1">{t('স্টাইল বা নোট খুঁজুন', 'Search Style / Note')}</label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-ink-soft" />
                <input
                  type="text"
                  placeholder="যেমন: HM-2026..."
                  className={`${inputClass} !py-1.5 !pl-8 text-xs`}
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink-soft mb-1">{t('বায়ার', 'Buyer')}</label>
              <select
                className={`${inputClass} !py-1.5 text-xs`}
                value={reportBuyerFilter}
                onChange={(e) => setReportBuyerFilter(e.target.value)}
              >
                <option value="all">{t('সব বায়ার (All Buyers)', 'All Buyers')}</option>
                {buyers.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink-soft mb-1">{t('প্রোডাকশন স্টেজ', 'Stage')}</label>
              <select
                className={`${inputClass} !py-1.5 text-xs`}
                value={reportStageFilter}
                onChange={(e) => setReportStageFilter(e.target.value)}
              >
                <option value="all">{t('সব স্টেজ (All Stages)', 'All Stages')}</option>
                {STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {lang === 'en' ? s.labelEn : s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink-soft mb-1">{t('টার্গেট অর্জন স্ট্যাটাস', 'Achievement Status')}</label>
              <select
                className={`${inputClass} !py-1.5 text-xs`}
                value={reportStatusFilter}
                onChange={(e) => setReportStatusFilter(e.target.value)}
              >
                <option value="all">{t('সব স্ট্যাটাস (All)', 'All')}</option>
                <option value="met">{t('🟢 লক্ষ্যমাত্রা পূর্ণ (≥ 100%)', '🟢 Target Met (≥ 100%)')}</option>
                <option value="track">{t('🟡 চলমান / কাছাকাছি (75% - 99%)', '🟡 On Track (75% - 99%)')}</option>
                <option value="behind">{t('🔴 টার্গেটের নিচে / ঘাটতি (< 75%)', '🔴 Behind Target (< 75%)')}</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <div className="w-1/2">
                <label className="block text-[11px] font-semibold text-ink-soft mb-1">{t('হতে', 'From')}</label>
                <input
                  type="date"
                  className={`${inputClass} !py-1.5 !px-1.5 text-xs`}
                  value={reportDateFrom}
                  onChange={(e) => setReportDateFrom(e.target.value)}
                />
              </div>
              <div className="w-1/2">
                <label className="block text-[11px] font-semibold text-ink-soft mb-1">{t('পর্যন্ত', 'To')}</label>
                <input
                  type="date"
                  className={`${inputClass} !py-1.5 !px-1.5 text-xs`}
                  value={reportDateTo}
                  onChange={(e) => setReportDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Filter Quick Clear & Count */}
          <div className="flex items-center justify-between text-xs text-ink-soft px-1">
            <span>
              {t('প্রদর্শিত রেকর্ড:', 'Showing records:')}{' '}
              <strong className="text-indigo">{filteredReportRecords.length}</strong>
            </span>
            {(reportSearch || reportBuyerFilter !== 'all' || reportStageFilter !== 'all' || reportStatusFilter !== 'all' || reportDateFrom || reportDateTo) && (
              <button
                type="button"
                onClick={() => {
                  setReportSearch('');
                  setReportBuyerFilter('all');
                  setReportStageFilter('all');
                  setReportStatusFilter('all');
                  setReportDateFrom('');
                  setReportDateTo('');
                }}
                className="text-red hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <X size={13} /> {t('ফিল্টার রিসেট করুন', 'Reset Filters')}
              </button>
            )}
          </div>

          {/* Detailed Report Table */}
          {filteredReportRecords.length === 0 ? (
            <EmptyState
              title={t('কোনো IE টার্গেট রিপোর্ট ডেটা নেই', 'No IE report records match current filters')}
              description={t('ফিল্টার পরিবর্তন করুন অথবা নতুন টার্গেট ও উৎপাদন এন্ট্রি দিন।', 'Adjust your filters or add new target entries.')}
            />
          ) : (
            <div className="scroll-thin overflow-x-auto rounded-md border border-line">
              <table className="w-full min-w-[980px] text-xs">
                <thead>
                  <tr className="border-b border-line bg-paper text-left font-semibold text-ink-soft">
                    <th className="py-2.5 px-3">{t('তারিখ', 'Date')}</th>
                    <th className="py-2.5 px-3">{t('স্টাইল ও বায়ার', 'Style & Buyer')}</th>
                    <th className="py-2.5 px-3">{t('স্টেজ', 'Stage')}</th>
                    <th className="py-2.5 px-3 text-right">{t('টার্গেট পিস', 'Target Pcs')}</th>
                    <th className="py-2.5 px-3 text-right">{t('বাস্তব উৎপাদন', 'Actual Output')}</th>
                    <th className="py-2.5 px-3 text-right">{t('ঘাটতি / উদ্বৃত্ত', 'Variance')}</th>
                    <th className="py-2.5 px-3 text-center">{t('টার্গেট অর্জন %', 'Achievement %')}</th>
                    <th className="py-2.5 px-3 text-center">SMV / {t('জনবল', 'Manpower')}</th>
                    <th className="py-2.5 px-3 text-center">{t('লাইন এফিসিয়েন্সি', 'Line Eff %')}</th>
                    <th className="py-2.5 px-3 text-center">{t('স্ট্যাটাস', 'Status')}</th>
                    <th className="py-2.5 px-3">{t('মন্তব্য / এন্ট্রি করেছেন', 'Remarks')}</th>
                    <th className="py-2.5 px-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReportRecords.map((r, idx) => {
                    const variance = Number(r.actualQty || 0) - Number(r.targetQty || 0);
                    const achRate = r.targetQty > 0 ? (r.actualQty / r.targetQty) * 100 : null;

                    return (
                      <tr key={`${r.id || 'record'}-${idx}`} className="border-b border-line last:border-0 hover:bg-paper/50">
                        <td className="py-2.5 px-3 font-mono font-medium text-ink">{r.date}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-ink">{r.styleNo}</div>
                          <div className="text-[11px] text-ink-soft">
                            {r.buyer} {r.styleName ? `• ${r.styleName}` : ''}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="rounded bg-paper px-2 py-0.5 text-ink font-medium border border-line">
                            {stageLabel(r.stage, lang)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo">
                          {Number(r.targetQty || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-ink">
                          {Number(r.actualQty || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold">
                          <span className={variance >= 0 ? 'text-green' : 'text-red'}>
                            {variance > 0 ? `+${variance}` : variance}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {achRate !== null ? (
                            <span
                              className={`inline-block rounded px-2 py-0.5 font-bold font-mono text-[11px] ${
                                TONE_CLASSES[achievementTone(achRate)]
                              }`}
                            >
                              {achRate.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-ink-soft">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-ink-soft">
                          {r.smv ? `${r.smv}m` : '—'} / {r.manpower ? `${r.manpower}p` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {r.achievedEfficiencyPct !== null && r.achievedEfficiencyPct !== undefined ? (
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 font-bold font-mono text-[11px] ${
                                TONE_CLASSES[efficiencyTone(Number(r.achievedEfficiencyPct))]
                              }`}
                            >
                              {r.achievedEfficiencyPct}%
                            </span>
                          ) : (
                            <span className="text-ink-soft">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {achRate !== null ? (
                            achRate >= 100 ? (
                              <span className="inline-flex items-center gap-1 rounded bg-green-soft px-1.5 py-0.5 text-[10px] font-bold text-green border border-green/20">
                                <CheckCircle2 size={11} /> {t('পূর্ণ', 'Met')}
                              </span>
                            ) : achRate >= 75 ? (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-soft px-1.5 py-0.5 text-[10px] font-bold text-amber border border-amber/20">
                                <Clock size={11} /> {t('চলমান', 'On Track')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-red-soft px-1.5 py-0.5 text-[10px] font-bold text-red border border-red/20">
                                <AlertTriangle size={11} /> {t('ঘাটতি', 'Behind')}
                              </span>
                            )
                          ) : (
                            <span className="text-ink-soft">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-ink-soft">
                          <div className="truncate max-w-[150px]" title={r.notes || ''}>
                            {r.notes || '—'}
                          </div>
                          {r.enteredBy && <div className="text-[10px] text-ink-soft/70">{r.enteredBy}</div>}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canEnter && (
                              <button
                                type="button"
                                onClick={() => setEditingRecord(r)}
                                className="p-1 text-indigo hover:opacity-75 transition cursor-pointer"
                                title={t('এডিট করুন', 'Edit')}
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            {(hasAreaAdmin(profile, 'production') || profile?.role === 'admin') && (
                              <button
                                type="button"
                                onClick={() => handleDelete(r)}
                                className="p-1 text-red hover:opacity-75 transition cursor-pointer"
                                title={t('মুছে ফেলুন', 'Delete')}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Table Footer Summary Row */}
                <tfoot>
                  <tr className="border-t-2 border-line bg-paper/80 font-semibold text-ink">
                    <td colSpan={3} className="py-3 px-3 text-right">
                      {t('সর্বমোট (Grand Total):', 'Grand Total:')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-sm text-indigo">
                      {reportTotals.targetSum.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-sm">
                      {reportTotals.actualSum.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-sm">
                      <span className={reportTotals.varianceSum >= 0 ? 'text-green' : 'text-red'}>
                        {reportTotals.varianceSum > 0 ? `+${reportTotals.varianceSum}` : reportTotals.varianceSum}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-sm text-indigo">
                      {reportTotals.avgAchievement.toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-center text-ink-soft">
                      {filteredReportRecords.length} {t('রেকর্ড', 'records')}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-sm">
                      {reportTotals.avgEfficiency > 0 ? `${reportTotals.avgEfficiency.toFixed(1)}%` : '—'}
                    </td>
                    <td colSpan={3} className="py-3 px-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: DETAILED IE LOGGING & SMV CALCULATOR */}
      {activeTab === 'entry' && (
        <section className="rounded-lg border border-line bg-surface p-5 space-y-4">
          <div className="flex flex-col gap-1 border-b border-line pb-3">
            <h2 className="font-display text-base font-semibold text-ink flex items-center gap-2">
              <Gauge size={18} className="text-indigo" />
              {t('নির্দিষ্ট স্টাইলের জন্য বিস্তারিত IE লগ এন্ট্রি ও ক্যালকুলেটর', 'Detailed IE Log Entry & SMV Calculator')}
            </h2>
            <p className="text-xs text-ink-soft">
              {t(
                'স্টাইল নির্বাচন করে SMV, জনবল এবং কর্মঘণ্টা দিন। সিস্টেম স্বয়ংক্রিয়ভাবে ১০০% টার্গেট, নির্ধারিত টার্গেট ও বাস্তব উৎপাদন সমন্বয় করবে।',
                'Select style and input SMV, manpower and hours. System calculates capacity and efficiency vs actual entries.'
              )}
            </p>
          </div>

          <div className="max-w-md">
            <label className="block text-xs font-semibold text-ink mb-1">
              {t('স্টাইল নির্বাচন করুন *', 'Select Style *')}
            </label>
            <StyleSearchSelect value={styleId} onChange={(id) => setStyleId(id)} />
          </div>

          {style && (
            <div className="space-y-4">
              <div className="rounded-md border border-line bg-paper p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-ink text-sm">
                    {style.styleNo}
                  </span>
                  <span className="text-ink-soft ml-2">
                    {style.styleName ? `— ${style.styleName}` : ''} • {style.buyer}
                  </span>
                </div>
                <div className="text-ink font-medium">
                  {t('অর্ডার কোয়ান্টিটি:', 'Order Qty:')}{' '}
                  <strong className="text-indigo">{Number(style.orderQty || 0).toLocaleString()} pcs</strong>
                </div>
              </div>

              {canEnter && (
                <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-line bg-paper/50 p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label={t('তারিখ', 'Date')}>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                        className={inputClass}
                      />
                    </Field>
                    <Field label={t('প্রোডাকশন স্টেজ', 'Stage')}>
                      <select
                        value={form.stage}
                        onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))}
                        className={inputClass}
                      >
                        {STAGES.map((s) => (
                          <option key={s.key} value={s.key}>
                            {lang === 'en' ? s.labelEn : s.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t('SMV (মিনিট) *', 'SMV (minutes) *')}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={form.smv}
                        onChange={(e) => setForm((f) => ({ ...f, smv: e.target.value }))}
                        className={inputClass}
                        placeholder="যেমন: 8.5"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label={t('জনবল (Manpower) *', 'Manpower *')}>
                      <input
                        type="number"
                        min="1"
                        required
                        value={form.manpower}
                        onChange={(e) => setForm((f) => ({ ...f, manpower: e.target.value }))}
                        className={inputClass}
                        placeholder="যেমন: 12"
                      />
                    </Field>
                    <Field label={t('কর্মঘণ্টা/দিন *', 'Working Hours/Day *')}>
                      <input
                        type="number"
                        min="1"
                        step="0.5"
                        required
                        value={form.workingHours}
                        onChange={(e) => setForm((f) => ({ ...f, workingHours: e.target.value }))}
                        className={inputClass}
                      />
                    </Field>
                    <Field label={t('টার্গেট দক্ষতা (%)', 'Target Efficiency (%)')}>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={form.targetEfficiencyPct}
                        onChange={(e) => setForm((f) => ({ ...f, targetEfficiencyPct: e.target.value }))}
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  {smv > 0 && manpower > 0 && workingHours > 0 && (
                    <div className="grid grid-cols-2 gap-3 rounded-md border border-indigo/30 bg-indigo/10 p-3 text-xs sm:grid-cols-4">
                      <div>
                        <p className="text-[11px] text-ink-soft">{t('স্ট্যান্ডার্ড টার্গেট (১০০%)', 'Standard Target (100%)')}</p>
                        <p className="font-semibold text-ink text-sm">{standardTargetQty.toFixed(0)} pcs</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-ink-soft">
                          {t('টার্গেট', 'Planned Target')} ({targetEfficiencyPct}%)
                        </p>
                        <p className="font-bold text-indigo text-sm">{targetQty.toFixed(0)} pcs</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-ink-soft">{t('বাস্তব আউটপুট (অটো)', 'Actual Output (auto)')}</p>
                        <p className="font-semibold text-ink text-sm">{suggestedActual.toLocaleString('en-US')} pcs</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-ink-soft">{t('অর্জিত দক্ষতা', 'Achieved Line Eff')}</p>
                        <p className={`inline-block rounded px-2 py-0.5 font-bold ${TONE_CLASSES[efficiencyTone(achievedEfficiencyPct)]}`}>
                          {achievedEfficiencyPct === null ? '—' : `${achievedEfficiencyPct.toFixed(1)}%`}
                        </p>
                      </div>
                    </div>
                  )}

                  <Field label={t('নোট বা মেশিনের বিবরণ (ঐচ্ছিক)', 'Notes / Line details (optional)')}>
                    <input
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      className={inputClass}
                      placeholder={t('যেমন: লাইন ২ অটোমেটিক গেজ ১২ নিটিং', 'e.g. Line 2 knitting floor')}
                    />
                  </Field>

                  {error && <p className="text-xs text-red">{error}</p>}

                  <button type="submit" disabled={busy} className={btnPrimary}>
                    {busy ? t('সেভ হচ্ছে…', 'Saving…') : t('IE এন্ট্রি সেভ করুন', 'Save IE Entry')}
                  </button>
                </form>
              )}

              {/* History of this specific style */}
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  {t('এই স্টাইলের IE লগ ইতিহাস', "This Style's IE History")}
                </h3>
                {records === null ? (
                  <p className="text-xs text-ink-soft">{t('লোড হচ্ছে…', 'Loading…')}</p>
                ) : records.length === 0 ? (
                  <EmptyState title={t('এখনো কোনো IE এন্ট্রি নেই', 'No IE entries for this style yet')} />
                ) : (
                  <div className="scroll-thin overflow-x-auto rounded border border-line">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-line bg-paper text-left font-semibold text-ink-soft">
                          <th className="py-2 px-3">{t('তারিখ', 'Date')}</th>
                          <th className="py-2 px-3">{t('স্টেজ', 'Stage')}</th>
                          <th className="py-2 px-3 text-right">SMV</th>
                          <th className="py-2 px-3 text-right">{t('টার্গেট', 'Target')}</th>
                          <th className="py-2 px-3 text-right">{t('বাস্তব আউটপুট', 'Actual')}</th>
                          <th className="py-2 px-3 text-center">{t('দক্ষতা', 'Efficiency')}</th>
                          <th className="py-2 px-3">{t('মন্তব্য', 'Notes')}</th>
                          <th className="py-2 px-3 text-right"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r, idx) => (
                          <tr key={`${r.id || 'rec'}-${idx}`} className="border-b border-line last:border-0 hover:bg-paper/40">
                            <td className="py-2 px-3 font-mono">{r.date}</td>
                            <td className="py-2 px-3">{stageLabel(r.stage, lang)}</td>
                            <td className="py-2 px-3 text-right font-mono">{r.smv}m</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-indigo">{r.targetQty}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-ink">{r.actualQty}</td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-bold ${
                                  TONE_CLASSES[efficiencyTone(r.achievedEfficiencyPct)]
                                }`}
                              >
                                {r.achievedEfficiencyPct === null || r.achievedEfficiencyPct === undefined
                                  ? '—'
                                  : `${r.achievedEfficiencyPct}%`}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-ink-soft max-w-[140px] truncate">{r.notes || '—'}</td>
                            <td className="py-2 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {canEnter && (
                                  <button
                                    onClick={() => setEditingRecord({ ...r, styleId })}
                                    className="p-1 text-indigo hover:opacity-75 cursor-pointer"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                )}
                                {(hasAreaAdmin(profile, 'production') || profile?.role === 'admin') && (
                                  <button
                                    onClick={() => handleDelete({ ...r, styleId })}
                                    className="p-1 text-red hover:opacity-75 cursor-pointer"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* TARGET SETUP & EDIT MODAL */}
      {editingTargetStyle && (
        <SetStyleTargetModal
          styleItem={editingTargetStyle}
          allStyles={styles}
          onClose={() => setEditingTargetStyle(null)}
          onSave={handleSaveStyleTarget}
        />
      )}

      {/* EDIT IE RECORD MODAL */}
      {editingRecord && (
        <EditIERecordModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSave={(updated) => {
            updateLocalIERecord(editingRecord.id, updated);
            setAllRecords((prev) => prev.map((r) => (r.id === editingRecord.id ? { ...r, ...updated } : r)));
            setRecords((prev) => (prev ? prev.map((r) => (r.id === editingRecord.id ? { ...r, ...updated } : r)) : []));
            setEditingRecord(null);
          }}
        />
      )}

      {/* OFFICIAL PRINTABLE REPORT MODAL */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto print:fixed print:inset-0 print:bg-white print:p-0">
          <div className="relative w-full max-w-5xl rounded-lg bg-white p-8 text-black shadow-2xl print:p-0 print:shadow-none print:max-w-none max-h-[95vh] overflow-y-auto">
            {/* Top Print Actions (hidden on print) */}
            <div className="flex items-center justify-between border-b pb-4 mb-6 print:hidden">
              <span className="font-display font-semibold text-lg text-indigo-deep">
                {t('অফিশিয়াল IE টার্গেট ও উৎপাদন পারফরম্যান্স রিপোর্ট প্রিভিউ', 'Official IE Target & Production Report Preview')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded bg-indigo px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-deep cursor-pointer"
                >
                  <Printer size={15} />
                  {t('প্রিন্ট করুন (Print Now)', 'Print Now')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  ✕ {t('বন্ধ করুন', 'Close')}
                </button>
              </div>
            </div>

            {/* PRINT CONTAINER */}
            <div className="printable-sheet space-y-6 text-sm text-gray-900 leading-relaxed font-sans">
              {/* Letterhead */}
              <div className="text-center border-b-2 border-gray-800 pb-3">
                <h1 className="text-2xl font-bold uppercase tracking-wider">{companyName || 'Factory ERP'}</h1>
                <p className="text-xs text-gray-600 mt-0.5">{settings?.address || 'Industrial Zone, Gazipur, Dhaka, Bangladesh'}</p>
                <p className="text-xs text-gray-600">Department of Industrial Engineering (IE) & Work Study</p>
                <div className="inline-block mt-2 px-6 py-1 border-2 border-black font-bold uppercase tracking-widest text-sm bg-gray-50">
                  IE TARGET VS ACTUAL PRODUCTION PERFORMANCE REPORT
                </div>
              </div>

              {/* Meta information */}
              <div className="flex justify-between items-center text-xs border border-gray-300 p-2.5 rounded bg-gray-50">
                <div>
                  <strong>Report Date:</strong> {today()} &nbsp;|&nbsp; <strong>Generated By:</strong> {profile?.name || user?.email || 'IE Dept'}
                </div>
                <div>
                  <strong>Total Styles Monitored:</strong> {reportTotals.recordCount} &nbsp;|&nbsp; <strong>Factory Target Met:</strong> {reportTotals.avgAchievement.toFixed(1)}%
                </div>
              </div>

              {/* Printable Table */}
              <table className="w-full text-xs border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100 text-left font-bold text-gray-800">
                    <th className="border border-gray-300 p-2">Date</th>
                    <th className="border border-gray-300 p-2">Style No & Name</th>
                    <th className="border border-gray-300 p-2">Buyer</th>
                    <th className="border border-gray-300 p-2">Stage</th>
                    <th className="border border-gray-300 p-2 text-right">Target Pcs</th>
                    <th className="border border-gray-300 p-2 text-right">Actual Pcs</th>
                    <th className="border border-gray-300 p-2 text-right">Variance</th>
                    <th className="border border-gray-300 p-2 text-center">Ach %</th>
                    <th className="border border-gray-300 p-2 text-center">SMV</th>
                    <th className="border border-gray-300 p-2 text-center">Line Eff %</th>
                    <th className="border border-gray-300 p-2">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReportRecords.map((r, i) => {
                    const variance = Number(r.actualQty || 0) - Number(r.targetQty || 0);
                    const achRate = r.targetQty > 0 ? (r.actualQty / r.targetQty) * 100 : null;

                    return (
                      <tr key={i} className="border-b border-gray-200">
                        <td className="border border-gray-300 p-2 font-mono">{r.date}</td>
                        <td className="border border-gray-300 p-2 font-bold">
                          {r.styleNo}
                          {r.styleName && <div className="text-[10px] text-gray-600 font-normal">{r.styleName}</div>}
                        </td>
                        <td className="border border-gray-300 p-2">{r.buyer}</td>
                        <td className="border border-gray-300 p-2">{stageLabel(r.stage, 'en')}</td>
                        <td className="border border-gray-300 p-2 text-right font-mono font-bold">
                          {Number(r.targetQty || 0).toLocaleString()}
                        </td>
                        <td className="border border-gray-300 p-2 text-right font-mono font-bold">
                          {Number(r.actualQty || 0).toLocaleString()}
                        </td>
                        <td className="border border-gray-300 p-2 text-right font-mono">
                          {variance > 0 ? `+${variance}` : variance}
                        </td>
                        <td className="border border-gray-300 p-2 text-center font-bold">
                          {achRate !== null ? `${achRate.toFixed(1)}%` : '—'}
                        </td>
                        <td className="border border-gray-300 p-2 text-center font-mono">
                          {r.smv ? `${r.smv}m` : '—'}
                        </td>
                        <td className="border border-gray-300 p-2 text-center font-mono font-bold">
                          {r.achievedEfficiencyPct ? `${r.achievedEfficiencyPct}%` : '—'}
                        </td>
                        <td className="border border-gray-300 p-2 text-[11px] text-gray-700">
                          {r.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold border-t-2 border-gray-800">
                    <td colSpan={4} className="border border-gray-300 p-2 text-right">Total Summary:</td>
                    <td className="border border-gray-300 p-2 text-right font-mono">{reportTotals.targetSum.toLocaleString()}</td>
                    <td className="border border-gray-300 p-2 text-right font-mono">{reportTotals.actualSum.toLocaleString()}</td>
                    <td className="border border-gray-300 p-2 text-right font-mono">
                      {reportTotals.varianceSum > 0 ? `+${reportTotals.varianceSum}` : reportTotals.varianceSum}
                    </td>
                    <td className="border border-gray-300 p-2 text-center">{reportTotals.avgAchievement.toFixed(1)}%</td>
                    <td className="border border-gray-300 p-2"></td>
                    <td className="border border-gray-300 p-2 text-center">{reportTotals.avgEfficiency.toFixed(1)}%</td>
                    <td className="border border-gray-300 p-2"></td>
                  </tr>
                </tfoot>
              </table>

              {/* Approval Signatures */}
              <div className="grid grid-cols-3 gap-6 pt-16 text-center text-xs font-semibold text-gray-800">
                <div className="border-t border-gray-400 pt-2">
                  <p>Prepared By</p>
                  <p className="text-[11px] font-normal text-gray-500">IE Officer / Work Study Engineer</p>
                </div>
                <div className="border-t border-gray-400 pt-2">
                  <p>Verified By</p>
                  <p className="text-[11px] font-normal text-gray-500">Production Manager (PM)</p>
                </div>
                <div className="border-t border-gray-400 pt-2">
                  <p>Approved By</p>
                  <p className="text-[11px] font-normal text-gray-500">General Manager / Managing Director</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SetStyleTargetModal({ styleItem, allStyles, onClose, onSave }) {
  const { t } = useLang();
  const [selectedStyleId, setSelectedStyleId] = useState(styleItem.id || (allStyles[0]?.id || ''));
  const currentStyle = allStyles.find((s) => s.id === selectedStyleId) || styleItem;

  const [dailyTarget, setDailyTarget] = useState(String(styleItem.targetDaily || 500));
  const [hourlyTarget, setHourlyTarget] = useState(String(styleItem.hourlyTarget || Math.round(500 / 8)));
  const [stage, setStage] = useState(styleItem.targetStage || 'knitting');
  const [smv, setSmv] = useState(String(styleItem.smv === '—' ? 8.5 : styleItem.smv || 8.5));
  const [manpower, setManpower] = useState(String(styleItem.manpower || 12));
  const [workingHours, setWorkingHours] = useState(String(styleItem.workingHours || 8));
  const [targetEfficiency, setTargetEfficiency] = useState(String(styleItem.targetEfficiency || 80));
  const [notes, setNotes] = useState(styleItem.notes || '');

  function handleSubmit(e) {
    e.preventDefault();
    if (!dailyTarget || Number(dailyTarget) <= 0) {
      alert(t('সঠিক দৈনিক টার্গেট দিন।', 'Enter a valid daily target.'));
      return;
    }
    onSave(selectedStyleId, {
      dailyTarget: Number(dailyTarget),
      hourlyTarget: Number(hourlyTarget) || Math.round(Number(dailyTarget) / 8),
      stage,
      smv: Number(smv) || 0,
      manpower: Number(manpower) || 10,
      workingHours: Number(workingHours) || 8,
      targetEfficiency: Number(targetEfficiency) || 80,
      notes,
    });
  }

  return (
    <Modal
      title={t(`IE টার্গেট নির্ধারণ — ${currentStyle?.styleNo || 'স্টাইল'}`, `Set IE Target — ${currentStyle?.styleNo || 'Style'}`)}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!styleItem.id && (
          <Field label={t('স্টাইল নির্বাচন করুন *', 'Select Style *')}>
            <select
              className={inputClass}
              value={selectedStyleId}
              onChange={(e) => setSelectedStyleId(e.target.value)}
            >
              {allStyles.map((s, idx) => (
                <option key={`${s.id}-${idx}`} value={s.id}>
                  {s.styleNo} {s.styleName ? `(${s.styleName})` : ''} — {s.buyer}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="rounded bg-paper p-3 text-xs text-ink-soft space-y-1">
          <div>
            <strong>{t('স্টাইল', 'Style')}:</strong> {currentStyle?.styleNo} ({currentStyle?.buyer})
          </div>
          <div>
            <strong>{t('অর্ডার কোয়ান্টিটি', 'Order Qty')}:</strong>{' '}
            {Number(currentStyle?.orderQty || 0).toLocaleString()} pcs
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('দৈনিক টার্গেট (Pcs/Day) *', 'Daily Target (Pcs/Day) *')}>
            <input
              type="number"
              min="1"
              required
              className={inputClass}
              value={dailyTarget}
              onChange={(e) => {
                const val = e.target.value;
                setDailyTarget(val);
                if (val && Number(val) > 0) {
                  setHourlyTarget(String(Math.round(Number(val) / (Number(workingHours) || 8))));
                }
              }}
            />
          </Field>

          <Field label={t('ঘণ্টাপ্রতি টার্গেট (Pcs/Hour)', 'Hourly Target (Pcs/Hour)')}>
            <input
              type="number"
              min="0"
              className={inputClass}
              value={hourlyTarget}
              onChange={(e) => setHourlyTarget(e.target.value)}
            />
          </Field>

          <Field label={t('টার্গেট স্টেজ', 'Target Stage')}>
            <select className={inputClass} value={stage} onChange={(e) => setStage(e.target.value)}>
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {t(s.label, s.labelEn)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="SMV (মিনিট)">
            <input
              type="number"
              step="0.1"
              min="0"
              className={inputClass}
              value={smv}
              onChange={(e) => setSmv(e.target.value)}
            />
          </Field>

          <Field label={t('জনবল (Manpower)', 'Manpower')}>
            <input
              type="number"
              min="1"
              className={inputClass}
              value={manpower}
              onChange={(e) => setManpower(e.target.value)}
            />
          </Field>

          <Field label={t('কর্মঘণ্টা/দিন', 'Working Hours/Day')}>
            <input
              type="number"
              min="1"
              step="0.5"
              className={inputClass}
              value={workingHours}
              onChange={(e) => setWorkingHours(e.target.value)}
            />
          </Field>
        </div>

        <Field label={t('টার্গেট দক্ষতা (%)', 'Target Efficiency (%)')}>
          <input
            type="number"
            min="0"
            max="100"
            className={inputClass}
            value={targetEfficiency}
            onChange={(e) => setTargetEfficiency(e.target.value)}
          />
        </Field>

        <Field label={t('মন্তব্য / নোট (ঐচ্ছিক)', 'Remarks / Notes (optional)')}>
          <input
            type="text"
            className={inputClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('যেমন: লাইন ৩ নিটিং টার্গেট', 'e.g. Line 3 knitting target')}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('বাতিল', 'Cancel')}
          </button>
          <button type="submit" className={btnPrimary}>
            {t('টার্গেট সেভ করুন', 'Save Target')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditIERecordModal({ record, onClose, onSave }) {
  const { t } = useLang();
  const [smv, setSmv] = useState(String(record.smv || ''));
  const [manpower, setManpower] = useState(String(record.manpower || ''));
  const [workingHours, setWorkingHours] = useState(String(record.workingHours || '8'));
  const [targetEfficiencyPct, setTargetEfficiencyPct] = useState(String(record.targetEfficiencyPct || '80'));
  const [targetQty, setTargetQty] = useState(String(record.targetQty || ''));
  const [actualQty, setActualQty] = useState(String(record.actualQty ?? 0));
  const [notes, setNotes] = useState(record.notes || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    const s = Number(smv);
    const m = Number(manpower);
    const wh = Number(workingHours);
    const te = Number(targetEfficiencyPct);
    const a = Number(actualQty);
    const tq = Number(targetQty);

    const workingMinutes = m * wh * 60;
    const achievedEfficiencyPct = workingMinutes > 0 && s > 0 ? (a * s * 100) / workingMinutes : null;

    setBusy(true);
    const updated = {
      smv: s,
      manpower: m,
      workingHours: wh,
      targetEfficiencyPct: te,
      targetQty: tq,
      actualQty: a,
      achievedEfficiencyPct: achievedEfficiencyPct === null ? null : Number(achievedEfficiencyPct.toFixed(1)),
      notes,
    };

    try {
      if (record.styleId && record.id) {
        await updateDoc(doc(db, 'styles', record.styleId, 'ieRecords', record.id), updated);
      }
    } catch (err) {
      console.warn('Edit IE notice:', err);
    } finally {
      onSave(updated);
      setBusy(false);
    }
  }

  return (
    <Modal title={t('IE রেকর্ড পরিবর্তন / এডিট করুন', 'Edit / Modify IE Record')} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="rounded bg-paper p-3 text-xs text-ink-soft space-y-1">
          <div>
            <strong>{t('স্টাইল', 'Style')}:</strong> {record.styleNo} ({record.buyer})
          </div>
          <div>
            <strong>{t('স্টেজ', 'Stage')}:</strong> {stageLabel(record.stage, 'bn')}
          </div>
          <div>
            <strong>{t('তারিখ', 'Date')}:</strong> {record.date}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('টার্গেট কোয়ান্টিটি *', 'Target Quantity *')}>
            <input
              type="number"
              min="0"
              required
              className={inputClass}
              value={targetQty}
              onChange={(e) => setTargetQty(e.target.value)}
            />
          </Field>

          <Field label={t('বাস্তব আউটপুট (Actual Qty) *', 'Actual Output *')}>
            <input
              type="number"
              min="0"
              required
              className={inputClass}
              value={actualQty}
              onChange={(e) => setActualQty(e.target.value)}
            />
          </Field>

          <Field label="SMV (মিনিট)">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={smv}
              onChange={(e) => setSmv(e.target.value)}
            />
          </Field>

          <Field label={t('জনবল (Manpower)', 'Manpower')}>
            <input
              type="number"
              min="0"
              className={inputClass}
              value={manpower}
              onChange={(e) => setManpower(e.target.value)}
            />
          </Field>

          <Field label={t('কর্মঘণ্টা', 'Working Hours')}>
            <input
              type="number"
              min="0"
              step="0.5"
              className={inputClass}
              value={workingHours}
              onChange={(e) => setWorkingHours(e.target.value)}
            />
          </Field>

          <Field label={t('টার্গেট দক্ষতা %', 'Target Efficiency %')}>
            <input
              type="number"
              min="0"
              max="100"
              className={inputClass}
              value={targetEfficiencyPct}
              onChange={(e) => setTargetEfficiencyPct(e.target.value)}
            />
          </Field>
        </div>

        <Field label={t('নোট বা মন্তব্য', 'Notes / Remarks')}>
          <input
            className={inputClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('সংশোধনের বিবরণ', 'Reason for change')}
          />
        </Field>

        {error && <p className="text-xs text-red">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-line">
          <button type="button" className={btnSecondary} onClick={onClose}>
            {t('বাতিল', 'Cancel')}
          </button>
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? t('সেভ হচ্ছে…', 'Saving…') : t('সংরক্ষণ করুন', 'Save Changes')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
