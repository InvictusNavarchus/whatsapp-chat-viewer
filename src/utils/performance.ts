/**
 * Simple performance monitoring utility for tracking bookmark operations
 */

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
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
      console.warn(`No timer found for operation: ${operation}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(operation);

    this.metrics.push({
      operation,
      duration,
      timestamp: Date.now()
    });

    // Log slow operations (> 100ms)
    if (duration > 100) {
      console.warn(`Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`);
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
    
    console.group('Bookmark Performance Summary');
    operations.forEach(operation => {
      const avg = this.getAverageDuration(operation);
      const count = this.metrics.filter(m => m.operation === operation).length;
      console.log(`${operation}: ${avg.toFixed(2)}ms avg (${count} operations)`);
    });
    console.groupEnd();
  }
}

// Export a singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator function to automatically time async functions
 */
export function timed(operation: string) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;
    
    descriptor.value = (async function (this: any, ...args: any[]) {
      performanceMonitor.startTimer(operation);
      try {
        const result = await method.apply(this, args);
        return result;
      } finally {
        performanceMonitor.endTimer(operation);
      }
    }) as T;
  };
}
