import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { InlineLoader } from '@/components/LoadingOverlay';
import MathRenderer from '@/components/MathRenderer';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PaginationBar from '@/components/ui/PaginationBar';
import { ArrowLeft, ChevronDown, ChevronUp, Wrench, BookOpen, CheckCircle, TrendingUp, User } from 'lucide-react';

const PAGE_SIZE = 20;

const CORRECTNESS_COLOR = {
  correct: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-100 text-amber-700 border-amber-200',
  wrong: 'bg-red-100 text-red-700 border-red-200',
};
const CORRECTNESS_LABEL = { correct: '정답', partial: '부분', wrong: '오답' };

export default function ProblemDetail({ mode }) {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();

  const [problem, setProblem] = useState(null);
  const [tools, setTools] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(0);

  useEffect(() => { load(); }, [problemId]);

  const load = async () => {
    setLoading(true);
    try {
      const [problems, allTools] = await Promise.all([
        base44.entities.Problem.filter({ id: problemId }, '-created_date', 1),
        base44.entities.MathTool.list('name', 100),
      ]);
      if (!problems.length) { navigate(-1); return; }
      const p = problems[0];
      setProblem(p);

      // Parse tool_ids
      let toolIds = [];
      try { const parsed = JSON.parse(p.tool_ids || '[]'); if (Array.isArray(parsed)) toolIds = parsed; } catch {}
      setTools(allTools.filter(t => toolIds.includes(t.tool_id)));

      // Fetch all attempts for this problem
      let atts = await base44.entities.StudentAttempt.filter({ problem_id: problemId }, '-submitted_at', 500);

      // Teacher mode: filter to own students only
      if (mode === 'teacher') {
        const allClasses = await base44.entities.Class.list('name', 500);
        const myClasses = allClasses.filter(c =>
          c.main_teacher_id === me.id || (c.assistant_teacher_ids || []).includes(me.id)
        );
        const myClassIds = myClasses.map(c => c.id);
        const studentFetches = myClassIds.map(cid =>
          base44.entities.User.filter({ class_id: cid }, '-created_date', 200)
        );
        const studentArrays = await Promise.all(studentFetches);
        const myStudentIds = new Set(studentArrays.flat().map(u => u.id));
        atts = atts.filter(a => myStudentIds.has(a.student_id));
      }

      setAttempts(atts);

      // Build user map for name display
      const uniqueIds = [...new Set(atts.map(a => a.student_id))];
      if (uniqueIds.length > 0) {
        const userFetches = uniqueIds.map(id => base44.entities.User.filter({ id }, '-created_date', 1));
        const userArrays = await Promise.all(userFetches);
        const map = {};
        userArrays.flat().forEach(u => { map[u.id] = u; });
        setUserMap(map);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <InlineLoader message="문제 정보 불러오는 중..." />;
  if (!problem) return null;

  const parsedText = (() => {
    try {
      const arr = typeof problem.content === 'string' ? JSON.parse(problem.content) : problem.content;
      if (Array.isArray(arr)) return arr.map(b => b.text).join('\n');
      return String(problem.content || '');
    } catch { return String(problem.content || ''); }
  })();

  const totalCount = attempts.length;
  const correctCount = attempts.filter(a => a.correctness === 'correct').length;
  const correctRate = totalCount > 0 ? Math.round(correctCount / totalCount * 100) : 0;
  const avgScore = totalCount > 0
    ? Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / totalCount)
    : 0;

  const sorted = [...attempts].sort((a, b) => {
    if (sort === 'recent') return new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0);
    if (sort === 'high') return (b.score || 0) - (a.score || 0);
    return (a.score || 0) - (b.score || 0);
  });
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 -ml-2">
        <ArrowLeft className="w-4 h-4" /> 뒤로
      </Button>

      {/* Problem header */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {problem.domain_name && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {problem.domain_name}
            </span>
          )}
          <span className="text-xs text-muted-foreground">#{problem.problem_id || problem.id?.slice(0, 8)}</span>
        </div>

        {tools.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tools.map(t => (
              <span key={t.tool_id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                <Wrench className="w-3 h-3" /> {t.name}
              </span>
            ))}
          </div>
        )}

        <div className="bg-blue-50/50 rounded-xl p-4">
          <MathRenderer content={parsedText} className="text-sm" />
        </div>

        {problem.verified_answer && (
          <>
            <button
              className="flex items-center gap-2 text-sm text-emerald-600 font-medium"
              onClick={() => setShowAnswer(o => !o)}>
              검증된 정답 {showAnswer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showAnswer && (
              <div className="bg-emerald-50 rounded-xl p-3">
                <MathRenderer content={problem.verified_answer} className="text-sm" />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: BookOpen, label: '총 시도', value: `${totalCount}회`, color: 'text-blue-500 bg-blue-50' },
          { icon: CheckCircle, label: '정답률', value: `${correctRate}%`, color: 'text-emerald-500 bg-emerald-50' },
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

      {/* Attempt list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">학생 풀이 ({totalCount}건)</h2>
          <Select value={sort} onValueChange={v => { setSort(v); setPage(0); }}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">최근순</SelectItem>
              <SelectItem value="high">점수 높은순</SelectItem>
              <SelectItem value="low">점수 낮은순</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {totalCount === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">아직 학생 풀이가 없어요</div>
        ) : (
          <div className="space-y-2">
            {paginated.map(a => {
              const u = userMap[a.student_id];
              const date = a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('ko-KR') : '—';
              return (
                <Card key={a.id}
                  className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/result/${a.id}`)}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{u?.full_name || a.student_email || '학생'}</p>
                      <p className="text-xs text-muted-foreground">{date}</p>
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