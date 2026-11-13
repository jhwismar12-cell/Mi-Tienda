import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  X,
  Flashlight,
  RefreshCw,
  ImagePlus,
  CheckCircle2,
  AlertTriangle,
  ScanBarcode,
  Loader2,
  Repeat
} from 'lucide-react';
import { BrowserMultiFormatReader, BrowserCodeReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { sounds } from '../../utils/audio';

export const RETAIL_BARCODE_FORMATS: BarcodeFormat[] = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
  BarcodeFormat.QR_CODE
];

export function createBarcodeReader(): BrowserMultiFormatReader {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, RETAIL_BARCODE_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints, {
    delayBetweenScanAttempts: 180,
    delayBetweenScanSuccess: 1500
  });
}

interface NativeBarcodeDetector {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
}

function getNativeBarcodeDetector(): NativeBarcodeDetector | null {
  if (typeof window === 'undefined') return null;
  const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => NativeBarcodeDetector }).BarcodeDetector;
  if (typeof Detector !== 'function') return null;
  try {
    return new Detector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'codabar', 'qr_code']
    });
  } catch {
    return null;
  }
}

export interface BarcodeCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  title?: string;
  subtitle?: string;
  allowContinuous?: boolean;
  defaultContinuous?: boolean;
  lastFeedback?: string | null;
}

export const BarcodeCameraModal: React.FC<BarcodeCameraModalProps> = ({
  isOpen,
  onClose,
  onDetected,
  title = 'Escanear Código de Barras con Cámara',
  subtitle = 'Apunta la cámara trasera al código de barras del producto',
  allowContinuous = false,
  defaultContinuous = false,
  lastFeedback = null
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  const isOpenRef = useRef(isOpen);
  const isMountedRef = useRef(true);
  const openEpochRef = useRef(0);
  onDetectedRef.current = onDetected;
  onCloseRef.current = onClose;
  isOpenRef.current = isOpen;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      openEpochRef.current += 1;
    };
  }, []);

  const [continuous, setContinuous] = useState(defaultContinuous);
  const continuousRef = useRef(continuous);
  continuousRef.current = continuous;

  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceIdx, setSelectedDeviceIdx] = useState(0);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [isDecodingPhoto, setIsDecodingPhoto] = useState(false);

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      /* noop */
    }
    controlsRef.current = null;
    try {
      BrowserCodeReader.releaseAllStreams();
    } catch {
      /* noop */
    }
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const handleDecodedValue = useCallback(
    (rawCode: string) => {
      if (!isOpenRef.current || !isMountedRef.current) return;
      const code = rawCode.trim();
      if (!code) return;

      const now = Date.now();
      if (
        lastScanRef.current &&
        lastScanRef.current.code === code &&
        now - lastScanRef.current.at < 1800
      ) {
        return;
      }

      lastScanRef.current = { code, at: now };
      setLastScannedCode(code);
      setCameraError(null);

      try {
        sounds.playScanBeep();
      } catch {
        /* noop */
      }
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(70);
        }
      } catch {
        /* noop */
      }

      onDetectedRef.current(code);
      if (!continuousRef.current) {
        stopCamera();
        onCloseRef.current();
      }
    },
    [stopCamera]
  );

  const closeModal = useCallback(() => {
    openEpochRef.current += 1;
    isOpenRef.current = false;
    stopCamera();
    onCloseRef.current();
  }, [stopCamera]);

  useEffect(() => {
    openEpochRef.current += 1;
    if (isOpen) {
      setContinuous(defaultContinuous);
      setLastScannedCode(null);
      setCameraError(null);
      setIsDecodingPhoto(false);
      lastScanRef.current = null;
    } else {
      setIsDecodingPhoto(false);
    }
    return () => {
      openEpochRef.current += 1;
    };
  }, [isOpen, defaultContinuous]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, closeModal]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let cancelled = false;
    let nativeTimer: ReturnType<typeof setInterval> | null = null;

    const startScanner = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          'Tu navegador no permite acceso directo a la cámara en vivo aquí. Usa el botón "Tomar foto / Galería" abajo.'
        );
        return;
      }

      const videoEl = videoRef.current;
      if (!videoEl) return;

      setIsStarting(true);
      setCameraError(null);

      try {
        const reader = createBarcodeReader();
        const activeDevice = devices[selectedDeviceIdx];
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: activeDevice
            ? { deviceId: { exact: activeDevice.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        };

        const controls = await reader.decodeFromConstraints(constraints, videoEl, (result) => {
          if (cancelled || !result) return;
          handleDecodedValue(result.getText());
        });

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setIsStarting(false);

        // Discover cameras after permission is granted so mobile labels populate
        try {
          const allDevices = await BrowserCodeReader.listVideoInputDevices();
          if (!cancelled && allDevices.length > 0) {
            setDevices(prev => (prev.length === allDevices.length ? prev : allDevices));
          }
        } catch {
          /* noop */
        }

        // Check torch/flashlight capability
        try {
          if (controls.switchTorch && controls.streamVideoCapabilitiesGet) {
            const caps = controls.streamVideoCapabilitiesGet(track => [track]) as MediaTrackCapabilities & {
              torch?: boolean;
            };
            if (caps && 'torch' in caps && caps.torch) {
              setTorchSupported(true);
            }
          }
        } catch {
          /* noop */
        }

        // Run native BarcodeDetector in parallel where supported (fast GPU pass on Android Chrome)
        const nativeDetector = getNativeBarcodeDetector();
        if (nativeDetector) {
          nativeTimer = setInterval(async () => {
            if (cancelled || !videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const detected = await nativeDetector.detect(videoRef.current);
              const val = detected.find(d => d.rawValue)?.rawValue;
              if (val) {
                handleDecodedValue(val);
              }
            } catch {
              /* noop */
            }
          }, 220);
        }
      } catch (err) {
        if (cancelled) return;
        setIsStarting(false);
        const message =
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Permiso de cámara denegado. Habilita la cámara en tu navegador o usa "Tomar foto / Galería".'
            : 'No se pudo iniciar la cámara en vivo. Puedes usar "Tomar foto / Galería" para extraer el código.';
        setCameraError(message);
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      if (nativeTimer !== null) clearInterval(nativeTimer);
      stopCamera();
    };
  }, [isOpen, selectedDeviceIdx, handleDecodedValue, stopCamera]);

  const handleToggleTorch = async () => {
    if (!controlsRef.current?.switchTorch) return;
    const next = !torchOn;
    try {
      await controlsRef.current.switchTorch(next);
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  };

  const handleSwitchCamera = () => {
    if (devices.length <= 1) return;
    setSelectedDeviceIdx(prev => (prev + 1) % devices.length);
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isOpenRef.current) return;

    const requestEpoch = openEpochRef.current;
    const isStale = () =>
      !isMountedRef.current || !isOpenRef.current || openEpochRef.current !== requestEpoch;

    setIsDecodingPhoto(true);
    setCameraError(null);
    const objectUrl = URL.createObjectURL(file);

    try {
      let decodedText: string | null = null;

      // Try native detector on ImageBitmap / Image first if available
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('No se pudo cargar la fotografía'));
        el.src = objectUrl;
      });
      if (isStale()) return;

      const nativeDetector = getNativeBarcodeDetector();
      if (nativeDetector) {
        try {
          const found = await nativeDetector.detect(img);
          if (isStale()) return;
          decodedText = found.find(f => f.rawValue)?.rawValue || null;
        } catch {
          /* fallback to zxing */
        }
      }

      if (!decodedText) {
        const reader = createBarcodeReader();
        const res = await reader.decodeFromImageElement(img);
        if (isStale()) return;
        decodedText = res.getText();
      }

      if (isStale()) return;

      if (decodedText) {
        handleDecodedValue(decodedText);
      } else {
        setCameraError('No se detectó ningún código de barras en la foto. Acerca más el código e intenta de nuevo.');
      }
    } catch {
      if (!isStale()) {
        setCameraError('No se pudo leer el código de barras en la foto. Asegúrate de que esté enfocado y bien iluminado.');
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
      if (isMountedRef.current && openEpochRef.current === requestEpoch) {
        setIsDecodingPhoto(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={closeModal}
    >
      <div
        className="bg-[var(--ui-surface)] rounded-none sm:rounded-2xl border-0 sm:border border-[var(--ui-border)] shadow-2xl w-full max-w-lg h-[100dvh] sm:h-auto sm:max-h-[92vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-[var(--ui-chrome)] text-white flex items-center justify-between gap-2 shrink-0 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[var(--ui-brand)] flex items-center justify-center shrink-0">
              <ScanBarcode className="w-4 h-4 text-[var(--ui-mint)]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm sm:text-base leading-tight truncate">{title}</h2>
              <p className="text-[11px] text-white/75 truncate">{subtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            aria-label="Cerrar escáner de cámara"
            className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Continuous mode bar (when allowed) */}
        {allowContinuous && (
          <div className="px-4 py-2 bg-[var(--ui-surface-muted)] border-b border-[var(--ui-border)] flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setContinuous(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                continuous
                  ? 'bg-[var(--ui-brand)] text-white border-[var(--ui-brand)]'
                  : 'bg-[var(--ui-surface)] text-[var(--ui-secondary)] border-[var(--ui-border)]'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>{continuous ? 'Escaneo continuo: ACTIVO' : 'Escaneo continuo: DESACTIVADO'}</span>
            </button>
            <span className="text-[11px] text-[var(--ui-muted)]">
              {continuous ? 'Escanea varios sin cerrar' : 'Cierra al leer 1 código'}
            </span>
          </div>
        )}

        {/* Camera Viewfinder */}
        <div className="flex-1 bg-black relative flex flex-col items-center justify-center overflow-hidden min-h-[260px] sm:min-h-[320px]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Targeting reticle */}
          {!cameraError && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6">
              <div className="w-full max-w-[280px] aspect-[16/9] border-2 border-[var(--ui-mint)] rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.42)] relative overflow-hidden">
                <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
              </div>
              <span className="mt-4 px-3 py-1 rounded-full bg-black/65 text-white text-[11px] font-medium backdrop-blur-xs">
                {isStarting ? 'Iniciando cámara…' : 'Centra las barras dentro del recuadro'}
              </span>
            </div>
          )}

          {/* Top-right camera controls overlay */}
          <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
            {torchSupported && (
              <button
                type="button"
                onClick={handleToggleTorch}
                aria-label={torchOn ? 'Apagar linterna' : 'Encender linterna'}
                className={`p-2.5 rounded-full backdrop-blur-xs border transition-colors cursor-pointer ${
                  torchOn
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-black/55 text-white border-white/25 hover:bg-black/75'
                }`}
              >
                <Flashlight className="w-4 h-4" />
              </button>
            )}
            {devices.length > 1 && (
              <button
                type="button"
                onClick={handleSwitchCamera}
                aria-label="Cambiar de cámara"
                className="p-2.5 rounded-full bg-black/55 hover:bg-black/75 text-white border border-white/25 backdrop-blur-xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Live feedback pill */}
          {(lastScannedCode || lastFeedback) && !cameraError && (
            <div className="absolute bottom-3 left-3 right-3 z-10 bg-emerald-600/95 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shadow-lg">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {lastFeedback || `Código detectado: ${lastScannedCode}`}
                </span>
              </div>
              {lastScannedCode && (
                <span className="font-mono text-[11px] bg-black/25 px-2 py-0.5 rounded shrink-0">
                  {lastScannedCode}
                </span>
              )}
            </div>
          )}

          {/* Camera Error Banner */}
          {cameraError && (
            <div className="absolute inset-x-4 z-10 bg-[var(--ui-surface)] border border-[var(--ui-danger-border)] text-[var(--ui-danger-text)] p-4 rounded-xl shadow-xl text-xs sm:text-sm space-y-2 text-center">
              <AlertTriangle className="w-6 h-6 mx-auto text-[var(--ui-danger-text)]" />
              <p className="font-semibold">{cameraError}</p>
            </div>
          )}
        </div>

        {/* Footer Actions: Photo Fallback + Done */}
        <div className="px-4 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] bg-[var(--ui-surface)] border-t border-[var(--ui-border)] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoSelected}
          />
          <button
            type="button"
            disabled={isDecodingPhoto}
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2.5 min-h-[42px] rounded-xl bg-[var(--ui-surface-muted)] hover:bg-[var(--ui-surface-hover)] border border-[var(--ui-border)] text-[var(--ui-text)] text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isDecodingPhoto ? (
              <Loader2 className="w-4 h-4 animate-spin text-[var(--ui-brand-strong)]" />
            ) : (
              <ImagePlus className="w-4 h-4 text-[var(--ui-brand-strong)]" />
            )}
            <span>{isDecodingPhoto ? 'Leyendo foto…' : 'Tomar foto / Galería'}</span>
          </button>

          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-2.5 min-h-[42px] rounded-xl bg-[var(--ui-chrome)] hover:bg-[var(--ui-chrome-raised)] text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer ml-auto"
          >
            <Camera className="w-4 h-4 text-[var(--ui-mint)]" />
            <span>{continuous && lastScannedCode ? 'Listo · Continuar' : 'Cerrar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
