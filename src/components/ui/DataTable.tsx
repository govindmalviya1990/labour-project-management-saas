import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Input } from './Input';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeOptions[0] || 10);

  // Filter
  const filteredData = data.filter((item) => {
    if (!searchTerm) return true;
    if (searchKey && item[searchKey as string]) {
      return String(item[searchKey as string])
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    }
    // Search across all string/number fields
    return Object.values(item).some(
      (val) => val && String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-72">
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-400">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-amber-500"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="border-b border-slate-800 bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 font-semibold">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className={`px-4 py-3.5 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {paginatedData.length > 0 ? (
              paginatedData.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className="hover:bg-slate-800/40 transition-colors"
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
