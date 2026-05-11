import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { ArrowLeft, User } from 'lucide-react';
import { toast } from 'sonner';

const GRADE_LABELS = {
  '1': '초등 1학년', '2': '초등 2학년', '3': '초등 3학년', '4': '초등 4학년',
  '5': '초등 5학년', '6': '초등 6학년', '7': '중학교 1학년', '8': '중학교 2학년',
  '9': '중학교 3학년', '10': '고등학교 1학년', '11': '고등학교 2학년', '12': '고등학교 3학년',
};

const APPROVAL_LABELS = {
  pending: { text: '승인 대기', cls: 'bg-amber-100 text-amber-700' },
  approved: { text: '승인됨', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { text: '거절됨', cls: 'bg-red-100 text-red-700' },
};

export default function StudentDetail({ mode }) {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const isAdmin = (mode === 'admin') || currentUser?.role === 'admin';

  const [student, setStudent] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [weakTools, setWeakTools] = useState([]);
  const [strongTools, setStrongTools] = useState([]);
  const [remediationHistory, setRemediationHistory] = useState([]);
  const [academy, setAcademy] = useState(null);
  const [cls, setCls] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('submitted_at');
  const [pageIdx, setPageIdx] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await base44.functions.invoke('studentDetailSummary', { userId });
        const data = res.data;
        if (!data || data.error) {
          toast.error(data?.error || '데이터를 불러오지 못해요');
          navigate(-1);
          return;
        }
        setStudent(data.student);
        setAttempts(data.attempts || []);
        setWeakTools(data.weak_tools || []);
        setStrongTools(data.strong_tools || []);
        setRemediationHistory(data.remediation_history || []);

        // Load org info for admin view
        if (isAdmin && data.student) {
          const s = data.student;
          const [academies, classes] = await Promise.all([
            s.academy_id ? base44.entities.Academy.filter({ id: s.academy_id }, '', 1) : Promise.resolve([]),
            s.class_id ? base44.entities.Class.filter({ id: s.class_id }, '', 1) : Promise.resolve([]),
          ]);
          setAcademy(academies[0] || null);
          setCls(classes[0] || null);
        }
      } catch (e) {
        toast.error(e.message || '데이터를 불러오지 못해요');
        navigate(-1);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, navigate, isAdmin]);

  if (loading) return <InlineLoader message="학생 정보 불러오는 중..." />;
  if (!student) return null;

  const sorted = [...attempts].sort((a, b) => {
    if (sortKey === 'submitted_at') return new Date(b.submitted_at) - new Date(a.submitted_at);
    if (sortKey === 'score_high') return b.score - a.score;
    if (sortKey === 'score_low') return a.score - b.score;
    return 0;
  });
  const paged = sorted.slice(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE);
  const maxPage = Math.ceil(sorted.length / PAGE_SIZE);

  const stats = {
    total: attempts.length,
    correct_rate: attempts.length > 0 ? Math.round((attempts.filter(a => a.correctness === 'correct').length / attempts.length) * 100) : 0,
    avg_score: attempts.length > 0 ? Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / attempts.length) : 0
  };

  const approval = APPROVAL_LABELS[student.approval_status || 'pending'];

  return (
    <div className="space-y-6 pb-10">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{student.full_name || '(이름 없음)'}</h1>
            <p className="text-sm text-muted-foreground">{student.email}</p>
          </div>
        </div>
      </div>

      {/* ── 관리자 뷰: 가입/프로필 정보 위주 ── */}
      {isAdmin && (
        <Card className="p-5 space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">학생 정보</h2>
          <InfoRow label="이메일" value={student.email} />
          <InfoRow label="이름" value={student.full_name || '—'} />
          <InfoRow label="학년" value={GRADE_LABELS[student.grade] || student.grade || '—'} />
          <InfoRow label="소속 학원" value={academy?.name || (student.academy_id ? '(로딩 중)' : '—')} />
          <InfoRow label="소속 학급" value={cls?.name || (student.class_id ? '(로딩 중)' : '—')} />
          <InfoRow
            label="승인 상태"
            value={
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${approval.cls}`}>
                {approval.text}
              </span>
            }
          />
          {student.rejected_reason && (
            <InfoRow label="거절 사유" value={student.rejected_reason} />
          )}
          <InfoRow
            label="가입일"
            value={student.created_date ? new Date(student.created_date).toLocaleDateString('ko-KR') : '—'}
          />
          {student.approved_at && (
            <InfoRow
              label="승인일"
              value={new Date(student.approved_at).toLocaleDateString('ko-KR')}
            />
          )}
        </Card>
      )}

      {/* ── 강사 뷰: 학습 통계 + 매듭 분석 ── */}
      {!isAdmin && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '총 시도', value: stats.total, unit: '회' },
              { label: '정답률', value: `${stats.correct_rate}%`, unit: '' },
              { label: '평균 점수', value: stats.avg_score, unit: '점' }
            ].map(s => (
              <Card key={s.label} className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}<span className="text-xs ml-1">{s.unit}</span></p>
              </Card>
            ))}
          </div>

          {weakTools.length > 0 && (
            <Card className="p-4 border-red-200">
              <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />약점 매듭
              </h2>
              <div className="space-y-2">
                {weakTools.map(tool => (
                  <div key={tool.tool_id} className="bg-red-50 rounded-lg p-3 border border-red-100">
                    <div className="flex justify-between mb-1">
                      <p className="font-medium text-sm">{tool.name}</p>
                      <span className="text-sm font-bold text-red-600">{tool.avg_score}점</span>
                    </div>
                    <p className="text-xs text-muted-foreground">시도 {tool.attempts}회 · 정답 {tool.correct_count}회</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {strongTools.length > 0 && (
            <Card className="p-4 border-emerald-200">
              <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />강점 매듭 (Top 5)
              </h2>
              <div className="space-y-2">
                {strongTools.map(tool => (
                  <div key={tool.tool_id} className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                    <div className="flex justify-between mb-1">
                      <p className="font-medium text-sm">{tool.name}</p>
                      <span className="text-sm font-bold text-emerald-600">{tool.avg_score}점</span>
                    </div>
                    <p className="text-xs text-muted-foreground">시도 {tool.attempts}회 · 정답 {tool.correct_count}회</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {remediationHistory.length > 0 && (
            <Card className="p-4 border-primary/30">
              <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />🎯 매듭 보강 이력
              </h2>
              <div className="space-y-2">
                {remediationHistory.map(rec => (
                  <div key={rec.tool_id} className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                    <div className="flex justify-between mb-1">
                      <p className="font-medium text-sm">{rec.tool_name}</p>
                      <span className={`text-sm font-bold ${rec.improvement > 0 ? 'text-emerald-600' : rec.improvement < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {rec.improvement > 0 ? '+' : ''}{rec.improvement}점
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">보강 전 {rec.before_avg}점 → 후 {rec.after_avg}점</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* 시도 기록 — 강사만 표시 */}
      {!isAdmin && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              시도 기록 <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">{sorted.length}건</span>
            </h2>
            <select value={sortKey} onChange={e => { setSortKey(e.target.value); setPageIdx(0); }}
              className="text-xs border border-input rounded px-2 py-1 bg-background">
              <option value="submitted_at">최근순</option>
              <option value="score_high">점수 높은순</option>
              <option value="score_low">점수 낮은순</option>
            </select>
          </div>
          <div className="space-y-2">
            {paged.map(attempt => (
              <button key={attempt.id} onClick={() => navigate(`/result/${attempt.id}`)}
                className={`w-full p-3 rounded-lg border transition-colors text-left ${
                  attempt.correctness === 'correct' ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                  : attempt.correctness === 'partial' ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                  : 'border-red-200 bg-red-50 hover:bg-red-100'
                }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attempt.problem_content?.substring(0, 50) || '(문제 없음)'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(attempt.submitted_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className={`text-sm font-bold flex-shrink-0 ${
                    attempt.correctness === 'correct' ? 'text-emerald-600' : attempt.correctness === 'partial' ? 'text-amber-600' : 'text-red-600'
                  }`}>{attempt.score}점</p>
                </div>
              </button>
            ))}
          </div>
          {sorted.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">시도 기록이 없어요</p>}
          {maxPage > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <button onClick={() => setPageIdx(Math.max(0, pageIdx - 1))} disabled={pageIdx === 0}
                className="px-3 py-1 text-sm rounded border disabled:opacity-40 hover:bg-muted">이전</button>
              <span className="text-xs text-muted-foreground">{pageIdx + 1} / {maxPage}</span>
              <button onClick={() => setPageIdx(Math.min(maxPage - 1, pageIdx + 1))} disabled={pageIdx >= maxPage - 1}
                className="px-3 py-1 text-sm rounded border disabled:opacity-40 hover:bg-muted">다음</button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}