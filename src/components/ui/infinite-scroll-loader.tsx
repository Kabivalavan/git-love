import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InfiniteScrollLoaderProps {
  isLoading: boolean;
  hasMore: boolean;
  className?: string;
}

export const InfiniteScrollLoader = forwardRef<HTMLDivElement, InfiniteScrollLoaderProps>(
  ({ isLoading, hasMore, className }, ref) => {
    if (!hasMore && !isLoading) return <div ref={ref} />;

    return (
      <div ref={ref} className={cn('flex justify-center py-6', className)}>
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading more...</span>
          </div>
        )}
      </div>
    );
  }
);

InfiniteScrollLoader.displayName = 'InfiniteScrollLoader';
