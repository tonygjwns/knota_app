import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const parseProblemText = (content) => {
  try {
    const arr = typeof content === 'string' ? JSON.parse(content) : content;
    if (Array.isArray(arr)) return arr.map(b => b.text).join(' ');
    return String(content);
  } catch { return String(content || ''); }
};

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, X, RotateCcw, Eye } from 'lucide-react';
import { InlineLoader } from '@/components/LoadingOverlay';
import MathRenderer from '@/components/MathRenderer';

// 문제 상세 미리보기 모달
function ProblemPreviewModal({ problem, onClose }) {
  if (!problem) return null;
  const text = parseProblemText(problem.content);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-mono text-muted-foreground">
            {problem.problem_id || problem.id?.slice(0, 8)}
            {problem.domain_name && <Badge variant="outline" className="ml-2 text-xs">{problem.domain_name}</Badge>}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-blue-50/50 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-2">문제 내용</p>
            <MathRenderer content={text} className="text-sm leading-relaxed" />
          </div>
          {problem.verified_answer && (
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-xs text-emerald-600 mb-1">정답</p>
              <MathRenderer content={problem.verified_answer} className="text-sm" />
            </div>
          )}
          {problem.difficulty && (
            <p className="text-xs text-muted-foreground">난이도: {problem.difficulty}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 공통 문제 카드 (미리보기 버튼 포함)
function ProblemCard({ problem, checked, onToggle, onPreview, compact = false }) {
  const text = parseProblemText(problem.content);
  return (
    <Card
      className={`p-3 cursor-pointer transition-all ${
        checked ? 'border-primary bg-primary/5' : 'hover:bg-muted'
      }`}
      onClick={() => onToggle(problem.id)}
    >
      <div className="flex items-start gap-2">
        <Checkbox checked={checked} onChange={() => onToggle(problem.id)} onClick={e => e.stopPropagation()} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-muted-foreground">{problem.id?.slice(0, 8)}...</p>
          {problem.domain_name && <p className="text-xs text-primary/80 mb-0.5">{problem.domain_name}</p>}
          <p className={`text-sm ${compact ? 'truncate' : 'line-clamp-2'}`}>{text.substring(0, compact ? 50 : 80)}...</p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onPreview(problem); }}
          className="p-1 rounded hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground flex-shrink-0"
          title="상세 미리보기"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>
    </Card>
  );
}

export default function AssignmentForm({ classId, onSave, onClose, assignment, preselectedToolId }) {
  // user는 handleSave에서 base44.auth.me()로 직접 조회
  const [title, setTitle] = useState(assignment?.title || '');
  const [description, setDescription] = useState(assignment?.description || '');
  const [deadline, setDeadline] = useState(assignment?.deadline || '');
  const [tempDeadline, setTempDeadline] = useState(assignment?.deadline || '');
  const initialProblemIds = assignment ? JSON.parse(assignment.problem_ids || '[]') : [];
  const [selectedProblems, setSelectedProblems] = useState(initialProblemIds);
  const [selectionTab, setSelectionTab] = useState(preselectedToolId ? 'tool' : 'tool');
  const [saving, setSaving] = useState(false);
  const [previewProblem, setPreviewProblem] = useState(null);

  // 도구별 출제
  const [selectedTool, setSelectedTool] = useState(preselectedToolId || '');
  const [toolCount, setToolCount] = useState(10);
  const [toolPreview, setToolPreview] = useState([]);
  const [selectedToolPreviewIds, setSelectedToolPreviewIds] = useState(new Set());
  const [tools, setTools] = useState([]);
  const [toolsLoading, setToolsLoading] = useState(true);

  // 단원별 출제
  const [selectedDomain, setSelectedDomain] = useState('');
  const [domainCount, setDomainCount] = useState(10);
  const [domainPreview, setDomainPreview] = useState([]);
  const [selectedDomainPreviewIds, setSelectedDomainPreviewIds] = useState(new Set());
  const [domains, setDomains] = useState([]);
  const [domainsLoading, setDomainsLoading] = useState(true);

  // 직접 선택
  const [searchQuery, setSearchQuery] = useState('');
  const [allProblems, setAllProblems] = useState([]);
  const [problemsLoading, setProblemsLoading] = useState(true);

  // 즐겨찾기
  const [bookmarkedProblems, setBookmarkedProblems] = useState([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(true);
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState(new Set());

  useEffect(() => setTempDeadline(deadline), [deadline]);

  // 초기화
  React.useEffect(() => {
    const init = async () => {
      const [toolsData, domainsData, problemsData] = await Promise.all([
        base44.entities.MathTool.list('name', 100),
        base44.entities.Domain.list('name', 100),
        base44.entities.Problem.list('-created_date', 1000),
      ]);
      setTools(toolsData);
      setDomains(domainsData);
      setAllProblems(problemsData);
      setToolsLoading(false);
      setDomainsLoading(false);
      setProblemsLoading(false);
      if (preselectedToolId && toolsData.length > 0) {
        setSelectedTool(preselectedToolId);
      }

      // 즐겨찾기 로드
      try {
        const me = await base44.auth.me();
        const bookmarks = await base44.entities.BookmarkedProblem.filter({ user_id: me.id }, '-created_date', 200);
        // bookmark에 실제 문제 데이터 병합
        const bmProblemIds = bookmarks.map(b => b.problem_id);
        const bmProblems = problemsData.filter(p => bmProblemIds.includes(p.id));
        setBookmarkedProblems(bmProblems);
      } catch { /* silent */ }
      setBookmarksLoading(false);
    };
    init();
  }, [preselectedToolId]);

  // 도구별 미리보기 재생성
  const regenerateToolPreview = useCallback(() => {
    if (!selectedTool) return;
    const filtered = allProblems.filter(p => {
      const toolIds = p.tool_ids ? JSON.parse(p.tool_ids) : [];
      return toolIds.includes(selectedTool);
    });
    const shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, toolCount);
    setToolPreview(shuffled);
    setSelectedToolPreviewIds(new Set(shuffled.map(p => p.id)));
  }, [selectedTool, toolCount, allProblems]);

  React.useEffect(() => { regenerateToolPreview(); }, [selectedTool, toolCount, regenerateToolPreview]);

  // 단원별 미리보기 재생성
  const regenerateDomainPreview = useCallback(() => {
    if (!selectedDomain) return;
    const filtered = allProblems.filter(p => p.domain_id === selectedDomain);
    const shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, domainCount);
    setDomainPreview(shuffled);
    setSelectedDomainPreviewIds(new Set(shuffled.map(p => p.id)));
  }, [selectedDomain, domainCount, allProblems]);

  React.useEffect(() => { regenerateDomainPreview(); }, [selectedDomain, domainCount, regenerateDomainPreview]);

  const toggleToolPreview = (id) => setSelectedToolPreviewIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleDomainPreview = (id) => setSelectedDomainPreviewIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleBookmark = (id) => setSelectedBookmarkIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const selectAllToolPreview = () => setSelectedToolPreviewIds(new Set(toolPreview.map(p => p.id)));
  const deselectAllToolPreview = () => setSelectedToolPreviewIds(new Set());
  const selectAllDomainPreview = () => setSelectedDomainPreviewIds(new Set(domainPreview.map(p => p.id)));
  const deselectAllDomainPreview = () => setSelectedDomainPreviewIds(new Set());
  const selectAllBookmarks = () => setSelectedBookmarkIds(new Set(bookmarkedProblems.map(p => p.id)));
  const deselectAllBookmarks = () => setSelectedBookmarkIds(new Set());

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allProblems.filter(p =>
      (p.content || '').toLowerCase().includes(q) ||
      (p.domain_name || '').toLowerCase().includes(q)
    );
  }, [searchQuery, allProblems]);

  const toggleProblem = (id) => setSelectedProblems(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const addSelectedPreviewProblems = (problems, selectedIds) => {
    const ids = problems.filter(p => selectedIds.has(p.id)).map(p => p.id).filter(id => !selectedProblems.includes(id));
    setSelectedProblems(prev => [...prev, ...ids]);
  };

  const handleSave = async () => {
    if (!title.trim() || selectedProblems.length === 0) return;
    setSaving(true);
    try {
      const me = await base44.auth.me();
      const criteria = {
        type: selectionTab,
        ...(selectionTab === 'tool' && { tool: selectedTool }),
        ...(selectionTab === 'domain' && { domain: selectedDomain }),
      };
      const data = {
        title: title.trim(),
        description: description.trim() || null,
        class_id: classId,
        created_by: me.id,
        problem_ids: JSON.stringify(selectedProblems),
        deadline: deadline || null,
        status: assignment?.status || 'active',
        selection_criteria: JSON.stringify(criteria),
      };
      await onSave(data);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const selectedProblemObjects = useMemo(
    () => allProblems.filter(p => selectedProblems.includes(p.id)),
    [allProblems, selectedProblems]
  );

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{assignment ? '숙제 수정' : '새 숙제 출제'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 기본 정보 */}
            <div>
              <label className="block text-sm font-semibold mb-2">제목 *</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 8주차 - 이차방정식" />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">설명 (선택)</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="학생들을 위한 안내 메시지..." className="h-20" />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">마감일 (선택)</label>
              <div className="flex gap-2">
                <Input type="datetime-local" value={tempDeadline}
                  onChange={e => setTempDeadline(e.target.value)} className="flex-1" />
                <Button type="button" variant="outline" size="sm"
                  disabled={!tempDeadline || tempDeadline === deadline}
                  onClick={() => setDeadline(tempDeadline)}>확인</Button>
                {deadline && (
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => { setDeadline(''); setTempDeadline(''); }}>지우기</Button>
                )}
              </div>
              {deadline && (
                <p className="text-xs text-emerald-600 mt-1">
                  ✓ 마감일: {new Date(deadline).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>

            {/* 문제 선택 */}
            <div>
              <label className="block text-sm font-semibold mb-3">문제 선택 *</label>
              <Tabs value={selectionTab} onValueChange={setSelectionTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="tool">도구별</TabsTrigger>
                  <TabsTrigger value="domain">단원별</TabsTrigger>
                  <TabsTrigger value="direct">직접 선택</TabsTrigger>
                  <TabsTrigger value="bookmark">즐겨찾기</TabsTrigger>
                </TabsList>

                {/* 도구별 */}
                <TabsContent value="tool" className="space-y-3 mt-3">
                  {toolsLoading ? <InlineLoader message="도구 로딩 중..." /> : (
                    <>
                      <Select value={selectedTool} onValueChange={setSelectedTool}>
                        <SelectTrigger><SelectValue placeholder="도구를 선택하세요" /></SelectTrigger>
                        <SelectContent>
                          {tools.map(t => <SelectItem key={t.tool_id} value={t.tool_id}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {selectedTool && (
                        <>
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-medium">문제 수</label>
                            <div className="flex items-center gap-2">
                              <Input type="number" min={1} max={50} value={toolCount}
                                onChange={e => setToolCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                                className="w-20 h-8" />
                              <span className="text-sm text-muted-foreground">개</span>
                              <Button variant="outline" size="sm" onClick={regenerateToolPreview} className="gap-1">
                                <RotateCcw className="w-4 h-4" />다시 뽑기
                              </Button>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <p className="text-xs text-muted-foreground">미리보기 ({toolPreview.length}개)</p>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={selectAllToolPreview} className="h-6 text-xs">전체 선택</Button>
                                <Button variant="ghost" size="sm" onClick={deselectAllToolPreview} className="h-6 text-xs">전체 해제</Button>
                              </div>
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                              {toolPreview.map(p => (
                                <ProblemCard key={p.id} problem={p}
                                  checked={selectedToolPreviewIds.has(p.id)}
                                  onToggle={toggleToolPreview}
                                  onPreview={setPreviewProblem} />
                              ))}
                            </div>
                          </div>
                          {toolPreview.length > 0 && (
                            <Button onClick={() => addSelectedPreviewProblems(toolPreview, selectedToolPreviewIds)}
                              className="w-full" disabled={selectedToolPreviewIds.size === 0}>
                              선택한 {selectedToolPreviewIds.size}개 문제 추가
                            </Button>
                          )}
                        </>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* 단원별 */}
                <TabsContent value="domain" className="space-y-3 mt-3">
                  {domainsLoading ? <InlineLoader message="단원 로딩 중..." /> : (
                    <>
                      <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                        <SelectTrigger><SelectValue placeholder="단원을 선택하세요" /></SelectTrigger>
                        <SelectContent>
                          {domains.map(d => <SelectItem key={d.domain_id} value={d.domain_id}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {selectedDomain && (
                        <>
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-medium">문제 수</label>
                            <div className="flex items-center gap-2">
                              <Input type="number" min={1} max={50} value={domainCount}
                                onChange={e => setDomainCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                                className="w-20 h-8" />
                              <span className="text-sm text-muted-foreground">개</span>
                              <Button variant="outline" size="sm" onClick={regenerateDomainPreview} className="gap-1">
                                <RotateCcw className="w-4 h-4" />다시 뽑기
                              </Button>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <p className="text-xs text-muted-foreground">미리보기 ({domainPreview.length}개)</p>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={selectAllDomainPreview} className="h-6 text-xs">전체 선택</Button>
                                <Button variant="ghost" size="sm" onClick={deselectAllDomainPreview} className="h-6 text-xs">전체 해제</Button>
                              </div>
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                              {domainPreview.map(p => (
                                <ProblemCard key={p.id} problem={p}
                                  checked={selectedDomainPreviewIds.has(p.id)}
                                  onToggle={toggleDomainPreview}
                                  onPreview={setPreviewProblem} />
                              ))}
                            </div>
                          </div>
                          {domainPreview.length > 0 && (
                            <Button onClick={() => addSelectedPreviewProblems(domainPreview, selectedDomainPreviewIds)}
                              className="w-full" disabled={selectedDomainPreviewIds.size === 0}>
                              선택한 {selectedDomainPreviewIds.size}개 문제 추가
                            </Button>
                          )}
                        </>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* 직접 선택 */}
                <TabsContent value="direct" className="space-y-3 mt-3">
                  {problemsLoading ? <InlineLoader message="문제 로딩 중..." /> : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="문제 검색 (내용, 단원)..." value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {searchResults.map(p => (
                          <ProblemCard key={p.id} problem={p}
                            checked={selectedProblems.includes(p.id)}
                            onToggle={toggleProblem}
                            onPreview={setPreviewProblem} />
                        ))}
                      </div>
                      {searchQuery && searchResults.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">검색 결과가 없습니다.</p>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* 즐겨찾기 */}
                <TabsContent value="bookmark" className="space-y-3 mt-3">
                  {bookmarksLoading ? <InlineLoader message="즐겨찾기 로딩 중..." /> : (
                    <>
                      {bookmarkedProblems.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">즐겨찾기한 문제가 없어요</p>
                      ) : (
                        <>
                          <div className="flex justify-between items-center">
                            <p className="text-xs text-muted-foreground">즐겨찾기 문제 ({bookmarkedProblems.length}개)</p>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={selectAllBookmarks} className="h-6 text-xs">전체 선택</Button>
                              <Button variant="ghost" size="sm" onClick={deselectAllBookmarks} className="h-6 text-xs">전체 해제</Button>
                            </div>
                          </div>
                          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {bookmarkedProblems.map(p => (
                              <ProblemCard key={p.id} problem={p}
                                checked={selectedBookmarkIds.has(p.id)}
                                onToggle={toggleBookmark}
                                onPreview={setPreviewProblem} />
                            ))}
                          </div>
                          {selectedBookmarkIds.size > 0 && (
                            <Button onClick={() => addSelectedPreviewProblems(bookmarkedProblems, selectedBookmarkIds)}
                              className="w-full">
                              선택한 {selectedBookmarkIds.size}개 문제 추가
                            </Button>
                          )}
                        </>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* 선택된 문제 리스트 */}
            {selectedProblems.length > 0 && (
              <div>
                <label className="block text-sm font-semibold mb-2">
                  선택된 문제 ({selectedProblems.length}개)
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedProblemObjects.map(p => (
                    <div key={p.id} className="flex items-start justify-between gap-2 p-2 bg-secondary rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-muted-foreground">{p.id.slice(0, 8)}</p>
                        <p className="text-sm truncate">{parseProblemText(p.content).substring(0, 60)}...</p>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {p.domain_name && <Badge variant="outline" className="text-xs">{p.domain_name}</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setPreviewProblem(p)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => toggleProblem(p.id)}
                          className="text-destructive hover:bg-destructive/10 p-1 rounded">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={saving}>취소</Button>
            <Button onClick={handleSave} disabled={!title.trim() || selectedProblems.length === 0 || saving}>
              {saving ? '저장 중...' : assignment ? '수정 완료' : '숙제 출제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 문제 상세 미리보기 모달 */}
      {previewProblem && (
        <ProblemPreviewModal problem={previewProblem} onClose={() => setPreviewProblem(null)} />
      )}
    </>
  );
}