/**
 * Ambari API Client - HTTP communication layer
 */
/**
 * Execute an HTTP request to the Ambari REST API
 */
export declare function executeAmbariRequest(method: string, path: string, params?: Record<string, unknown>, body?: unknown): Promise<{
    status: number;
    statusText: string;
    data: unknown;
}>;
/**
 * Execute a GET request to Ambari API
 */
export declare function ambariGet(path: string, params?: Record<string, unknown>): Promise<unknown>;
/**
 * Execute a POST request to Ambari API
 */
export declare function ambariPost(path: string, body: unknown, params?: Record<string, unknown>): Promise<unknown>;
/**
 * Execute a PUT request to Ambari API
 */
export declare function ambariPut(path: string, body: unknown, params?: Record<string, unknown>): Promise<unknown>;
/**
 * Execute a DELETE request to Ambari API
 */
export declare function ambariDelete(path: string, params?: Record<string, unknown>): Promise<unknown>;
/**
 * Get the cluster name, auto-detecting if not configured
 */
export declare function getClusterName(): Promise<string>;
/**
 * Clear the cached cluster name
 */
export declare function clearClusterNameCache(): void;
//# sourceMappingURL=api-client.d.ts.map