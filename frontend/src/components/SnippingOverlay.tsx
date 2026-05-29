import React, { useState, useEffect } from 'react';

interface SnippingOverlayProps {
  onCapture: (base64Image: string) => void;
  onCancel: () => void;
}

export function SnippingOverlay({ onCapture, onCancel }: SnippingOverlayProps) {
  const [isCapturing, setIsCapturing] = useState(true);
  const [fullScreenCanvas, setFullScreenCanvas] = useState<HTMLCanvasElement | null>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [currentY, setCurrentY] = useState(0);

  useEffect(() => {
    // Use native screen capture for 100% perfect accuracy
    const captureScreen = async () => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "browser" },
          audio: false
        });
        
        const video = document.createElement('video');
        video.srcObject = stream;
        await new Promise((resolve) => {
          video.onloadedmetadata = () => {
            video.play();
            resolve(null);
          };
        });
        
        // Give a tiny moment for the frame to fully paint
        await new Promise(r => setTimeout(r, 150));

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          setFullScreenCanvas(canvas);
        }
        
        // Stop all tracks to end the screen sharing session immediately
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error("Snipping Tool Error:", err);
        alert("Screen capture was cancelled or failed. Please try again and select 'Current Tab'.");
        onCancel();
      } finally {
        setIsCapturing(false);
      }
    };
    captureScreen();
  }, [onCancel]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  if (isCapturing) {
    return (
      <div className="fixed inset-0 z-[9999] cursor-crosshair pointer-events-none bg-transparent" />
    );
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDrawing(true);
    setStartX(e.clientX);
    setStartY(e.clientY);
    setCurrentX(e.clientX);
    setCurrentY(e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setCurrentX(e.clientX);
    setCurrentY(e.clientY);
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (!fullScreenCanvas) return;

    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    if (width < 10 || height < 10) {
      // Too small, ignore
      return;
    }

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);

    // Calculate the scale factor between the viewport and the captured video frame
    const scaleX = fullScreenCanvas.width / window.innerWidth;
    const scaleY = fullScreenCanvas.height / window.innerHeight;

    const mappedX = x * scaleX;
    const mappedY = y * scaleY;
    const mappedWidth = width * scaleX;
    const mappedHeight = height * scaleY;
    
    // Create a new canvas for the cropped area
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = mappedWidth;
    cropCanvas.height = mappedHeight;
    const ctx = cropCanvas.getContext('2d');
    
    if (ctx) {
      // Draw the exact mapped area from the screenshot
      ctx.drawImage(
        fullScreenCanvas,
        mappedX, 
        mappedY, 
        mappedWidth, 
        mappedHeight,
        0, 0, mappedWidth, mappedHeight
      );
      
      const base64Image = cropCanvas.toDataURL('image/jpeg', 1.0);
      onCapture(base64Image);
    }
  };

  const rectLeft = Math.min(startX, currentX);
  const rectTop = Math.min(startY, currentY);
  const rectWidth = Math.abs(currentX - startX);
  const rectHeight = Math.abs(currentY - startY);

  return (
    <div 
      className="fixed inset-0 z-[9999] select-none"
      style={{ cursor: 'crosshair' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => { e.preventDefault(); onCancel(); }}
    >
      {/* Horizontal Crosshair Line */}
      <div 
        className="absolute left-0 right-0 border-t border-emerald-500 pointer-events-none"
        style={{ top: currentY }}
      />
      {/* Vertical Crosshair Line */}
      <div 
        className="absolute top-0 bottom-0 border-l border-emerald-500 pointer-events-none"
        style={{ left: currentX }}
      />

      {/* The drawn rectangle */}
      {isDrawing && (
        <div 
          className="absolute border border-emerald-500 bg-emerald-500/10 pointer-events-none"
          style={{
            left: rectLeft,
            top: rectTop,
            width: rectWidth,
            height: rectHeight,
          }}
        >
            <div className="absolute top-1 left-1 bg-emerald-500 text-white text-[10px] px-1 font-mono rounded">
                {Math.round(rectWidth)} x {Math.round(rectHeight)}
            </div>
        </div>
      )}

      {!isDrawing && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white text-slate-800 px-5 py-2 rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] font-bold text-sm pointer-events-none flex items-center gap-3 border border-slate-200">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
              Click and Drag to Select Area (Right-Click to Cancel)
          </div>
      )}
    </div>
  );
}
