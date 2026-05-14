import React, { useRef, useState, useEffect, useCallback } from 'react';
import SignaturePad from 'signature_pad';
import { Button } from '@/components/ui/button';
import { Pencil, Eraser, Undo2, Trash2, Plus } from 'lucide-react';

const PAGE_HEIGHT = 400;

export default function DrawingCanvas({ onImageReady, penColor = '#1e293b', penSize = 1.5, height, answerRegionHeight = 0 }) {
  const solveCanvasRef = useRef(null);
  const solveWrapperRef = useRef(null);
  const solvePadRef = useRef(null);
  const answerCanvasRef = useRef(null);
  const answerWrapperRef = useRef(null);
  const answerPadRef = useRef(null);
  const onImageReadyRef = useRef(onImageReady);
  const lastStrokeRef = useRef(null); // 'solve' | 'answer'

  const [tool, setTool] = useState('pen');
  const [canvasHeight, setCanvasHeight] = useState(height || PAGE_HEIGHT);
  const [solveEmpty, setSolveEmpty] = useState(true);
  const [answerEmpty, setAnswerEmpty] = useState(true);

  useEffect(() => { onImageReadyRef.current = onImageReady; }, [onImageReady]);

  // body canvas-active 클래스 (selection 차단)
  useEffect(() => {
    document.body.classList.add('canvas-active');
    return () => document.body.classList.remove('canvas-active');
  }, []);

  const emitImageReady = useCallback(async () => {
    const solveCanvas = solveCanvasRef.current;
    if (!solveCanvas) return;

    const fullBlob = await new Promise(resolve =>
      solveCanvas.toBlob(resolve, 'image/jpeg', 0.7)
    );

    let answerRegionBlob = null;
    if (answerPadRef.current && !answerPadRef.current.isEmpty() && answerCanvasRef.current) {
      answerRegionBlob = await new Promise(resolve =>
        answerCanvasRef.current.toBlob(resolve, 'image/jpeg', 0.7)
      );
    }

    onImageReadyRef.current?.({ fullBlob, answerRegionBlob });
  }, []);

  const resizeSolveCanvas = useCallback(() => {
    const canvas = solveCanvasRef.current;
    const wrapper = solveWrapperRef.current;
    const pad = solvePadRef.current;
    if (!canvas || !wrapper) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const cssWidth = wrapper.clientWidth;
    const data = pad ? pad.toData() : [];

    canvas.width = cssWidth * ratio;
    canvas.height = canvasHeight * ratio;
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = canvasHeight + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssWidth, canvasHeight);

    if (pad && data.length > 0) pad.fromData(data);
  }, [canvasHeight]);

  const resizeAnswerCanvas = useCallback(() => {
    const canvas = answerCanvasRef.current;
    const wrapper = answerWrapperRef.current;
    const pad = answerPadRef.current;
    if (!canvas || !wrapper || answerRegionHeight <= 0) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const cssWidth = wrapper.clientWidth;
    const data = pad ? pad.toData() : [];

    canvas.width = cssWidth * ratio;
    canvas.height = answerRegionHeight * ratio;
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = answerRegionHeight + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssWidth, answerRegionHeight);

    if (pad && data.length > 0) pad.fromData(data);
  }, [answerRegionHeight]);

  // 두 SignaturePad 초기화 (마운트 1회)
  useEffect(() => {
    if (!solveCanvasRef.current) return;

    resizeSolveCanvas();

    const solvePad = new SignaturePad(solveCanvasRef.current, {
      minWidth: penSize * 0.6,
      maxWidth: penSize * 1.4,
      penColor,
      velocityFilterWeight: 0.7,
      backgroundColor: 'rgba(0,0,0,0)',
    });
    solvePadRef.current = solvePad;
    solvePad.addEventListener('endStroke', () => {
      lastStrokeRef.current = 'solve';
      setSolveEmpty(solvePad.isEmpty());
      emitImageReady();
    });

    if (answerRegionHeight > 0 && answerCanvasRef.current) {
      resizeAnswerCanvas();
      const answerPad = new SignaturePad(answerCanvasRef.current, {
        minWidth: penSize * 0.6,
        maxWidth: penSize * 1.4,
        penColor,
        velocityFilterWeight: 0.7,
        backgroundColor: 'rgba(0,0,0,0)',
      });
      answerPadRef.current = answerPad;
      answerPad.addEventListener('endStroke', () => {
        lastStrokeRef.current = 'answer';
        setAnswerEmpty(answerPad.isEmpty());
        emitImageReady();
      });
    }

    return () => {
      solvePadRef.current?.off();
      answerPadRef.current?.off();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 펜/지우개 toggle — 두 pad 동기화
  useEffect(() => {
    [solvePadRef.current, answerPadRef.current].filter(Boolean).forEach(pad => {
      if (tool === 'eraser') {
        pad.penColor = '#ffffff';
        pad.minWidth = 10;
        pad.maxWidth = 20;
      } else {
        pad.penColor = penColor;
        pad.minWidth = penSize * 0.6;
        pad.maxWidth = penSize * 1.4;
      }
    });
  }, [tool, penColor, penSize]);

  // ResizeObserver — 두 wrapper 감시
  useEffect(() => {
    const solveWrapper = solveWrapperRef.current;
    if (!solveWrapper) return;
    const ro = new ResizeObserver(() => {
      resizeSolveCanvas();
      resizeAnswerCanvas();
    });
    ro.observe(solveWrapper);
    if (answerWrapperRef.current) ro.observe(answerWrapperRef.current);
    return () => ro.disconnect();
  }, [resizeSolveCanvas, resizeAnswerCanvas]);

  // canvasHeight 변경 시 풀이 캔버스만 resize
  useEffect(() => { resizeSolveCanvas(); }, [canvasHeight, resizeSolveCanvas]);

  const undo = () => {
    // 마지막으로 그린 캔버스에서 undo
    const targetPad = lastStrokeRef.current === 'answer' ? answerPadRef.current : solvePadRef.current;
    if (!targetPad) return;
    const data = targetPad.toData();
    if (data.length === 0) return;
    data.pop();
    targetPad.fromData(data);

    if (lastStrokeRef.current === 'answer') {
      setAnswerEmpty(targetPad.isEmpty());
    } else {
      setSolveEmpty(targetPad.isEmpty());
    }
    emitImageReady();
  };

  const clear = () => {
    const clearPad = (pad, canvas) => {
      if (!pad || !canvas) return;
      pad.clear();
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    };
    clearPad(solvePadRef.current, solveCanvasRef.current);
    clearPad(answerPadRef.current, answerCanvasRef.current);
    setSolveEmpty(true);
    setAnswerEmpty(true);
    lastStrokeRef.current = null;
    onImageReadyRef.current?.({ fullBlob: null, answerRegionBlob: null });
  };

  const expandCanvas = () => {
    setCanvasHeight(h => h + PAGE_HEIGHT);
  };

  const cursorClass = tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair';
  const bothEmpty = solveEmpty && answerEmpty;

  return (
    <div className="flex flex-col gap-3">
      {/* 도구 선택 — sticky 상단 */}
      <div className="sticky top-0 z-10 bg-card grid grid-cols-2 gap-2 py-2 mb-2">
        <Button type="button" variant={tool === 'pen' ? 'default' : 'outline'} size="sm"
          onClick={() => setTool('pen')} className="btn-touch">
          <Pencil className="w-4 h-4 mr-1" /> 펜
        </Button>
        <Button type="button" variant={tool === 'eraser' ? 'default' : 'outline'} size="sm"
          onClick={() => setTool('eraser')} className="btn-touch">
          <Eraser className="w-4 h-4 mr-1" /> 지우개
        </Button>
      </div>

      {/* 풀이 + 답란 한 박스 */}
      <div className="bg-white border-2 border-dashed border-border rounded-xl overflow-hidden">
        {/* 풀이 캔버스 */}
        <div
          ref={solveWrapperRef}
          className="relative"
          style={{ height: canvasHeight, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
          onSelectStart={(e) => e.preventDefault()}
        >
          {solveEmpty && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground pointer-events-none select-none">
              <Pencil className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">여기에 풀이를 적어 주세요</p>
            </div>
          )}
          <canvas
            ref={solveCanvasRef}
            className={cursorClass}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            style={{ display: 'block', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
          />
        </div>

        {/* 답란 캔버스 — 점선으로 분리 */}
        {answerRegionHeight > 0 && (
          <div className="border-t-2 border-dashed border-blue-300 relative" style={{ touchAction: 'none' }}>
            <div className="absolute top-1 left-2 text-xs font-medium text-blue-500 bg-white/80 px-1.5 py-0.5 rounded z-10 pointer-events-none">답</div>
            <div
              ref={answerWrapperRef}
              className="relative bg-blue-50/20"
              style={{ height: answerRegionHeight, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
              onSelectStart={(e) => e.preventDefault()}
            >
              <canvas
                ref={answerCanvasRef}
                className={cursorClass}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                onContextMenu={(e) => e.preventDefault()}
                style={{ display: 'block', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 하단 버튼 — sticky 하단 */}
      <div className="sticky bottom-0 z-10 bg-card grid grid-cols-3 gap-2 py-2 mt-2 border-t border-border">
        <Button type="button" variant="outline" size="sm" onClick={undo}
                disabled={bothEmpty} className="btn-touch">
          <Undo2 className="w-4 h-4 mr-1" /> 되돌리기
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={clear}
                className="btn-touch text-destructive hover:text-destructive">
          <Trash2 className="w-4 h-4 mr-1" /> 초기화
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={expandCanvas}
                className="btn-touch">
          <Plus className="w-4 h-4 mr-1" /> 칸 늘리기
        </Button>
      </div>
    </div>
  );
}