import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox, Select } from './ui/input';
import { Button } from './ui/button';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'right' | 'center';
  /** Hide the column below this breakpoint to keep tables readable on smaller screens. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const HIDE: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
  '2xl': 'hidden 2xl:table-cell',
};

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  pageSize?: number;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (s: Set<string>) => void;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  caption?: string;
  rowClassName?: (row: T) => string | undefined;
  dense?: boolean;
}

export function DataTable<T>({ rows, columns, getRowId, initialSort, pageSize: initialPageSize = 10, selectable, selected, onSelectedChange, onRowClick, empty, caption, rowClassName, dense }: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), undefined, { numeric: true })) * dir;
    });
  }, [rows, columns, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page > pageCount - 1) setPage(0);
  }, [page, pageCount]);
  useEffect(() => setPage(0), [rows.length]);

  const pageRows = sorted.slice(page * pageSize, page * pageSize + pageSize);
  const ids = pageRows.map(getRowId);
  const allOnPage = selectable && ids.length > 0 && ids.every((id) => selected?.has(id));
  const someOnPage = selectable && ids.some((id) => selected?.has(id));

  const toggleSort = (key: string) => {
    setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));
  };

  const toggleAll = () => {
    const next = new Set(selected);
    if (allOnPage) ids.forEach((id) => next.delete(id));
    else ids.forEach((id) => next.add(id));
    onSelectedChange?.(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectedChange?.(next);
  };

  const start = sorted.length ? page * pageSize + 1 : 0;
  const end = Math.min(sorted.length, (page + 1) * pageSize);

  return (
    <div>
      <div className="scrollbar-thin relative overflow-x-auto">
        <table className="w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b bg-muted/40">
              {selectable && (
                <th className="w-10 px-4 py-2.5">
                  <Checkbox aria-label="Select all rows on this page" checked={!!allOnPage} indeterminate={!allOnPage && !!someOnPage} onChange={toggleAll} />
                </th>
              )}
              {columns.map((c) => {
                const active = sort?.key === c.key;
                const ariaSort = active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none';
                return (
                  <th key={c.key} scope="col" aria-sort={c.sortValue ? ariaSort : undefined} className={cn(c.hideBelow && HIDE[c.hideBelow], 'whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.headerClassName)}>
                    {c.sortValue ? (
                      <button type="button" onClick={() => toggleSort(c.key)} className={cn('inline-flex items-center gap-1 rounded uppercase tracking-wide transition hover:text-foreground', active && 'text-foreground')}>
                        {c.header}
                        {active ? sort!.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const id = getRowId(row);
              const isSel = selected?.has(id);
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn('border-b transition-colors last:border-0 hover:bg-muted/40', onRowClick && 'cursor-pointer', isSel && 'bg-accent/50 hover:bg-accent/60', rowClassName?.(row))}
                >
                  {selectable && (
                    <td className="px-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox aria-label={`Select row ${id}`} checked={!!isSel} onChange={() => toggleOne(id)} />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={cn(c.hideBelow && HIDE[c.hideBelow], 'px-4', dense ? 'py-2' : 'py-3', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!sorted.length && <div className="border-t">{empty}</div>}
      </div>
      {sorted.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="tabular">
              Showing <strong className="text-foreground">{start}–{end}</strong> of <strong className="text-foreground">{sorted.length}</strong>
              {selectable && selected && selected.size > 0 && <> · {selected.size} selected</>}
            </span>
            <label className="flex items-center gap-1.5">
              <span className="hidden sm:inline">Rows</span>
              <Select aria-label="Rows per page" className="h-7 w-[68px] text-xs" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}>
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </label>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span className="tabular px-2">Page {page + 1} of {pageCount}</span>
            <Button variant="outline" size="icon-sm" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
