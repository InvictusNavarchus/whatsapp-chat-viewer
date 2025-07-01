/**
 * Simple performance monitoring utility for tracking bookmark operations
 */

import log from 'loglevel';
const logger = log.getLogger('performance');
logger.setLevel('debug');

logger.debug('⏱️ [UTIL] performance module loaded');

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
  private static readonly MAX_METRICS = 1000; // Maximum metrics to keep in memory
  private metrics: PerformanceMetric[] = [];
  private timers: Map<string, number> = new Map();

  /**
   * Start timing an operation
   */
  startTimer(operation: string): void {
    this.timers.set(operation, performance.now());
  }

  /**
   * End timing an operation and record the metric
   */
  endTimer(operation: string): number {
    const startTime = this.timers.get(operation);
    if (!startTime) {
      logger.warn('⏱️ [PERF] No timer found for operation:', operation);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(operation);

    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: Date.now()
    };

    // Add metric and implement rotation to prevent memory leaks
    this.metrics.push(metric);
    
    // Rotate metrics array if it exceeds the maximum size
    if (this.metrics.length > PerformanceMonitor.MAX_METRICS) {
      // Remove the oldest 100 entries to avoid frequent rotations
      this.metrics.splice(0, 100);
    }

    // Log slow operations (> 100ms)
    if (duration > 100) {
      logger.warn(`🐢 [PERF] Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  /**
   * Get performance metrics for analysis
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get average duration for a specific operation
   */
  getAverageDuration(operation: string): number {
    const operationMetrics = this.metrics.filter(m => m.operation === operation);
    if (operationMetrics.length === 0) return 0;

    const totalDuration = operationMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    return totalDuration / operationMetrics.length;
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clearMetrics(): void {
    this.metrics = [];
    this.timers.clear();
  }

  /**
   * Log performance summary to console
   */
  logSummary(): void {
    const operations = [...new Set(this.metrics.map(m => m.operation))];
    logger.info('📊 [PERF] Bookmark Performance Summary:');
    operations.forEach(operation => {
      const avg = this.getAverageDuration(operation);
      const count = this.metrics.filter(m => m.operation === operation).length;
      logger.info(`🔹 [PERF] ${operation}: ${avg.toFixed(2)}ms avg (${count} operations)`);
    });
  }
}

// Export a singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator function to automatically time async functions with proper typing
 */
export function timed(operation: string) {
  return function <TThis, TArgs extends readonly unknown[], TReturn>(
    target: TThis,
    propertyName: string | symbol,
    descriptor: TypedPropertyDescriptor<(...args: TArgs) => Promise<TReturn>>
  ): TypedPropertyDescriptor<(...args: TArgs) => Promise<TReturn>> {
    const method = descriptor.value!;
    
    descriptor.value = (async function (this: TThis, ...args: TArgs): Promise<TReturn> {
      performanceMonitor.startTimer(operation);
      try {
        const result = await method.apply(this, args);
        return result;
      } finally {
        performanceMonitor.endTimer(operation);
      }
    }) as (...args: TArgs) => Promise<TReturn>;

    return descriptor;
  };
}
