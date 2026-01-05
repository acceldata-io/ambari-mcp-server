/**
 * Cluster Management Tools for Ambari MCP Server
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ambariGet, ambariPost, getClusterName } from '../api-client.js';

// ============================================================================
// Tool Definitions
// ============================================================================

export const CLUSTER_TOOLS: Tool[] = [
  {
    name: 'ambari_clusters_getclusters',
    description: 'Returns all clusters managed by Ambari with their basic information',
    inputSchema: {
      type: 'object',
      properties: {
        fields: {
          type: 'string',
          description: 'Filter fields in the response (identifier fields are mandatory)',
          default: 'Clusters/*'
        },
        sortBy: {
          type: 'string',
          description: 'Sort resources in result by (asc | desc)'
        },
        page_size: {
          type: 'integer',
          description: 'The number of resources to be returned for the paged response.',
          default: 10
        },
        from: {
          type: 'integer',
          description: 'The starting page resource (inclusive). "start" is also accepted.',
          default: 0
        },
        to: {
          type: 'integer',
          description: 'The ending page resource (inclusive). "end" is also accepted.'
        }
      },
      required: []
    }
  },
  {
    name: 'ambari_clusters_getcluster',
    description: 'Returns detailed information about a specific cluster',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: {
          type: 'string',
          description: 'The name of the cluster (optional, uses default if not specified)'
        },
        fields: {
          type: 'string',
          description: 'Filter fields in the response (identifier fields are mandatory)',
          default: 'Clusters/*'
        }
      },
      required: []
    }
  },
  {
    name: 'ambari_clusters_createcluster',
    description: 'Creates a new cluster in Ambari',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: {
          type: 'string',
          description: 'The name of the cluster to create'
        },
        body: {
          type: 'string',
          description: 'JSON body for cluster creation'
        }
      },
      required: ['clusterName', 'body']
    }
  },
  {
    name: 'ambari_cluster_info',
    description: 'Retrieves comprehensive information about the cluster including version, security, and health status',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: {
          type: 'string',
          description: 'The name of the cluster (optional, uses default if not specified)'
        }
      },
      required: []
    }
  }
];

// ============================================================================
// Tool Executors
// ============================================================================

export const clusterToolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  
  ambari_clusters_getclusters: async (args) => {
    const params: Record<string, unknown> = {};
    if (args['fields']) params['fields'] = args['fields'];
    if (args['sortBy']) params['sortBy'] = args['sortBy'];
    if (args['page_size']) params['page_size'] = args['page_size'];
    if (args['from'] !== undefined) params['from'] = args['from'];
    if (args['to'] !== undefined) params['to'] = args['to'];
    
    const data = await ambariGet('/clusters', params);
    return { result: data };
  },

  ambari_clusters_getcluster: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const params: Record<string, unknown> = {};
    if (args['fields']) params['fields'] = args['fields'];
    
    const data = await ambariGet(`/clusters/${clusterName}`, params);
    return { result: data };
  },

  ambari_clusters_createcluster: async (args) => {
    const clusterName = args['clusterName'] as string;
    const bodyStr = args['body'] as string;
    const body = typeof bodyStr === 'string' ? JSON.parse(bodyStr) : bodyStr;
    
    const data = await ambariPost(`/clusters/${clusterName}`, body);
    return { result: data };
  },

  ambari_cluster_info: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    
    const data = await ambariGet(`/clusters/${clusterName}`, {
      fields: 'Clusters/*,services/ServiceInfo/service_name,services/ServiceInfo/state,hosts/Hosts/host_name,hosts/Hosts/host_status'
    }) as {
      Clusters?: {
        cluster_name?: string;
        version?: string;
        provisioning_state?: string;
        security_type?: string;
        total_hosts?: number;
      };
      services?: Array<{ ServiceInfo?: { service_name?: string; state?: string } }>;
      hosts?: Array<{ Hosts?: { host_name?: string; host_status?: string } }>;
    };

    const clusters = data.Clusters ?? {};
    const services = data.services ?? [];
    const hosts = data.hosts ?? [];

    // Build formatted response
    const lines: string[] = [
      `Cluster Information: ${clusters.cluster_name ?? clusterName}`,
      '='.repeat(50),
      `Cluster Name: ${clusters.cluster_name ?? clusterName}`,
      `Version: ${clusters.version ?? 'Unknown'}`,
      `Provisioning State: ${clusters.provisioning_state ?? 'N/A'}`,
      `Security Type: ${clusters.security_type ?? 'NONE'}`,
      '',
      `Services (${services.length}):`,
    ];

    // Group services by state
    const servicesByState: Record<string, string[]> = {};
    for (const svc of services) {
      const state = svc.ServiceInfo?.state ?? 'UNKNOWN';
      const name = svc.ServiceInfo?.service_name ?? 'Unknown';
      if (!servicesByState[state]) servicesByState[state] = [];
      servicesByState[state].push(name);
    }

    for (const [state, names] of Object.entries(servicesByState)) {
      lines.push(`  ${state}: ${names.join(', ')}`);
    }

    lines.push('');
    lines.push(`Hosts (${hosts.length}):`);
    
    // Group hosts by status
    const hostsByStatus: Record<string, string[]> = {};
    for (const host of hosts) {
      const status = host.Hosts?.host_status ?? 'UNKNOWN';
      const name = host.Hosts?.host_name ?? 'Unknown';
      if (!hostsByStatus[status]) hostsByStatus[status] = [];
      hostsByStatus[status].push(name);
    }

    for (const [status, names] of Object.entries(hostsByStatus)) {
      lines.push(`  ${status}: ${names.length} host(s)`);
      if (names.length <= 5) {
        for (const name of names) {
          lines.push(`    - ${name}`);
        }
      }
    }

    return {
      summary: lines.join('\n'),
      data: {
        cluster: clusters,
        services: servicesByState,
        hosts: hostsByStatus,
        counts: {
          services: services.length,
          hosts: hosts.length,
        }
      }
    };
  }
};

