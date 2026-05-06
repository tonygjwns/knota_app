import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

const CHUNK_SIZE = 50;

export default function DataImportPanel() {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total }

  const addLog = (msg, type = 'info') => {
    setLog(prev => [...prev, { msg, type, ts: new Date().toLocaleTimeString() }]);
  };

  const invoke = (mode, extra = {}) =>
    base44.functions.invoke('importKnotaData', { mode, ...extra });

  const runCheck = async () => {
    setRunning(true);
    setLog([]);
    addLog('현황 확인 중...');
    try {
      const r = await invoke('check');
      const d = r.data;
      addLog(`GitHub: 문제 ${d.github.problems}개 / 도구 ${d.github.tools}개`, 'ok');
      addLog(`DB: 문제 ${d.db.problems}개 / 도구 ${d.db.tools}개 / 도메인 ${d.db.domains}개`, 'ok');
      addLog(`미삽입 문제: ${d.remaining_problems}개`, d.remaining_problems > 0 ? 'warn' : 'ok');
    } catch (e) {
      addLog(`오류: ${e.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  const runImport = async () => {
    setRunning(true);
    setLog([]);
    setProgress(null);

    try {
      // Step 1: init
      addLog('[1/2] Domain + MathTool 초기화...');
      const initRes = await invoke('init');
      const id = initRes.data;
      addLog(`도메인 ${id.domains_created}개 생성, ${id.domains_skipped}개 스킵`, 'ok');
      addLog(`도구 ${id.tools_created}개 생성, ${id.tools_skipped}개 스킵`, 'ok');

      // Step 2: problems in chunks
      addLog('[2/2] 문제 삽입 시작...');
      let offset = 0;
      let totalInserted = 0;
      let totalSkipped = 0;
      let totalInGithub = 0;

      while (true) {
        const res = await invoke('problems', { offset, limit: CHUNK_SIZE });
        const d = res.data;
        totalInGithub = d.total_in_github;
        totalInserted += d.inserted;
        totalSkipped += d.skipped;

        setProgress({ done: offset + d.chunk_size, total: totalInGithub });
        addLog(
          `offset ${offset}: ${d.inserted}개 삽입, ${d.skipped}개 스킵 (잔여 ~${d.total_remaining}개)`,
          'info'
        );

        if (!d.next_offset) break;
        offset = d.next_offset;

        // 500ms pause between chunks (client-side, no timeout risk)
        await new Promise(r => setTimeout(r, 500));
      }

      addLog(`✅ 완료! 총 삽입 ${totalInserted}개, 스킵 ${totalSkipped}개`, 'ok');
      setProgress({ done: totalInGithub, total: totalInGithub });

    } catch (e) {
      addLog(`❌ 오류: ${e.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">KNOTA 데이터 Import</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-4">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={runCheck} disabled={running}>
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              현황 확인
            </Button>
            <Button size="sm" onClick={runImport} disabled={running}>
              {running ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {running ? '실행 중...' : '전체 Import 실행'}
            </Button>
          </div>

          {progress && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>진행률</span>
                <span>{progress.done} / {progress.total} ({pct}%)</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {log.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 max-h-64 overflow-y-auto font-mono text-xs">
              {log.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-muted-foreground flex-shrink-0">{l.ts}</span>
                  <span className={
                    l.type === 'ok' ? 'text-emerald-600' :
                    l.type === 'error' ? 'text-red-500' :
                    l.type === 'warn' ? 'text-amber-500' :
                    'text-foreground'
                  }>
                    {l.type === 'ok' ? <CheckCircle className="inline w-3 h-3 mr-0.5" /> :
                     l.type === 'error' ? <AlertCircle className="inline w-3 h-3 mr-0.5" /> : null}
                    {l.msg}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}