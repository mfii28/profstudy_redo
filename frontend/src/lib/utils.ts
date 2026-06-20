import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Standardized price formatter for Profs Training Solutions.
 * Resilient to both numeric and string inputs.
 * Defaults to GHS (GH₵) with safe fallbacks for missing locale data.
 */
export function formatPrice(amount: number | string, currency: string = 'GHS') {
  if (amount === undefined || amount === null) return 'GH₵0.00';
  
  try {
    const value = typeof amount === 'string' 
      ? parseFloat(amount.replace(/[^0-9.]/g, '')) 
      : amount;
    
    if (isNaN(value)) return 'GH₵0.00';

    // Safe Intl check
    const locale = currency === 'GHS' ? 'en-GH' : 'en-US';
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency === 'GHS' ? 'GHS' : 'USD',
      minimumFractionDigits: 2,
    }).format(value).replace('GHS', 'GH₵');
  } catch (error) {
    // Robust fallback if Intl is unavailable or fails
    const val = typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0;
    return `GH₵${val.toFixed(2)}`;
  }
}
