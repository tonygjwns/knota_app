import React, { useState } from 'react';
import MathRenderer from '@/components/MathRenderer';
import { ChevronDown, ChevronUp, Wrench, Star } from 'lucide-react';

export const parseContents = (c) => {
  try {
    const arr = JSON.parse(c || '[]');
    return arr.map(b => b.text || '').join('\n\n');
  } catch { return c || ''; }
};

export default function SolutionCard({ solution, steps, toolMap, defaultOpen = false, bookmarkedToolIds = new Set(), onToggleToolBookmark }) {
  const [open, setOpen] = useState(defaultOpen);

  const sortedSteps = [...(steps || [])].sort((a, b) => a.sequence_order - b.sequence_order);
  const bodyText = parseContents(solution.contents);

  return (
    <div className="rounded-xl border overflow-hidden">
      <button
        className="w-full p-4 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">풀이 #{solution.priority}</span>
          {solution.priority === 1 && (
            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">대표</span>
          )}
          <span className="text-xs text-muted-foreground">({sortedSteps.length}단계)</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4 border-t">
          {bodyText && (
            <div className="prose prose-sm max-w-none">
              <MathRenderer content={bodyText} />
            </div>
          )}

          {sortedSteps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">단계별 도구 흐름</p>
              <div className="space-y-2">
                {sortedSteps.map(step => {
                  const tool = toolMap?.get(step.tool_id);
                  return (
                    <div key={step.id || step.sequence_order} className="rounded-lg border bg-background p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono flex-shrink-0">Step {step.sequence_order}</span>
                        {tool && (
                          <span className="inline-flex items-center gap-0 text-xs bg-primary/10 text-primary rounded-full">
                            <span className="px-2 py-0.5 inline-flex items-center gap-1">
                              <Wrench className="w-3 h-3" />
                              {tool.name}
                            </span>
                            {onToggleToolBookmark && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onToggleToolBookmark(tool); }}
                                className="px-1.5 py-0.5 hover:bg-primary/20 rounded-r-full transition-colors"
                                aria-label={bookmarkedToolIds.has(tool.tool_id) ? '즐겨찾기 해제' : '즐겨찾기에 추가'}
                              >
                                <Star className={`w-3 h-3 ${bookmarkedToolIds.has(tool.tool_id) ? 'fill-amber-500 text-amber-500' : ''}`} />
                              </button>
                            )}
                          </span>
                        )}
                        {!tool && step.tool_id && (
                          <span className="text-xs text-muted-foreground font-mono">{step.tool_id}</span>
                        )}
                      </div>
                      {step.reason && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{step.reason}</p>
                      )}
                      {step.application && (
                        <div className="bg-muted/40 rounded-lg p-2">
                          <MathRenderer content={step.application} />
                        </div>
                      )}
                      {step.appended_info && (
                        <p className="text-xs text-muted-foreground italic">{step.appended_info}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}