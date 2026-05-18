import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { gradeLabel, extractGradeOptions } from '@/lib/grade-labels.js';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, X, Eye } from 'lucide-react';
import { InlineLoader } from '@/components/LoadingOverlay';
import MathRenderer from '@/components/MathRenderer';
import RandomPicker from '@/components/RandomPicker';

const parseProblemText = (content) => {
  try {
    const arr = typeof content === 'string' ? JSON.parse(content) : content;
    if (Array.isArray(arr)) return arr.map(b => b.text).join(' ');
    return String(content);
  } catch { return String(content || ''); }
};

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

function ProblemCard({ problem, checked, onToggle, onPreview }) {
  const text = parseProblemText(problem.content);
  return (
    <Card
      className={`p-3 cursor-pointer transition-all ${checked ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
      onClick={() => onToggle(problem.id)}
    >
      <div className="flex items-start gap-2">
        <Checkbox checked={checked} onChange={() => onToggle(problem.id)} onClick={e => e.stopPropagation()} />
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="text-xs font-mono text-muted-foreground">{problem.id?.slice(0, 8)}...</p>
          {problem.domain_name && <p className="text-xs text-primary/80 mb-0.5">{problem.domain_name}</p>}
          <p className="text-sm line-clamp-2">{text.substring(0, 80)}...</p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onPreview(problem); }}
          className="p-1 rounded hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground flex-shrink-0"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>
    </Card>
  );
}

// 유형 chip 공통 컴포넌트
function TypeChips({ chips, selectedTypeIds, setSelectedTypeIds }) {
  if (chips.length === 0) return null;
  return (
    <div>
      <label className="block text-sm font-semibold mb-2">유형 필터 <span className="text-xs font-normal text-muted-foreground">(선택 사항)</span></label>
      <div className="flex flex-wrap gap-2">
        {chips.map(t => (
          <button key={t.type_id} type="button"
            title={t.name}
            onClick={() => setSelectedTypeIds(prev => {
              const next = new Set(prev);
              next.has(t.type_id) ? next.delete(t.type_id) : next.add(t.type_id);
              return next;
            })}
            className={`rounded-full text-xs px-3 py-1.5 border transition-colors max-w-[160px] truncate ${
              selectedTypeIds.has(t.type_id)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-foreground border-border hover:bg-muted'
            }`}
          >{t.name}</button>
        ))}
        {selectedTypeIds.size > 0 && (
          <button type="button" onClick={() => setSelectedTypeIds(new Set())}
            className="rounded-full text-xs px-3 py-1.5 border border-dashed border-muted-foreground text-muted-foreground hover:bg-muted transition-colors">
            전체 해제
          </button>
        )}
      </div>
    </div>
  );
}

export default function AssignmentForm({ classId, onSave, onClose, assignment, preselectedToolId, initialTypeId }) {
  const [title, setTitle] = useState(assignment?.title || '');
  const [description, setDescription] = useState(assignment?.description || '');
  const [deadline, setDeadline] = useState(assignment?.deadline || '');
  const [saving, setSaving] = useState(false);
  const [previewProblem, setPreviewProblem] = useState(null);

  // 누적 출제 문제 (Set<id>)
  const [selectedProblems, setSelectedProblems] = useState(new Set());

  // 각 탭 임시 선택
  const [toolPickedIds, setToolPickedIds] = useState(new Set());
  const [directPickedIds, setDirectPickedIds] = useState(new Set());
  const [bookmarkPickedIds, setBookmarkPickedIds] = useState(new Set());

  // 탭
  const [activeTab, setActiveTab] = useState('tool');

  // 학년 / 단원 필터
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [grades, setGrades] = useState([]);
  const [allDomains, setAllDomains] = useState([]);
  const [allTools, setAllTools] = useState([]);
  const [allProblems, setAllProblems] = useState([]);
  const [allTypes, setAllTypes] = useState([]);
  const [allProblemTypes, setAllProblemTypes] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [classGradeNotice, setClassGradeNotice] = useState(false);

  // 도구 탭 필터
  const [selectedToolIds, setSelectedToolIds] = useState(
    preselectedToolId ? new Set([preselectedToolId]) : new Set()
  );
  const [selectedTypeIds, setSelectedTypeIds] = useState(new Set());

  // 단원 탭 검색
  const [directSearchQuery, setDirectSearchQuery] = useState('');

  // 즐겨찾기 풀
  const [bookmarkedProblemPool, setBookmarkedProblemPool] = useState([]);

  // 초기 데이터 로드
  useEffect(() => {
    const init = async () => {
      const [toolsData, domainsData, problemsData, typesData, ptData] = await Promise.all([
        base44.entities.MathTool.list('name', 300),
        base44.entities.Domain.list('grade_range', 100),
        base44.entities.Problem.list('-created_date', 1000),
        base44.entities.Type.list('name', 100),
        base44.entities.ProblemType.list('-created_date', 5000),
      ]);
      setAllTools(toolsData);
      setAllDomains(domainsData);
      setAllProblems(problemsData);
      setAllTypes(typesData);
      setAllProblemTypes(ptData);
      setGrades(extractGradeOptions(domainsData));
      setDataLoading(false);

      // preselectedToolId → 도메인/학년 자동 선택
      if (preselectedToolId) {
        const tool = toolsData.find(t => t.tool_id === preselectedToolId);
        if (tool) {
          try {
            const domainIds = JSON.parse(tool.domain_ids || '[]');
            if (domainIds.length > 0) {
              const domain = domainsData.find(d => d.domain_id === domainIds[0]);
              if (domain) {
                setSelectedGrade(domain.grade_range);
                setSelectedDomainId(domain.domain_id);
              }
            }
          } catch {}
        }
      }

      // initialTypeId → grade/domain/type 자동 선택
      if (initialTypeId && !assignment) {
        try {
          const types = await base44.entities.Type.filter({ type_id: initialTypeId }, '-created_date', 1);
          const t = types[0];
          if (t) {
            if (t.grade_range && t.domain_id) {
              setSelectedGrade(t.grade_range);
              setSelectedDomainId(t.domain_id);
            } else {
              const pts = ptData.filter(pt => pt.type_id === initialTypeId);
              if (pts.length > 0) {
                const pid = pts[0].problem_id;
                const prob = problemsData.find(p => p.problem_id === pid);
                if (prob?.domain_id) {
                  const domain = domainsData.find(d => d.domain_id === prob.domain_id);
                  if (domain) {
                    setSelectedGrade(domain.grade_range);
                    setSelectedDomainId(domain.domain_id);
                  }
                }
              }
            }
            setSelectedTypeIds(new Set([initialTypeId]));
          }
        } catch {}
      }

      // 학급 grade_range default
      if (classId && !preselectedToolId && !initialTypeId) {
        try {
          const cls = await base44.entities.Class.filter({ id: classId }, '', 1);
          if (cls[0]?.grade_range) {
            setSelectedGrade(cls[0].grade_range);
          } else {
            setClassGradeNotice(true);
          }
        } catch {}
      }

      // 즐겨찾기 로드
      try {
        const me = await base44.auth.me();
        const bookmarks = await base44.entities.BookmarkedProblem.filter({ user_id: me.id }, '-created_date', 200);
        const bmProblemIds = new Set(bookmarks.map(b => b.problem_id));
        const bmProblems = problemsData.filter(p => bmProblemIds.has(p.id));
        setBookmarkedProblemPool(bmProblems);
      } catch {}
    };
    init();
  }, [classId, preselectedToolId, initialTypeId]);

  // 수정 진입 시 문제 복원
  useEffect(() => {
    if (!assignment) return;
    try {
      const ids = JSON.parse(assignment.problem_ids || '[]');
      setSelectedProblems(new Set(ids));
    } catch {}
  }, [assignment]);

  // 학년 선택 시 단원/도구/유형 리셋
  const handleGradeChange = (g) => {
    setSelectedGrade(g);
    setSelectedDomainId('');
    setSelectedToolIds(new Set());
    setSelectedTypeIds(new Set());
  };

  // 단원 선택 시 도구/유형 리셋
  const handleDomainChange = (d) => {
    setSelectedDomainId(d);
    setSelectedToolIds(new Set());
    setSelectedTypeIds(new Set());
  };

  const filteredDomains = useMemo(
    () => allDomains.filter(d => d.grade_range === selectedGrade),
    [allDomains, selectedGrade]
  );

  const domainTypeChips = useMemo(() => {
    if (!selectedDomainId) return [];
    const domainProblems = allProblems.filter(p => p.domain_id === selectedDomainId);
    const domainProblemIds = new Set(domainProblems.map(p => p.problem_id));
    const typeIdsInDomain = new Set(
      allProblemTypes.filter(pt => domainProblemIds.has(pt.problem_id)).map(pt => pt.type_id)
    );
    return allTypes.filter(t => typeIdsInDomain.has(t.type_id));
  }, [allTypes, allProblemTypes, allProblems, selectedDomainId]);

  const typeFilteredProblemIds = useMemo(() => {
    if (selectedTypeIds.size === 0) return null;
    return new Set(
      allProblemTypes.filter(pt => selectedTypeIds.has(pt.type_id)).map(pt => pt.problem_id)
    );
  }, [allProblemTypes, selectedTypeIds]);

  const filteredTools = useMemo(() => {
    if (!selectedDomainId) return [];
    const domainTools = allTools.filter(t => {
      try {
        const ids = JSON.parse(t.domain_ids || '[]');
        return ids.includes(selectedDomainId);
      } catch { return false; }
    });
    if (!typeFilteredProblemIds) return domainTools;
    return domainTools.filter(tool =>
      allProblems.some(p => {
        if (!typeFilteredProblemIds.has(p.problem_id)) return false;
        try { return JSON.parse(p.tool_ids || '[]').includes(tool.tool_id); } catch { return false; }
      })
    );
  }, [allTools, allProblems, selectedDomainId, typeFilteredProblemIds]);

  const toggleToolId = (toolId) => {
    setSelectedToolIds(prev => {
      const next = new Set(prev);
      next.has(toolId) ? next.delete(toolId) : next.add(toolId);
      return next;
    });
  };

  // 도구 탭 문제 풀
  const toolPool = useMemo(() => {
    if (selectedToolIds.size === 0) return [];
    const seen = new Set();
    const out = [];
    for (const p of allProblems) {
      try {
        const tids = JSON.parse(p.tool_ids || '[]');
        if (!tids.some(t => selectedToolIds.has(t))) continue;
        if (typeFilteredProblemIds && !typeFilteredProblemIds.has(p.problem_id)) continue;
        if (!seen.has(p.id)) { seen.add(p.id); out.push(p); }
      } catch {}
    }
    return out;
  }, [allProblems, selectedToolIds, typeFilteredProblemIds]);

  // 즐겨찾기 풀 필터 (학년/단원/유형)
  const filteredBookmarks = useMemo(() => {
    let pool = bookmarkedProblemPool;
    if (selectedDomainId) pool = pool.filter(p => p.domain_id === selectedDomainId);
    if (typeFilteredProblemIds) pool = pool.filter(p => typeFilteredProblemIds.has(p.problem_id));
    return pool;
  }, [bookmarkedProblemPool, selectedDomainId, typeFilteredProblemIds]);

  // 추가 / 제거 핸들러
  const handleAddPicked = (pickedIds, clearFn) => {
    if (pickedIds.size === 0) return;
    setSelectedProblems(prev => {
      const next = new Set(prev);
      pickedIds.forEach(id => next.add(id));
      return next;
    });
    clearFn(new Set());
    toast.success(`${pickedIds.size}개 문제를 추가했어요`);
  };

  const handleRemoveProblem = (id) => {
    setSelectedProblems(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('제목을 입력해 주세요'); return; }
    if (!selectedGrade) { toast.error('학년을 선택해 주세요'); return; }
    if (!selectedDomainId) { toast.error('단원을 선택해 주세요'); return; }
    if (selectedProblems.size === 0) { toast.error('출제할 문제를 1개 이상 추가해 주세요'); return; }

    setSaving(true);
    try {
      const me = await base44.auth.me();
      const data = {
        title: title.trim(),
        description: description.trim() || null,
        class_id: classId,
        created_by: me.id,
        problem_ids: JSON.stringify([...selectedProblems]),
        deadline: deadline || null,
        status: assignment?.status || 'active',
      };
      await onSave(data);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{assignment ? '숙제 수정' : '새 숙제 출제'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 제목 */}
            <div>
              <label className="block text-sm font-semibold mb-2">제목 *</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 8주차 - 이차방정식" />
            </div>

            {/* 설명 */}
            <div>
              <label className="block text-sm font-semibold mb-2">설명 (선택)</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="학생들을 위한 안내 메시지..." className="h-20" />
            </div>

            {/* 마감일 */}
            <div>
              <label className="block text-sm font-semibold mb-2">마감일 (선택)</label>
              <div className="flex gap-2">
                <Input
                  type="datetime-local"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="flex-1"
                />
                {deadline && (
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => setDeadline('')}>지우기</Button>
                )}
              </div>
              {deadline && (
                <p className="text-xs text-emerald-600 mt-1">
                  ✓ 마감일: {new Date(deadline).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>

            {/* 학년 / 단원 / 문제 선택 */}
            {dataLoading ? <InlineLoader message="데이터 불러오는 중..." /> : (
              <div className="space-y-4">
                {classGradeNotice && (
                  <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                    이 학급의 기본 학년이 설정되지 않았어요. 학년을 선택해 주세요
                  </p>
                )}

                {/* 학년 */}
                <div>
                  <label className="block text-sm font-semibold mb-2">학년 *</label>
                  <Select value={selectedGrade} onValueChange={handleGradeChange}>
                    <SelectTrigger><SelectValue placeholder="학년을 선택하세요" /></SelectTrigger>
                    <SelectContent>
                      {grades.map(g => <SelectItem key={g} value={g}>{gradeLabel(g)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* 단원 */}
                <div>
                  <label className="block text-sm font-semibold mb-2">단원 *</label>
                  <Select value={selectedDomainId} onValueChange={handleDomainChange} disabled={!selectedGrade}>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedGrade ? '단원을 선택하세요' : '학년을 먼저 선택해 주세요'} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredDomains.map(d => <SelectItem key={d.domain_id} value={d.domain_id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* 3탭 문제 선택 */}
                {selectedDomainId && (
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid grid-cols-3 w-full">
                      <TabsTrigger value="tool">도구로 출제</TabsTrigger>
                      <TabsTrigger value="direct">단원 전체</TabsTrigger>
                      <TabsTrigger value="bookmark">즐겨찾기</TabsTrigger>
                    </TabsList>

                    {/* 탭 A: 도구로 출제 */}
                    <TabsContent value="tool" className="mt-3 space-y-4">
                      <TypeChips chips={domainTypeChips} selectedTypeIds={selectedTypeIds} setSelectedTypeIds={setSelectedTypeIds} />

                      {/* 도구 목록 */}
                      <div>
                        <label className="block text-sm font-semibold mb-2">
                          도구 선택 <span className="text-xs font-normal text-muted-foreground">({selectedToolIds.size}개 선택됨)</span>
                        </label>
                        {filteredTools.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">이 단원에 연결된 도구가 없어요</p>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto overflow-x-hidden pr-1">
                            {filteredTools.map(t => (
                              <Card
                                key={t.tool_id}
                                className={`p-3 cursor-pointer transition-all ${selectedToolIds.has(t.tool_id) ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
                                onClick={() => toggleToolId(t.tool_id)}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <input
                                    type="checkbox"
                                    readOnly
                                    checked={selectedToolIds.has(t.tool_id)}
                                    className="flex-shrink-0"
                                    onClick={e => e.stopPropagation()}
                                  />
                                  <div className="flex-1 min-w-0 overflow-hidden">
                                    <p className="text-sm font-medium truncate" title={t.name}>
                                      {t.name.length > 30 ? t.name.slice(0, 30) + '…' : t.name}
                                    </p>
                                    {t.goal && (
                                      <p className="text-xs text-muted-foreground truncate" title={t.goal}>
                                        {t.goal.length > 50 ? t.goal.slice(0, 50) + '…' : t.goal}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 도구 풀 — 임시 선택 */}
                      {toolPool.length > 0 && (
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold">
                            이 도구의 문제 풀 <span className="text-xs font-normal text-muted-foreground">({toolPool.length}개)</span>
                          </label>
                          <RandomPicker
                            poolSize={toolPool.length}
                            onPick={(n) => {
                              const shuffled = [...toolPool].sort(() => Math.random() - 0.5);
                              setToolPickedIds(new Set(shuffled.slice(0, n).map(p => p.id)));
                            }}
                            onClear={() => setToolPickedIds(new Set())}
                          />
                          <div className="space-y-2 max-h-64 overflow-y-auto overflow-x-hidden pr-1">
                            {toolPool.map(p => (
                              <ProblemCard
                                key={p.id}
                                problem={p}
                                checked={toolPickedIds.has(p.id)}
                                onToggle={(id) => setToolPickedIds(prev => {
                                  const next = new Set(prev);
                                  next.has(id) ? next.delete(id) : next.add(id);
                                  return next;
                                })}
                                onPreview={setPreviewProblem}
                              />
                            ))}
                          </div>
                          <Button
                            type="button" className="w-full"
                            disabled={toolPickedIds.size === 0}
                            onClick={() => handleAddPicked(toolPickedIds, setToolPickedIds)}
                          >
                            선택한 {toolPickedIds.size}개 추가
                          </Button>
                        </div>
                      )}
                    </TabsContent>

                    {/* 탭 B: 단원 전체에서 직접 선택 */}
                    <TabsContent value="direct" className="mt-3 space-y-3">
                      <TypeChips chips={domainTypeChips} selectedTypeIds={selectedTypeIds} setSelectedTypeIds={setSelectedTypeIds} />

                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="문제 내용 검색..." className="pl-10"
                          value={directSearchQuery}
                          onChange={e => setDirectSearchQuery(e.target.value)} />
                      </div>

                      {(() => {
                        let pool = allProblems.filter(p => p.domain_id === selectedDomainId);
                        if (typeFilteredProblemIds) pool = pool.filter(p => typeFilteredProblemIds.has(p.problem_id));
                        const q = directSearchQuery.toLowerCase();
                        const filtered = q
                          ? pool.filter(p => parseProblemText(p.content).toLowerCase().includes(q))
                          : pool;
                        if (filtered.length === 0) return (
                          <p className="text-sm text-muted-foreground text-center py-6">
                            {q ? '검색 결과가 없어요' : '이 단원에 문제가 없어요'}
                          </p>
                        );
                        return (
                          <>
                            <RandomPicker
                              poolSize={filtered.length}
                              onPick={(n) => {
                                const shuffled = [...filtered].sort(() => Math.random() - 0.5);
                                setDirectPickedIds(new Set(shuffled.slice(0, n).map(p => p.id)));
                              }}
                              onClear={() => setDirectPickedIds(new Set())}
                            />
                            <div className="space-y-2 max-h-96 overflow-y-auto overflow-x-hidden pr-1">
                              {filtered.map(p => (
                                <ProblemCard
                                  key={p.id}
                                  problem={p}
                                  checked={directPickedIds.has(p.id)}
                                  onToggle={(id) => setDirectPickedIds(prev => {
                                    const next = new Set(prev);
                                    next.has(id) ? next.delete(id) : next.add(id);
                                    return next;
                                  })}
                                  onPreview={setPreviewProblem}
                                />
                              ))}
                            </div>
                            <Button
                              type="button" className="w-full"
                              disabled={directPickedIds.size === 0}
                              onClick={() => handleAddPicked(directPickedIds, setDirectPickedIds)}
                            >
                              선택한 {directPickedIds.size}개 추가
                            </Button>
                          </>
                        );
                      })()}
                    </TabsContent>

                    {/* 탭 C: 즐겨찾기에서 선택 */}
                    <TabsContent value="bookmark" className="mt-3 space-y-3">
                      <TypeChips chips={domainTypeChips} selectedTypeIds={selectedTypeIds} setSelectedTypeIds={setSelectedTypeIds} />

                      <p className="text-xs text-muted-foreground">
                        내가 즐겨찾기한 문제 {filteredBookmarks.length}개 (학년/단원/유형 필터 적용됨)
                      </p>
                      {filteredBookmarks.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">
                          이 학년/단원에 즐겨찾기한 문제가 없어요
                        </p>
                      ) : (
                        <>
                          <RandomPicker
                            poolSize={filteredBookmarks.length}
                            onPick={(n) => {
                              const shuffled = [...filteredBookmarks].sort(() => Math.random() - 0.5);
                              setBookmarkPickedIds(new Set(shuffled.slice(0, n).map(p => p.id)));
                            }}
                            onClear={() => setBookmarkPickedIds(new Set())}
                          />
                          <div className="space-y-2 max-h-96 overflow-y-auto overflow-x-hidden pr-1">
                            {filteredBookmarks.map(p => (
                              <ProblemCard
                                key={p.id}
                                problem={p}
                                checked={bookmarkPickedIds.has(p.id)}
                                onToggle={(id) => setBookmarkPickedIds(prev => {
                                  const next = new Set(prev);
                                  next.has(id) ? next.delete(id) : next.add(id);
                                  return next;
                                })}
                                onPreview={setPreviewProblem}
                              />
                            ))}
                          </div>
                          <Button
                            type="button" className="w-full"
                            disabled={bookmarkPickedIds.size === 0}
                            onClick={() => handleAddPicked(bookmarkPickedIds, setBookmarkPickedIds)}
                          >
                            선택한 {bookmarkPickedIds.size}개 추가
                          </Button>
                        </>
                      )}
                    </TabsContent>
                  </Tabs>
                )}

                {/* 누적 출제 문제 — 탭 외부 항상 표시 */}
                {selectedProblems.size > 0 && (
                  <div className="space-y-2 border-t pt-4">
                    <label className="block text-sm font-semibold">
                      현재 출제 문제 <span className="text-xs font-normal text-muted-foreground">총 {selectedProblems.size}개</span>
                    </label>
                    <div className="space-y-2 max-h-64 overflow-y-auto overflow-x-hidden pr-1">
                      {allProblems.filter(p => selectedProblems.has(p.id)).map(p => (
                        <div key={p.id} className="flex items-start justify-between gap-2 p-2 bg-secondary rounded-lg min-w-0 max-w-full">
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className="text-xs font-mono text-muted-foreground">{p.id.slice(0, 8)}</p>
                            <p className="text-sm truncate">{parseProblemText(p.content).substring(0, 70)}...</p>
                            {p.domain_name && <Badge variant="outline" className="text-xs mt-1">{p.domain_name}</Badge>}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => setPreviewProblem(p)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleRemoveProblem(p.id)}
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
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={saving}>취소</Button>
            <Button onClick={handleSave} disabled={!title.trim() || selectedProblems.size === 0 || saving}>
              {saving ? '저장 중...' : assignment ? '수정 완료' : '숙제 출제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {previewProblem && (
        <ProblemPreviewModal problem={previewProblem} onClose={() => setPreviewProblem(null)} />
      )}
    </>
  );
}