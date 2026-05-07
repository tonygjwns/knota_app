import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, X, Wrench, BookOpen, Lightbulb, Star } from 'lucide-react';
import { toast } from 'sonner';
import MathRenderer from '@/components/MathRenderer';

export default function RemediationLesson() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [attempt, setAttempt] = useState(null);
  const [tool, setTool] = useState(null);
  const [step, setStep] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [attempts, tools, problems] = await Promise.all([
          base44.entities.StudentAttempt.filter({ id: attemptId }),
          base44.entities.MathTool.list('name', 100),
          base44.entities.Problem.list('-created_date', 1000)
        ]);
        if (attempts.length === 0) throw new Error('시도를 찾을 수 없어요');
        const a = attempts[0];
        setAttempt(a);

        // Extract target tool from grading
        const grading = a.claude_grade_json ? JSON.parse(a.claude_grade_json) : null;
        const errorToolIds = grading?.error_locations?.map(e => e.tool_id).filter(Boolean) || [];
        const gapToolIds = grading?.gap_locations?.map(g => g.tool_id).filter(Boolean) || [];
        const targetToolId = errorToolIds[0] || gapToolIds[0];

        if (targetToolId) {
          const t = tools.find(t => t.tool_id === targetToolId);
          if (t) setTool(t);
        }

        // Extract step from problem solution_path
        if (targetToolId && a.problem_id) {
          const problem = problems.find(p => p.id === a.problem_id);
          if (problem?.solution_path) {
            try {
              const path = JSON.parse(problem.solution_path);
              const toolStep = path.find(s => s.tool_id === targetToolId);
              if (toolStep) setStep(toolStep);
            } catch {}
          }
        }
      } catch (e) {
        console.error(e);
        toast.error(e.message || '데이터를 불러오지 못해요');
        navigate('/home');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [attemptId, navigate]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">불러오는 중...</p>
      </div>
    </div>
  );

  const handleBookmark = async () => {
    if (!tool || !user) return;
    try {
      await base44.entities.BookmarkedTool.create({
        student_id: user.id,
        tool_id: tool.tool_id,
        context_attempt_id: attemptId
      });
      toast.success('즐겨찾기에 추가했어요');
      navigate('/home');
    } catch (e) {
      toast.error('즐겨찾기 추가 실패');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/home')} className="p-1.5 rounded-lg hover:bg-muted">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-muted" />
                <div className="w-2 h-2 rounded-full bg-primary" />
                <div className="w-2 h-2 rounded-full bg-muted" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">2/3 단계</p>
            </div>
          </div>
          <button onClick={() => navigate('/home')} className="p-1.5 rounded-lg hover:bg-muted">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="text-center py-4">
          <h1 className="text-xl font-bold mb-2">매듭 학습</h1>
          <p className="text-muted-foreground">이 도구를 함께 살펴봐요</p>
        </div>

        {tool && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">{tool.name}</h2>
                {tool.name_en && <p className="text-xs text-muted-foreground">{tool.name_en}</p>}
              </div>
            </div>

            {tool.goal && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">목적</p>
                </div>
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">{tool.goal}</p>
              </div>
            )}

            {tool.description && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">방법</p>
                </div>
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">{tool.description}</p>
              </div>
            )}

            {step && (
              <div>
                <p className="text-sm font-semibold mb-2">이 문제에 적용한다면</p>
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <MathRenderer content={step.description || step.operation} />
                </div>
              </div>
            )}
          </Card>
        )}

        <div className="space-y-2">
          <Button size="lg" className="w-full" onClick={() => navigate(`/remediation/${attemptId}/practice/0`)}>
            ✅ 이해했어요 — 유사 문제 풀기
          </Button>
          <Button size="lg" variant="outline" className="w-full" onClick={() => navigate('/home')}>
            👍 이해했어요
          </Button>
          <Button size="lg" variant="ghost" className="w-full" onClick={handleBookmark}>
            <Star className="w-4 h-4 mr-2" />
            ⭐ 나중에 다시 공부할래요
          </Button>
        </div>
      </div>
    </div>
  );
}