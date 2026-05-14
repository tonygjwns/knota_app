import React, { useRef, useState, useEffect, useCallback } from 'react';
import SignaturePad from 'signature_pad';
import { Button } from '@/components/ui/button';
import { Pencil, Eraser, Undo2, Trash2, Plus } from 'lucide-react';

const PAGE_HEIGHT = 400;

export default function DrawingCanvas({ onImageReady, penColor = '#1e293b', penSize = 1.5, height, answerRegionHeight = 0 }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const padRef = useRef(null);
  const onImageReadyRef = useRef(onImageReady);
  const answerRegionHeightRef = useRef(answerRegionHeight);
  const [tool, setTool] = useState('pen');
  const [canvasHeight, setCanvasHeight] = useState(height || PAGE_HEIGHT);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => { onImageReadyRef.current = onImageReady; }, [onImageReady]);
  useEffect(() => { answerRegionHeightRef.current = answerRegionHeight; }, [answerRegionHeight]);

  // body canvas-active 클래스 (selection 차단)
  useEffect(() => {
    document.body.classList.add('canvas-active');
    return () => document.body.classList.remove('canvas-active');
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    const pad = padRef.current;
    if (!canvas || !wrapper) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const cssWidth = wrapper.clientWidth;
    const cssHeight = canvasHeight;

    // 기존 stroke 데이터 보존
    const data = pad ? pad.toData() : [];

    canvas.width = cssWidth * ratio;
    canvas.height = cssHeight * ratio;
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    if (pad && data.length > 0) {
      pad.fromData(data);
    }
  }, [canvasHeight]);

  // SignaturePad 초기화 (마운트 1회)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    resizeCanvas();

    const pad = new SignaturePad(canvas, {
      minWidth: penSize * 0.6,
      maxWidth: penSize * 1.4,
      penColor: penColor,
      velocityFilterWeight: 0.7,
      backgroundColor: 'rgba(0,0,0,0)',
    });
    padRef.current = pad;

    pad.addEventListener('endStroke', () => {
      setIsEmpty(pad.isEmpty());
      if (onImageReadyRef.current && canvas) {
        canvas.toBlob(async (fullBlob) => {
          if (!fullBlob) return;
          let answerRegionBlob = null;
          const arh = answerRegionHeightRef.current;
          if (arh > 0) {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            const ctx = canvas.getContext('2d');
            const imgData = ctx.getImageData(0, (canvas.height - arh * ratio), canvas.width, arh * ratio);
            let hasStroke = false;
            for (let i = 3; i < imgData.data.length; i += 4) {
              if (imgData.data[i] > 0) { hasStroke = true; break; }
            }
            if (hasStroke) {
              const region = document.createElement('canvas');
              region.width = canvas.width;
              region.height = arh * ratio;
              region.getContext('2d').drawImage(canvas, 0, canvas.height - arh * ratio, canvas.width, arh * ratio, 0, 0, canvas.width, arh * ratio);
              await new Promise(resolve => {
                region.toBlob(b => { answerRegionBlob = b; resolve(); }, 'image/jpeg', 0.7);
              });
            }
          }
          onImageReadyRef.current({ fullBlob, answerRegionBlob });
        }, 'image/jpeg', 0.7);
      }
    });

    return () => { pad.off(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // tool / penColor / penSize 변경 시 pad 옵션 업데이트
  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    if (tool === 'eraser') {
      pad.penColor = '#ffffff';
      pad.minWidth = 10;
      pad.maxWidth = 20;
    } else {
      pad.penColor = penColor;
      pad.minWidth = penSize * 0.6;
      pad.maxWidth = penSize * 1.4;
    }
  }, [tool, penColor, penSize]);

  // ResizeObserver
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [resizeCanvas]);

  // canvasHeight 변경 시 resize
  useEffect(() => { resizeCanvas(); }, [canvasHeight, resizeCanvas]);

  const undo = () => {
    const pad = padRef.current;
    if (!pad) return;
    const data = pad.toData();
    if (data.length === 0) return;
    data.pop();
    pad.fromData(data);
    const empty = pad.isEmpty();
    setIsEmpty(empty);
    const canvas = canvasRef.current;
    if (canvas) {
      if (empty) {
        onImageReadyRef.current?.({ fullBlob: null, answerRegionBlob: null });
      } else {
        canvas.toBlob(blob => { if (blob) onImageReadyRef.current?.({ fullBlob: blob, answerRegionBlob: null }); }, 'image/jpeg', 0.7);
      }
    }
  };

  const clear = () => {
    const pad = padRef.current;
    const canvas = canvasRef.current;
    if (!pad || !canvas) return;
    pad.clear();
    // 흰 배경 복원
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setIsEmpty(true);
    onImageReadyRef.current?.({ fullBlob: null, answerRegionBlob: null });
  };

  const expandCanvas = () => {
    setCanvasHeight(h => h + PAGE_HEIGHT);
  };

  const cursorClass = tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair';

  return (
    <div className="flex flex-col gap-3">
      {/* 도구 선택 */}
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

      {/* 캔버스 영역 */}
      <div
        ref={wrapperRef}
        className="relative bg-white border-2 border-dashed border-border rounded-xl overflow-hidden"
        onSelectStart={(e) => e.preventDefault()}
        style={{
          height: canvasHeight,
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
      >
        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground pointer-events-none select-none">
            <Pencil className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">여기에 풀이를 적어 주세요</p>
          </div>
        )}
        {answerRegionHeight > 0 && (
          <div
            className="absolute left-0 right-0 pointer-events-none"
            style={{ bottom: 0, height: answerRegionHeight }}
          >
            <div className="absolute top-0 left-0 right-0 border-t-2 border-dashed border-blue-300" />
            <div className="absolute top-1 left-2 text-xs font-medium text-blue-500 bg-white/80 px-1.5 py-0.5 rounded">
              답
            </div>
            <div className="absolute inset-0 bg-blue-50/20" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={cursorClass}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            display: 'block',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
          }}
        />
      </div>

      {/* 하단 버튼 */}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={undo}
                disabled={isEmpty} className="btn-touch flex-1">
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
    </div>
  );
}