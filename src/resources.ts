/**
 * MCP Resources for Ambari MCP Server
 * Provides structured access to Ambari data via resource URIs
 */

import type { Resource } from '@modelcontextprotocol/sdk/types.js';
import { ambariGet, getClusterName } from './api-client.js';

// ============================================================================
// Resource Definitions
// ============================================================================

export const AMBARI_RESOURCES: Resource[] = [
  {
    uri: 'ambari://clusters',
    name: 'Ambari Clusters',
    description: 'List of all Ambari clusters with basic information',
    mimeType: 'application/json'
  },
  {
    uri: 'ambari://cluster/{clusterName}',
    name: 'Cluster Details',
    description: 'Detailed information about a specific cluster including services and hosts',
    mimeType: 'application/json'
  },
  {
    uri: 'ambari://cluster/{clusterName}/services',
    name: 'Cluster Services',
    description: 'All services running in a specific cluster with their status',
    mimeType: 'application/json'
  },
  {
    uri: 'ambari://cluster/{clusterName}/hosts',
    name: 'Cluster Hosts',
    description: 'All hosts in a specific cluster with their status and components',
    mimeType: 'application/json'
  },
  {
    uri: 'ambari://cluster/{clusterName}/alerts',
    name: 'Cluster Alerts',
    description: 'Current alerts for a specific cluster grouped by severity',
    mimeType: 'application/json'
  },
  {
    uri: 'ambari://cluster/{clusterName}/alerts/summary',
    name: 'Alert Summary',
    description: 'Summarized alert information for quick cluster health overview',
    mimeType: 'application/json'
  },
  {
    uri: 'ambari://cluster/{clusterName}/services/stale-configs',
    name: 'Stale Configurations',
    description: 'Services and components that need restart due to configuration changes',
    mimeType: 'application/json'
  },
  {
    uri: 'ambari://cluster/{clusterName}/service/{serviceName}',
    name: 'Service Details',
    description: 'Detailed information about a specific service including components and configurations',
    mimeType: 'application/json'
  },
  {
    uri: 'ambari://cluster/{clusterName}/service/{serviceName}/components',
    name: 'Service Components',
    description: 'All components of a specific service with their host assignments and status',
    mimeType: 'application/json'
  },
  {
    uri: 'ambari://host/{hostName}',
    name: 'Host Details',
    description: 'Detailed information about a specific host including installed components',
    mimeType: 'application/json'
  },
  {
    uri: 'ambari://cluster/{clusterName}/requests/recent',
    name: 'Recent Operations',
    description: 'Recent operations and their status (restarts, service checks, etc.)',
    mimeType: 'application/json'
  },
  {
    uri: 'ambari://cluster/{clusterName}/configurations',
    name: 'Cluster Configurations',
    description: 'Current configuration types and tags for all services in the cluster',
    mimeType: 'application/json'
  }
];

// ============================================================================
// Resource URI Parser
// ============================================================================

interface ParsedUri {
  type: string;
  clusterName?: string;
  serviceName?: string;
  hostName?: string;
}

export function parseResourceUri(uri: string): ParsedUri {
  const match = uri.match(/^ambari:\/\/(.+)$/);
  if (!match?.[1]) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }

  const path = match[1];

  // Simple resources
  if (path === 'clusters') {
    return { type: 'clusters' };
  }

  // Cluster-based resources
  if (path.startsWith('cluster/')) {
    const clusterMatch = path.match(/^cluster\/([^/]+)(?:\/(.+))?$/);
    if (!clusterMatch?.[1]) {
      throw new Error(`Invalid cluster resource URI: ${uri}`);
    }

    const clusterName = clusterMatch[1];
    const subPath = clusterMatch[2];

    if (!subPath) {
      return { type: 'cluster', clusterName };
    }

    if (subPath === 'services') {
      return { type: 'services', clusterName };
    }

    if (subPath === 'hosts') {
      return { type: 'hosts', clusterName };
    }

    if (subPath === 'alerts') {
      return { type: 'alerts', clusterName };
    }

    if (subPath === 'alerts/summary') {
      return { type: 'alerts-summary', clusterName };
    }

    if (subPath === 'services/stale-configs') {
      return { type: 'stale-configs', clusterName };
    }

    if (subPath === 'requests/recent') {
      return { type: 'recent-requests', clusterName };
    }

    if (subPath === 'configurations') {
      return { type: 'configurations', clusterName };
    }

    // Service-based resources
    const serviceMatch = subPath.match(/^service\/([^/]+)(?:\/(.+))?$/);
    if (serviceMatch?.[1]) {
      const serviceName = serviceMatch[1];
      const serviceSubPath = serviceMatch[2];

      if (!serviceSubPath) {
        return { type: 'service', clusterName, serviceName };
      }

      if (serviceSubPath === 'components') {
        return { type: 'service-components', clusterName, serviceName };
      }
    }
  }

  // Host-based resources
  if (path.startsWith('host/')) {
    const hostMatch = path.match(/^host\/(.+)$/);
    if (hostMatch?.[1]) {
      return { type: 'host', hostName: hostMatch[1] };
    }
  }

  throw new Error(`Unsupported resource URI: ${uri}`);
}

// ============================================================================
// Resource Handlers
// ============================================================================

type ResourceHandler = (params: ParsedUri) => Promise<unknown>;

const resourceHandlers: Record<string, ResourceHandler> = {
  clusters: async () => {
    const data = await ambariGet('/clusters', {
      fields: 'Clusters/cluster_name,Clusters/version,Clusters/provisioning_state,Clusters/security_type'
    });
    return {
      type: 'clusters',
      timestamp: new Date().toISOString(),
      data
    };
  },

  cluster: async (params) => {
    const clusterName = params.clusterName ?? await getClusterName();
    const data = await ambariGet(`/clusters/${clusterName}`, {
      fields: 'Clusters/*,services/ServiceInfo/service_name,services/ServiceInfo/state,hosts/Hosts/host_name,hosts/Hosts/host_status'
    });
    return {
      type: 'cluster-details',
      clusterName,
      timestamp: new Date().toISOString(),
      data
    };
  },

  services: async (params) => {
    const clusterName = params.clusterName ?? await getClusterName();
    const data = await ambariGet(`/clusters/${clusterName}/services`, {
      fields: 'ServiceInfo/service_name,ServiceInfo/state,ServiceInfo/maintenance_state,components/ServiceComponentInfo/component_name,components/ServiceComponentInfo/total_count,components/ServiceComponentInfo/started_count'
    });
    return {
      type: 'cluster-services',
      clusterName,
      timestamp: new Date().toISOString(),
      data
    };
  },

  hosts: async (params) => {
    const clusterName = params.clusterName ?? await getClusterName();
    const data = await ambariGet(`/clusters/${clusterName}/hosts`, {
      fields: 'Hosts/host_name,Hosts/host_status,Hosts/maintenance_state,host_components/HostRoles/component_name,host_components/HostRoles/state'
    });
    return {
      type: 'cluster-hosts',
      clusterName,
      timestamp: new Date().toISOString(),
      data
    };
  },

  alerts: async (params) => {
    const clusterName = params.clusterName ?? await getClusterName();
    const data = await ambariGet(`/clusters/${clusterName}/alerts`, {
      fields: 'Alert/definition_name,Alert/service_name,Alert/component_name,Alert/host_name,Alert/state,Alert/text,Alert/latest_timestamp',
      _: Date.now()
    }) as {
      items?: Array<{ Alert?: { state?: string } }>;
    };

    // Group alerts by state
    const alertsByState: Record<string, unknown[]> = {
      CRITICAL: [],
      WARNING: [],
      OK: [],
      UNKNOWN: []
    };

    const items = data.items ?? [];
    for (const alert of items) {
      const state = alert.Alert?.state ?? 'UNKNOWN';
      if (alertsByState[state]) {
        alertsByState[state].push(alert);
      }
    }

    return {
      type: 'cluster-alerts',
      clusterName,
      timestamp: new Date().toISOString(),
      summary: {
        critical: alertsByState['CRITICAL']?.length ?? 0,
        warning: alertsByState['WARNING']?.length ?? 0,
        ok: alertsByState['OK']?.length ?? 0,
        unknown: alertsByState['UNKNOWN']?.length ?? 0
      },
      data: alertsByState
    };
  },

  'alerts-summary': async (params) => {
    const clusterName = params.clusterName ?? await getClusterName();
    const data = await ambariGet(`/clusters/${clusterName}/alerts`, {
      format: 'groupedSummary',
      _: Date.now()
    });
    return {
      type: 'alerts-summary',
      clusterName,
      timestamp: new Date().toISOString(),
      data
    };
  },

  'stale-configs': async (params) => {
    const clusterName = params.clusterName ?? await getClusterName();
    const data = await ambariGet(`/clusters/${clusterName}/host_components`, {
      fields: 'HostRoles/component_name,HostRoles/host_name,HostRoles/service_name,HostRoles/state,HostRoles/stale_configs',
      'HostRoles/stale_configs': 'true',
      _: Date.now()
    }) as {
      items?: Array<{ HostRoles?: { service_name?: string } }>;
    };

    // Group by service
    const staleByService: Record<string, unknown[]> = {};
    const items = data.items ?? [];
    
    for (const item of items) {
      const serviceName = item.HostRoles?.service_name ?? 'Unknown';
      if (!staleByService[serviceName]) {
        staleByService[serviceName] = [];
      }
      staleByService[serviceName].push(item);
    }

    return {
      type: 'stale-configurations',
      clusterName,
      timestamp: new Date().toISOString(),
      summary: {
        totalStaleComponents: items.length,
        affectedServices: Object.keys(staleByService).length
      },
      data: staleByService
    };
  },

  service: async (params) => {
    const clusterName = params.clusterName ?? await getClusterName();
    const serviceName = params.serviceName;
    const data = await ambariGet(`/clusters/${clusterName}/services/${serviceName}`, {
      fields: 'ServiceInfo/*,components/ServiceComponentInfo/*,components/host_components/HostRoles/state,components/host_components/HostRoles/host_name,components/host_components/HostRoles/stale_configs'
    });
    return {
      type: 'service-details',
      clusterName,
      serviceName,
      timestamp: new Date().toISOString(),
      data
    };
  },

  'service-components': async (params) => {
    const clusterName = params.clusterName ?? await getClusterName();
    const serviceName = params.serviceName;
    const data = await ambariGet(`/clusters/${clusterName}/services/${serviceName}`, {
      fields: 'components/ServiceComponentInfo/component_name,components/ServiceComponentInfo/category,components/ServiceComponentInfo/total_count,components/ServiceComponentInfo/started_count,components/host_components/HostRoles/host_name,components/host_components/HostRoles/state,components/host_components/HostRoles/stale_configs'
    });
    return {
      type: 'service-components',
      clusterName,
      serviceName,
      timestamp: new Date().toISOString(),
      data
    };
  },

  host: async (params) => {
    const hostName = params.hostName;
    const clusterName = await getClusterName();
    const data = await ambariGet(`/clusters/${clusterName}/hosts/${hostName}`, {
      fields: 'Hosts/*,host_components/HostRoles/component_name,host_components/HostRoles/service_name,host_components/HostRoles/state,host_components/HostRoles/stale_configs'
    });
    return {
      type: 'host-details',
      hostName,
      timestamp: new Date().toISOString(),
      data
    };
  },

  'recent-requests': async (params) => {
    const clusterName = params.clusterName ?? await getClusterName();
    const data = await ambariGet(`/clusters/${clusterName}/requests`, {
      fields: 'Requests/id,Requests/request_context,Requests/request_status,Requests/progress_percent,Requests/start_time,Requests/end_time,Requests/create_time',
      sortBy: 'Requests/id.desc',
      page_size: 20,
      _: Date.now()
    });
    return {
      type: 'recent-requests',
      clusterName,
      timestamp: new Date().toISOString(),
      data
    };
  },

  configurations: async (params) => {
    const clusterName = params.clusterName ?? await getClusterName();
    const data = await ambariGet(`/clusters/${clusterName}`, {
      fields: 'Clusters/desired_configs',
      _: Date.now()
    });
    return {
      type: 'cluster-configurations',
      clusterName,
      timestamp: new Date().toISOString(),
      data
    };
  }
};

// ============================================================================
// Resource Reader
// ============================================================================

export async function readResource(uri: string): Promise<{
  uri: string;
  mimeType: string;
  text: string;
}> {
  const startTime = Date.now();
  const parsedUri = parseResourceUri(uri);

  const handler = resourceHandlers[parsedUri.type];
  if (!handler) {
    throw new Error(`Unsupported resource type: ${parsedUri.type}`);
  }

  const result = await handler(parsedUri);
  const executionTime = Date.now() - startTime;

  const responseData = {
    uri,
    executionTimeMs: executionTime,
    timestamp: new Date().toISOString(),
    ...(result as object)
  };

  return {
    uri,
    mimeType: 'application/json',
    text: JSON.stringify(responseData, null, 2)
  };
}

