import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

interface WebcamMonitorProps {
  onUserPresent: () => void;
  onUserNotPresent: () => void;
}

export const WebcamMonitor = forwardRef<HTMLVideoElement, WebcamMonitorProps>(
  ({ onUserPresent, onUserNotPresent }, ref) => {
    const [error, setError] = React.useState<string | null>(null);
    const [isCamStarted, setIsCamStarted] = React.useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const lastFrameRef = useRef<ImageData | null>(null);
    const detectionIntervalRef = useRef<number | null>(null);
    const isPresentRef = useRef<boolean>(true);
 
    // Expose the video element and control methods to the parent
    useImperativeHandle(ref, () => ({
      get video() { return videoRef.current; },
      start: startWebcam,
      stop: () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
          setIsCamStarted(false);
        }
      }
    } as any));
 
    const startWebcam = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Webcam not supported or blocked (check HTTPS)");
        return;
      }
      try {
        console.log("WebcamMonitor: Requesting camera access...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Use a promise-ready approach for play
          try {
            await videoRef.current.play();
            setIsCamStarted(true);
            setError(null);
            console.log("WebcamMonitor: Camera started successfully.");
          } catch (playErr) {
            console.warn("WebcamMonitor: Auto-play blocked, waiting for user interaction.", playErr);
            setError("Auto-play blocked. Please click to start.");
          }
        }
      } catch (err: any) {
        console.error("WebcamMonitor: Error accessing webcam:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError("Camera permission denied. Please allow access in browser settings.");
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError("No camera device found.");
        } else {
          setError("Webcam error: " + (err.message || "Unknown error"));
        }
      }
    };

    useEffect(() => {
      startWebcam();
 
      // Basic presence/motion detection
      detectionIntervalRef.current = window.setInterval(() => {
        if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return;
 
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
 
        canvas.width = 160; // Low res for performance
        canvas.height = 120;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        try {
          const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          if (lastFrameRef.current) {
            let diff = 0;
            const data1 = lastFrameRef.current.data;
            const data2 = currentFrame.data;
            
            // Compare every 16th pixel to save CPU
            for (let i = 0; i < data1.length; i += 64) {
              diff += Math.abs(data1[i] - data2[i]);
              diff += Math.abs(data1[i+1] - data2[i+1]);
              diff += Math.abs(data1[i+2] - data2[i+2]);
            }
            
            const threshold = (canvas.width * canvas.height * 3) / 10; // Adjusted threshold
            const currentlyPresent = diff > threshold;

            if (currentlyPresent !== isPresentRef.current) {
              isPresentRef.current = currentlyPresent;
              if (currentlyPresent) {
                onUserPresent();
              } else {
                onUserNotPresent();
              }
            }
          }
          lastFrameRef.current = currentFrame;
        } catch (e) {}
      }, 1000);
 
      return () => {
        console.log("WebcamMonitor: Cleaning up...");
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (detectionIntervalRef.current) {
          clearInterval(detectionIntervalRef.current);
        }
      };
    }, [onUserPresent, onUserNotPresent]);
 
    return (
      <div 
        className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden rounded-lg cursor-pointer group"
        onClick={() => !isCamStarted && startWebcam()}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover rounded-lg transition-opacity duration-500 ${isCamStarted ? 'opacity-100' : 'opacity-0'}`}
        />
        
        {(!isCamStarted || error) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-gray-900/80 backdrop-blur-sm z-20">
            {error ? (
              <>
                <div className="w-12 h-12 bg-red-900/40 rounded-full flex items-center justify-center mb-3">
                  <span className="text-red-400 text-xl font-bold">!</span>
                </div>
                <p className="text-gray-200 text-sm font-medium mb-1">{error}</p>
                <button 
                  onClick={(e) => { e.stopPropagation(); startWebcam(); }}
                  className="mt-4 bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-full font-bold transition-colors"
                >
                  Retry Camera
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3" />
                <p className="text-gray-400 text-xs">Initializing Camera...</p>
              </div>
            )}
          </div>
        )}
        
        <div className="absolute top-2 right-2 flex gap-1 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
           <div className={`w-2 h-2 rounded-full ${isCamStarted ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }
);

WebcamMonitor.displayName = 'WebcamMonitor';