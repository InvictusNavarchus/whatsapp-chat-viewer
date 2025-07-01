import { performanceMonitor } from '@/utils/performance';

/**
 * Add debug utilities to window object during development
 * This should only be used in development mode
 */
export const setupDebugUtils = () => {
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    // Add performance monitor to window for easy access in console
    (window as Window & typeof globalThis & { 
      bookmarkPerformance?: {
        getMetrics: () => unknown;
        getAverage: (operation: string) => number;
        logSummary: () => void;
        clear: () => void;
      }
    }).bookmarkPerformance = {
      getMetrics: () => performanceMonitor.getMetrics(),
      getAverage: (operation: string) => performanceMonitor.getAverageDuration(operation),
      logSummary: () => performanceMonitor.logSummary(),
      clear: () => performanceMonitor.clearMetrics()
    };
  }
};
