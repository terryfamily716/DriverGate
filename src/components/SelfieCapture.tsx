import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Upload, VideoOff } from 'lucide-react';

interface SelfieCaptureProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  error?: string | null;
}

export function SelfieCapture({ value, onChange, error }: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'active' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const startCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState('error');
      setCameraError('Live camera is unavailable in this browser. Upload a selfie photo instead.');
      return;
    }

    setCameraState('starting');
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 960 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState('active');
    } catch {
      stopCamera();
      setCameraState('error');
      setCameraError(
        'Camera access was blocked or no webcam was found. You can upload a clear selfie photo below.'
      );
    }
  };

  const captureFromVideo = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    const maxWidth = 720;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
    onChange(dataUrl);
    stopCamera();
    setCameraState('idle');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setCameraError('Please select a JPEG, PNG, or WebP photo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 720;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
        setCameraError(null);
        stopCamera();
        setCameraState('idle');
        onChange(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRetake = () => {
    onChange(null);
    setCameraError(null);
    void startCamera();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Verification Selfie</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Required for administrator identity approval before badge issuance.
          </p>
        </div>
        {value && (
          <span className="text-xs font-medium text-emerald-700 whitespace-nowrap">
            Photo Ready
          </span>
        )}
      </div>

      <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-200 flex items-center justify-center">
        {value ? (
          <img
            src={value}
            alt="Driver verification selfie preview"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover -scale-x-100 ${
                cameraState === 'active' ? 'block' : 'hidden'
              }`}
            />

            {cameraState === 'active' && (
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                aria-hidden="true"
              >
                <div className="w-44 h-56 rounded-full border-2 border-dashed border-white/60 shadow-[0_0_0_9999px_rgba(15,23,42,0.28)]" />
              </div>
            )}

            {cameraState !== 'active' && (
              <div className="px-6 py-8 text-center max-w-sm">
                <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center mx-auto mb-3">
                  {cameraState === 'error' ? (
                    <VideoOff className="w-5 h-5 text-amber-400" aria-hidden="true" />
                  ) : (
                    <Camera className="w-5 h-5" aria-hidden="true" />
                  )}
                </div>
                <p className="text-sm font-medium text-white">
                  {cameraState === 'starting'
                    ? 'Starting camera...'
                    : cameraState === 'error'
                      ? 'Camera Unavailable'
                      : 'Take a Live Verification Selfie'}
                </p>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  {cameraError ??
                    'Center your face in good lighting. The administrator compares this selfie against your profile.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {value ? (
          <>
            <button
              type="button"
              onClick={handleRetake}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>Retake Selfie</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              <span>Replace Photo</span>
            </button>
          </>
        ) : cameraState === 'active' ? (
          <>
            <button
              type="button"
              onClick={captureFromVideo}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 text-sm font-semibold text-white hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-4 h-4" aria-hidden="true" />
              <span>Take Selfie</span>
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setCameraState('idle');
              }}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel Camera
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void startCamera()}
              disabled={cameraState === 'starting'}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-4 h-4" aria-hidden="true" />
              <span>{cameraState === 'starting' ? 'Connecting...' : 'Open Camera'}</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              <span>Upload Photo</span>
            </button>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="user"
          onChange={handleFileUpload}
          className="hidden"
          aria-label="Upload verification selfie photo"
        />
      </div>

      {error && (
        <p className="mt-2.5 text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
