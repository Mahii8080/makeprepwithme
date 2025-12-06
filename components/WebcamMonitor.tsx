
import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';

// FaceDetector API might not be in standard TypeScript lib
declare global {
  interface Window {
    FaceDetector: any;
  }
  class FaceDetector {
    constructor(options?: { fastMode?: boolean; maxDetectedFaces?: number });
    detect(image: ImageBitmapSource): Promise<any[]>;
  }
}


interface WebcamMonitorProps {
  onUserPresent: () => void;
  onUserNotPresent: () => void;
}

type WebcamStatus = 'initializing' | 'waiting' | 'active' | 'error';

const ABSENCE_TIMEOUT = 3000; // 3 seconds of absence triggers the warning
const CHECK_INTERVAL = 500; // Check every 0.5 seconds

export const WebcamMonitor = forwardRef<HTMLVideoElement, WebcamMonitorProps>(({ onUserPresent, onUserNotPresent }, ref) => {
  const videoRefInternal = useRef<HTMLVideoElement>(null);
  useImperativeHandle(ref, () => videoRefInternal.current as HTMLVideoElement);
  
  const absenceTimerRef = useRef<number | null>(null);
  const faceDetectorRef = useRef<FaceDetector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalIdRef = useRef<number | null>(null);
  const [status, setStatus] = useState<WebcamStatus>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const detectFace = useCallback(async () => {
    if (!videoRefInternal.current || !faceDetectorRef.current || videoRefInternal.current.paused || videoRefInternal.current.ended || videoRefInternal.current.videoWidth === 0) {
      return;
    }

    try {
      const faces = await faceDetectorRef.current.detect(videoRefInternal.current);
      if (faces.length > 0) {
        // User is present
        if (absenceTimerRef.current) {
          clearTimeout(absenceTimerRef.current);
          absenceTimerRef.current = null;
        }
        onUserPresent();
      } else {
        // User might not be present
        if (!absenceTimerRef.current) {
          absenceTimerRef.current = window.setTimeout(() => {
            onUserNotPresent();
          }, ABSENCE_TIMEOUT);
        }
      }
    } catch (err) {
      console.error("Face detection failed:", err);
      // Fallback: assume presence to avoid breaking the flow on a glitch
      onUserPresent();
    }
  }, [onUserNotPresent, onUserPresent]);

  // Start or retry camera stream on demand
  const startStream = async () => {
    try {
      setErrorMessage(null);
      setStatus('waiting');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRefInternal.current) {
        const videoEl = videoRefInternal.current;
        videoEl.srcObject = streamRef.current;

        const startVideo = () => {
          videoEl.play().catch(e => console.warn('Video play failed:', e)).finally(() => {
            setStatus('active');
            if (faceDetectorRef.current) {
              if (intervalIdRef.current) clearInterval(intervalIdRef.current);
              intervalIdRef.current = window.setInterval(detectFace, CHECK_INTERVAL);
            } else {
              onUserPresent();
            }
          });
        };

        if (videoEl.readyState >= 2) {
          startVideo();
        } else {
          const onCanPlay = () => {
            startVideo();
            videoEl.removeEventListener('canplay', onCanPlay);
            videoEl.removeEventListener('loadedmetadata', onCanPlay);
          };
          videoEl.addEventListener('canplay', onCanPlay);
          videoEl.addEventListener('loadedmetadata', onCanPlay);
        }
      }
    } catch (err) {
      console.error('Error accessing webcam:', err);
      setErrorMessage('Could not access webcam. Please check permissions and retry.');
      setStatus('error');
      throw err;
    }
  };

  useEffect(() => {
    // Initialize face detector if available
    setStatus('initializing');
    if ('FaceDetector' in window) {
      try {
        faceDetectorRef.current = new window.FaceDetector({ fastMode: true });
      } catch (err) {
        console.warn('Failed to create FaceDetector, proceeding without it:', err);
        faceDetectorRef.current = null;
      }
    } else {
      faceDetectorRef.current = null;
    }

    // Try to start the stream automatically; if user blocked, UI shows retry
    (async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          setStatus('waiting');
          await startStream();
        } else {
          throw new Error('getUserMedia not supported');
        }
      } catch (err) {
        console.warn('Automatic stream start failed (will wait for user action):', err);
        setStatus('waiting');
      }
    })();

    return () => {
      // Cleanup on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      if (absenceTimerRef.current) {
        clearTimeout(absenceTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectFace]);

  const renderContent = () => {
    switch (status) {
        case 'error':
            return <div className="text-red-400 bg-red-900/50 p-3 rounded-lg text-center text-sm flex items-center justify-center h-full">{errorMessage}</div>;
        case 'initializing':
            return <div className="text-gray-400 flex items-center justify-center h-full animate-pulse">Initializing Camera...</div>;
        case 'waiting':
            return (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="text-gray-400 mb-3">Waiting for camera permission...</div>
                <button
                  onClick={() => startStream().catch(()=>{})}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-md"
                >
                  Enable Camera
                </button>
              </div>
            );
        case 'active':
            return (
                <>
              <video ref={videoRefInternal} className="w-full h-full object-cover transform scaleX(-1)" muted playsInline autoPlay />
                    <div className="absolute top-2 left-2 bg-red-600/80 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                        LIVE
                    </div>
                </>
            );
    }
  };

  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden relative shadow-lg flex items-center justify-center">
      {renderContent()}
    </div>
  );
});