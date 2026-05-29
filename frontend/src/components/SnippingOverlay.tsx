import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';

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
    // Hide the overlay itself from the capture by not rendering the overlay contents until capture is done
    const captureScreen = async () => {
      try {
        const canvas = await html2canvas(document.body, {
          backgroundColor: null,
          useCORS: true,
          logging: false
        });
        setFullScreenCanvas(canvas);
      } catch (err) {
        console.error("Snipping Tool Error:", err);
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
      <div className="fixed inset-0 z-[9999] cursor-wait bg-black/10 flex items-center justify-center pointer-events-none">
        <div className="bg-slate-800 text-white px-4 py-2 rounded shadow-lg font-bold">
          Freezing screen...
        </div>
      </div>
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
    if (!isDrawing) return;
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

    // Create a new canvas for the cropped area
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = width;
    cropCanvas.height = height;
    const ctx = cropCanvas.getContext('2d');
    
    if (ctx) {
      // Draw the selected portion from the full screen canvas
      ctx.drawImage(
        fullScreenCanvas,
        x, y, width, height,
        0, 0, width, height
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
      className="fixed inset-0 z-[9999] cursor-crosshair select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => { e.preventDefault(); onCancel(); }}
    >
      {/* Dimmed Background */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      
      {/* The visible cropped rectangle that acts as a window to the original screen */}
      {isDrawing && (
        <div 
          className="absolute border-2 border-emerald-500 bg-transparent pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"
          style={{
            left: rectLeft,
            top: rectTop,
            width: rectWidth,
            height: rectHeight,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' // Creates the dimming effect around the box
          }}
        >
            <div className="absolute top-1 left-1 bg-emerald-500 text-white text-[10px] px-1 font-mono rounded">
                {Math.round(rectWidth)} x {Math.round(rectHeight)}
            </div>
        </div>
      )}
      
      {!isDrawing && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-xl font-bold text-sm opacity-80 pointer-events-none">
              Click and drag to select math (Right-click to cancel)
          </div>
      )}
    </div>
  );
}
