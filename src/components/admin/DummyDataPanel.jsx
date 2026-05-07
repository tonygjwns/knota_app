import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FlaskConical, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, UserCheck } from 'lucide-react';

export default function DummyDataPanel() {
  const [open, setOpen] = useState(false);
  const [studentCount, setStudentCount] = useState(6);
  const [minAttempts, setMinAttempts] = useState(15);
  const [maxAttempts, setMaxAttempts] = useState(25);
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);

  const addLog = (msg, type = 'info') =>
    setLog(prev => [...prev, { msg, type, ts: new Date().toLocaleTimeString() }]);

  const invoke = (params) => base44.functions.invoke('seedDummyData', params);

  const runDryRun = async () => {
    setRunning(true);
    setLog([]);
    addLog('현황 확인 중 (dry_run)...');
    try {
      const r = await invoke({ count: studentCount, attemptsPerStudent: { min: minAttempts, max: maxAttempts }, dry_run: true });
      const d = r.data;
      addLog(`기존 더미 학원: ${d.existing_academy ? `"${d.existing_academy.name}"` : '없음'}`, 'info');
      addLog(`기존 더미 학급: ${d.existing_classes?.join(', ') || '없음'}`, 'info');
      addLog(`기존 더미 사용자: ${d.existing_dummy_users}명`, 'info');
      addLog(`기존 더미 시도: ${d.existing_dummy_attempts}건`, 'info');
      addLog(`생성 예정 학생: ${d.plan.students_to_create}명`, 'ok');
      addLog(`생성 예정 시도: ${d.plan.estimated_total_attempts}건`, 'ok');
      addLog('--- 프로필 ---', 'info');
      d.profiles.forEach(p => addLog(`  ${p.email} | 목표 avg ${p.avg_target}점 | 약점 도구 ${p.weak_tools_count}개`, 'info'));
    } catch (e) {
      addLog(`오류: ${e.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  const runGenerate = async (reset) => {
    if (reset && !confirm('기존 더미 데이터(학원·강사·학급·학생·시도)를 모두 삭제하고 새로 생성할까요?')) return;
    setRunning(true);
    setLog([]);
    addLog(reset ? '리셋 후 더미 환경 생성 중...' : '더미 환경 생성 중...');
    try {
      const r = await invoke({
        count: studentCount,
        attemptsPerStudent: { min: minAttempts, max: maxAttempts },
        reset,
        dry_run: false,
      });
      const d = r.data;
      if (d.error) { addLog(`오류: ${d.error}`, 'error'); return; }
      addLog(`✓ 학원 '${d.academy.name}' ${d.academy.created ? '생성' : '기존 재사용'}`, 'ok');
      addLog(`✓ 강사 ${d.teachers.length}명 ${d.teachers.filter(t => t.created).length > 0 ? '생성' : '재배정'}`, 'ok');
      const classInfo = d.classes.map(c => `${c.name} (${c.student_count}명)`).join(', ');
      addLog(`✓ 학급 ${d.classes.length}개: ${classInfo}`, 'ok');
      addLog(`✓ 학생 ${d.students.created}명 생성 / ${d.students.skipped}명 재배정 + 시도 ${d.attempts_created}건`, 'ok');
    } catch (e) {
      addLog(`오류: ${e.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  const runAssignSelf = async () => {
    if (!confirm("본인을 '중3-A반' 의 강사로 임시 배정하시겠어요? (Teacher Panel 검증용)")) return;
    setRunning(true);
    setLog([]);
    addLog('내 계정을 중3-A반 강사로 배정 중...');
    try {
      const r = await invoke({ assign_self: true });
      const d = r.data;
      if (d.error) { addLog(`오류: ${d.error}`, 'error'); return; }
      addLog(`✓ '${d.updated_class}' 강사로 배정 완료. /teacher 에서 확인하세요.`, 'ok');
    } catch (e) {
      addLog(`오류: ${e.message}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-purple-500" />
          <span className="font-semibold text-sm">더미 환경 생성</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            한 번에 학원 1개 · 강사 2명 · 학급 3개 · 학생 N명 · 시도 데이터를 생성해요. 실제 학생 데이터에는 영향을 주지 않아요.
          </p>

          {/* Controls */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">학생 수 (1-20)</label>
              <input
                type="number" min={1} max={20}
                value={studentCount}
                onChange={e => setStudentCount(Math.min(20, Math.max(1, Number(e.target.value))))}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">학생당 시도 수 범위</label>
              <div className="flex items-center gap-1">
                <input
                  type="number" min={1} max={50}
                  value={minAttempts}
                  onChange={e => setMinAttempts(Math.max(1, Number(e.target.value)))}
                  className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm"
                />
                <span className="text-xs text-muted-foreground">~</span>
                <input
                  type="number" min={1} max={50}
                  value={maxAttempts}
                  onChange={e => setMaxAttempts(Math.max(minAttempts, Number(e.target.value)))}
                  className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm"
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={runDryRun} disabled={running}>
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              현황 확인
            </Button>
            <Button size="sm" onClick={() => runGenerate(false)} disabled={running}>
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              더미 환경 생성
            </Button>
            <Button
              size="sm" variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => runGenerate(true)}
              disabled={running}
            >
              리셋 후 재생성
            </Button>
            <Button
              size="sm" variant="outline"
              className="text-blue-600 border-blue-200 hover:bg-blue-50 gap-1"
              onClick={runAssignSelf}
              disabled={running}
            >
              <UserCheck className="w-3.5 h-3.5" />
              내 계정 강사 배정
            </Button>
          </div>

          {/* Log */}
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