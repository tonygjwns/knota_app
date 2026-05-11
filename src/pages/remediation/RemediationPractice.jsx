import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, X, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import MathRenderer from '@/components/MathRenderer';
import DrawingCanvas from '@/components/DrawingCanvas';
import LoadingOverlay from '@/components/LoadingOverlay';
import { findSimilarProblems } from '@/lib/findSimilarProblems';

export default function RemediationPractice() {
  const { attemptId, practiceIdx } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const idx = parseInt(practiceIdx) || 0;

  const [attempt, setAttempt] = useState(null);
  const [problem, setProblem] = useState(null);
  const [problems, setProblems] = useState([]);
  const [canvasBlob, setCanvasBlob] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [attempts, allProblems] = await Promise.all([
          base44.entities.StudentAttempt.filter({ id: attemptId }),
          base44.entities.Problem.list('-created_date', 1000)
        ]);
        if (attempts.length === 0) throw new Error('시도를 찾을 수 없어요');
        const a = attempts[0];
        setAttempt(a);

        // Extract target tool
        const rawGrading = a.claude_grade_json ? JSON.parse(a.claude_grade_json) : null;
        const grading = rawGrading?.response ?? rawGrading;
        const errorToolIds = grading?.error_locations?.map(e => e.tool_id).filter(Boolean) || [];
        const gapToolIds = grading?.gap_locations?.map(g => g.tool_id).filter(Boolean) || [];
        const targetToolId = errorToolIds[0] || gapToolIds[0];

        if (targetToolId && user) {
          const currentProblem = allProblems.find(p => p.id === a.problem_id);
          if (currentProblem) {
            const similar = await findSimilarProblems(targetToolId, currentProblem, user.id);
            setProblems(similar);
            if (similar.length > idx) {
              setProblem(similar[idx]);
            }
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
  }, [attemptId, practiceIdx, user, navigate]);

  const handleSubmit = async () => {
    if (!problem || !canvasBlob || !user) return;
    setSubmitting(true);
    try {
      // Upload canvas image
      const formData = new FormData();
      formData.append('file', canvasBlob);
      const uploadRes = await fetch('/api/integrations/Core/UploadFile', { method: 'POST', body: formData });
      const { file_url } = await uploadRes.json();

      // Submit attempt
      await base44.entities.StudentAttempt.create({
        student_id: user.id,
        student_email: user.email,
        problem_id: problem.id,
        problem_content: problem.content?.slice(0, 500) || '',
        problem_domain: problem.domain_name || '',
        canvas_image_url: file_url,
        ocr_text: '',
        claude_grade_json: '',
        score: 0,
        correctness: 'wrong',
        started_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
        duration_sec: 0,
        attempt_type: 'remediation_practice',
        parent_attempt_id: attemptId,
        target_tool_id: attempt.target_tool_id,
      });

      toast.success('제출됐어요!');
      
      if (idx < 2) {
        navigate(`/remediation/${attemptId}/practice/${idx + 1}`);
      } else {
        // Completion
        navigate(`/remediation/${attemptId}/complete`);
      }
    } catch (e) {
      toast.error('제출 실패');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">불러오는 중...</p>
      </div>
    </div>
  );

  if (!problem) return null;

  return (
    <div className="min-h-screen bg-background">
      {submitting && <LoadingOverlay stage="grading" />}
      
      {/* Header */}
      <div className="bg-card border-b p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/home')} className="p-1.5 rounded-lg hover:bg-muted">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${idx >= 0 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`w-2 h-2 rounded-full ${idx >= 1 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`w-2 h-2 rounded-full ${idx >= 2 ? 'bg-primary' : 'bg-muted'}`} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">3/3 단계 · {idx + 1}/3</p>
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
          <h1 className="text-lg font-bold mb-2">유사 문제 보강</h1>
          <p className="text-muted-foreground text-sm">비슷한 문제를 풀어봐요</p>
        </div>

        <Card className="p-4">
          <p className="text-sm font-medium mb-2">문제</p>
          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            {problem.content ? (
              <pre className="whitespace-pre-wrap font-sans">{problem.content}</pre>
            ) : (
              <p className="text-muted-foreground">문제 내용을 불러올 수 없어요</p>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-medium mb-3">풀이</p>
          <DrawingCanvas
            value={canvasBlob}
            onChange={setCanvasBlob}
            className="border rounded-lg"
          />
        </Card>

        <Button size="lg" className="w-full" onClick={handleSubmit} disabled={!canvasBlob || submitting}>
          {idx < 2 ? '다음 문제' : '보강 완료'}
          {idx < 2 ? <CheckCircle className="w-4 h-4 ml-2" /> : <CheckCircle className="w-4 h-4 ml-2" />}
        </Button>
      </div>
    </div>
  );
}