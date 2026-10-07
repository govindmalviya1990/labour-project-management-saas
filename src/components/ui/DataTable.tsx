import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from 'lucide-react';
import { Input } from './Input';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T | string;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  searchPlaceholder?: string;
  searchKey?: keyof T | string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  pageSizeOptions?: number[];
}

function extractSearchableStrings(obj: any, depth = 0): string[] {
  if (depth > 5 || obj === null || obj === undefined) return [];
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return [String(obj).toLowerCase()];
  }
  if (Array.isArray(obj)) {
    return obj.flatMap((item) => extractSearchableStrings(item, depth + 1));
  }
  if (typeof obj === 'object') {
    return Object.values(obj).flatMap((val) => extractSearchableStrings(val, depth + 1));
  }
  return [];
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  searchPlaceholder = 'Search records...',
  searchKey,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items matching your criteria.',
  emptyActionLabel,
  onEmptyAction,
  pageSizeOptions = [10, 25, 50, 100],
}: DataTableProps<T>) {
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeOptions[0] || 10);

  const applySearch = (val: string) => {
    setActiveQuery(val);
    setCurrentPage(1);
  };

  // Filter
  const filteredData = data.filter((item) => {
    const rawSearch = activeQuery.trim().toLowerCase();
    if (!rawSearch) return true;

    if (searchKey && item[searchKey as string]) {
      return String(item[searchKey as string])
        .toLowerCase()
        .includes(rawSearch);
    }

    const allValues = extractSearchableStrings(item);
    const joined = allValues.join(' ');
    const cleanedJoined = joined.replace(/\s+/g, '');
    const cleanedSearch = rawSearch.replace(/\s+/g, '');

    // 1. Direct match in concatenated values
    if (joined.includes(rawSearch)) return true;

    // 2. Space-insensitive match (e.g. "sher singh" matches "shersingh")
    if (cleanedJoined.includes(cleanedSearch)) return true;

    // 3. Multi-word match: each word in search query must appear in values
    const words = rawSearch.split(/\s+/).filter(Boolean);
    if (words.length > 0 && words.every((w) => joined.includes(w))) {
      return true;
    }

    return false;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <div className="w-full space-y-4">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applySearch(searchInput);
          }}
          className="w-full sm:max-w-md flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Input
              placeholder={searchPlaceholder}
              value={searchInput}
              onChange={(e) => {
                const val = e.target.value;
                setSearchInput(val);
                applySearch(val);
              }}
              leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              className="pr-8"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  applySearch('');
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs p-1 rounded-full hover:bg-slate-800 transition-colors"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button
            type="submit"
            onClick={() => applySearch(searchInput)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shrink-0 shadow-sm transition-all active:scale-95"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </Button>
        </form>
        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-500 dark:text-slate-400">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-amber-500"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left text-sm text-slate-700 dark:text-slate-200">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className={`px-4 py-3.5 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {paginatedData.length > 0 ? (
              paginatedData.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {columns.map((col, idx) => (
                    <td key={idx} className={`px-4 py-3.5 ${col.className || ''}`}>
                      {col.cell
                        ? col.cell(item)
                        : col.accessorKey
                        ? item[col.accessorKey as string]
                        : null}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="py-8">
                  <EmptyState
                    icon={<Search className="w-6 h-6" />}
                    title={emptyTitle}
                    description={emptyDescription}
                    actionLabel={emptyActionLabel}
                    onAction={onEmptyAction}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {filteredData.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 px-1">
          <div>
            Showing <span className="text-white font-medium">{startIndex + 1}</span> to{' '}
            <span className="text-white font-medium">
              {Math.min(startIndex + pageSize, filteredData.length)}
            </span>{' '}
            of <span className="text-white font-medium">{filteredData.length}</span> records
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-medium text-slate-200">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
