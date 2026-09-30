import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLang } from '../lib/i18n';

export default function CameraQrScanner({ onScan, onClose, autoCloseOnScan = false }) {
  const { t } = useLang();
  const scannerRef = useRef(null);
  const html5QrCodeInstance = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState('');
  const [lastScanned, setLastScanned] = useState('');
  const [flash, setFlash] = useState(false);

  const containerId = 'qr-camera-viewport-' + Math.random().toString(36).substring(2, 9);

  useEffect(() => {
    let isMounted = true;
    const scanner = new Html5Qrcode(containerId);
    html5QrCodeInstance.current = scanner;

    const config = {
      fps: 12,
      qrbox: { width: 240, height: 240 },
      aspectRatio: 1.0,
    };

    scanner
      .start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          if (!isMounted) return;
          setLastScanned(decodedText);
          setFlash(true);
          setTimeout(() => setFlash(false), 500);

          try {
            // Beep audio feedback
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(880, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.15);
          } catch {}

          if (onScan) {
            onScan(decodedText);
          }
          if (autoCloseOnScan && onClose) {
            onClose();
          }
        },
        () => {
          // ignore ordinary video frame misses
        }
      )
      .then(() => {
        if (isMounted) setCameraActive(true);
      })
      .catch((err) => {
        if (isMounted) {
          setError(
            t(
              'ক্যামেরা চালু করা যায়নি। ব্রাউজারের ক্যামেরা পারমিশন এলাউ (Allow) আছে কিনা নিশ্চিত করুন।',
              'Could not start camera. Please ensure camera permissions are allowed in your browser.'
            )
          );
        }
      });

    return () => {
      isMounted = false;
      if (html5QrCodeInstance.current) {
        if (html5QrCodeInstance.current.isScanning) {
          html5QrCodeInstance.current
            .stop()
            .then(() => html5QrCodeInstance.current?.clear())
            .catch(() => {});
        } else {
          html5QrCodeInstance.current.clear();
        }
      }
    };
  }, [containerId, onScan, autoCloseOnScan, onClose, t]);

  function handleStop() {
    if (html5QrCodeInstance.current && html5QrCodeInstance.current.isScanning) {
      html5QrCodeInstance.current
        .stop()
        .then(() => {
          setCameraActive(false);
          if (onClose) onClose();
        })
        .catch(() => {
          if (onClose) onClose();
        });
    } else {
      if (onClose) onClose();
    }
  }

  return (
    <div className="rounded-lg border-2 border-indigo bg-surface p-4 shadow-md space-y-3">
      <div className="flex items-center justify-between border-b border-line pb-2.5">
        <div className="flex items-center gap-2 text-indigo">
          <Camera size={18} className="animate-pulse" />
          <span className="font-semibold text-xs text-ink">
            {t('লাইভ ক্যামেরা কিউআর / বারকোড স্ক্যানার', 'Live Camera QR / Barcode Scanner')}
          </span>
        </div>
        <button
          type="button"
          onClick={handleStop}
          className="rounded p-1 text-ink-soft hover:bg-paper hover:text-red transition cursor-pointer"
          title={t('ক্যামেরা বন্ধ করুন', 'Close Camera')}
        >
          <CameraOff size={16} />
        </button>
      </div>

      {error ? (
        <div className="rounded bg-red-soft/40 p-3 text-xs text-red flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      ) : (
        <div className="relative mx-auto overflow-hidden rounded-md bg-black max-w-[320px]">
          <div id={containerId} className="w-full min-h-[260px]" />
          {flash && (
            <div className="pointer-events-none absolute inset-0 bg-green/30 transition-opacity" />
          )}
          <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-white/50 m-6 rounded-lg flex items-center justify-center">
            <span className="bg-black/60 px-2 py-1 rounded text-[10px] text-white">
              {t('কিউআর কোড মাঝখানে ধরুন', 'Center QR code inside box')}
            </span>
          </div>
        </div>
      )}

      {lastScanned && (
        <div className="rounded bg-green-soft/40 p-2 text-center text-xs font-mono font-bold text-green flex items-center justify-center gap-1.5">
          <CheckCircle2 size={14} />
          {t('স্ক্যান হয়েছে:', 'Scanned:')} {lastScanned}
        </div>
      )}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleStop}
          className="rounded-md border border-line bg-paper px-3 py-1 text-xs text-ink hover:bg-line transition cursor-pointer"
        >
          {t('ক্যামেরা বন্ধ করুন', 'Close Camera')}
        </button>
      </div>
    </div>
  );
}
