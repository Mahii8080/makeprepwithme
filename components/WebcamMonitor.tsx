import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

interface WebcamMonitorProps {
  onUserPresent: () => void;
  onUserNotPresent: () => void;
}

export const WebcamMonitor = forwardRef<HTMLVideoElement, WebcamMonitorProps>(
  ({ onUserPresent, onUserNotPresent }, ref) => {
    const [error, setError] = React.useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const lastFrameRef = useRef<ImageData | null>(null);
    const detectionIntervalRef = useRef<number | null>(null);
 
    // Expose the video element to the parent
    useImperativeHandle(ref, () => videoRef.current!);
 
    useEffect(() => {
      const startWebcam = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError("Webcam not supported or blocked by browser (check HTTPS)");
          return;
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => {
              console.error("Error playing video:", e);
              setError("Click to enable video");
            });
          }
          setError(null);
        } catch (err: any) {
          console.error("Error accessing webcam:", err);
          if (err.name === 'NotAllowedError') {
            setError("Permission denied");
          } else {
            setError("Webcam error: " + (err.message || "Unknown error"));
          }
        }
      };
 
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
            
            // Compare every 4th pixel to save CPU
            for (let i = 0; i < data1.length; i += 16) {
              diff += Math.abs(data1[i] - data2[i]);     // R
              diff += Math.abs(data1[i+1] - data2[i+1]); // G
              diff += Math.abs(data1[i+2] - data2[i+2]); // B
            }
            
            const threshold = (canvas.width * canvas.height * 3) / 4; // Arbitrary threshold for "presence/motion"
            if (diff > threshold) {
              onUserPresent();
            } else {
              if (diff < threshold / 5) {
                onUserNotPresent();
              } else {
                onUserPresent();
              }
            }
          }
          lastFrameRef.current = currentFrame;
        } catch (e) {}
      }, 1000);
 
      return () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (detectionIntervalRef.current) {
          clearInterval(detectionIntervalRef.current);
        }
      };
    }, [onUserPresent, onUserNotPresent]);
 
    return (
      <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden rounded-lg">
        {error ? (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <div className="w-12 h-12 bg-red-900/40 rounded-full flex items-center justify-center mb-3">
              <span className="text-red-400 text-xl font-bold">!</span>
            </div>
            <p className="text-gray-300 text-sm font-medium mb-1">{error}</p>
            <p className="text-gray-500 text-[10px]">Please check camera permissions in your browser bar.</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover rounded-lg"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }
);

WebcamMonitor.displayName = 'WebcamMonitor';