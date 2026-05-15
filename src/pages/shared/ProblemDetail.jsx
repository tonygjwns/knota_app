import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useTeacher } from '@/lib/TeacherContext';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Star } from 'lucide-react';
import { toast } from 'sonner';
import MathRenderer from '@/components/MathRenderer';
import SolutionCard from '@/components/SolutionCard';

const parseProblemText = (content) => {
  try {
    const arr = typeof content === 'string' ? JSON.parse(content) : content;
    if (Array.isArray(arr)) return arr.map(b => b.text).join('\n');
    return String(content);
  } catch {
    return String(content || '');
  }
};

export default function ProblemDetail({ mode = 'admin' }) {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: teacherData } = useTeacher();

  const [problem, setProblems] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [tools, setTools] = useState([]);
  const [users, setUsers] = useState([]);
  const [solutions, setSolutions] = useState([]);
  const [solutionSteps, setSolutionSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('submitted_at');
  const [pageIdx, setPageIdx] = useState(0);


  // 즐겨찾기 상태 (teacher mode)
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkRecordId, setBookmarkRecordId] = useState(null);

  const PAGE_SIZE = 20;

  useEffect(() => {
    const load = async () => {
      try {
        // 문제 fetch
        let problemsData = await base44.entities.Problem.filter({ id: problemId });
        if (problemsData.length === 0) {
          problemsData = await base44.entities.Problem.filter({ problem_id: problemId });
        }
        if (problemsData.length === 0) throw new Error('문제를 찾을 수 없어요');
        const prob = problemsData[0];
        setProblems(prob);

        // 병렬 fetch: 시도 + 도구 + 별해 + (강사 즐겨찾기)
        const fetchPromises = [
          base44.entities.StudentAttempt.filter({ problem_id: problemId }, '-submitted_at', 1000),
          base44.entities.MathTool.list(),
          base44.entities.Solution.filter({ problem_id: prob.problem_id }, 'priority', 100),
        ];
        if (mode === 'teacher' && user) {
          fetchPromises.push(
            base44.entities.BookmarkedProblem.filter({ user_id: user.id, problem_id: prob.problem_id }, '-created_date', 1)
          );
        }

        const results = await Promise.all(fetchPromises);
        const [allAttempts, toolsData, sols, bmData] = results;

        // 강사 즐겨찾기 초기화
        if (mode === 'teacher' && bmData && bmData.length > 0) {
          setIsBookmarked(true);
          setBookmarkRecordId(bmData[0].id);
        }

        // 별해 steps fetch
        if (sols.length > 0) {
          const allSteps = await Promise.all(
            sols.map(s => base44.entities.SolutionStep.filter({ solution_id: s.solution_id }, 'sequence_order', 50))
          );
          setSolutionSteps(allSteps.flat());
        }
        setSolutions(sols);

        // teacher mode: 내 학생 필터
        let filteredAttempts = allAttempts;
        if (mode === 'teacher' && teacherData?.my_students) {
          const myStudentIds = new Set(teacherData.my_students.map(s => s.id));
          filteredAttempts = allAttempts.filter(a => myStudentIds.has(a.student_id));
        }
        setAttempts(filteredAttempts);
        setTools(toolsData);

        // 학생 정보 fetch
        if (filteredAttempts.length > 0) {
          if (mode === 'teacher') {
            setUsers(teacherData?.my_students || []);
          } else {
            const studentIds = [...new Set(filteredAttempts.map(a => a.student_id))];
            const usersData = await Promise.all(
              studentIds.map(id => base44.entities.User.filter({ id }))
            );
            setUsers(usersData.flat());
          }
        }
      } catch (e) {
        setError(e.message || '데이터를 불러오지 못했어요');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [problemId, mode, teacherData]);

  const toggleBookmark = async () => {
    if (!user || !problem) return;
    try {
      if (isBookmarked) {
        await base44.entities.BookmarkedProblem.delete(bookmarkRecordId);
        setIsBookmarked(false);
        setBookmarkRecordId(null);
        toast.success('즐겨찾기 해제했어요');
      } else {
        let preview = '';
        try {
          const blocks = JSON.parse(problem.content || '[]');
          preview = blocks.map(b => b.text || '').join(' ').slice(0, 100);
        } catch { preview = (problem.content || '').slice(0, 100); }
        const created = await base44.entities.BookmarkedProblem.create({
          user_id: user.id,
          problem_id: problem.problem_id,
          problem_content_preview: preview,
          problem_domain: problem.domain_name || '',
        });
        setIsBookmarked(true);
        setBookmarkRecordId(created.id);
        toast.success('즐겨찾기에 추가했어요');
      }
    } catch {
      toast.error('즐겨찾기 처리 중 오류가 발생했어요');
    }
  };

  if (loading) return <InlineLoader message="문제 정보 불러오는 중..." />;
  if (error) return <div className="text-center py-12 text-red-500">{error}</div>;
  if (!problem) return null;

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
    correct: attempts.filter(a => a.correctness === 'correct').length,
    correct_rate: attempts.length > 0 ? Math.round((attempts.filter(a => a.correctness === 'correct').length / attempts.length) * 100) : 0,
    avg_score: attempts.length > 0 ? Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / attempts.length) : 0
  };

  const toolIds = problem.tool_ids ? JSON.parse(problem.tool_ids) : [];
  const toolNames = toolIds.map(id => tools.find(t => t.tool_id === id)?.name || id).filter(Boolean);
  const toolMap = new Map(tools.map(t => [t.tool_id, t]));

  return (
    <div className="space-y-6 pb-10">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">문제 ID: {problem.problem_id}</p>
          <h1 className="text-xl font-bold">{problem.domain_name || '(도메인 없음)'}</h1>
          {toolNames.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {toolNames.map(name => (
                <span key={name} className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded">
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* 즐겨찾기 (teacher mode only) */}
        {mode === 'teacher' && (
          <button
            onClick={toggleBookmark}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors text-sm flex-shrink-0"
          >
            <Star className={`w-4 h-4 ${isBookmarked ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`} />
            <span className="text-xs text-muted-foreground">{isBookmarked ? '저장됨' : '저장'}</span>
          </button>
        )}
      </div>

      {/* 문제 본문 */}
      <Card className="p-4">
        <div className="prose prose-sm max-w-none">
          {problem.content ? (
            <MathRenderer content={parseProblemText(problem.content)} />
          ) : (
            <p className="text-muted-foreground">(문제 내용 없음)</p>
          )}
        </div>
      </Card>

      {/* 검증 정답 */}
      {problem.verified_answer && (
        <Card className="p-4">
          <p className="font-semibold mb-3">검증 정답</p>
          <div className="pt-3 border-t prose prose-sm max-w-none">
            <MathRenderer content={parseProblemText(problem.verified_answer)} />
          </div>
        </Card>
      )}

      {/* 별해 섹션 */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          풀이
          <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">{solutions.length}개</span>
        </h2>
        {solutions.length === 0 ? (
          <p className="text-sm text-muted-foreground">별해 데이터 없음</p>
        ) : (
          <div className="space-y-3">
            {solutions.map((sol, idx) => {
              const steps = solutionSteps.filter(s => s.solution_id === sol.solution_id);
              return (
                <SolutionCard
                  key={sol.id}
                  solution={sol}
                  steps={steps}
                  toolMap={toolMap}
                  defaultOpen={idx === 0}
                />
              );
            })}
          </div>
        )}
      </Card>

      {/* 통계 */}
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

      {/* 학생 풀이 리스트 */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <span>학생 풀이</span>
            <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">{sorted.length}건</span>
          </h2>
          <select
            value={sortKey}
            onChange={e => { setSortKey(e.target.value); setPageIdx(0); }}
            className="text-xs border border-input rounded px-2 py-1 bg-background"
          >
            <option value="submitted_at">최근순</option>
            <option value="score_high">점수 높은순</option>
            <option value="score_low">점수 낮은순</option>
          </select>
        </div>

        <div className="space-y-2">
          {paged.map(attempt => {
            const student = users.find(u => u.id === attempt.student_id);
            return (
              <button
                key={attempt.id}
                onClick={() => navigate(`/record/${attempt.id}`)}
                className={`w-full p-3 rounded-lg border transition-colors text-left ${
                  attempt.correctness === 'correct'
                    ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                    : attempt.correctness === 'partial'
                      ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                      : 'border-red-200 bg-red-50 hover:bg-red-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                      {student?.full_name?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{student?.full_name || '(이름 없음)'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(attempt.submitted_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${
                      attempt.correctness === 'correct' ? 'text-emerald-600' : attempt.correctness === 'partial' ? 'text-amber-600' : 'text-red-600'
                    }`}>{attempt.score}점</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {sorted.length === 0 && (
          <p className="text-center py-8 text-muted-foreground text-sm">
            {mode === 'teacher' ? '내 학생들의 풀이가 없어요' : '풀이 기록이 없어요'}
          </p>
        )}

        {maxPage > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <button
              onClick={() => setPageIdx(Math.max(0, pageIdx - 1))}
              disabled={pageIdx === 0}
              className="px-3 py-1 text-sm rounded border disabled:opacity-40 hover:bg-muted"
            >이전</button>
            <span className="text-xs text-muted-foreground">{pageIdx + 1} / {maxPage}</span>
            <button
              onClick={() => setPageIdx(Math.min(maxPage - 1, pageIdx + 1))}
              disabled={pageIdx >= maxPage - 1}
              className="px-3 py-1 text-sm rounded border disabled:opacity-40 hover:bg-muted"
            >다음</button>
          </div>
        )}
      </Card>
    </div>
  );
}