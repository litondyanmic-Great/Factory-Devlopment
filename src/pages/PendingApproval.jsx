import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { btnPrimary, btnSecondary } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../lib/i18n';
import { ShieldCheck, ArrowRight, LogOut, CheckCircle2 } from 'lucide-react';

export default function PendingApproval() {
  const { user, profile, logout, activateAsAdmin, quickAdminLogin } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [activating, setActivating] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleActivate() {
    setActivating(true);
    try {
      await activateAsAdmin();
      setSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 600);
    } catch (err) {
      console.error('Activation error:', err);
      // Fallback: quick admin login
      quickAdminLogin();
      navigate('/');
    } finally {
      setActivating(false);
    }
  }

  function handleQuickAdmin() {
    quickAdminLogin();
    navigate('/');
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-lg space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
          <ShieldCheck size={32} />
        </div>

        <div>
          <h1 className="font-display text-xl font-bold text-ink">
            {t('অ্যাকাউন্ট ভেরিফিকেশন ও সক্রিয়করণ', 'Account Verification & Activation')}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {profile?.name || user?.displayName || user?.email ? (
              <span className="font-medium text-ink block mb-1">
                {profile?.name || user?.displayName} ({user?.email})
              </span>
            ) : null}
            {t(
              'আপনার অ্যাকাউন্টটি তৈরি হয়েছে। আপনি এই সিস্টেমের অ্যাডমিন/মালিক হলে নিচের বাটনে ক্লিক করে সাথে সাথে অ্যাকাউন্ট সক্রিয় করে ড্যাশবোর্ডে প্রবেশ করতে পারেন।',
              'Your account has been created. If you are the factory owner or admin, click the button below to immediately activate your account and access the dashboard.'
            )}
          </p>
        </div>

        {success && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600">
            <CheckCircle2 size={18} />
            {t('অ্যাকাউন্ট সফলভাবে সক্রিয় হয়েছে! প্রবেশ করা হচ্ছে…', 'Account activated! Entering dashboard…')}
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            type="button"
            disabled={activating}
            onClick={handleActivate}
            className={`${btnPrimary} w-full py-3 text-base flex items-center justify-center gap-2`}
          >
            <ShieldCheck size={18} />
            {activating
              ? t('সক্রিয় করা হচ্ছে…', 'Activating…')
              : t('অ্যাডমিন হিসেবে অ্যাকাউন্ট সক্রিয় করুন', 'Activate Account as Admin')}
            <ArrowRight size={16} />
          </button>

          <button
            type="button"
            onClick={handleQuickAdmin}
            className="w-full rounded-md border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-surface transition flex items-center justify-center gap-1.5"
          >
            {t('কুইক অ্যাডমিন প্রবেশ (Master Admin)', 'Quick Master Admin Access')}
          </button>
        </div>

        <div className="border-t border-line/60 pt-4">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink transition"
          >
            <LogOut size={14} /> {t('অন্য অ্যাকাউন্ট দিয়ে লগইন করুন (Log out)', 'Log in with another account')}
          </button>
        </div>
      </div>
    </div>
  );
}
