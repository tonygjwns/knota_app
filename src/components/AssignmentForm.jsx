import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { gradeLabel, extractGradeOptions } from '@/lib/grade-labels.js';
import { toast } from 'sonner';

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
import { Search, X, Eye } from 'lucide-react';
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
  const [title, setTitle] = useState(assignment?.title || '');
  const [description, setDescription] = useState(assignment?.description || '');
  const [deadline, setDeadline] = useState(assignment?.deadline || '');
  const [tempDeadline, setTempDeadline] = useState(assignment?.deadline || '');
  const initialProblemIds = assignment ? JSON.parse(assignment.problem_ids || '[]') : [];
  const [selectedProblems, setSelectedProblems] = useState(initialProblemIds);
  const [saving, setSaving] = useState(false);
  const [previewProblem, setPreviewProblem] = useState(null);

  // 학년 / 단원 필터
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [grades, setGrades] = useState([]);
  const [allDomains, setAllDomains] = useState([]);
  const [allTools, setAllTools] = useState([]);
  const [allProblems, setAllProblems] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [classGradeNotice, setClassGradeNotice] = useState(false);

  // 선택된 도구 Set
  const [selectedToolIds, setSelectedToolIds] = useState(
    preselectedToolId ? new Set([preselectedToolId]) : new Set()
  );

  // 직접 선택
  const [searchQuery, setSearchQuery] = useState('');

  // 즐겨찾기
  const [bookmarkedProblems, setBookmarkedProblems] = useState([]);
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState(new Set());

  useEffect(() => setTempDeadline(deadline), [deadline]);

  // 초기화
  useEffect(() => {
    const init = async () => {
      const [toolsData, domainsData, problemsData] = await Promise.all([
        base44.entities.MathTool.list('name', 300),
        base44.entities.Domain.list('grade_range', 100),
        base44.entities.Problem.list('-created_date', 1000),
      ]);
      setAllTools(toolsData);
      setAllDomains(domainsData);
      setAllProblems(problemsData);
      setGrades(extractGradeOptions(domainsData));
      setDataLoading(false);

      // 학급 grade_range default
      if (classId) {
        try {
          const cls = await base44.entities.Class.filter({ id: classId }, '', 1);
          if (cls[0]?.grade_range) {
            setSelectedGrade(cls[0].grade_range);
          } else {
            setClassGradeNotice(true);
          }
        } catch { /* silent */ }
      }

      // 즐겨찾기 로드
      try {
        const me = await base44.auth.me();
        const bookmarks = await base44.entities.BookmarkedProblem.filter({ user_id: me.id }, '-created_date', 200);
        const bmProblemIds = bookmarks.map(b => b.problem_id);
        const bmProblems = problemsData.filter(p =>
          bmProblemIds.includes(p.id) || bmProblemIds.includes(p.problem_id)
        );
        setBookmarkedProblems(bmProblems);
      } catch { /* silent */ }
    };
    init();
  }, [classId, preselectedToolId]);

  // 학년 선택 시 단원/도구 리셋
  const handleGradeChange = (g) => {
    setSelectedGrade(g);
    setSelectedDomainId('');
    setSelectedToolIds(new Set());
  };

  // 단원 선택 시 도구 리셋
  const handleDomainChange = (d) => {
    setSelectedDomainId(d);
    setSelectedToolIds(new Set());
  };

  const filteredDomains = useMemo(
    () => allDomains.filter(d => d.grade_range === selectedGrade),
    [allDomains, selectedGrade]
  );

  const selectedDomainObj = allDomains.find(d => d.domain_id === selectedDomainId);

  const filteredTools = useMemo(() => {
    if (!selectedDomainId) return [];
    return allTools.filter(t => {
      try {
        const ids = JSON.parse(t.domain_ids || '[]');
        return ids.includes(selectedDomainId);
      } catch { return false; }
    });
  }, [allTools, selectedDomainId]);

  const toggleToolId = (toolId) => {
    setSelectedToolIds(prev => {
      const next = new Set(prev);
      next.has(toolId) ? next.delete(toolId) : next.add(toolId);
      return next;
    });
  };

  // 선택된 도구들의 문제 합집합 (미리보기)
  const previewProblems = useMemo(() => {
    if (selectedToolIds.size === 0) return [];
    const seen = new Set();
    const out = [];
    for (const p of allProblems) {
      try {
        const tids = JSON.parse(p.tool_ids || '[]');
        if (tids.some(t => selectedToolIds.has(t)) && !seen.has(p.id)) {
          seen.add(p.id);
          out.push(p);
        }
      } catch { /* skip */ }
    }
    return out;
  }, [allProblems, selectedToolIds]);

  // previewProblems 변경 시 selectedProblems 동기화 (도구 선택 기반 자동 추가 — 단, 직접 제외한 것은 유지)
  const [manuallyExcluded, setManuallyExcluded] = useState(new Set());

  useEffect(() => {
    const autoIds = previewProblems.map(p => p.id).filter(id => !manuallyExcluded.has(id));
    setSelectedProblems(autoIds);
  }, [previewProblems]);

  const excludeProblem = (id) => {
    setManuallyExcluded(prev => new Set([...prev, id]));
    setSelectedProblems(prev => prev.filter(x => x !== id));
  };

  const toggleBookmark = (id) => setSelectedBookmarkIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
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
    if (!title.trim()) { toast.error('제목을 입력해 주세요'); return; }
    if (!selectedGrade) { toast.error('학년을 선택해 주세요'); return; }
    if (!selectedDomainId) { toast.error('단원을 선택해 주세요'); return; }
    if (selectedToolIds.size === 0) { toast.error('도구를 1개 이상 선택해 주세요'); return; }
    if (selectedProblems.length === 0) { toast.error('출제할 문제가 없어요'); return; }
    setSaving(true);
    try {
      const me = await base44.auth.me();
      const criteria = {
        grade: selectedGrade,
        domain: selectedDomainId,
        tools: [...selectedToolIds],
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

            {/* 학년 / 단원 / 도구 단일 흐름 */}
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

                {/* 도구 목록 */}
                {selectedDomainId && (
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      도구 선택 * <span className="text-xs font-normal text-muted-foreground">({selectedToolIds.size}개 선택됨)</span>
                    </label>
                    {filteredTools.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">이 단원에 연결된 도구가 없어요</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {filteredTools.map(t => (
                          <button key={t.tool_id} className="w-full text-left" onClick={() => toggleToolId(t.tool_id)}>
                            <Card className={`p-3 transition-all ${selectedToolIds.has(t.tool_id) ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}>
                              <div className="flex items-center gap-2">
                                <input type="checkbox" readOnly checked={selectedToolIds.has(t.tool_id)} className="flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{t.name}</p>
                                  {t.goal && <p className="text-xs text-muted-foreground truncate">{t.goal}</p>}
                                </div>
                              </div>
                            </Card>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 문제 미리보기 */}
                {selectedToolIds.size > 0 && (
                  <div>
                    <label className="block text-sm font-semibold mb-2">
                      출제 문제 <span className="text-xs font-normal text-muted-foreground">총 {selectedProblems.length}문제</span>
                    </label>
                    {selectedProblems.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">선택된 도구에 해당하는 문제가 없어요</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {selectedProblemObjects.map(p => (
                          <div key={p.id} className="flex items-start justify-between gap-2 p-2 bg-secondary rounded-lg">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-mono text-muted-foreground">{p.id.slice(0, 8)}</p>
                              <p className="text-sm truncate">{parseProblemText(p.content).substring(0, 70)}...</p>
                              {p.domain_name && <Badge variant="outline" className="text-xs mt-1">{p.domain_name}</Badge>}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => setPreviewProblem(p)}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => excludeProblem(p.id)}
                                className="text-destructive hover:bg-destructive/10 p-1 rounded">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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