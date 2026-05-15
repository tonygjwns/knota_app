import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shuffle } from 'lucide-react';

/**
 * RandomPicker — 랜덤으로 N개 선택 버튼
 * Props:
 *   poolSize: number — 전체 풀 크기
 *   onPick: (n: number) => void — n개 랜덤 선택 요청
 *   onClear: () => void — 선택 초기화
 */
export default function RandomPicker({ poolSize, onPick, onClear }) {
  const [n, setN] = useState(Math.min(5, poolSize));

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <Shuffle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="text-xs text-muted-foreground flex-shrink-0">랜덤</span>
      <Input
        type="number"
        min={1}
        max={poolSize}
        value={n}
        onChange={e => setN(Math.max(1, Math.min(poolSize, Number(e.target.value))))}
        className="h-7 w-16 text-xs px-2"
      />
      <span className="text-xs text-muted-foreground flex-shrink-0">개</span>
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs px-2"
        onClick={() => onPick(n)}>
        선택
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-7 text-xs px-2"
        onClick={onClear}>
        초기화
      </Button>
    </div>
  );
}