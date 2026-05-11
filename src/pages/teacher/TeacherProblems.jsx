import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InlineLoader } from '@/components/LoadingOverlay';
import { ArrowLeft, BookOpen, Wrench, Star, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import MathRenderer from '@/components/MathRenderer';

export default function TeacherProblems() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // step: 'domain' | 'tool' | 'problem'
  const [step, setStep] = useState('domain');
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [selectedTool, setSelectedTool] = useState(null);

  const [domains, setDomains] = useState([]);
  const [tools, setTools] = useState([]);
  const [problems, setProblems] = useState([]);
  const [bookmarkedProblemIds, setBookmarkedProblemIds] = useState(new Set());
  const [bookmarkIdMap, setBookmarkIdMap] = useState(new Map()); // problemId → bookmarkRecordId
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBase();
  }, []);

  const loadBase = async () => {
    setLoading(true);
    const [allDomains, allTools, allProblems, myBookmarks] = await Promise.all([
      base44.entities.Domain.list('name', 50),
      base44.entities.MathTool.list('name', 200),
      base44.entities.Problem.list('-created_date', 1000),
      base44.entities.BookmarkedProblem.filter({ user_id: user.id }, '-created_date', 500),
    ]);
    setDomains(allDomains);
    setTools(allTools);
    setProblems(allProblems);
    const bSet = new Set(myBookmarks.map(b => b.problem_id));
    const bMap = new Map(myBookmarks.map(b => [b.problem_id, b.id]));
    setBookmarkedProblemIds(bSet);
    setBookmarkIdMap(bMap);
    setLoading(false);
  };

  // Compute tools per domain
  const toolsForDomain = (domain) => {
    return tools.filter(t => {
      try {
        const ids = JSON.parse(t.domain_ids || '[]');
        return ids.includes(domain.domain_id);
      } catch { return false; }
    });
  };

  // Problems for a tool
  const problemsForTool = (tool) => {
    return problems.filter(p => {
      try {
        const ids = JSON.parse(p.tool_ids || '[]');
        return ids.includes(tool.tool_id);
      } catch { return false; }
    });
  };

  const handleSelectDomain = (domain) => {
    setSelectedDomain(domain);
    setStep('tool');
  };

  const handleSelectTool = (tool) => {
    setSelectedTool(tool);
    setStep('problem');
  };

  const handleBack = () => {
    if (step === 'tool') { setStep('domain'); setSelectedDomain(null); }
    else if (step === 'problem') { setStep('tool'); setSelectedTool(null); }
  };

  const toggleBookmark = async (problem) => {
    const pid = problem.problem_id;
    if (bookmarkedProblemIds.has(pid)) {
      const bId = bookmarkIdMap.get(pid);
      if (!bId) return;
      await base44.entities.BookmarkedProblem.delete(bId);
      setBookmarkedProblemIds(prev => { const s = new Set(prev); s.delete(pid); return s; });
      setBookmarkIdMap(prev => { const m = new Map(prev); m.delete(pid); return m; });
      toast.success('즐겨찾기 해제했어요');
    } else {
      // get preview text from content
      let preview = '';
      try {
        const blocks = JSON.parse(problem.content || '[]');
        preview = blocks.map(b => b.text || '').join(' ').slice(0, 100);
      } catch { preview = (problem.content || '').slice(0, 100); }

      const created = await base44.entities.BookmarkedProblem.create({
        user_id: user.id,
        problem_id: pid,
        problem_content_preview: preview,
        problem_domain: problem.domain_name || '',
      });
      setBookmarkedProblemIds(prev => new Set([...prev, pid]));
      setBookmarkIdMap(prev => new Map(prev).set(pid, created.id));
      toast.success('즐겨찾기에 추가했어요');
    }
  };

  if (loading) return <InlineLoader message="데이터 불러오는 중..." />;

  // ── 단원 선택 ──
  if (step === 'domain') {
    return (
      <div className="space-y-5 pb-8">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" />
              문제 열람
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">단원을 선택하세요</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {domains.map(domain => {
            const cnt = toolsForDomain(domain).length;
            return (
              <Card
                key={domain.id}
                className="p-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
                onClick={() => handleSelectDomain(domain)}
              >
                <p className="font-semibold text-foreground text-sm leading-snug">{domain.name}</p>
                {domain.name_en && <p className="text-xs text-muted-foreground mt-0.5">{domain.name_en}</p>}
                <div className="flex items-center gap-1 mt-3 text-xs text-primary">
                  <Wrench className="w-3 h-3" />
                  <span>도구 {cnt}개</span>
                  <ChevronRight className="w-3 h-3 ml-auto" />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ── 도구 선택 ──
  if (step === 'tool') {
    const domainTools = toolsForDomain(selectedDomain);
    return (
      <div className="space-y-5 pb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack} className="btn-touch">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{selectedDomain.name}</h1>
            <p className="text-sm text-muted-foreground">도구를 선택하세요</p>
          </div>
        </div>
        {domainTools.length === 0 ? (
          <p className="text-muted-foreground text-sm">이 단원에 등록된 도구가 없어요.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {domainTools.map(tool => {
              const pCnt = problemsForTool(tool).length;
              return (
                <Card
                  key={tool.id}
                  className="p-4 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
                  onClick={() => handleSelectTool(tool)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Wrench className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground">{tool.name}</p>
                      {tool.goal && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{tool.goal}</p>}
                      <p className="text-xs text-primary mt-2">문제 {pCnt}개</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── 문제 목록 ──
  const toolProblems = problemsForTool(selectedTool);
  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={handleBack} className="btn-touch">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" />
            <h1 className="text-xl font-bold">{selectedTool.name}</h1>
          </div>
          {selectedTool.goal && (
            <p className="text-sm text-muted-foreground mt-0.5">{selectedTool.goal}</p>
          )}
        </div>
      </div>

      {toolProblems.length === 0 ? (
        <p className="text-muted-foreground text-sm">이 도구에 연결된 문제가 없어요.</p>
      ) : (
        <div className="space-y-3">
          {toolProblems.map(problem => {
            let preview = '';
            try {
              const blocks = JSON.parse(problem.content || '[]');
              preview = blocks.map(b => b.text || '').join(' ');
            } catch { preview = problem.content || ''; }
            const isBookmarked = bookmarkedProblemIds.has(problem.problem_id);

            return (
              <Card
                key={problem.id}
                className="p-4 cursor-pointer hover:shadow-md transition-all"
                onClick={() => navigate(`/teacher/problems/${problem.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground font-mono mb-1">{problem.problem_id}</p>
                    {problem.domain_name && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full mb-1 inline-block">
                        {problem.domain_name}
                      </span>
                    )}
                    <p className="text-sm text-foreground mt-1 line-clamp-2">{preview}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleBookmark(problem); }}
                    className="p-1.5 rounded-full hover:bg-muted transition-colors flex-shrink-0"
                    aria-label={isBookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                  >
                    <Star className={`w-4 h-4 ${isBookmarked ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}