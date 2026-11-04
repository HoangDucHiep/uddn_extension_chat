import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Gop class Tailwind, uu tien class cuoi. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
