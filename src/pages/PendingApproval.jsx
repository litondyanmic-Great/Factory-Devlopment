import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { btnSecondary } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../lib/i18n';
import { Clock, LogOut, RefreshCw } from 'lucide-react';

export default function PendingApproval() {
  const { user, profile, logout } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (profile?.status === 'active') {
      navigate('/', { replace: true });
    }
  }, [profile?.status, navigate]);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  function handleRefresh() {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      if (profile?.status === 'active') {
        navigate('/');
      }
    }, 600);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-lg space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
          <Clock size={32} />
        </div>

        <div>
          <h1 className="font-display text-xl font-bold text-ink">
            {t('অনুমোদনের অপেক্ষায় রয়েছে', 'Account Awaiting Approval')}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {profile?.name || user?.displayName || user?.email ? (
              <span className="font-medium text-ink block mb-1">
                {profile?.name || user?.displayName} ({user?.email})
              </span>
            ) : null}
            {t(
              'আপনার অ্যাকাউন্টটি সফলভাবে তৈরি হয়েছে। ফ্যাক্টরি অ্যাডমিন আপনার রোল ও সেকশন নির্ধারণ করে অনুমোদন করলেই আপনি ড্যাশবোর্ডে প্রবেশ করতে পারবেন।',
              'Your account has been created and is awaiting administrator approval. Once an admin assigns your department and approves your account, you will have access.'
            )}
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <button
            type="button"
            disabled={checking}
            onClick={handleRefresh}
            className="w-full rounded-md border border-line bg-paper px-4 py-2.5 text-xs font-semibold text-ink hover:bg-surface transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
            {checking ? t('চেক করা হচ্ছে…', 'Checking…') : t('স্ট্যাটাস রিফ্রেশ করুন', 'Check Approval Status')}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className={`${btnSecondary} w-full flex items-center justify-center gap-1.5 !text-xs`}
          >
            <LogOut size={14} />
            {t('লগ আউট', 'Log Out')}
          </button>
        </div>
      </div>
    </div>
  );
}
