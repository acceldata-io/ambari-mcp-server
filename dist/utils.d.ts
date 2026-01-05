/**
 * Utility functions for Ambari MCP Server
 */
import type { MetricDataPoint, MetricSummary } from './types.js';
/**
 * Format a Unix timestamp to human-readable format
 */
export declare function formatTimestamp(timestamp: number | string | null | undefined, isMilliseconds?: boolean): string;
/**
 * Format bytes to human-readable size
 */
export declare function formatBytes(bytes: number | null | undefined): string;
/**
 * Calculate percentage safely
 */
export declare function safePercent(numerator: number | null | undefined, denominator: number | null | undefined): string;
/**
 * Parse a timestamp string to epoch milliseconds
 */
export declare function parseEpochMillis(value: string | number | null | undefined): number | undefined;
/**
 * Parse duration string to milliseconds
 * Supports: "1h", "30m", "2d", "1h30m", "90s", etc.
 */
export declare function parseDurationToMillis(duration: string | null | undefined): number | undefined;
/**
 * Resolve metrics time range from duration, start_time, and end_time
 */
export declare function resolveMetricsTimeRange(duration?: string | null, startTime?: string | number | null, endTime?: string | number | null): {
    startMs: number;
    endMs: number;
    description: string;
};
/**
 * Convert metrics map to sorted series of data points
 */
export declare function metricsMapToSeries(metricsMap: Record<string, number> | undefined): MetricDataPoint[];
/**
 * Compute statistics for a metric series
 */
export declare function summarizeMetricSeries(points: MetricDataPoint[]): MetricSummary | null;
/**
 * State descriptions for services
 */
export declare const SERVICE_STATE_DESCRIPTIONS: Record<string, string>;
/**
 * State descriptions for requests
 */
export declare const REQUEST_STATUS_DESCRIPTIONS: Record<string, string>;
/**
 * Sleep utility for async operations
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Truncate string to max length with ellipsis
 */
export declare function truncate(str: string, maxLength: number): string;
/**
 * Safely get nested object property
 */
export declare function getNestedValue<T = unknown>(obj: unknown, path: string, defaultValue?: T): T | undefined;
//# sourceMappingURL=utils.d.ts.map