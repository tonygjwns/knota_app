import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, X } from 'lucide-react';
import { toast } from 'sonner';

export default function RemediationRetry() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [attempt, setAttempt] = useState(null);
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [attempts, problems] = await Promise.all([
          base44.entities.StudentAttempt.filter({ id: attemptId }),
          base44.entities.Problem.list('-created_date', 1000)
        ]);
        if (attempts.length === 0) throw new Error('시도를 찾을 수 없어요');
        const a = attempts[0];
        setAttempt(a);
        
        const p = problems.find(p => p.id === a.problem_id);
        if (p) setProblem(p);
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

  if (!attempt || !problem) return null;

  const handleRetry = () => {
    const params = new URLSearchParams();
    params.set('assignment_id', attempt.assignment_id || '');
    params.set('remediation_for', attemptId);
    navigate(`/problem/${problem.id}?${params.toString()}`);
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
                {[1, 2, 3].map(i => (
                  <div key={i} className={`w-2 h-2 rounded-full ${i === 1 ? 'bg-primary' : 'bg-muted'}`} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">1/3 단계</p>
            </div>
          </div>
          <button onClick={() => navigate('/home')} className="p-1.5 rounded-lg hover:bg-muted">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="text-center py-8">
          <h1 className="text-xl font-bold mb-2">같은 문제 다시 풀기</h1>
          <p className="text-muted-foreground">어디가 막혔는지 알았으니 다시 풀어볼까요?</p>
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

        <div className="flex gap-3">
          <Button size="lg" className="flex-1" onClick={handleRetry}>
            다시 풀기
          </Button>
          <Button size="lg" variant="outline" className="flex-1" onClick={() => navigate(`/remediation/${attemptId}/lesson`)}>
            건너뛰기 — 도구 학습으로
          </Button>
        </div>
      </div>
    </div>
  );
}