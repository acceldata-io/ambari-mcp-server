/**
 * Ambari API Client - HTTP communication layer
 */
import axios from 'axios';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { getAmbariConfig, getHttpsAgent } from './config.js';
// ============================================================================
// Ambari REST API Client
// ============================================================================
/**
 * Execute an HTTP request to the Ambari REST API
 */
export async function executeAmbariRequest(method, path, params = {}, body) {
    const config = getAmbariConfig();
    const url = `${config.baseUrl}${path}`;
    const httpsAgent = getHttpsAgent();
    const axiosConfig = {
        url,
        method: method.toLowerCase(),
        auth: {
            username: config.username,
            password: config.password,
        },
        timeout: config.timeoutMs,
        params: Object.keys(params).length > 0 ? params : undefined,
        data: body,
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-By': 'ambari-mcp-server',
        },
        // Use httpsAgent for SSL verification skip when configured
        httpsAgent,
    };
    try {
        const response = await axios(axiosConfig);
        return {
            status: response.status,
            statusText: response.statusText,
            data: response.data,
        };
    }
    catch (error) {
        // Build rich diagnostic information
        const axiosError = error;
        const hasResponse = Boolean(axiosError.response);
        const status = axiosError.response?.status;
        const statusText = axiosError.response?.statusText;
        const responseData = axiosError.response?.data;
        const code = axiosError.code;
        const isTimeout = code === 'ECONNABORTED' || /timeout/i.test(axiosError.message ?? '');
        const methodUpper = method.toUpperCase();
        const summaryParts = [`${methodUpper} ${url}`];
        if (status)
            summaryParts.push(`HTTP ${status}${statusText ? ' ' + statusText : ''}`);
        if (code && !status)
            summaryParts.push(`Code ${code}`);
        if (isTimeout)
            summaryParts.push('Timeout');
        if (!hasResponse && !code)
            summaryParts.push('No response');
        const details = {
            url,
            method: methodUpper,
            params: Object.keys(params).length > 0 ? params : undefined,
            timeoutMs: config.timeoutMs,
            code,
            status,
            statusText,
        };
        if (isTimeout)
            details['timeout'] = true;
        if (responseData)
            details['responseBody'] = responseData;
        if (axiosError.message && axiosError.message !== 'Error') {
            details['message'] = axiosError.message;
        }
        throw new McpError(ErrorCode.InternalError, `Ambari API Error: ${summaryParts.join(' | ')}`, { diagnostics: JSON.stringify(details, null, 2) });
    }
}
/**
 * Execute a GET request to Ambari API
 */
export async function ambariGet(path, params = {}) {
    const response = await executeAmbariRequest('GET', path, params);
    return response.data;
}
/**
 * Execute a POST request to Ambari API
 */
export async function ambariPost(path, body, params = {}) {
    const response = await executeAmbariRequest('POST', path, params, body);
    return response.data;
}
/**
 * Execute a PUT request to Ambari API
 */
export async function ambariPut(path, body, params = {}) {
    const response = await executeAmbariRequest('PUT', path, params, body);
    return response.data;
}
/**
 * Execute a DELETE request to Ambari API
 */
export async function ambariDelete(path, params = {}) {
    const response = await executeAmbariRequest('DELETE', path, params);
    return response.data;
}
// ============================================================================
// Cluster Name Auto-Detection
// ============================================================================
let cachedClusterName = null;
/**
 * Get the cluster name, auto-detecting if not configured
 */
export async function getClusterName() {
    const config = getAmbariConfig();
    // Return configured cluster name if set
    if (config.clusterName) {
        return config.clusterName;
    }
    // Return cached cluster name if available
    if (cachedClusterName) {
        return cachedClusterName;
    }
    // Auto-detect cluster name
    try {
        const response = await ambariGet('/clusters', { fields: 'Clusters/cluster_name' });
        const clusters = response.items ?? [];
        if (clusters.length === 0) {
            throw new McpError(ErrorCode.InternalError, 'No clusters found in Ambari. Please configure AMBARI_CLUSTER_NAME.');
        }
        const firstCluster = clusters[0];
        const clusterName = firstCluster?.Clusters?.cluster_name;
        if (!clusterName) {
            throw new McpError(ErrorCode.InternalError, 'Failed to detect cluster name. Please configure AMBARI_CLUSTER_NAME.');
        }
        cachedClusterName = clusterName;
        console.error(`[cluster] Auto-detected cluster name: ${clusterName}`);
        return clusterName;
    }
    catch (error) {
        if (error instanceof McpError)
            throw error;
        throw new McpError(ErrorCode.InternalError, `Failed to detect cluster name: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Clear the cached cluster name
 */
export function clearClusterNameCache() {
    cachedClusterName = null;
}
//# sourceMappingURL=api-client.js.map