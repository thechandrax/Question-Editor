import React, { useState, useEffect } from 'react';
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
      <div className="fixed inset-0 z-[9999] cursor-crosshair pointer-events-none" />
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
