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
  const fileInputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const cid = containerIdRef.current;
    const scanner = new Html5Qrcode(cid);
    html5QrCodeInstance.current = scanner;

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };

    function handleSuccess(decodedText) {
      if (!isMounted) return;
      setLastScanned(decodedText);
      setFlash(true);
      setTimeout(() => setFlash(false), 500);

      try {
        // Audio beep feedback
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

    // Smart multi-stage camera startup:
    // 1. Try back/environment camera
    // 2. If OverconstrainedError or fails, try any available camera from getCameras()
    // 3. If that fails, fallback to user camera
    async function startCamera() {
      setStarting(true);
      setError('');

      try {
        // First try back camera
        await scanner.start({ facingMode: 'environment' }, config, handleSuccess, () => {});
        if (isMounted) {
          setCameraActive(true);
          setStarting(false);
        }
      } catch (err1) {
        console.warn('Environment camera failed, trying getCameras fallback:', err1);
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const cameraId = cameras[cameras.length - 1].id || cameras[0].id;
            await scanner.start(cameraId, config, handleSuccess, () => {});
            if (isMounted) {
              setCameraActive(true);
              setStarting(false);
            }
          } else {
            // Try standard video
            await scanner.start({ facingMode: 'user' }, config, handleSuccess, () => {});
            if (isMounted) {
              setCameraActive(true);
              setStarting(false);
            }
          }
        } catch (err2) {
          console.error('All camera attempts failed:', err2);
          if (isMounted) {
            setStarting(false);
            setError(
              t(
                'ক্যামেরা ওপেন করা যায়নি (অনুমতি দেওয়া নেই অথবা ওয়েবক্যাম কানেক্টেড নেই)। নিচের "ছবি আপলোড করুন" অপশন বা সরাসরি কোড লিখে এন্ট্রি করতে পারেন।',
                'Could not start camera (permission denied or no webcam detected). You can use "Scan from Image" below or type code directly.'
              )
            );
          }
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
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
        <div className="rounded-lg bg-red-soft/40 p-3 text-xs text-red space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded bg-surface px-3 py-1.5 font-semibold text-ink border border-line shadow-sm hover:bg-paper"
          >
            <Upload size={14} className="text-indigo" />
            {t('কিউআর কোডের ছবি আপলোড করে স্ক্যান করুন', 'Upload QR Code Image Instead')}
          </button>
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
