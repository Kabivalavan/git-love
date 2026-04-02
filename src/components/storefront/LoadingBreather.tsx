import { cn } from '@/lib/utils';

interface LoadingBreatherProps {
  className?: string;
  compact?: boolean;
  message?: string;
  subtext?: string;
}

export function LoadingBreather({
  className,
  compact = false,
  message = 'Take a deep breath',
  subtext = 'Hold on while we prepare your store.',
}: LoadingBreatherProps) {
  return (
    <div
      className={cn(
        'flex min-h-[50vh] w-full items-center justify-center px-4 py-10',
        compact && 'min-h-[24rem] py-6',
        className,
      )}
    >
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <span className="absolute inline-flex h-24 w-24 rounded-full border border-primary/20 bg-primary/5 motion-safe:animate-ping" />
          <span className="absolute inline-flex h-20 w-20 rounded-full border border-primary/25 bg-primary/10 animate-pulse" />
          <svg
            viewBox="0 0 120 120"
            className="relative h-24 w-24 text-primary"
            aria-hidden="true"
          >
            <circle cx="60" cy="60" r="42" fill="none" stroke="hsl(var(--primary) / 0.12)" strokeWidth="8" />
            <path
              d="M60 28c12 10 18 20 18 31 0 12-8 22-18 32-10-10-18-20-18-32 0-11 6-21 18-31Z"
              fill="hsl(var(--primary) / 0.16)"
              className="origin-center motion-safe:animate-pulse"
            />
            <path
              d="M60 40c7 6 10 12 10 19 0 7-4 14-10 20-6-6-10-13-10-20 0-7 3-13 10-19Z"
              fill="hsl(var(--primary))"
            />
          </svg>
        </div>
        <p className="mt-6 text-xl font-semibold text-foreground">{message}</p>
        <p className="mt-2 text-sm text-muted-foreground">{subtext}</p>
      </div>
    </div>
  );
}