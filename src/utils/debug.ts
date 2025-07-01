import { performanceMonitor } from '@/utils/performance';
import log from 'loglevel';
const logger = log.getLogger('debug');
logger.setLevel('debug');

/**
 * Add debug utilities to window object during development
 * This should only be used in development mode
 */
export const setupDebugUtils = () => {
  logger.info('🛠️ [DEBUG] Setting up debug utilities...');
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    logger.info('🌐 [DEBUG] Exposing performance monitor to window object');
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
  logger.info('✅ [DEBUG] Debug utilities setup complete.');
};
