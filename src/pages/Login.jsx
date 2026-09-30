import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Field, inputClass, btnPrimary, btnSecondary } from '../components/ui';
import { useLang } from '../lib/i18n';
import { useSettings } from '../lib/settingsContext';

export default function Login() {
  const { login, quickAdminLogin, adminConfig } = useAuth();
  const { t, lang } = useLang();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [email, setEmail] = useState(adminConfig?.email || 'admin@factoryerp.com');
  const [password, setPassword] = useState(adminConfig?.password || 'admin123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (adminConfig?.email) setEmail(adminConfig.email);
    if (adminConfig?.password) setPassword(adminConfig.password);
  }, [adminConfig]);

  const companyName = lang === 'en' ? settings?.companyNameEn || settings?.companyName : settings?.companyName;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(t('ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।', 'Incorrect email or password.'));
    } finally {
      setBusy(false);
    }
  }

  function handleQuickLogin() {
    setError('');
    try {
      quickAdminLogin();
      navigate('/');
    } catch (err) {
      setError(t('লগইন ব্যর্থ হয়েছে।', 'Login failed.'));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-8">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          {settings?.logoDataUrl ? (
            <img src={settings.logoDataUrl} alt="logo" className="mx-auto mb-3 h-12 w-12 rounded object-contain" />
          ) : (
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded bg-indigo-deep font-display text-lg font-bold text-white shadow-sm">
              {companyName?.[0] || 'ফ'}
            </div>
          )}
          <h1 className="font-display text-xl font-semibold text-ink">{companyName || 'Factory ERP'}</h1>
          <p className="mt-1 text-sm text-ink-soft">{t('সোয়েটার ফ্যাক্টরি ম্যানেজমেন্ট সিস্টেম', 'Sweater Factory Management System')}</p>
        </div>

        {/* Quick Admin Demo Box */}
        <div className="rounded-lg border-2 border-indigo/20 bg-indigo-soft/40 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo text-white">
              <ShieldCheck size={20} />
            </div>
            <div className="flex-1 text-xs">
              <p className="font-semibold text-ink">
                {t('অ্যাডমিন ডেমো এক্সেস (Default Admin Login)', 'Default Admin Login')}
              </p>
              <p className="mt-0.5 text-ink-soft">
                {t('এখন দেখার জন্য নিচের ডিফল্ট এক্সেস দিয়ে সরাসরি প্রবেশ করতে পারেন:', 'Use default credentials below to explore all modules:')}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded bg-surface px-2.5 py-1.5 font-mono text-[11px] text-ink border border-line">
                <span><strong className="font-sans font-medium text-ink-soft">{t('ইমেইল', 'Email')}:</strong> {adminConfig?.email || 'admin@factoryerp.com'}</span>
                <span className="text-line">|</span>
                <span><strong className="font-sans font-medium text-ink-soft">{t('পাসওয়ার্ড', 'Pass')}:</strong> {adminConfig?.password || 'admin123'}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleQuickLogin}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-indigo px-3 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-deep transition-all"
          >
            <KeyRound size={14} />
            {t('অ্যাডমিন হিসেবে সরাসরি প্রবেশ করুন (1-Click Login)', 'One-Click Admin Login')}
            <ArrowRight size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-line bg-surface p-6 shadow-sm">
          <Field label={t('ইমেইল', 'Email')}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="you@factory.com"
            />
          </Field>
          <Field label={t('পাসওয়ার্ড', 'Password')}>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </Field>
          {error && <p className="text-sm text-red">{error}</p>}
          <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
            {busy ? t('লগইন হচ্ছে…', 'Logging in…') : t('লগইন করুন', 'Log In')}
          </button>
        </form>

        <p className="text-center text-xs text-ink-soft">
          {t('অ্যাডমিন হিসেবে লগইন করার পর Settings থেকে ইমেইল ও পাসওয়ার্ড নিজের মতো পরিবর্তন করে নিতে পারবেন।', 'After logging in as admin, you can change your email & password anytime in Settings.')}
        </p>
      </div>
    </div>
  );
}
