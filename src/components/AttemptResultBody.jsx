/**
 * AttemptResultBody — ResultView / RemediationResult 공통 본문 컴포넌트
 * Props:
 *   attempt, grading, problem, tools, solutions, solutionSteps,
 *   showDetail, setShowDetail,
 *   showOCR, setShowOCR,
 *   showMatchedSolution, setShowMatchedSolution,
 *   viewerIsOwner,
 *   bookmarkedToolIds, toggleBookmark,
 *   tooltipTool, setTooltipTool,
 *   showOcrComplainModal, setShowOcrComplainModal, ocrHint, setOcrHint, handleOCRReRecognize, reRecognizing,
 *   showReviewRequestModal, setShowReviewRequestModal, reviewNote, setReviewNote, submittingReview, handleSubmitReview,
 *   fromRecommend, recommendReason, feedbackSent, setFeedbackSent,
 *   user,
 *   onRemediation,          — (toolId) => void
 *   remediationToolIds,     — string[]
 *   extraBottomSlot,        — optional JSX for action buttons area
 */
import React, { useState } from 'react';
import MathRenderer from '@/components/MathRenderer';
import ScoreBadge, { ScoreSummaryText, StepStatusBadge } from '@/components/ScoreBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronUp, AlertTriangle, RotateCcw, ChevronRight, Wrench, Star, BookOpen, MessageSquare } from 'lucide-react';
import SolutionCard from '@/components/SolutionCard';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

// 강사 step_judgments 기반 단계 카드
function TeacherStepCard({ seq, judgment, getToolName, onToolClick, onBookmarkTool, bookmarkedToolIds }) {
  const { status, tool_id } = judgment;
  const [open, setOpen] = useState(status !== 'correct');
  const toolName = getToolName ? getToolName(tool_id) : null;

  const statusLabel = { correct: '정답', partial: '부분 정답', missing: '누락', wrong: '다시 살펴보기' }[status] || status;
  const borderColor = status === 'correct' ? 'border-emerald-200 bg-emerald-50/30'
    : status === 'partial' ? 'border-amber-200 bg-amber-50/30'
    : status === 'missing' ? 'border-slate-200 bg-slate-50/30'
    : 'border-red-200 bg-red-50/30';

  return (
    <div className={`rounded-xl border overflow-hidden ${borderColor}`}>
      <button className="w-full p-4 flex items-start justify-between gap-3 text-left" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-mono text-muted-foreground flex-shrink-0">{seq}단계</span>
          {toolName && tool_id ? (
            <div className="inline-flex items-center gap-0 flex-shrink-0">
              <button onClick={e => { e.stopPropagation(); onToolClick && onToolClick(tool_id); }}
                className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-l-full inline-flex items-center gap-1 hover:bg-primary/20 transition-colors">
                <Wrench className="w-3 h-3" />{toolName}
              </button>
              <button onClick={e => { e.stopPropagation(); onBookmarkTool && onBookmarkTool(tool_id); }}
                className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-r-full hover:bg-primary/20 transition-colors">
                <Star className={`w-3 h-3 ${bookmarkedToolIds?.has(tool_id) ? 'fill-amber-500 text-amber-500' : ''}`} />
              </button>
            </div>
          ) : null}
          <StepStatusBadge status={status} />
        </div>
        {open ? <ChevronUp className="w-4 h-4 flex-shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />}
      </button>
      {open && status === 'missing' && (
        <div className="px-4 pb-4 border-t border-current/10">
          <p className="text-sm text-slate-500 mt-3">이 단계가 풀이에서 빠진 것 같아요. 다시 한번 살펴볼까요?</p>
        </div>
      )}
    </div>
  );
}

function StepCard({ step, getToolName, onToolClick, onBookmarkTool, bookmarkedToolIds }) {
  const [open, setOpen] = React.useState(step.status !== 'correct');
  const toolName = getToolName ? getToolName(step.tool_id) : null;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      step.status === 'correct' ? 'border-emerald-200 bg-emerald-50/30' :
      step.status === 'partial' ? 'border-amber-200 bg-amber-50/30' :
      step.status === 'missing' ? 'border-slate-200 bg-slate-50/30' :
      'border-red-200 bg-red-50/30'
    }`}>
      <button className="w-full p-4 flex items-start justify-between gap-3 text-left" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-mono text-muted-foreground flex-shrink-0">{step.step_number}단계</span>
          {toolName ? (
            <div className="inline-flex items-center gap-0 flex-shrink-0">
              <button onClick={(e) => { e.stopPropagation(); onToolClick && onToolClick(step.tool_id); }}
                className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-l-full inline-flex items-center gap-1 hover:bg-primary/20 transition-colors">
                <Wrench className="w-3 h-3" />{toolName}
              </button>
              <button onClick={(e) => { e.stopPropagation(); onBookmarkTool && onBookmarkTool(step.tool_id); }}
                className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-r-full hover:bg-primary/20 transition-colors">
                <Star className={`w-3 h-3 ${bookmarkedToolIds?.has(step.tool_id) ? 'fill-amber-500 text-amber-500' : ''}`} />
              </button>
            </div>
          ) : (
            step.student_step && <span className="text-sm text-foreground truncate">{step.student_step.slice(0, 50)}</span>
          )}
          <StepStatusBadge status={step.status} />
        </div>
        {open ? <ChevronUp className="w-4 h-4 flex-shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-current/10">
          {step.student_step && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">학생 풀이</p>
              <div className="bg-white/60 rounded-lg p-3 text-sm"><MathRenderer content={step.student_step} /></div>
            </div>
          )}
          {step.comment && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">피드백</p>
              <p className="text-sm text-foreground">{step.comment}</p>
            </div>
          )}
          {step.correction && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">정정</p>
              <div className="bg-white/60 rounded-lg p-3 text-sm border border-current/10"><MathRenderer content={step.correction} /></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AttemptResultBody({
  attempt, grading, problem, tools, solutions, solutionSteps,
  showDetail, setShowDetail,
  showOCR, setShowOCR,
  showMatchedSolution, setShowMatchedSolution,
  viewerIsOwner,
  bookmarkedToolIds, toggleBookmark,
  tooltipTool, setTooltipTool,
  showOcrComplainModal, setShowOcrComplainModal, ocrHint, setOcrHint, handleOCRReRecognize, reRecognizing,
  showReviewRequestModal, setShowReviewRequestModal, reviewNote, setReviewNote, submittingReview, handleSubmitReview,
  fromRecommend, recommendReason, feedbackSent, setFeedbackSent,
  user,
  onRemediation,
  remediationToolIds = [],
  extraBottomSlot,
}) {
  const isFastGrade = attempt.answer_check_result === 'correct' || attempt.answer_check_result === 'correct_via_solution';
  const score = attempt.score || 0;
  const scoreColor = score >= 80 ? 'from-emerald-50 to-emerald-100/50 border-emerald-200' :
                     score >= 40 ? 'from-amber-50 to-amber-100/50 border-amber-200' :
                     'from-red-50 to-red-100/50 border-red-200';

  // 강사 검토 완료 여부
  const teacherReview = (() => {
    if (!attempt.teacher_review_json || !attempt.review_resolved_at) return null;
    try { return JSON.parse(attempt.teacher_review_json); } catch { return null; }
  })();
  const isTeacherReviewed = !!teacherReview;
  const [showAIGrade, setShowAIGrade] = useState(viewerIsOwner && !isTeacherReviewed ? true : false);

  const toolNameMap = new Map((tools || []).map(t => [t.tool_id, t.name]));
  const toolEntityMap = new Map((tools || []).map(t => [t.tool_id, t]));
  const getToolName = (toolId) => toolId ? (toolNameMap.get(toolId) || null) : null;
  const getToolEntity = (toolId) => toolEntityMap.get(toolId) || null;

  const steps = grading?.step_feedback || [];
  const gaps = grading?.gap_locations || [];
  const toolMapForSolution = new Map((tools || []).map(t => [t.tool_id, t]));
  const matchedSolution = grading?.matched_solution_id
    ? (solutions || []).find(s => s.solution_id === grading.matched_solution_id)
    : null;
  const otherSolutions = (solutions || []).filter(s => s.solution_id !== grading?.matched_solution_id);

  return (
    <div className="space-y-5 pb-8">

      {/* 강사 검토 완료 배너 */}
      {isTeacherReviewed && (
        <Card className="p-4 border-blue-200 bg-blue-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">✏️</span>
            <p className="text-sm font-medium text-blue-800">선생님께서 채점을 보완해 주셨어요</p>
          </div>
          <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100 flex-shrink-0"
            onClick={() => setShowAIGrade(v => !v)}>
            {showAIGrade ? 'AI 채점 접기' : 'AI 채점도 보기'}
          </Button>
        </Card>
      )}

      {/* 검토 요청 처리 중 배너 (검토 완료 전) */}
      {viewerIsOwner && attempt.review_requested && !attempt.review_resolved_at && !isTeacherReviewed && (
        <Card className="p-3 bg-emerald-50 border-emerald-200">
          <p className="text-sm text-emerald-700">✓ 선생님께 전달됐어요. 검토 결과를 기다리고 있어요.</p>
        </Card>
      )}

      {/* Score card */}
      <Card className={`p-6 bg-gradient-to-br ${scoreColor} border text-center`}>
        <div className="text-6xl font-bold mb-2" style={{ color: score >= 80 ? '#059669' : score >= 40 ? '#d97706' : '#dc2626' }}>
          {score}점
        </div>
        <div className="text-xl font-semibold mt-2"><ScoreSummaryText score={score} /></div>
        {attempt?.answer_check_result === 'correct' && (
          <p className="text-sm text-emerald-700 font-medium mt-2">정답을 맞췄어요!</p>
        )}
        {attempt?.answer_check_result === 'correct_via_solution' && (
          <p className="text-sm text-amber-700 font-medium mt-2">
            {attempt.student_answer ? '풀이가 정답에 도달했어요! (답안 인식에 오타가 있었나봐요)' : '풀이가 정답에 도달했어요! (답란을 비우고 제출했나봐요)'}
          </p>
        )}
        {grading?.summary && !isTeacherReviewed && <p className="text-muted-foreground text-sm mt-3 leading-relaxed">{grading.summary}</p>}
      </Card>

      {/* 학생 답안 표시 */}
      {attempt?.student_answer && (
        <div className="bg-muted/40 rounded-lg p-3 space-y-2">
          <p className="text-xs text-muted-foreground">학생이 적은 답</p>
          <MathRenderer
            content={attempt.student_answer.includes('$') ? attempt.student_answer : `$${attempt.student_answer}$`}
            className="text-base"
          />
        </div>
      )}

      {/* 강사 보정 단계별 피드백 */}
      {isTeacherReviewed && teacherReview.step_judgments && Object.keys(teacherReview.step_judgments).length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">단계별 피드백 <span className="text-xs font-normal text-blue-600 ml-1">✏️ 선생님 보완</span></h2>
          <div className="space-y-2">
            {Object.entries(teacherReview.step_judgments)
              .sort((a, b) => Number(a[0]) - Number(b[0]))
              .map(([seq, judgment]) => (
                <TeacherStepCard
                  key={seq}
                  seq={seq}
                  judgment={judgment}
                  getToolName={getToolName}
                  onToolClick={(tid) => { const t = getToolEntity(tid); if (t) setTooltipTool(t); }}
                  onBookmarkTool={(tid) => { const t = getToolEntity(tid); if (t) toggleBookmark(t); }}
                  bookmarkedToolIds={bookmarkedToolIds}
                />
              ))}
          </div>
        </div>
      )}

      {/* 강사 코멘트 카드 */}
      {isTeacherReviewed && teacherReview.comment && (
        <Card className="p-4 border-blue-200 bg-blue-50/60">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-semibold text-blue-800">선생님 메시지</p>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{teacherReview.comment}</p>
        </Card>
      )}

      {/* AI 채점 구분선 (강사 검토 후 AI 채점도 보기 토글) */}
      {isTeacherReviewed && showAIGrade && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex-1 h-px bg-border" />
          AI 원본 채점
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {/* AI 상세 채점 카드 */}
      {isFastGrade && !showDetail && (!isTeacherReviewed || showAIGrade) && (
        <Card className="p-4 border-primary/30 bg-primary/5">
          {!grading ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75"/>
                </svg>
                <p className="text-sm font-medium">AI가 상세하게 채점 중이에요</p>
              </div>
              <p className="text-xs text-muted-foreground">잠시 후 단계별 피드백과 사용된 도구를 확인할 수 있어요</p>
              <Button size="sm" disabled className="w-full">상세 결과 보기 (분석 중...)</Button>
            </div>
          ) : attempt.tool_mapping_status === 'failed' ? (
            <div>
              <p className="text-sm font-medium text-red-600 mb-1">✗ 상세 채점에 실패했어요</p>
              <p className="text-xs text-muted-foreground">채점 결과는 정상이지만 단계별 분석은 진행되지 못했어요</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">✓ AI 채점이 완료됐어요</p>
              <Button size="sm" className="w-full" onClick={() => setShowDetail(true)}>
                상세 결과 보기 <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Tools used chips */}
      {showDetail && tools.length > 0 && grading && (!isTeacherReviewed || showAIGrade) && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium">
            {grading.matched_solution_id
              ? (viewerIsOwner ? '당신의 풀이에 사용된 도구' : '학생 풀이에 사용된 도구')
              : '이 문제의 풀이 도구'}
          </p>
          <div className="flex flex-wrap gap-2">
            {tools.map(tool => (
              <div key={tool.tool_id} className="inline-flex items-center gap-0 bg-primary/10 text-primary rounded-full text-xs font-medium">
                <button onClick={() => setTooltipTool(tool)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 hover:bg-primary/20 rounded-l-full transition-colors">
                  <Wrench className="w-3 h-3" />{tool.name}
                </button>
                {user && viewerIsOwner && (
                  <button onClick={() => toggleBookmark(tool)}
                    className="px-2 py-1.5 hover:bg-primary/20 rounded-r-full transition-colors"
                    aria-label={bookmarkedToolIds.has(tool.tool_id) ? '즐겨찾기 해제' : '즐겨찾기에 추가'}>
                    <Star className={`w-3 h-3 ${bookmarkedToolIds.has(tool.tool_id) ? 'fill-amber-500 text-amber-500' : ''}`} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low confidence warning */}
      {showDetail && grading?.confidence !== undefined && grading.confidence < 70 && (!isTeacherReviewed || showAIGrade) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-slate-600 text-sm">채점 자신감이 낮아요 ({grading.confidence}점). 관리자가 검토할 거예요.</p>
        </div>
      )}

      {/* Step feedback (AI 원본 — 강사 검토 시 showAIGrade일 때만) */}
      {showDetail && steps.length > 0 && (!isTeacherReviewed || showAIGrade) && (
        <div>
          <h2 className="text-lg font-semibold mb-3">단계별 피드백</h2>
          <div className="space-y-2">
            {(() => {
              const stepGroups = [];
              let current = null;
              for (const sf of steps) {
                const key = sf.matched_solution_step_number ?? null;
                if (current && current.key === key) { current.items.push(sf); }
                else { current = { key, items: [sf] }; stepGroups.push(current); }
              }
              return stepGroups.map((g, gi) => {
                const solStep = matchedSolution && g.key
                  ? (solutionSteps || []).find(s => s.solution_id === matchedSolution.solution_id && s.sequence_order === g.key)
                  : null;
                const toolName = solStep ? getToolName(solStep.tool_id) : null;
                return (
                  <div key={gi} className="space-y-2">
                    {solStep && toolName && (
                      <div className="text-xs text-muted-foreground flex items-center gap-2 pl-1">
                        <span>📍 정해 Step {g.key} — {toolName} (학생 풀이 {g.items.length}줄에 해당)</span>
                      </div>
                    )}
                    {g.items.map((step, i) => (
                      <StepCard key={`${gi}-${i}`} step={step} getToolName={getToolName}
                        onToolClick={(tid) => { const t = getToolEntity(tid); if (t) setTooltipTool(t); }}
                        onBookmarkTool={(tid) => { const t = getToolEntity(tid); if (t) toggleBookmark(t); }}
                        bookmarkedToolIds={bookmarkedToolIds}
                      />
                    ))}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Gap locations */}
      {showDetail && gaps.length > 0 && (!isTeacherReviewed || showAIGrade) && (
        <div>
          <h2 className="text-base font-semibold mb-2 text-amber-700">빠진 단계</h2>
          <div className="space-y-2">
            {gaps.map((gap, i) => {
              const toolName = getToolName(gap.tool_id);
              const toolEntity = getToolEntity(gap.tool_id);
              return (
                <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    {toolName && toolEntity ? (
                      <div className="inline-flex items-center gap-0">
                        <button onClick={() => setTooltipTool(toolEntity)}
                          className="text-xs bg-amber-200/60 text-amber-800 px-2 py-0.5 rounded-l-full inline-flex items-center gap-1 hover:bg-amber-200 transition-colors">
                          <Wrench className="w-3 h-3" />{toolName}
                        </button>
                        {user && viewerIsOwner && (
                          <button onClick={() => toggleBookmark(toolEntity)}
                            className="text-xs bg-amber-200/60 text-amber-800 px-1.5 py-0.5 rounded-r-full hover:bg-amber-200 transition-colors">
                            <Star className={`w-3 h-3 ${bookmarkedToolIds.has(gap.tool_id) ? 'fill-amber-500 text-amber-500' : ''}`} />
                          </button>
                        )}
                      </div>
                    ) : null}
                    <p className="text-xs text-amber-600 font-medium">
                      {toolName ? '— 여기에 단계가 빠졌어요' : '여기에 단계가 빠졌어요'}
                    </p>
                  </div>
                  <p className="text-sm text-amber-800">{gap.description}</p>
                  {gap.expected_step && (
                    <div className="mt-2 bg-white/60 rounded-lg p-2">
                      <MathRenderer content={gap.expected_step} className="text-sm" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 매칭된 별해 배너 */}
      {showDetail && matchedSolution && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
          <button className="w-full p-4 flex items-center justify-between text-left"
            onClick={() => setShowMatchedSolution(o => !o)}>
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <span className="font-medium text-foreground">
                {viewerIsOwner
                  ? `풀이 #${matchedSolution.priority} 방식으로 푸셨네요!`
                  : `학생이 풀이 #${matchedSolution.priority} 방식으로 풀었어요`}
              </span>
              {matchedSolution.priority === 1 && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">대표</span>
              )}
            </div>
            {showMatchedSolution ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showMatchedSolution && (
            <div className="border-t px-4 pb-4 pt-2">
              <SolutionCard
                solution={matchedSolution}
                steps={(solutionSteps || []).filter(s => s.solution_id === matchedSolution.solution_id)}
                toolMap={toolMapForSolution}
                defaultOpen={true}
                bookmarkedToolIds={bookmarkedToolIds}
                onToggleToolBookmark={user && viewerIsOwner ? toggleBookmark : undefined}
              />
            </div>
          )}
        </div>
      )}

      {/* 다른 풀이도 있어요 */}
      {showDetail && otherSolutions.length > 0 && grading && (
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            {grading.matched_solution_id ? '다른 풀이도 있어요' : '이 문제의 풀이 방법들'}
            <span className="text-xs text-muted-foreground font-normal">({otherSolutions.length}개)</span>
          </h2>
          <div className="space-y-2">
            {otherSolutions.map(sol => (
              <SolutionCard key={sol.id} solution={sol}
                steps={(solutionSteps || []).filter(s => s.solution_id === sol.solution_id)}
                toolMap={toolMapForSolution} defaultOpen={false}
                bookmarkedToolIds={bookmarkedToolIds}
                onToggleToolBookmark={user && viewerIsOwner ? toggleBookmark : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* OCR section */}
      {showDetail && (attempt.ocr_text || attempt.ocr_corrected_text) && (
        <div>
          <button className="w-full flex items-center justify-between p-3 bg-muted rounded-xl"
            onClick={() => setShowOCR(o => !o)}>
            <span className="text-sm font-medium text-muted-foreground">OCR 인식 결과 보기</span>
            {showOCR ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showOCR && (
            <Card className="mt-2 p-4 bg-slate-50">
              <p className="text-xs text-muted-foreground mb-2">Gemini가 인식한 풀이</p>
              <pre className="text-sm whitespace-pre-wrap font-mono bg-white rounded-lg p-3 border">
                {attempt.ocr_corrected_text || attempt.ocr_text}
              </pre>
              {viewerIsOwner && (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowOcrComplainModal(true)}>
                  <RotateCcw className="w-4 h-4 mr-2" />OCR이 잘못됐어요
                </Button>
              )}
            </Card>
          )}
        </div>
      )}


      {/* 검토 요청하기 버튼 — 강사 검토 완료 시 숨김 */}
      {viewerIsOwner && !attempt.review_requested && !isFastGrade && !isTeacherReviewed && (
        <Card className="p-3 border-dashed">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">채점이 이상한가요?</p>
              <p className="text-xs text-muted-foreground mt-0.5">선생님께 검토를 요청할 수 있어요</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowReviewRequestModal(true)}>검토 요청하기</Button>
          </div>
        </Card>
      )}

      {/* 추천 피드백 카드 */}
      {viewerIsOwner && fromRecommend && !feedbackSent && (
        <Card className="p-4 bg-primary/5 border-primary/30">
          <p className="text-sm font-medium mb-2">이 추천 문제는 어땠나요?</p>
          <div className="flex gap-2">
            {['helpful', 'not_helpful'].map((fb) => (
              <Button key={fb} size="sm" variant="outline" onClick={async () => {
                try {
                  await base44.entities.RecommendationFeedback.create({
                    user_id: user.id, attempt_id: attempt.id, problem_id: attempt.problem_id,
                    reason_type: recommendReason || 'unknown', feedback: fb,
                  });
                  setFeedbackSent(true);
                  toast.success('피드백 감사합니다');
                } catch { toast.error('피드백 저장 실패'); }
              }}>{fb === 'helpful' ? '👍 도움 됐어요' : '👎 안 맞아요'}</Button>
            ))}
          </div>
        </Card>
      )}
      {viewerIsOwner && fromRecommend && feedbackSent && (
        <p className="text-xs text-muted-foreground">피드백을 보내주셔서 감사해요</p>
      )}

      {/* 도구 보강하기 카드 */}
      {viewerIsOwner && (attempt.correctness === 'partial' || attempt.correctness === 'wrong') && remediationToolIds.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" />도구 보강하기
          </h2>
          <p className="text-xs text-muted-foreground">이 문제에서 부족했던 도구를 그 도구의 다른 문제로 연습할 수 있어요</p>
          {remediationToolIds.map(toolId => {
            const toolName = getToolName(toolId) || toolId;
            return (
              <Card key={toolId} className="p-3 flex items-center justify-between border-primary/30 bg-primary/5">
                <div className="flex items-center gap-2 min-w-0">
                  <Wrench className="w-4 h-4 text-primary flex-shrink-0" />
                  <p className="text-sm font-medium truncate">{toolName}</p>
                </div>
                <Button size="sm" onClick={() => onRemediation && onRemediation(toolId)}>
                  연습하기 <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* 추가 하단 슬롯 (action buttons 등) */}
      {extraBottomSlot}

      {/* Tool tooltip modal */}
      {tooltipTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setTooltipTool(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <Card className="relative z-10 p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-primary" />
              <p className="font-semibold text-foreground">{tooltipTool.name}</p>
            </div>
            {tooltipTool.goal && <p className="text-sm text-muted-foreground mb-2">{tooltipTool.goal}</p>}
            {tooltipTool.description && <p className="text-sm text-foreground">{tooltipTool.description}</p>}
            <div className="flex gap-2 mt-4">
              {user && viewerIsOwner && (
                <Button size="sm" variant="outline" className="flex-1" onClick={() => toggleBookmark(tooltipTool)}>
                  <Star className={`w-3 h-3 mr-1 ${bookmarkedToolIds.has(tooltipTool.tool_id) ? 'fill-amber-500 text-amber-500' : ''}`} />
                  {bookmarkedToolIds.has(tooltipTool.tool_id) ? '즐겨찾기 해제' : '즐겨찾기에 추가'}
                </Button>
              )}
              <Button size="sm" onClick={() => setTooltipTool(null)}>닫기</Button>
            </div>
          </Card>
        </div>
      )}

      {/* OCR 재인식 모달 */}
      {showOcrComplainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             onClick={() => !reRecognizing && setShowOcrComplainModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <Card className="relative z-10 p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-1">OCR 다시 인식 요청</h2>
            <p className="text-xs text-muted-foreground mb-3">어떤 부분이 잘못됐나요? (선택 — AI에게 힌트로 전달)</p>
            <Textarea value={ocrHint} onChange={e => setOcrHint(e.target.value)}
              placeholder="예: x가 y로 인식됐어요" className="min-h-20" disabled={reRecognizing} />
            <div className="flex gap-2 mt-4 justify-end">
              <Button variant="outline" disabled={reRecognizing} onClick={() => setShowOcrComplainModal(false)}>취소</Button>
              <Button disabled={reRecognizing} onClick={handleOCRReRecognize}>
                {reRecognizing ? '재인식 중...' : '다시 인식 요청'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 검토 요청 모달 */}
      {showReviewRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             onClick={() => !submittingReview && setShowReviewRequestModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <Card className="relative z-10 p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold mb-1">채점 다시 요청</h2>
            <p className="text-xs text-muted-foreground mb-3">어떤 점이 이상한가요? (선택)</p>
            <Textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
              placeholder="예: 제 풀이가 맞다고 생각해요" className="min-h-24" disabled={submittingReview} />
            <div className="flex gap-2 mt-4 justify-end">
              <Button variant="outline" disabled={submittingReview} onClick={() => setShowReviewRequestModal(false)}>취소</Button>
              <Button disabled={submittingReview} onClick={handleSubmitReview}>
                {submittingReview ? '전송 중...' : '요청 보내기'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}