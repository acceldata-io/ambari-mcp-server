/**
 * Utility functions for Ambari MCP Server
 */
/**
 * Format a Unix timestamp to human-readable format
 */
export function formatTimestamp(timestamp, isMilliseconds = true) {
    if (!timestamp) {
        return 'N/A';
    }
    try {
        // Handle string timestamps by converting to number
        const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
        if (isNaN(ts)) {
            return `${timestamp} (Invalid timestamp format)`;
        }
        // Convert milliseconds to Date
        const date = new Date(isMilliseconds ? ts : ts * 1000);
        const formattedTime = date.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
        return `${ts} (${formattedTime})`;
    }
    catch {
        return `${timestamp} (Invalid timestamp)`;
    }
}
/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes) {
    if (bytes === null || bytes === undefined) {
        return 'N/A';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let size = Math.abs(bytes);
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    const sign = bytes < 0 ? '-' : '';
    return `${sign}${size.toFixed(2)} ${units[unitIndex]}`;
}
/**
 * Calculate percentage safely
 */
export function safePercent(numerator, denominator) {
    if (numerator === null || numerator === undefined ||
        denominator === null || denominator === undefined ||
        denominator === 0) {
        return 'N/A';
    }
    const percent = (numerator / denominator) * 100;
    return `${percent.toFixed(2)}%`;
}
/**
 * Parse a timestamp string to epoch milliseconds
 */
export function parseEpochMillis(value) {
    if (value === null || value === undefined) {
        return undefined;
    }
    const raw = String(value).trim();
    if (!raw) {
        return undefined;
    }
    // Try parsing as number first
    if (/^[-+]?\d+(\.\d+)?$/.test(raw)) {
        const num = parseFloat(raw);
        // Normalize to milliseconds
        return num >= 1_000_000_000_000 ? num : num * 1000;
    }
    // Try parsing as ISO date
    try {
        let candidate = raw;
        if (candidate.endsWith('Z')) {
            candidate = candidate.slice(0, -1) + '+00:00';
        }
        const date = new Date(candidate);
        if (!isNaN(date.getTime())) {
            return date.getTime();
        }
    }
    catch {
        // Fall through
    }
    return undefined;
}
/**
 * Parse duration string to milliseconds
 * Supports: "1h", "30m", "2d", "1h30m", "90s", etc.
 */
export function parseDurationToMillis(duration) {
    if (!duration) {
        return undefined;
    }
    const text = duration.trim().toLowerCase();
    if (!text) {
        return undefined;
    }
    // Try parsing as plain number (assumed seconds)
    if (/^\d+(\.\d+)?$/.test(text)) {
        return parseFloat(text) * 1000;
    }
    const pattern = /(\d+(?:\.\d+)?)\s*(milliseconds?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d)/g;
    let totalMs = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        const amount = parseFloat(match[1] ?? '0');
        const unit = match[2] ?? '';
        if (unit.startsWith('ms') || unit.startsWith('millisecond')) {
            totalMs += amount;
        }
        else if (unit.startsWith('s') || unit.startsWith('sec')) {
            totalMs += amount * 1000;
        }
        else if (unit.startsWith('m') && !unit.startsWith('ms')) {
            totalMs += amount * 60 * 1000;
        }
        else if (unit.startsWith('h') || unit.startsWith('hr')) {
            totalMs += amount * 60 * 60 * 1000;
        }
        else if (unit.startsWith('d')) {
            totalMs += amount * 24 * 60 * 60 * 1000;
        }
    }
    return totalMs > 0 ? totalMs : undefined;
}
/**
 * Resolve metrics time range from duration, start_time, and end_time
 */
export function resolveMetricsTimeRange(duration, startTime, endTime) {
    const nowMs = Date.now();
    let endMs = endTime ? parseEpochMillis(endTime) : nowMs;
    if (!endMs)
        endMs = nowMs;
    const durationMs = duration ? parseDurationToMillis(duration) : undefined;
    let startMs = startTime ? parseEpochMillis(startTime) : undefined;
    // Calculate start from duration if not provided
    if (startMs === undefined && durationMs !== undefined) {
        startMs = endMs - durationMs;
    }
    // Default to 1 hour lookback
    if (startMs === undefined) {
        startMs = endMs - 3600_000;
    }
    // Ensure start is before end
    if (startMs > endMs) {
        [startMs, endMs] = [endMs, startMs];
    }
    const startFormatted = formatTimestamp(startMs).split(' (')[1]?.replace(')', '') || '';
    const endFormatted = formatTimestamp(endMs).split(' (')[1]?.replace(')', '') || '';
    const description = `from ${startFormatted} to ${endFormatted}`;
    return { startMs, endMs, description };
}
/**
 * Convert metrics map to sorted series of data points
 */
export function metricsMapToSeries(metricsMap) {
    if (!metricsMap || typeof metricsMap !== 'object') {
        return [];
    }
    const points = [];
    for (const [rawTs, rawValue] of Object.entries(metricsMap)) {
        const tsMs = parseEpochMillis(rawTs);
        if (tsMs === undefined)
            continue;
        const value = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
        if (isNaN(value))
            continue;
        points.push({ timestamp: tsMs, value });
    }
    // Sort by timestamp
    points.sort((a, b) => a.timestamp - b.timestamp);
    return points;
}
/**
 * Compute statistics for a metric series
 */
export function summarizeMetricSeries(points) {
    if (!points || points.length === 0) {
        return null;
    }
    const values = points.map(p => p.value);
    const firstValue = values[0] ?? 0;
    const lastValue = values[values.length - 1] ?? 0;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    return {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        first: firstValue,
        last: lastValue,
        delta: lastValue - firstValue,
        start_timestamp: firstPoint?.timestamp ?? 0,
        end_timestamp: lastPoint?.timestamp ?? 0,
        duration_ms: (lastPoint?.timestamp ?? 0) - (firstPoint?.timestamp ?? 0),
    };
}
/**
 * State descriptions for services
 */
export const SERVICE_STATE_DESCRIPTIONS = {
    'STARTED': 'Service is running and operational',
    'INSTALLED': 'Service is installed but not running',
    'STARTING': 'Service is in the process of starting',
    'STOPPING': 'Service is in the process of stopping',
    'INSTALLING': 'Service is being installed',
    'INSTALL_FAILED': 'Service installation failed',
    'MAINTENANCE': 'Service is in maintenance mode',
    'UNKNOWN': 'Service state cannot be determined',
    'INIT': 'Service is initializing',
};
/**
 * State descriptions for requests
 */
export const REQUEST_STATUS_DESCRIPTIONS = {
    'PENDING': 'Request is pending execution',
    'IN_PROGRESS': 'Request is currently running',
    'COMPLETED': 'Request completed successfully',
    'FAILED': 'Request failed',
    'ABORTED': 'Request was aborted',
    'TIMEDOUT': 'Request timed out',
    'QUEUED': 'Request is queued for execution',
};
/**
 * Sleep utility for async operations
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Truncate string to max length with ellipsis
 */
export function truncate(str, maxLength) {
    if (str.length <= maxLength) {
        return str;
    }
    return str.slice(0, maxLength - 3) + '...';
}
/**
 * Safely get nested object property
 */
export function getNestedValue(obj, path, defaultValue) {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current === null || current === undefined) {
            return defaultValue;
        }
        if (typeof current === 'object' && key in current) {
            current = current[key];
        }
        else {
            return defaultValue;
        }
    }
    return current;
}
//# sourceMappingURL=utils.js.map