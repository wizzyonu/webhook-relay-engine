// src/lib/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS classes with clsx conditional logic.
 * Prevents class conflicts (e.g., 'px-2 px-4' → 'px-4').
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}