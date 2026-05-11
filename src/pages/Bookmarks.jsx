import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Wrench, Star, ChevronRight, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export default function Bookmarks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toolBookmarks, setToolBookmarks] = useState([]);
  const [problemBookmarks, setProblemBookmarks] = useState([]);
  const [toolMap, setToolMap] = useState(new Map());
  const [attemptMap, setAttemptMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [practicingId, setPracticingId] = useState(null);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin') { navigate('/admin', { replace: true }); return; }
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    const [toolBmarks, probBmarks, allTools, recentAttempts] = await Promise.all([
      base44.entities.BookmarkedTool.filter({ user_id: user.id }, '-created_date', 100),
      base44.entities.BookmarkedProblem.filter({ user_id: user.id }, '-created_date', 100),
      base44.entities.MathTool.list('name', 100),
      base44.entities.StudentAttempt.filter({ student_id: user.id }, '-submitted_at', 200),
    ]);
    setToolBookmarks(toolBmarks);
    setProblemBookmarks(probBmarks);
    setToolMap(new Map(allTools.map(t => [t.tool_id, t])));
    setAttemptMap(new Map(recentAttempts.map(a => [a.id, a])));
    setLoading(false);
  };

  const handleToolPractice = async (bookmark) => {
    setPracticingId(bookmark.id);
    try {
      const allProblems = await base44.entities.Problem.list('-created_date', 1000);
      const matching = allProblems.filter(p => {
        try {
          const ids = JSON.parse(p.tool_ids || '[]');
          return ids.includes(bookmark.tool_id);
        } catch { return false; }
      });
      if (matching.length === 0) {
        toast.error('이 매듭의 문제가 아직 없어요');
        return;
      }
      const pick = matching[Math.floor(Math.random() * matching.length)];
      navigate(`/problem/${pick.id}`);
    } finally {
      setPracticingId(null);
    }
  };

  const handleToolUnbookmark = async (bookmark) => {
    await base44.entities.BookmarkedTool.delete(bookmark.id);
    setToolBookmarks(prev => prev.filter(b => b.id !== bookmark.id));
    toast.success('즐겨찾기에서 제거했어요');
  };

  const handleProblemUnbookmark = async (bookmark) => {
    await base44.entities.BookmarkedProblem.delete(bookmark.id);
    setProblemBookmarks(prev => prev.filter(b => b.id !== bookmark.id));
    toast.success('즐겨찾기에서 제거했어요');
  };

  if (loading) return <AppLayout><InlineLoader message="즐겨찾기 불러오는 중..." /></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-5 pb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/problems')} className="btn-touch">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Star className="w-6 h-6 text-amber-500" />
              내 즐겨찾기
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">나중에 다시 공부하려고 표시한 항목들이에요</p>
          </div>
        </div>

        <Tabs defaultValue="tools">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="tools">
              <Wrench className="w-4 h-4 mr-1.5" />
              매듭 ({toolBookmarks.length})
            </TabsTrigger>
            <TabsTrigger value="problems">
              <BookOpen className="w-4 h-4 mr-1.5" />
              문제 ({problemBookmarks.length})
            </TabsTrigger>
          </TabsList>

          {/* ── 매듭 탭 ── */}
          <TabsContent value="tools" className="mt-4">
            {toolBookmarks.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center">
                  <Star className="w-8 h-8 text-amber-300" />
                </div>
                <div>
                  <p className="font-semibold text-lg text-foreground">아직 즐겨찾기한 매듭이 없어요</p>
                  <p className="text-sm text-muted-foreground mt-1">문제 풀기·결과 화면에서 ⭐ 버튼으로 추가할 수 있어요</p>
                </div>
                <Button onClick={() => navigate('/problems')}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  자유 풀이로 →
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {toolBookmarks.map(bookmark => {
                  const tool = toolMap.get(bookmark.tool_id);
                  const contextAttempt = bookmark.context_attempt_id ? attemptMap.get(bookmark.context_attempt_id) : null;
                  const contextDate = contextAttempt?.submitted_at
                    ? new Date(contextAttempt.submitted_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
                    : null;

                  return (
                    <Card key={bookmark.id} className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Wrench className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground">{tool?.name || bookmark.tool_id}</p>
                          {tool?.goal && <p className="text-sm text-muted-foreground mt-0.5">{tool.goal}</p>}
                          {tool?.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tool.description}</p>}
                          {contextDate && <p className="text-xs text-muted-foreground mt-1">{contextDate}에 풀던 문제에서 추가했어요</p>}
                          {bookmark.note && (
                            <p className="text-xs bg-amber-50 text-amber-700 rounded-lg px-2 py-1 mt-1 border border-amber-200">{bookmark.note}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm" className="flex-1 gap-1"
                          onClick={() => handleToolPractice(bookmark)}
                          disabled={practicingId === bookmark.id}
                        >
                          {practicingId === bookmark.id ? '문제 찾는 중...' : '이 매듭의 문제 풀기'}
                          {practicingId !== bookmark.id && <ChevronRight className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleToolUnbookmark(bookmark)} className="text-muted-foreground">
                          해제
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── 문제 탭 ── */}
          <TabsContent value="problems" className="mt-4">
            {problemBookmarks.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-blue-300" />
                </div>
                <div>
                  <p className="font-semibold text-lg text-foreground">아직 즐겨찾기한 문제가 없어요</p>
                  <p className="text-sm text-muted-foreground mt-1">문제 풀기·결과 화면에서 ⭐ 버튼으로 추가할 수 있어요</p>
                </div>
                <Button onClick={() => navigate('/problems')}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  문제 풀러 가기 →
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {problemBookmarks.map(bookmark => (
                  <Card key={bookmark.id} className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {bookmark.problem_domain && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {bookmark.problem_domain}
                          </span>
                        )}
                        {bookmark.problem_content_preview && (
                          <p className="text-sm text-foreground mt-1 line-clamp-2">{bookmark.problem_content_preview}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(bookmark.created_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}에 저장
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm" className="flex-1 gap-1"
                        onClick={() => navigate(`/problem/${bookmark.problem_id}`)}
                      >
                        다시 풀기 <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleProblemUnbookmark(bookmark)} className="text-muted-foreground">
                        해제
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}