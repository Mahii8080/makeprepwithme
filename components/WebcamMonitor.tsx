import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

interface WebcamMonitorProps {
  onUserPresent: () => void;
  onUserNotPresent: () => void;
}

export const WebcamMonitor = forwardRef<HTMLVideoElement, WebcamMonitorProps>(
  ({ onUserPresent, onUserNotPresent }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const lastFrameRef = useRef<ImageData | null>(null);
    const detectionIntervalRef = useRef<number | null>(null);

    // Expose the video element to the parent
    useImperativeHandle(ref, () => videoRef.current!);

    useEffect(() => {
      const startWebcam = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: false,
          });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Error accessing webcam:", err);
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
              // If no motion, we might be still or absent
              // For a simple mock, we'll assume absent if VERY still or truly absent
              // In a real app, you'd use a face detection library here
              // Let's be generous: only call NotPresent if diff is extremely low (meaning static or black)
              if (diff < threshold / 5) {
                onUserNotPresent();
              } else {
                  onUserPresent(); // Still enough motion to be "present"
              }
            }
          }
          lastFrameRef.current = currentFrame;
        } catch (e) {
          // Cross-origin issues or other errors
        }
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
      <div className="relative w-full h-full bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }
);

WebcamMonitor.displayName = 'WebcamMonitor';