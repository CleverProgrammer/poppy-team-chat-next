import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility function to merge Tailwind CSS classes with clsx.
 * Handles conditional classes and deduplicates/merges conflicting Tailwind classes.
 * 
 * @example
 * cn('px-2 py-1', condition && 'bg-red-500', 'px-4') // => 'py-1 bg-red-500 px-4'
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

