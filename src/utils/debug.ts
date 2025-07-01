import { performanceMonitor } from '@/utils/performance';

/**
 * Add debug utilities to the global window object for development
 * This should only be used in development mode
 */
export const setupDebugUtils = () => {
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    // Add performance monitor to window for easy access in console
    (window as any).bookmarkPerformance = {
      getMetrics: () => performanceMonitor.getMetrics(),
      getAverage: (operation: string) => performanceMonitor.getAverageDuration(operation),
      logSummary: () => performanceMonitor.logSummary(),
      clear: () => performanceMonitor.clearMetrics()
    };

    console.log('Debug utilities loaded. Use window.bookmarkPerformance to check performance metrics.');
  }
};
