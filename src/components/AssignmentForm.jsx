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
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Search, X, RotateCcw } from 'lucide-react';
import { InlineLoader } from '@/components/LoadingOverlay';

export default function AssignmentForm({ classId, onSave, onClose, assignment }) {
  const [title, setTitle] = useState(assignment?.title || '');
  const [description, setDescription] = useState(assignment?.description || '');
  const [deadline, setDeadline] = useState(assignment?.deadline || '');
  const initialProblemIds = assignment ? JSON.parse(assignment.problem_ids || '[]') : [];
  const [selectedProblems, setSelectedProblems] = useState(initialProblemIds);
  const [selectionTab, setSelectionTab] = useState('tool');
  const [saving, setSaving] = useState(false);

  // 도구별 출제
  const [selectedTool, setSelectedTool] = useState('');
  const [toolCount, setToolCount] = useState(10);
  const [toolPreview, setToolPreview] = useState([]);
  const [tools, setTools] = useState([]);
  const [toolsLoading, setToolsLoading] = useState(true);

  // 단원별 출제
  const [selectedDomain, setSelectedDomain] = useState('');
  const [domainCount, setDomainCount] = useState(10);
  const [domainPreview, setDomainPreview] = useState([]);
  const [domains, setDomains] = useState([]);
  const [domainsLoading, setDomainsLoading] = useState(true);

  // 직접 선택
  const [searchQuery, setSearchQuery] = useState('');
  const [allProblems, setAllProblems] = useState([]);
  const [problemsLoading, setProblemsLoading] = useState(true);

  // 초기화: 도구, 단원, 문제 로드
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
    };
    init();
  }, []);

  // 도구별 미리보기 재생성
  const regenerateToolPreview = React.useCallback(() => {
    if (!selectedTool) return;
    const filtered = allProblems.filter(p => {
      const toolIds = p.tool_ids ? JSON.parse(p.tool_ids) : [];
      return toolIds.includes(selectedTool);
    });
    const shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, toolCount);
    setToolPreview(shuffled);
  }, [selectedTool, toolCount, allProblems]);

  React.useEffect(() => {
    regenerateToolPreview();
  }, [selectedTool, toolCount, regenerateToolPreview]);

  // 단원별 미리보기 재생성
  const regenerateDomainPreview = React.useCallback(() => {
    if (!selectedDomain) return;
    const filtered = allProblems.filter(p => p.domain_id === selectedDomain);
    const shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, domainCount);
    setDomainPreview(shuffled);
  }, [selectedDomain, domainCount, allProblems]);

  React.useEffect(() => {
    regenerateDomainPreview();
  }, [selectedDomain, domainCount, regenerateDomainPreview]);

  // 검색 필터
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allProblems.filter(p => {
      const content = (p.content || '').toLowerCase();
      const domain = (p.domain_name || '').toLowerCase();
      return content.includes(q) || domain.includes(q);
    });
  }, [searchQuery, allProblems]);

  // 문제 추가/제거
  const toggleProblem = (problemId) => {
    setSelectedProblems(prev =>
      prev.includes(problemId)
        ? prev.filter(id => id !== problemId)
        : [...prev, problemId]
    );
  };

  // 도구별/단원별 미리보기 추가
  const addPreviewProblems = (problems) => {
    const ids = problems.map(p => p.id).filter(id => !selectedProblems.includes(id));
    setSelectedProblems(prev => [...prev, ...ids]);
  };

  const handleSave = async () => {
    if (!title.trim() || selectedProblems.length === 0) return;

    setSaving(true);
    try {
      const user = await base44.auth.me();
      const criteria = {
        type: selectionTab,
        ...(selectionTab === 'tool' && { tool: selectedTool }),
        ...(selectionTab === 'domain' && { domain: selectedDomain }),
      };

      const data = {
        title: title.trim(),
        description: description.trim() || null,
        class_id: classId,
        created_by: user.id,
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

  const getToolName = toolId =>
    tools.find(t => t.tool_id === toolId)?.name || toolId;

  const getDomainName = domainId =>
    domains.find(d => d.domain_id === domainId)?.name || domainId;

  const selectedProblemObjects = useMemo(
    () =>
      allProblems.filter(p => selectedProblems.includes(p.id)),
    [allProblems, selectedProblems]
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{assignment ? '숙제 수정' : '새 숙제 출제'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 기본 정보 */}
          <div>
            <label className="block text-sm font-semibold mb-2">제목 *</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="예: 8주차 - 이차방정식"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">설명 (선택)</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="학생들을 위한 안내 메시지..."
              className="w-full h-20"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">마감일 (선택)</label>
            <Input
              type="datetime-local"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full"
            />
          </div>

          {/* 문제 선택 */}
          <div>
            <label className="block text-sm font-semibold mb-3">문제 선택 *</label>

            <Tabs value={selectionTab} onValueChange={setSelectionTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="tool">도구별</TabsTrigger>
                <TabsTrigger value="domain">단원별</TabsTrigger>
                <TabsTrigger value="direct">직접 선택</TabsTrigger>
              </TabsList>

              {/* 도구별 출제 */}
              <TabsContent value="tool" className="space-y-4">
                {toolsLoading ? (
                  <InlineLoader message="도구 로딩 중..." />
                ) : (
                  <>
                    <div>
                      <label className="text-sm font-medium">도구 선택</label>
                      <Select value={selectedTool} onValueChange={setSelectedTool}>
                        <SelectTrigger>
                          <SelectValue placeholder="도구를 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          {tools.map(t => (
                            <SelectItem key={t.tool_id} value={t.tool_id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedTool && (
                      <>
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-medium">문제 수: {toolCount}</label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => regenerateToolPreview()}
                              className="gap-1"
                            >
                              <RotateCcw className="w-4 h-4" />
                              다시 뽑기
                            </Button>
                          </div>
                          <Slider
                            value={[toolCount]}
                            onValueChange={([v]) => setToolCount(v)}
                            min={5}
                            max={30}
                            step={5}
                            className="w-full"
                          />
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-2">
                            미리보기 ({toolPreview.length}개)
                          </p>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {toolPreview.map(p => (
                              <Card key={p.id} className="p-3">
                                <p className="text-xs font-mono text-muted-foreground">
                                  {p.id.slice(0, 8)}...
                                </p>
                                <p className="text-sm truncate">
                                  {parseProblemText(p.content).substring(0, 50)}...
                                </p>
                              </Card>
                            ))}
                          </div>
                        </div>

                        {toolPreview.length > 0 && (
                          <Button
                            onClick={() => addPreviewProblems(toolPreview)}
                            className="w-full"
                          >
                            이 문제들 추가 ({toolPreview.length})
                          </Button>
                        )}
                      </>
                    )}
                  </>
                )}
              </TabsContent>

              {/* 단원별 출제 */}
              <TabsContent value="domain" className="space-y-4">
                {domainsLoading ? (
                  <InlineLoader message="단원 로딩 중..." />
                ) : (
                  <>
                    <div>
                      <label className="text-sm font-medium">단원 선택</label>
                      <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                        <SelectTrigger>
                          <SelectValue placeholder="단원을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          {domains.map(d => (
                            <SelectItem key={d.domain_id} value={d.domain_id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedDomain && (
                      <>
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-medium">
                              문제 수: {domainCount}
                            </label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => regenerateDomainPreview()}
                              className="gap-1"
                            >
                              <RotateCcw className="w-4 h-4" />
                              다시 뽑기
                            </Button>
                          </div>
                          <Slider
                            value={[domainCount]}
                            onValueChange={([v]) => setDomainCount(v)}
                            min={5}
                            max={30}
                            step={5}
                            className="w-full"
                          />
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-2">
                            미리보기 ({domainPreview.length}개)
                          </p>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {domainPreview.map(p => (
                              <Card key={p.id} className="p-3">
                                <p className="text-xs font-mono text-muted-foreground">
                                  {p.id.slice(0, 8)}...
                                </p>
                                <p className="text-sm truncate">
                                  {parseProblemText(p.content).substring(0, 50)}...
                                </p>
                              </Card>
                            ))}
                          </div>
                        </div>

                        {domainPreview.length > 0 && (
                          <Button
                            onClick={() => addPreviewProblems(domainPreview)}
                            className="w-full"
                          >
                            이 문제들 추가 ({domainPreview.length})
                          </Button>
                        )}
                      </>
                    )}
                  </>
                )}
              </TabsContent>

              {/* 직접 선택 */}
              <TabsContent value="direct" className="space-y-4">
                {problemsLoading ? (
                  <InlineLoader message="문제 로딩 중..." />
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="문제 검색 (제목, 단원)..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                       {searchResults.map(p => (
                         <Card
                           key={p.id}
                           className={`p-2 cursor-pointer transition-all ${
                             selectedProblems.includes(p.id)
                               ? 'bg-primary/10 border-primary'
                               : 'hover:bg-muted'
                           }`}
                           onClick={() => toggleProblem(p.id)}
                         >
                           <p className="text-xs font-mono text-muted-foreground">
                             {p.id.slice(0, 8)}
                           </p>
                           <p className="text-xs line-clamp-2">
                             {parseProblemText(p.content).substring(0, 40)}...
                           </p>
                           <p className="text-xs text-muted-foreground mt-1">
                             {p.domain_name}
                           </p>
                         </Card>
                       ))}
                     </div>

                    {searchQuery && searchResults.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        검색 결과가 없습니다.
                      </p>
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
              <div
               key={p.id}
               className="flex items-start justify-between gap-2 p-2 bg-secondary rounded-lg"
              >
               <div className="flex-1 min-w-0">
                 <p className="text-xs font-mono text-muted-foreground">
                   {p.id.slice(0, 8)}
                 </p>
                 <p className="text-sm truncate">
                   {parseProblemText(p.content).substring(0, 50)}...
                 </p>
                 <div className="flex gap-1 mt-1 flex-wrap">
                   {p.domain_name && (
                     <Badge variant="outline" className="text-xs">
                       {p.domain_name}
                     </Badge>
                   )}
                 </div>
               </div>
                    <button
                      onClick={() => toggleProblem(p.id)}
                      className="text-destructive hover:bg-destructive/10 p-1 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || selectedProblems.length === 0 || saving}
          >
            {saving ? '저장 중...' : assignment ? '수정 완료' : '숙제 출제'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}