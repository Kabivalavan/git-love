import { cn } from "@/lib/utils";

interface ShimmerProps {
  className?: string;
}

export function Shimmer({ className }: ShimmerProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
    />
  );
}

export function ShimmerText({ className }: ShimmerProps) {
  return <Shimmer className={cn("h-4 w-full", className)} />;
}

export function ShimmerCard({ className }: ShimmerProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 space-y-4", className)}>
      <Shimmer className="h-4 w-3/4" />
      <Shimmer className="h-8 w-1/2" />
      <Shimmer className="h-4 w-full" />
    </div>
  );
}

export function ShimmerTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex gap-4 p-4 border-b">
        {Array.from({ length: columns }).map((_, i) => (
          <Shimmer key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-4 border-b">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Shimmer key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ShimmerStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <ShimmerCard key={i} />
      ))}
    </div>
  );
}

export function ShimmerList({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
          <Shimmer className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-4 w-1/2" />
            <Shimmer className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ShimmerProductCard() {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Shimmer className="h-48 w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Shimmer className="h-4 w-3/4" />
        <Shimmer className="h-3 w-1/2" />
        <div className="flex justify-between items-center">
          <Shimmer className="h-5 w-20" />
          <Shimmer className="h-8 w-24" />
        </div>
      </div>
    </div>
  );
}

export function ShimmerProductGrid({ items = 8 }: { items?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {Array.from({ length: items }).map((_, i) => (
        <ShimmerProductCard key={i} />
      ))}
    </div>
  );
}
