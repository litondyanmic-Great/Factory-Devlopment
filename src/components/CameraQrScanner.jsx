import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, AlertCircle, Upload, CheckCircle2, RefreshCw } from 'lucide-react';
import { useLang } from '../lib/i18n';

export default function CameraQrScanner({ onScan, onClose, autoCloseOnScan = false }) {
  const { t } = useLang();
  // Stable container ID across re-renders
  const containerIdRef = useRef('qr-camera-viewport-' + Math.random().toString(36).substring(2, 9));
  const html5QrCodeInstance = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState('');
  const [lastScanned, setLastScanned] = useState('');
  const [flash, setFlash] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const fileInputRef = useRef(null);

  const [quickBundles, setQuickBundles] = useState([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem('factory_erp_bundles_data');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setQuickBundles(parsed.slice(0, 5));
        }
      }
    } catch {}
  }, []);

  function handleManualSubmit(e) {
    e?.preventDefault();
    if (!manualCode.trim()) return;
    const clean = manualCode.trim();
    setLastScanned(clean);
    setFlash(true);
    setTimeout(() => setFlash(false), 500);
    if (onScan) onScan(clean);
    setManualCode('');
    if (autoCloseOnScan && onClose) onClose();
  }

  function handleQuickClick(code) {
    if (!code) return;
    setLastScanned(code);
    setFlash(true);
    setTimeout(() => setFlash(false), 500);
    if (onScan) onScan(code);
    if (autoCloseOnScan && onClose) onClose();
  }

  async function initCamera() {
    setStarting(true);
    setError('');
    const cid = containerIdRef.current;
    if (!document.getElementById(cid)) {
      setTimeout(initCamera, 100);
      return;
    }

    try {
      if (html5QrCodeInstance.current) {
        try {
          if (html5QrCodeInstance.current.isScanning) {
            await html5QrCodeInstance.current.stop();
          }
          await html5QrCodeInstance.current.clear();
        } catch {}
      }
      const scanner = new Html5Qrcode(cid);
      html5QrCodeInstance.current = scanner;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      function handleSuccess(decodedText) {
        setLastScanned(decodedText);
        setFlash(true);
        setTimeout(() => setFlash(false), 500);

        try {
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
      }

      // Try camera with facingMode environment first
      try {
        await scanner.start({ facingMode: 'environment' }, config, handleSuccess, () => {});
        setCameraActive(true);
        setStarting(false);
      } catch (err1) {
        console.warn('Environment camera failed, trying getCameras fallback:', err1);
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const cameraId = cameras[cameras.length - 1].id || cameras[0].id;
            await scanner.start(cameraId, config, handleSuccess, () => {});
            setCameraActive(true);
            setStarting(false);
          } else {
            await scanner.start({ facingMode: 'user' }, config, handleSuccess, () => {});
            setCameraActive(true);
            setStarting(false);
          }
        } catch (err2) {
          console.error('All camera attempts failed:', err2);
          setStarting(false);
          setError(
            t(
              'ওয়েবক্যাম/ক্যামেরা এক্সেস করা যায়নি (ব্রাউজার অনুমতি প্রয়োজন বা ক্যামেরা অনুপস্থিত)। নিচে সরাসরি কোড লিখুন বা ছবি আপলোড করুন।',
              'Could not access webcam/camera (permission needed or no camera). You can type the code below or upload an image.'
            )
          );
        }
      }
    } catch (e) {
      setStarting(false);
      setError(t('ক্যামেরা চালু করতে সমস্যা হয়েছে।', 'Failed to start camera feed.'));
    }
  }

  useEffect(() => {
    initCamera();
    return () => {
      if (html5QrCodeInstance.current) {
        try {
          if (html5QrCodeInstance.current.isScanning) {
            html5QrCodeInstance.current
              .stop()
              .then(() => html5QrCodeInstance.current?.clear())
              .catch(() => {});
          } else {
            html5QrCodeInstance.current.clear();
          }
        } catch {}
      }
    };
  }, []);

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !html5QrCodeInstance.current) return;
    try {
      const decoded = await html5QrCodeInstance.current.scanFile(file, true);
      if (decoded) {
        setLastScanned(decoded);
        setFlash(true);
        setTimeout(() => setFlash(false), 500);
        if (onScan) onScan(decoded);
        if (autoCloseOnScan && onClose) onClose();
      }
    } catch (err) {
      setError(t('ছবিতে কোনো কিউআর কোড পাওয়া যায়নি। স্পষ্ট ছবি আপলোড করুন।', 'No QR code found in image. Please upload a clear photo.'));
    }
  }

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
    <div className="rounded-xl border-2 border-indigo bg-surface p-4 shadow-md space-y-3">
      <div className="flex items-center justify-between border-b border-line pb-2.5">
        <div className="flex items-center gap-2 text-indigo">
          <Camera size={18} className="animate-pulse" />
          <span className="font-semibold text-xs text-ink">
            {t('লাইভ ক্যামেরা কিউআর / বারকোড স্ক্যানার', 'Live Camera QR / Barcode Scanner')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 rounded bg-paper px-2 py-1 text-xs font-medium text-ink-soft hover:text-ink border border-line"
            title={t('ছবি থেকে স্ক্যান', 'Scan from image file')}
          >
            <Upload size={13} />
            <span className="hidden sm:inline">{t('ছবি আপলোড', 'Upload Image')}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            onClick={handleStop}
            className="rounded p-1 text-ink-soft hover:bg-paper hover:text-red transition cursor-pointer"
            title={t('ক্যামেরা বন্ধ করুন', 'Close Camera')}
          >
            <CameraOff size={16} />
          </button>
        </div>
      </div>

      {starting && !error && (
        <div className="flex flex-col items-center justify-center p-6 text-ink-soft gap-2">
          <RefreshCw size={24} className="animate-spin text-indigo" />
          <p className="text-xs">{t('ক্যামেরা ইনিশিয়ালাইজ হচ্ছে…', 'Initializing camera feed…')}</p>
        </div>
      )}

      {error ? (
        <div className="rounded-lg bg-red-soft/40 p-3 text-xs text-red space-y-2.5">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={initCamera}
              className="flex items-center gap-1.5 rounded bg-surface px-3 py-1.5 font-semibold text-ink border border-line shadow-sm hover:bg-paper"
            >
              <RefreshCw size={13} className="text-indigo" />
              {t('ক্যামেরা পুনরায় চেষ্টা করুন', 'Retry Camera')}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded bg-surface px-3 py-1.5 font-semibold text-ink border border-line shadow-sm hover:bg-paper"
            >
              <Upload size={13} className="text-indigo" />
              {t('কিউআর কোডের ছবি আপলোড করুন', 'Upload QR Image')}
            </button>
          </div>
        </div>
      ) : (
        <div className="relative mx-auto overflow-hidden rounded-lg bg-black max-w-[320px]">
          <div id={containerIdRef.current} className="w-full min-h-[260px]" />
          {flash && (
            <div className="pointer-events-none absolute inset-0 bg-green/40 transition-opacity" />
          )}
          <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-white/60 m-6 rounded-lg flex items-center justify-center">
            <span className="bg-black/70 px-2 py-1 rounded text-[10px] text-white font-medium">
              {t('কিউআর কোড মাঝখানে ধরুন', 'Center QR code inside box')}
            </span>
          </div>
        </div>
      )}

      {/* Manual Input Fallback */}
      <form onSubmit={handleManualSubmit} className="flex gap-2 pt-1 border-t border-line">
        <input
          type="text"
          placeholder={t('বান্ডেল নং লিখুন বা পেস্ট করুন (যেমন: BND-...)', 'Type or paste Bundle No...')}
          className="flex-1 rounded-md border border-line bg-paper px-3 py-1.5 text-xs text-ink placeholder:text-ink-soft focus:border-indigo focus:outline-none"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-md bg-indigo px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-deep cursor-pointer"
        >
          {t('স্ক্যান সাবমিট', 'Submit')}
        </button>
      </form>

      {/* Quick Click Bundles */}
      {quickBundles.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-ink-soft">{t('সাম্প্রতিক বান্ডেল (১-ক্লিক স্ক্যান):', 'Recent Bundles (1-click scan):')}</p>
          <div className="flex flex-wrap gap-1.5">
            {quickBundles.map((b, idx) => (
              <button
                key={`${b.id || b.bundleNo || 'bundle'}-${idx}`}
                type="button"
                onClick={() => handleQuickClick(b.bundleNo)}
                className="rounded border border-indigo/30 bg-indigo-soft/60 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo hover:bg-indigo hover:text-white transition"
              >
                {b.bundleNo} ({b.size || ''} {b.qty ? `${b.qty}pcs` : ''})
              </button>
            ))}
          </div>
        </div>
      )}

      {lastScanned && (
        <div className="flex items-center justify-between rounded bg-green/10 p-2.5 text-xs text-green font-mono">
          <span className="flex items-center gap-1.5 font-bold">
            <CheckCircle2 size={15} />
            {t('স্ক্যান সম্পন্ন:', 'Scanned:')}
          </span>
          <span className="truncate max-w-[200px] text-ink">{lastScanned}</span>
        </div>
      )}
    </div>
  );
}
