import React, { useEffect, useRef } from 'react';
import katex from 'katex';

// Renders a string that may contain inline $...$ and block $$...$$ math
export default function MathRenderer({ content, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !content) return;
    const html = renderMath(content);
    ref.current.innerHTML = html;
  }, [content]);

  return <div ref={ref} className={`math-content leading-relaxed ${className}`} />;
}

export function renderMath(text) {
  if (!text) return '';
  let result = '';
  let i = 0;
  const escaped = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  while (i < text.length) {
    // Block math $$...$$
    if (text[i] === '$' && text[i + 1] === '$') {
      const end = text.indexOf('$$', i + 2);
      if (end !== -1) {
        const math = text.slice(i + 2, end);
        try {
          result += katex.renderToString(math, { displayMode: true, throwOnError: false });
        } catch {
          result += `<span class="text-destructive">$$${escaped(math)}$$</span>`;
        }
        i = end + 2;
        continue;
      }
    }
    // Inline math $...$
    if (text[i] === '$') {
      const end = text.indexOf('$', i + 1);
      if (end !== -1) {
        const math = text.slice(i + 1, end);
        try {
          result += katex.renderToString(math, { displayMode: false, throwOnError: false });
        } catch {
          result += `<span class="text-destructive">$${escaped(math)}$</span>`;
        }
        i = end + 1;
        continue;
      }
    }
    // Newline → br
    if (text[i] === '\n') {
      result += '<br/>';
      i++;
      continue;
    }
    result += escaped(text[i]);
    i++;
  }
  return result;
}

export function MathInline({ math }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(math, ref.current, { displayMode: false, throwOnError: false });
    } catch {}
  }, [math]);
  return <span ref={ref} />;
}