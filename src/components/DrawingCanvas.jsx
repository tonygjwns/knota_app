import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Undo2, Trash2, Pencil, Eraser, Plus } from 'lucide-react';

const PAGE_HEIGHT = 400;

export default function DrawingCanvas({ onImageReady, penColor = '#1e293b', penSize = 3 }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState([]);
  const [tool, setTool] = useState('pen');
  const [eraserSize] = useState(20);
  const [canvasHeight, setCanvasHeight] = useState(PAGE_HEIGHT);
  const lastPos = useRef(null);
  const isDrawingRef = useRef(false);
  const activePointerIdRef = useRef(null);
  const lastUpAtRef = useRef(0);
  const lastUpPosRef = useRef(null);
  const moveCountRef = useRef(0);
  const toolRef = useRef(tool);
  const penColorRef = useRef(penColor);
  const penSizeRef = useRef(penSize);
  const [debugLog, setDebugLog] = useState([]);

  const pushLog = (msg) => {
    setDebugLog(prev => [
      `${performance.now().toFixed(0)}ms ${msg}`,
      ...prev.slice(0, 9),
    ]);
  };

  // body에 canvas-active 클래스 추가 (페이지 전체 selection 차단)
  useEffect(() => {
    document.body.classList.add('canvas-active');
    return () => {
      document.body.classList.remove('canvas-active');
    };
  }, []);

  // Keep refs in sync
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { penColorRef.current = penColor; }, [penColor]);
  useEffect(() => { penSizeRef.current = penSize; }, [penSize]);

  // Get position from PointerEvent relative to canvas logical coordinates
  // Use getBoundingClientRect for cross-platform accuracy (offsetX unreliable on iOS)
  // ctx is already scaled by dpr via ctx.scale(dpr,dpr), so return CSS pixels
  const getPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width / (window.devicePixelRatio || 1)),
      y: (e.clientY - rect.top) * (canvas.height / rect.height / (window.devicePixelRatio || 1)),
    };
  };

  // Initialize canvas size based on wrapper width
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = wrapper.clientWidth;
    const cssHeight = canvasHeight;
    if (canvas.width === Math.round(cssWidth * dpr) && canvas.height === Math.round(cssHeight * dpr)) return;
    const ctx = canvas.getContext('2d');
    const data = canvas.toDataURL();
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx.scale(dpr, dpr);
    if (data !== 'data:,') {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, cssWidth, cssHeight);
      img.src = data;
    }
  }, [canvasHeight]);

  useEffect(() => { initCanvas(); }, [initCanvas]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const ro = new ResizeObserver(() => {
      if (isDrawingRef.current) return; // 드로잉 중엔 canvas reset 안 함
      initCanvas();
    });
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [initCanvas]);

  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setHistory(h => [...h.slice(-19), canvas.toDataURL()]);
  }, []);

  const expandCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wrapper = wrapperRef.current;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = wrapper.clientWidth;
    const oldData = canvas.toDataURL();
    const newCssHeight = canvasHeight + PAGE_HEIGHT;
    setCanvasHeight(newCssHeight);
    requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d');
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(newCssHeight * dpr);
      ctx.scale(dpr, dpr);
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, cssWidth, newCssHeight);
        if (onImageReady) canvas.toBlob(b => b && onImageReady(b), 'image/jpeg', 0.7);
      };
      img.src = oldData;
    });
  };

  // Attach pointer events via addEventListener with passive:false to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const STROKE_MERGE_MS = 1500;
    const STROKE_MERGE_DIST = 80;

    const onPointerDown = (e) => {
      if (activePointerIdRef.current !== null) return;
      if (e.pointerType === 'touch' && !e.isPrimary) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      e.preventDefault();
      const sel = window.getSelection?.();
      if (sel && sel.rangeCount > 0) sel.removeAllRanges();
      activePointerIdRef.current = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      moveCountRef.current = 0;

      const now = performance.now();
      const pos = getPos(e);
      const dx = lastUpPosRef.current ? pos.x - lastUpPosRef.current.x : Infinity;
      const dy = lastUpPosRef.current ? pos.y - lastUpPosRef.current.y : Infinity;
      const dist = Math.hypot(dx, dy);
      const timeGap = lastUpAtRef.current > 0 ? (now - lastUpAtRef.current).toFixed(0) : '∞';
      const isContinuation = e.pointerType === 'pen'
        && (now - lastUpAtRef.current < STROKE_MERGE_MS)
        && lastUpPosRef.current !== null
        && dist < STROKE_MERGE_DIST;

      pushLog(`down ${e.pointerType} ${isContinuation ? 'MERGE' : 'NEW'} gap=${timeGap}ms dist=${dist === Infinity ? '∞' : dist.toFixed(0)}px`);

      if (isContinuation) {
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(lastUpPosRef.current.x, lastUpPosRef.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (toolRef.current === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
          ctx.lineWidth = eraserSize;
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = penColorRef.current;
          ctx.lineWidth = penSizeRef.current;
        }
        ctx.stroke();
        if (toolRef.current === 'eraser') ctx.globalCompositeOperation = 'source-over';
      } else {
        // 새 stroke — dot 없이 saveState만 (dot은 짧은 false up에서 토막 남김)
        saveState();
      }

      lastPos.current = pos;
      isDrawingRef.current = true;
      setIsDrawing(true);
    };

    const onPointerMove = (e) => {
      if (!isDrawingRef.current) return;
      if (e.pointerId !== activePointerIdRef.current) return; // palm 차단
      e.preventDefault();
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // getCoalescedEvents: 빠른 stroke의 중간 점 보강
      const events = (typeof e.getCoalescedEvents === 'function' && e.getCoalescedEvents().length > 0)
        ? e.getCoalescedEvents()
        : [e];

      for (const ev of events) {
        const pos = getPos(ev);
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (toolRef.current === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
          ctx.lineWidth = eraserSize;
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = penColorRef.current;
          // Apple Pencil 압력 반영 (pressure 미지원 환경은 기존 크기 유지)
          const width = (ev.pointerType === 'pen' && ev.pressure > 0)
            ? penSizeRef.current * (0.6 + ev.pressure * 0.8)
            : penSizeRef.current;
          ctx.lineWidth = width;
        }
        ctx.stroke();
        if (toolRef.current === 'eraser') ctx.globalCompositeOperation = 'source-over';
        lastPos.current = pos;
        moveCountRef.current += 1;
      }
    };

    const onPointerUp = (e) => {
      if (e.pointerId !== activePointerIdRef.current) return;
      pushLog(`up   ${e.pointerType} moves=${moveCountRef.current}`);
      e.preventDefault();
      lastUpAtRef.current = performance.now();
      lastUpPosRef.current = lastPos.current ? { ...lastPos.current } : null;
      activePointerIdRef.current = null;
      isDrawingRef.current = false;
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (onImageReady && canvas) {
        canvas.toBlob(blob => { if (blob) onImageReady(blob); }, 'image/jpeg', 0.7);
      }
    };

    const onPointerCancel = (e) => {
      pushLog(`CANCEL ${e.pointerType} id=${e.pointerId}`);
      if (e.pointerId !== activePointerIdRef.current) return;
      // cancel은 강제 중단 — merge 정보 reset
      lastUpAtRef.current = 0;
      lastUpPosRef.current = null;
      activePointerIdRef.current = null;
      isDrawingRef.current = false;
      setIsDrawing(false);
    };

    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', onPointerUp, { passive: false });
    canvas.addEventListener('pointercancel', onPointerCancel, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [saveState, onImageReady, eraserSize]);

  const undo = () => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
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

  const isEmpty = history.length === 0;
  const cursorClass = tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Button type="button" variant={tool === 'pen' ? 'default' : 'outline'} size="sm"
          onClick={() => setTool('pen')} className="flex-1 btn-touch">
          <Pencil className="w-4 h-4 mr-1" /> 펜
        </Button>
        <Button type="button" variant={tool === 'eraser' ? 'default' : 'outline'} size="sm"
          onClick={() => setTool('eraser')} className="flex-1 btn-touch">
          <Eraser className="w-4 h-4 mr-1" /> 지우개
        </Button>
      </div>

      <div ref={wrapperRef}
           className="relative bg-white border-2 border-dashed border-border rounded-xl overflow-hidden"
           onSelectStart={(e) => e.preventDefault()}
           style={{
             height: canvasHeight,
             userSelect: 'none',
             WebkitUserSelect: 'none',
             WebkitTouchCallout: 'none',
             touchAction: 'none',
           }}>
        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground pointer-events-none select-none">
            <Pencil className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">여기에 풀이를 적어 주세요</p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={cursorClass}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onSelectStart={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            width: '100%', height: canvasHeight, display: 'block',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
          }}
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
        <Button type="button" variant="outline" size="sm" onClick={expandCanvas}
                className="btn-touch flex-1">
          <Plus className="w-4 h-4 mr-1" /> 칸 늘리기
        </Button>
      </div>

      {/* 진단용 디버그 패널 — 검증 후 제거 */}
      <div className="text-[10px] font-mono bg-slate-50 border rounded p-2 max-h-32 overflow-auto">
        <div className="text-muted-foreground mb-1">[debug] pen events:</div>
        {debugLog.length === 0 && <div className="text-muted-foreground">— 아직 없음 —</div>}
        {debugLog.map((l, i) => (
          <div key={i} className={
            l.includes('CANCEL') ? 'text-red-600 font-bold' :
            l.includes('MERGE') ? 'text-emerald-600' :
            l.includes('moves=0') ? 'text-amber-600' : ''
          }>{l}</div>
        ))}
      </div>
    </div>
  );
}