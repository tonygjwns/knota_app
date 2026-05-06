import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * PaginationBar
 * @param {number} page - 0-indexed current page
 * @param {number} totalCount - total number of items
 * @param {number} pageSize - items per page
 * @param {function} onPage - (pageIndex: number) => void
 * @param {boolean} loading
 */
export default function PaginationBar({ page, totalCount, pageSize, onPage, loading }) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalCount);

  // Build page number list with ellipsis
  const getPages = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }
    const pages = [];
    // Always show first 2
    pages.push(0, 1);
    // Show around current
    const around = [page - 2, page - 1, page, page + 1, page + 2].filter(
      p => p > 1 && p < totalPages - 2
    );
    if (around.length > 0 && around[0] > 2) pages.push('...');
    pages.push(...around);
    if (around.length > 0 && around[around.length - 1] < totalPages - 3) pages.push('...');
    // Always show last 2
    pages.push(totalPages - 2, totalPages - 1);
    return pages;
  };

  const pages = getPages();

  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      <p className="text-xs text-muted-foreground">
        {start}–{end} / 총 {totalCount.toLocaleString()}개
      </p>
      <div className="flex items-center gap-1 flex-wrap justify-center">
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={() => onPage(page - 1)}
          disabled={page === 0 || loading}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline ml-1">이전</span>
        </Button>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-sm">…</span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'default' : 'outline'}
              size="sm"
              className="h-8 w-8 p-0 text-xs hidden sm:inline-flex"
              onClick={() => onPage(p)}
              disabled={loading}
            >
              {p + 1}
            </Button>
          )
        )}

        {/* Mobile: just show current/total */}
        <span className="sm:hidden text-sm font-medium px-2">
          {page + 1} / {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages - 1 || loading}
        >
          <span className="hidden sm:inline mr-1">다음</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}