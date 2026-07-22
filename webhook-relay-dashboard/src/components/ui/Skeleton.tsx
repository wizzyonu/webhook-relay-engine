// src/components/ui/Skeleton.tsx
import { cn } from '@/lib/cn';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    // Tailwind's animate-pulse uses opacity (GPU composited), preventing layout thrashing
    <div 
      className={cn(
        'bg-canvas-parchment animate-pulse rounded-sm', 
        className
      )} 
    />
  );
}