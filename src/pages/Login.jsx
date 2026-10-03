import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Field, inputClass, btnPrimary } from '../components/ui';
import { useLang } from '../lib/i18n';
import { useSettings } from '../lib/settingsContext';

export default function Login() {
  const { login } = useAuth();
  const { t, lang } = useLang();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const companyName = lang === 'en' ? settings?.companyNameEn || settings?.companyName : settings?.companyName;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError(t('ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।', 'Incorrect email or password.'));
      } else if (err.code === 'auth/too-many-requests') {
        setError(t('অতিরিক্ত চেষ্টার কারণে সাময়িক ব্লক। কিছুক্ষণ পর আবার চেষ্টা করুন।', 'Too many attempts. Please try again later.'));
      } else {
        setError(t('লগইন করা যায়নি। অনুগ্রহ করে সঠিক তথ্য দিন।', 'Could not log in. Please check your credentials.'));
      }
    } finally {
      setBusy(false);
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

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-line bg-surface p-6 shadow-sm">
          <Field label={t('ইমেইল', 'Email')}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="name@factory.com"
            />
          </Field>
          <Field label={t('পাসওয়ার্ড', 'Password')}>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </Field>
          {error && <p className="text-sm text-red">{error}</p>}
          <button type="submit" disabled={busy} className={`${btnPrimary} w-full py-2.5`}>
            {busy ? t('লগইন হচ্ছে…', 'Logging in…') : t('লগইন করুন', 'Log In')}
          </button>
        </form>

        <p className="text-center text-sm text-ink-soft">
          {t('অ্যাকাউন্ট নেই?', "Don't have an account?")}{' '}
          <Link to="/signup" className="font-semibold text-indigo hover:underline">
            {t('নতুন অ্যাকাউন্ট তৈরি করুন', 'Create Account / Sign Up')}
          </Link>
        </p>
      </div>
    </div>
  );
}
