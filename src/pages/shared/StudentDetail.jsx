import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PaginationBar from '@/components/ui/PaginationBar';
import { aggregateToolMastery, topWeakTools, topStrongTools } from '@/lib/toolMastery';
import { ArrowLeft, User, TrendingUp, BookOpen, CheckCircle, Target } from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

const CORRECTNESS_COLOR = {
  correct: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-100 text-amber-700 border-amber-200',
  wrong: 'bg-red-100 text-red-700 border-red-200',
};
const CORRECTNESS_LABEL = { correct: '정답', partial: '부분', wrong: '오답' };

export default function StudentDetail({ mode }) {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();

  const [target, setTarget] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [weakTools, setWeakTools] = useState([]);
  const [strongTools, setStrongTools] = useState([]);
  const [academyName, setAcademyName] = useState('');
  const [className, setClassName] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => { load(); }, [userId]);

  const load = async () => {
    setLoading(true);
    try {
      // Fetch target user
      const users = await base44.entities.User.filter({ id: userId }, '-created_date', 1);
      if (!users.length) { toast.error('학생을 찾을 수 없어요'); navigate(-1); return; }
      const t = users[0];

      // Teacher access guard
      if (mode === 'teacher') {
        const allClasses = await base44.entities.Class.list('name', 500);
        const myClasses = allClasses.filter(c =>
          c.main_teacher_id === me.id || (c.assistant_teacher_ids || []).includes(me.id)
        );
        const myClassIds = myClasses.map(c => c.id);
        if (!myClassIds.includes(t.class_id)) {
          toast.error('이 학생을 볼 권한이 없어요');
          navigate(-1);
          return;
        }
      }

      setTarget(t);

      // Parallel: attempts, problems, tools, academy, class
      const [atts, problems, allTools, academies, classes] = await Promise.all([
        base44.entities.StudentAttempt.filter({ student_id: userId }, '-submitted_at', 500),
        base44.entities.Problem.list('-created_date', 1000, 0),
        base44.entities.MathTool.list('name', 100),
        t.academy_id ? base44.entities.Academy.list('name', 200) : Promise.resolve([]),
        t.class_id ? base44.entities.Class.list('name', 500) : Promise.resolve([]),
      ]);

      setAttempts(atts);
      setAcademyName(academies.find(a => a.id === t.academy_id)?.name || '');
      setClassName(classes.find(c => c.id === t.class_id)?.name || '');

      // Tool mastery
      const problemMap = new Map(problems.map(p => [p.id, p]));
      const toolNameMap = new Map(allTools.map(t => [t.tool_id, t]));
      const masteryMap = aggregateToolMastery(atts, problemMap);
      setWeakTools(topWeakTools(masteryMap, toolNameMap, 5, 2));
      setStrongTools(topStrongTools(masteryMap, toolNameMap, 5, 70, 2));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <InlineLoader message="학생 정보 불러오는 중..." />;
  if (!target) return null;

  const totalCount = attempts.length;
  const correctCount = attempts.filter(a => a.correctness === 'correct').length;
  const correctRate = totalCount > 0 ? Math.round(correctCount / totalCount * 100) : 0;
  const avgScore = totalCount > 0
    ? Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / totalCount)
    : 0;

  const paginated = attempts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const gradeLabel = target.grade ? `${target.grade}학년` : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 -ml-2">
        <ArrowLeft className="w-4 h-4" /> 뒤로
      </Button>

      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-7 h-7 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{target.full_name || '(이름 없음)'}</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
              {target.role || 'student'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{target.email}</p>
          {(gradeLabel || academyName || className) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {[gradeLabel, academyName, className].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: BookOpen, label: '총 시도', value: `${totalCount}회`, color: 'text-blue-500 bg-blue-50' },
          { icon: CheckCircle, label: `정답 ${correctCount}회`, value: `${correctRate}%`, color: 'text-emerald-500 bg-emerald-50' },
          { icon: TrendingUp, label: '평균 점수', value: `${avgScore}점`, color: 'text-amber-500 bg-amber-50' },
        ].map(s => (
          <Card key={s.label} className="p-3 text-center">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 mx-auto ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Tool mastery */}
      {(weakTools.length > 0 || strongTools.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {weakTools.length > 0 && (
            <Card className="p-4">
              <h2 className="font-semibold text-sm mb-3 text-red-600 flex items-center gap-1.5">
                <Target className="w-4 h-4" /> 약점 매듭 Top {weakTools.length}
              </h2>
              <div className="space-y-2">
                {weakTools.map(t => (
                  <div key={t.tool_id} className="flex items-center justify-between gap-2">
                    <span className="text-sm truncate flex-1">{t.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">{t.attempts}회</span>
                      <span className={`text-xs font-semibold ${t.avg_score < 40 ? 'text-red-500' : 'text-amber-500'}`}>
                        {t.avg_score}점
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {strongTools.length > 0 && (
            <Card className="p-4">
              <h2 className="font-semibold text-sm mb-3 text-emerald-600 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> 강점 매듭 Top {strongTools.length}
              </h2>
              <div className="space-y-2">
                {strongTools.map(t => (
                  <div key={t.tool_id} className="flex items-center justify-between gap-2">
                    <span className="text-sm truncate flex-1">{t.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">{t.attempts}회</span>
                      <span className="text-xs font-semibold text-emerald-600">{t.avg_score}점</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Attempt timeline */}
      <div>
        <h2 className="font-semibold mb-3">시도 기록 ({totalCount}회)</h2>
        {totalCount === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">아직 시도 기록이 없어요</div>
        ) : (
          <div className="space-y-2">
            {paginated.map(a => {
              const text = (() => {
                try {
                  const arr = typeof a.problem_content === 'string' ? JSON.parse(a.problem_content) : a.problem_content;
                  if (Array.isArray(arr)) return arr.map(b => b.text).join(' ');
                  return String(a.problem_content || '');
                } catch { return String(a.problem_content || ''); }
              })();
              const date = a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('ko-KR') : '—';
              return (
                <Card key={a.id}
                  className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/result/${a.id}`)}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate text-foreground">
                        {text.slice(0, 60) || `문제 #${a.problem_id?.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {a.correctness && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${CORRECTNESS_COLOR[a.correctness] || ''}`}>
                          {CORRECTNESS_LABEL[a.correctness] || a.correctness}
                        </span>
                      )}
                      <span className={`text-sm font-bold ${
                        (a.score || 0) >= 80 ? 'text-emerald-600' : (a.score || 0) >= 40 ? 'text-amber-500' : 'text-red-500'
                      }`}>{a.score ?? '—'}점</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        <div className="mt-3">
          <PaginationBar page={page} totalCount={totalCount} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
      </div>
    </div>
  );
}