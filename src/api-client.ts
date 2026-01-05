/**
 * Ambari API Client - HTTP communication layer
 */

import axios, { AxiosRequestConfig } from 'axios';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { getAmbariConfig, getHttpsAgent } from './config.js';

// ============================================================================
// Ambari REST API Client
// ============================================================================

/**
 * Execute an HTTP request to the Ambari REST API
 */
export async function executeAmbariRequest(
  method: string,
  path: string,
  params: Record<string, unknown> = {},
  body?: unknown
): Promise<{ status: number; statusText: string; data: unknown }> {
  const config = getAmbariConfig();
  const url = `${config.baseUrl}${path}`;
  const httpsAgent = getHttpsAgent();

  const axiosConfig: AxiosRequestConfig = {
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
  } catch (error: unknown) {
    // Build rich diagnostic information
    const axiosError = error as {
      response?: { status: number; statusText: string; data: unknown };
      code?: string;
      message?: string;
      config?: { method?: string; url?: string };
    };
    
    const hasResponse = Boolean(axiosError.response);
    const status = axiosError.response?.status;
    const statusText = axiosError.response?.statusText;
    const responseData = axiosError.response?.data;
    const code = axiosError.code;
    const isTimeout = code === 'ECONNABORTED' || /timeout/i.test(axiosError.message ?? '');

    const methodUpper = method.toUpperCase();
    const summaryParts: string[] = [`${methodUpper} ${url}`];
    
    if (status) summaryParts.push(`HTTP ${status}${statusText ? ' ' + statusText : ''}`);
    if (code && !status) summaryParts.push(`Code ${code}`);
    if (isTimeout) summaryParts.push('Timeout');
    if (!hasResponse && !code) summaryParts.push('No response');

    const details: Record<string, unknown> = {
      url,
      method: methodUpper,
      params: Object.keys(params).length > 0 ? params : undefined,
      timeoutMs: config.timeoutMs,
      code,
      status,
      statusText,
    };

    if (isTimeout) details['timeout'] = true;
    if (responseData) details['responseBody'] = responseData;
    if (axiosError.message && axiosError.message !== 'Error') {
      details['message'] = axiosError.message;
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Ambari API Error: ${summaryParts.join(' | ')}`,
      { diagnostics: JSON.stringify(details, null, 2) }
    );
  }
}

/**
 * Execute a GET request to Ambari API
 */
export async function ambariGet(
  path: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  const response = await executeAmbariRequest('GET', path, params);
  return response.data;
}

/**
 * Execute a POST request to Ambari API
 */
export async function ambariPost(
  path: string,
  body: unknown,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  const response = await executeAmbariRequest('POST', path, params, body);
  return response.data;
}

/**
 * Execute a PUT request to Ambari API
 */
export async function ambariPut(
  path: string,
  body: unknown,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  const response = await executeAmbariRequest('PUT', path, params, body);
  return response.data;
}

/**
 * Execute a DELETE request to Ambari API
 */
export async function ambariDelete(
  path: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  const response = await executeAmbariRequest('DELETE', path, params);
  return response.data;
}

// ============================================================================
// Cluster Name Auto-Detection
// ============================================================================

let cachedClusterName: string | null = null;

/**
 * Get the cluster name, auto-detecting if not configured
 */
export async function getClusterName(): Promise<string> {
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
    const response = await ambariGet('/clusters', { fields: 'Clusters/cluster_name' }) as {
      items?: Array<{ Clusters?: { cluster_name?: string } }>;
    };

    const clusters = response.items ?? [];
    if (clusters.length === 0) {
      throw new McpError(
        ErrorCode.InternalError,
        'No clusters found in Ambari. Please configure AMBARI_CLUSTER_NAME.'
      );
    }

    const firstCluster = clusters[0];
    const clusterName = firstCluster?.Clusters?.cluster_name;
    
    if (!clusterName) {
      throw new McpError(
        ErrorCode.InternalError,
        'Failed to detect cluster name. Please configure AMBARI_CLUSTER_NAME.'
      );
    }

    cachedClusterName = clusterName;
    console.error(`[cluster] Auto-detected cluster name: ${clusterName}`);
    return clusterName;
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to detect cluster name: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Clear the cached cluster name
 */
export function clearClusterNameCache(): void {
  cachedClusterName = null;
}

