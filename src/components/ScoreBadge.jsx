import React from 'react';

export function getScoreColor(score) {
  if (score >= 80) return 'correct';
  if (score >= 40) return 'partial';
  return 'wrong';
}

export function getCorrectnessBadge(correctness) {
  const map = {
    correct: { label: '정답', class: 'traffic-correct' },
    partial: { label: '부분 정답', class: 'traffic-partial' },
    wrong: { label: '오답', class: 'traffic-wrong' },
  };
  return map[correctness] || map.wrong;
}

export default function ScoreBadge({ score, size = 'md' }) {
  const color = getScoreColor(score);
  const colorMap = {
    correct: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    partial: 'text-amber-600 bg-amber-50 border-amber-200',
    wrong: 'text-red-600 bg-red-50 border-red-200',
  };
  const sizeMap = {
    sm: 'text-sm px-2 py-0.5',
    md: 'text-base px-3 py-1',
    lg: 'text-4xl px-5 py-2 font-bold',
    xl: 'text-6xl px-6 py-3 font-bold',
  };
  return (
    <span className={`inline-flex items-center rounded-full border font-semibold ${colorMap[color]} ${sizeMap[size]}`}>
      {score}점
    </span>
  );
}

export function ScoreSummaryText({ score }) {
  if (score >= 80) return <span className="text-emerald-600 font-semibold">정답이에요! 🎉</span>;
  if (score >= 40) return <span className="text-amber-600 font-semibold">거의 다 왔어요! 💪</span>;
  return <span className="text-red-500 font-semibold">다시 살펴볼까요? 📝</span>;
}

export function StepStatusBadge({ status }) {
  const map = {
    correct: { label: '정확', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    partial: { label: '부분', class: 'bg-amber-100 text-amber-700 border-amber-200' },
    wrong: { label: '오류', class: 'bg-red-100 text-red-700 border-red-200' },
    missing: { label: '누락', class: 'bg-slate-100 text-slate-600 border-slate-200' },
  };
  const info = map[status] || map.missing;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${info.class}`}>
      {info.label}
    </span>
  );
}