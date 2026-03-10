import { ReactNode, useState, useRef, useCallback, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ShimmerTable } from '@/components/ui/shimmer';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  getRowId?: (item: T) => string;
  /** Infinite scroll support */
  isLoadingMore?: boolean;
  hasMore?: boolean;
  sentinelRef?: React.Ref<HTMLDivElement>;
  /** Enable virtual scrolling for large datasets (default: auto at 100+ rows) */
  virtualizeThreshold?: number;
}

const ROW_HEIGHT = 52; // px per row
const MAX_VIRTUAL_HEIGHT = 600; // max table height before scrolling

export function DataTable<T>({
  columns,
  data,
  isLoading,
  emptyMessage = 'No data found',
  onRowClick,
  searchable = false,
  searchPlaceholder = 'Search...',
  searchKeys = [],
  getRowId,
  isLoadingMore = false,
  hasMore = false,
  sentinelRef,
  virtualizeThreshold = 100,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const parentRef = useRef<HTMLDivElement>(null);

  const filteredData = useMemo(() => {
    if (!searchable || !searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((item) =>
      searchKeys.some((key) => {
        const value = item[key];
        if (typeof value === 'string') return value.toLowerCase().includes(q);
        if (typeof value === 'number') return value.toString().includes(searchQuery);
        return false;
      })
    );
  }, [data, searchable, searchQuery, searchKeys]);

  const shouldVirtualize = filteredData.length >= virtualizeThreshold;

  const virtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
    enabled: shouldVirtualize,
  });

  if (isLoading) {
    return <ShimmerTable rows={5} columns={columns.length} />;
  }

  const renderRow = (item: T, index: number, style?: React.CSSProperties) => (
    <TableRow
      key={getRowId ? getRowId(item) : index}
      style={style}
      className={cn(
        "transition-colors",
        onRowClick && "cursor-pointer hover:bg-muted/50"
      )}
      onClick={() => onRowClick?.(item)}
    >
      {columns.map((column) => (
        <TableCell key={String(column.key)} className={column.className}>
          {column.render
            ? column.render(item)
            : (item[column.key as keyof T] as ReactNode) ?? '-'}
        </TableCell>
      ))}
    </TableRow>
  );

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {shouldVirtualize ? (
        /* Virtualized table for large datasets */
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {columns.map((column) => (
                  <TableHead key={String(column.key)} className={cn("font-semibold", column.className)}>
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
          </Table>
          <div
            ref={parentRef}
            className="overflow-auto"
            style={{ maxHeight: MAX_VIRTUAL_HEIGHT }}
          >
            {filteredData.length === 0 ? (
              <div className="h-24 flex items-center justify-center text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                <Table>
                  <TableBody>
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      const item = filteredData[virtualRow.index];
                      return renderRow(item, virtualRow.index, {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                        display: 'table-row',
                      });
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <div className="px-3 py-1.5 text-xs text-muted-foreground border-t bg-muted/30">
            {filteredData.length.toLocaleString()} rows
          </div>
        </div>
      ) : (
        /* Standard table for smaller datasets */
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {columns.map((column) => (
                  <TableHead key={String(column.key)} className={cn("font-semibold", column.className)}>
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item, index) => renderRow(item, index))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Infinite scroll sentinel + loader */}
      {sentinelRef && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {isLoadingMore && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading more...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
