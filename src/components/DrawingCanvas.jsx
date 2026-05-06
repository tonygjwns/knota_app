import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Undo2, Trash2, Pencil } from 'lucide-react';

export default function DrawingCanvas({ onImageReady, penColor = '#1e293b', penSize = 3 }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState([]);
  const lastPos = useRef(null);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setHistory(h => [...h.slice(-19), canvas.toDataURL()]);
  }, []);

  const startDraw = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    saveState();
    const pos = getPos(e, canvas);
    lastPos.current = pos;
    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, penSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = penColor;
    ctx.fill();
  }, [penColor, penSize, saveState]);

  const draw = useCallback((e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  }, [isDrawing, penColor, penSize]);

  const stopDraw = useCallback(() => {
    setIsDrawing(false);
    if (onImageReady && canvasRef.current) {
      canvasRef.current.toBlob(blob => {
        if (blob) onImageReady(blob);
      }, 'image/jpeg', 0.7);
    }
  }, [onImageReady]);

  const undo = () => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      if (onImageReady) canvas.toBlob(b => b && onImageReady(b), 'image/jpeg', 0.7);
    };
    img.src = prev;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    saveState();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (onImageReady) onImageReady(null);
  };

  // Resize canvas to fill container
  useEffect(() => {
    const canvas = canvasRef.current;
    const resize = () => {
      const ctx = canvas.getContext('2d');
      const data = canvas.toDataURL();
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = data;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, []);

  const isEmpty = history.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative bg-white border-2 border-dashed border-border rounded-xl overflow-hidden"
           style={{ minHeight: 280 }}>
        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground pointer-events-none select-none">
            <Pencil className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">여기에 풀이를 적어 주세요</p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="drawing-canvas w-full"
          style={{ height: 280, display: 'block' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={undo} disabled={history.length === 0}
                className="btn-touch flex-1">
          <Undo2 className="w-4 h-4 mr-1" /> 되돌리기
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={clear}
                className="btn-touch flex-1 text-destructive hover:text-destructive">
          <Trash2 className="w-4 h-4 mr-1" /> 초기화
        </Button>
      </div>
    </div>
  );
}