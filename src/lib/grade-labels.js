// 학년 라벨 헬퍼 — Domain.grade_range 와 Class.grade_range 가 사용하는 동일 코드 체계.
// 1~6  = 초등, 7~9  = 중학, 10~12 = 고등.

export const GRADE_LABELS = {
  '1': '초등 1학년', '2': '초등 2학년', '3': '초등 3학년',
  '4': '초등 4학년', '5': '초등 5학년', '6': '초등 6학년',
  '7': '중학교 1학년', '8': '중학교 2학년', '9': '중학교 3학년',
  '10': '고등학교 1학년', '11': '고등학교 2학년', '12': '고등학교 3학년',
};

/**
 * 학년 코드 → 한국어 라벨.
 * @param {string|number|null|undefined} g
 * @returns {string}
 */
export function gradeLabel(g) {
  if (g === null || g === undefined || g === '') return '미설정';
  return GRADE_LABELS[String(g)] || `학년 ${g}`;
}

/**
 * Domain.list 결과에서 unique grade_range 값 추출 + 숫자 오름차순 정렬.
 * @param {Array<{grade_range?: string}>} domains
 * @returns {string[]}  예: ['1', '2', ..., '12']
 */
export function extractGradeOptions(domains) {
  return [...new Set((domains || []).map(d => d.grade_range).filter(Boolean))]
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}
