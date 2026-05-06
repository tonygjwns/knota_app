import React from 'react';

const STAGES = [
  { key: 'ocr', label: '필기 인식 중...', sub: 'Gemini가 손글씨를 읽고 있어요' },
  { key: 'grading', label: '채점 중...', sub: 'AI가 풀이를 꼼꼼히 확인하고 있어요' },
  { key: 'loading', label: '불러오는 중...', sub: '' },
];

export default function LoadingOverlay({ stage = 'loading', message }) {
  const info = STAGES.find(s => s.key === stage) || STAGES[2];
  const label = message || info.label;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card rounded-2xl shadow-xl p-8 flex flex-col items-center gap-5 max-w-xs w-full mx-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            {stage === 'ocr' ? '✍️' : stage === 'grading' ? '🧮' : '📖'}
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{label}</p>
          {info.sub && <p className="text-sm text-muted-foreground mt-1">{info.sub}</p>}
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div key={i}
                 className="w-2 h-2 rounded-full bg-primary animate-bounce"
                 style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function InlineLoader({ message = '불러오는 중...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"
           style={{ borderWidth: 3 }} />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}