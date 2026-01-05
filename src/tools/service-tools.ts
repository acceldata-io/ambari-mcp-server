/**
 * Service Management Tools for Ambari MCP Server
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ambariGet, ambariPut, ambariPost, getClusterName } from '../api-client.js';
import { SERVICE_STATE_DESCRIPTIONS, sleep } from '../utils.js';

// ============================================================================
// Tool Definitions
// ============================================================================

export const SERVICE_TOOLS: Tool[] = [
  {
    name: 'ambari_services_getservices',
    description: 'Get all services for a cluster with their current state',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        fields: { type: 'string', description: 'Filter fields in the response', default: 'ServiceInfo/service_name,ServiceInfo/state,ServiceInfo/maintenance_state' },
        sortBy: { type: 'string', description: 'Sort resources in result by (asc | desc)', default: 'ServiceInfo/service_name.asc' },
        page_size: { type: 'integer', description: 'The number of resources to be returned', default: 50 }
      },
      required: []
    }
  },
  {
    name: 'ambari_services_getservice',
    description: 'Get detailed information about a specific service',
    inputSchema: {
      type: 'object',
      properties: {
        serviceName: { type: 'string', description: 'The name of the service' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        fields: { type: 'string', description: 'Filter fields in the response', default: 'ServiceInfo/*' }
      },
      required: ['serviceName']
    }
  },
  {
    name: 'ambari_services_getservicestate',
    description: 'Get detailed state information for a service including all components and their host assignments',
    inputSchema: {
      type: 'object',
      properties: {
        serviceName: { type: 'string', description: 'The name of the service' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' }
      },
      required: ['serviceName']
    }
  },
  {
    name: 'ambari_services_getcomponents',
    description: 'Get all components for a specific service with their state and host assignments',
    inputSchema: {
      type: 'object',
      properties: {
        serviceName: { type: 'string', description: 'The name of the service' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' }
      },
      required: ['serviceName']
    }
  },
  {
    name: 'ambari_services_startservice',
    description: 'Start a specific service on the cluster',
    inputSchema: {
      type: 'object',
      properties: {
        serviceName: { type: 'string', description: 'The name of the service to start' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        context: { type: 'string', description: 'Context message for the start operation', default: 'Start service via MCP' }
      },
      required: ['serviceName']
    }
  },
  {
    name: 'ambari_services_stopservice',
    description: 'Stop a specific service on the cluster',
    inputSchema: {
      type: 'object',
      properties: {
        serviceName: { type: 'string', description: 'The name of the service to stop' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        context: { type: 'string', description: 'Context message for the stop operation', default: 'Stop service via MCP' }
      },
      required: ['serviceName']
    }
  },
  {
    name: 'ambari_services_restartservice',
    description: 'Restart a specific service (stop then start)',
    inputSchema: {
      type: 'object',
      properties: {
        serviceName: { type: 'string', description: 'The name of the service to restart' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        waitForStop: { type: 'boolean', description: 'Wait for stop to complete before starting', default: true },
        context: { type: 'string', description: 'Context message for the restart operation', default: 'Restart service via MCP' }
      },
      required: ['serviceName']
    }
  },
  {
    name: 'ambari_services_startall',
    description: 'Start all services in the cluster',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        context: { type: 'string', description: 'Context message for the operation', default: 'Start All Services via MCP' }
      },
      required: []
    }
  },
  {
    name: 'ambari_services_stopall',
    description: 'Stop all services in the cluster',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        context: { type: 'string', description: 'Context message for the operation', default: 'Stop All Services via MCP' }
      },
      required: []
    }
  },
  {
    name: 'ambari_services_getstaleconfigs',
    description: 'Get services and components that have stale configurations requiring restart',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        serviceName: { type: 'string', description: 'Filter by specific service name (optional)' }
      },
      required: []
    }
  },
  {
    name: 'ambari_services_enablemaintenancemode',
    description: 'Enable maintenance mode for a service or component',
    inputSchema: {
      type: 'object',
      properties: {
        serviceName: { type: 'string', description: 'The name of the service' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        componentName: { type: 'string', description: 'The name of the component (optional - applies to entire service if not provided)' },
        hostName: { type: 'string', description: 'The name of the host (required if componentName is provided)' }
      },
      required: ['serviceName']
    }
  },
  {
    name: 'ambari_services_disablemaintenancemode',
    description: 'Disable maintenance mode for a service or component',
    inputSchema: {
      type: 'object',
      properties: {
        serviceName: { type: 'string', description: 'The name of the service' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        componentName: { type: 'string', description: 'The name of the component (optional)' },
        hostName: { type: 'string', description: 'The name of the host (required if componentName is provided)' }
      },
      required: ['serviceName']
    }
  },
  {
    name: 'ambari_services_runservicecheck',
    description: 'Run a service check to verify the service is working correctly',
    inputSchema: {
      type: 'object',
      properties: {
        serviceName: { type: 'string', description: 'The name of the service to check' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        context: { type: 'string', description: 'Context message for the service check operation', default: 'Service Check via MCP' }
      },
      required: ['serviceName']
    }
  }
];

// ============================================================================
// Tool Executors
// ============================================================================

export const serviceToolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {

  ambari_services_getservices: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const params: Record<string, unknown> = {};
    if (args['fields']) params['fields'] = args['fields'];
    if (args['sortBy']) params['sortBy'] = args['sortBy'];
    if (args['page_size']) params['page_size'] = args['page_size'];

    const data = await ambariGet(`/clusters/${clusterName}/services`, params);
    return { result: data };
  },

  ambari_services_getservice: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const serviceName = args['serviceName'] as string;
    const params: Record<string, unknown> = {};
    if (args['fields']) params['fields'] = args['fields'];

    const data = await ambariGet(`/clusters/${clusterName}/services/${serviceName}`, params) as {
      ServiceInfo?: { state?: string };
    };

    // Add state description
    const state = data.ServiceInfo?.state;
    const description = state && SERVICE_STATE_DESCRIPTIONS[state];

    return {
      result: data,
      stateDescription: description
    };
  },

  ambari_services_getservicestate: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const serviceName = args['serviceName'] as string;

    const data = await ambariGet(`/clusters/${clusterName}/services/${serviceName}`, {
      fields: 'ServiceInfo/*,components/ServiceComponentInfo/*,components/host_components/HostRoles/state,components/host_components/HostRoles/stale_configs,components/host_components/HostRoles/host_name'
    }) as {
      ServiceInfo?: { service_name?: string; state?: string; maintenance_state?: string };
      components?: Array<{
        ServiceComponentInfo?: { component_name?: string; state?: string; category?: string; total_count?: number; started_count?: number };
        host_components?: Array<{ HostRoles?: { host_name?: string; state?: string; stale_configs?: boolean } }>;
      }>;
    };

    const serviceInfo = data.ServiceInfo ?? {};
    const components = data.components ?? [];

    // Build summary
    const lines: string[] = [
      `Service State: ${serviceName}`,
      '='.repeat(50),
      `State: ${serviceInfo.state ?? 'Unknown'}`,
      `Maintenance Mode: ${serviceInfo.maintenance_state ?? 'OFF'}`,
      '',
      `Components (${components.length}):`,
    ];

    let hasStaleConfigs = false;
    for (const comp of components) {
      const compInfo = comp.ServiceComponentInfo ?? {};
      const hostComps = comp.host_components ?? [];
      
      lines.push(`  ${compInfo.component_name ?? 'Unknown'} [${compInfo.state ?? 'Unknown'}]`);
      lines.push(`    Category: ${compInfo.category ?? 'Unknown'}`);
      lines.push(`    Instances: ${compInfo.started_count ?? 0}/${compInfo.total_count ?? 0} started`);

      const staleHosts = hostComps.filter(hc => hc.HostRoles?.stale_configs);
      if (staleHosts.length > 0) {
        hasStaleConfigs = true;
        lines.push(`    Stale Configs: ${staleHosts.length} host(s) need restart`);
      }
    }

    if (hasStaleConfigs) {
      lines.push('');
      lines.push('⚠️  Some components have stale configurations and need restart');
    }

    return {
      summary: lines.join('\n'),
      data: {
        service: serviceInfo,
        components: components.map(c => ({
          name: c.ServiceComponentInfo?.component_name,
          state: c.ServiceComponentInfo?.state,
          category: c.ServiceComponentInfo?.category,
          hosts: (c.host_components ?? []).map(hc => ({
            host: hc.HostRoles?.host_name,
            state: hc.HostRoles?.state,
            staleConfigs: hc.HostRoles?.stale_configs
          }))
        }))
      }
    };
  },

  ambari_services_getcomponents: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const serviceName = args['serviceName'] as string;

    const data = await ambariGet(`/clusters/${clusterName}/services/${serviceName}/components`, {
      fields: 'ServiceComponentInfo/*,host_components/HostRoles/host_name,host_components/HostRoles/state'
    });

    return { result: data };
  },

  ambari_services_startservice: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const serviceName = args['serviceName'] as string;
    const context = (args['context'] as string) || 'Start service via MCP';

    // Check current state first
    const current = await ambariGet(`/clusters/${clusterName}/services/${serviceName}`) as {
      ServiceInfo?: { state?: string };
    };
    const currentState = current.ServiceInfo?.state;

    if (currentState === 'STARTED') {
      return {
        status: 'already_started',
        message: `Service '${serviceName}' is already running (state: ${currentState})`
      };
    }

    const body = {
      RequestInfo: {
        context,
        operation_level: {
          level: 'SERVICE',
          cluster_name: clusterName,
          service_name: serviceName
        }
      },
      Body: {
        ServiceInfo: { state: 'STARTED' }
      }
    };

    const data = await ambariPut(`/clusters/${clusterName}/services/${serviceName}`, body) as {
      Requests?: { id?: number; status?: string };
      href?: string;
    };

    return {
      status: 'started',
      previousState: currentState,
      requestId: data.Requests?.id,
      requestStatus: data.Requests?.status,
      monitorUrl: data.href,
      message: `Start request submitted for service '${serviceName}'`
    };
  },

  ambari_services_stopservice: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const serviceName = args['serviceName'] as string;
    const context = (args['context'] as string) || 'Stop service via MCP';

    // Check current state first
    const current = await ambariGet(`/clusters/${clusterName}/services/${serviceName}`) as {
      ServiceInfo?: { state?: string };
    };
    const currentState = current.ServiceInfo?.state;

    if (currentState === 'INSTALLED' || currentState === 'INSTALL_FAILED') {
      return {
        status: 'already_stopped',
        message: `Service '${serviceName}' is already stopped (state: ${currentState})`
      };
    }

    const body = {
      RequestInfo: {
        context,
        operation_level: {
          level: 'SERVICE',
          cluster_name: clusterName,
          service_name: serviceName
        }
      },
      Body: {
        ServiceInfo: { state: 'INSTALLED' }
      }
    };

    const data = await ambariPut(`/clusters/${clusterName}/services/${serviceName}`, body) as {
      Requests?: { id?: number; status?: string };
      href?: string;
    };

    return {
      status: 'stopping',
      previousState: currentState,
      requestId: data.Requests?.id,
      requestStatus: data.Requests?.status,
      monitorUrl: data.href,
      message: `Stop request submitted for service '${serviceName}'`
    };
  },

  ambari_services_restartservice: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const serviceName = args['serviceName'] as string;
    const waitForStop = args['waitForStop'] !== false;
    const context = (args['context'] as string) || 'Restart service via MCP';

    // Step 1: Stop the service
    const stopBody = {
      RequestInfo: {
        context: `Stop ${serviceName} for restart via MCP`,
        operation_level: {
          level: 'SERVICE',
          cluster_name: clusterName,
          service_name: serviceName
        }
      },
      Body: {
        ServiceInfo: { state: 'INSTALLED' }
      }
    };

    const stopData = await ambariPut(`/clusters/${clusterName}/services/${serviceName}`, stopBody) as {
      Requests?: { id?: number };
    };
    const stopRequestId = stopData.Requests?.id;

    // Wait for stop if requested
    if (waitForStop && stopRequestId) {
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes max wait

      while (attempts < maxAttempts) {
        const statusData = await ambariGet(`/clusters/${clusterName}/requests/${stopRequestId}`) as {
          Requests?: { request_status?: string };
        };
        const status = statusData.Requests?.request_status;

        if (status === 'COMPLETED') break;
        if (status === 'FAILED' || status === 'ABORTED') {
          return {
            status: 'failed',
            phase: 'stop',
            requestId: stopRequestId,
            message: `Stop operation failed with status: ${status}`
          };
        }

        await sleep(2000);
        attempts++;
      }
    }

    // Step 2: Start the service
    const startBody = {
      RequestInfo: {
        context,
        operation_level: {
          level: 'SERVICE',
          cluster_name: clusterName,
          service_name: serviceName
        }
      },
      Body: {
        ServiceInfo: { state: 'STARTED' }
      }
    };

    const startData = await ambariPut(`/clusters/${clusterName}/services/${serviceName}`, startBody) as {
      Requests?: { id?: number; status?: string };
      href?: string;
    };

    return {
      status: 'restarting',
      stopRequestId,
      startRequestId: startData.Requests?.id,
      startRequestStatus: startData.Requests?.status,
      monitorUrl: startData.href,
      message: `Restart initiated for service '${serviceName}'`
    };
  },

  ambari_services_startall: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const context = (args['context'] as string) || 'Start All Services via MCP';

    const body = {
      RequestInfo: {
        context,
        operation_level: {
          level: 'CLUSTER',
          cluster_name: clusterName
        }
      },
      Body: {
        ServiceInfo: { state: 'STARTED' }
      }
    };

    const data = await ambariPut(`/clusters/${clusterName}/services`, body) as {
      Requests?: { id?: number; status?: string };
      href?: string;
    };

    return {
      status: 'starting',
      requestId: data.Requests?.id,
      requestStatus: data.Requests?.status,
      monitorUrl: data.href,
      message: 'Start All Services request submitted'
    };
  },

  ambari_services_stopall: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const context = (args['context'] as string) || 'Stop All Services via MCP';

    const body = {
      RequestInfo: {
        context,
        operation_level: {
          level: 'CLUSTER',
          cluster_name: clusterName
        }
      },
      Body: {
        ServiceInfo: { state: 'INSTALLED' }
      }
    };

    const data = await ambariPut(`/clusters/${clusterName}/services`, body) as {
      Requests?: { id?: number; status?: string };
      href?: string;
    };

    return {
      status: 'stopping',
      requestId: data.Requests?.id,
      requestStatus: data.Requests?.status,
      monitorUrl: data.href,
      message: 'Stop All Services request submitted'
    };
  },

  ambari_services_getstaleconfigs: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const serviceName = args['serviceName'] as string | undefined;

    const params = {
      fields: 'HostRoles/component_name,HostRoles/host_name,HostRoles/service_name,HostRoles/state,HostRoles/stale_configs,HostRoles/maintenance_state',
      'HostRoles/stale_configs': 'true'
    };

    const data = await ambariGet(`/clusters/${clusterName}/host_components`, params) as {
      items?: Array<{
        HostRoles?: {
          component_name?: string;
          host_name?: string;
          service_name?: string;
          state?: string;
        };
      }>;
    };

    const items = data.items ?? [];
    const filtered = serviceName
      ? items.filter(item => item.HostRoles?.service_name === serviceName)
      : items;

    // Group by service
    const byService: Record<string, Array<{ component: string; host: string; state: string }>> = {};
    for (const item of filtered) {
      const roles = item.HostRoles ?? {};
      const svcName = roles.service_name ?? 'Unknown';
      if (!byService[svcName]) byService[svcName] = [];
      byService[svcName].push({
        component: roles.component_name ?? 'Unknown',
        host: roles.host_name ?? 'Unknown',
        state: roles.state ?? 'Unknown'
      });
    }

    const lines: string[] = [
      'Stale Configurations Report',
      '='.repeat(50),
      `Total components needing restart: ${filtered.length}`,
      ''
    ];

    for (const [svc, components] of Object.entries(byService)) {
      lines.push(`${svc}:`);
      for (const comp of components) {
        lines.push(`  - ${comp.component} on ${comp.host} [${comp.state}]`);
      }
      lines.push('');
    }

    return {
      summary: lines.join('\n'),
      count: filtered.length,
      byService
    };
  },

  ambari_services_enablemaintenancemode: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const serviceName = args['serviceName'] as string;
    const componentName = args['componentName'] as string | undefined;
    const hostName = args['hostName'] as string | undefined;

    if (componentName && hostName) {
      // Enable for specific host component
      const body = { HostRoles: { maintenance_state: 'ON' } };
      await ambariPut(`/clusters/${clusterName}/hosts/${hostName}/host_components/${componentName}`, body);
      return {
        status: 'enabled',
        target: 'host_component',
        component: componentName,
        host: hostName,
        message: `Maintenance mode enabled for ${componentName} on ${hostName}`
      };
    } else {
      // Enable for entire service
      const body = {
        RequestInfo: { context: 'Enable Maintenance Mode via MCP' },
        Body: { ServiceInfo: { maintenance_state: 'ON' } }
      };
      await ambariPut(`/clusters/${clusterName}/services/${serviceName}`, body);
      return {
        status: 'enabled',
        target: 'service',
        service: serviceName,
        message: `Maintenance mode enabled for service ${serviceName}`
      };
    }
  },

  ambari_services_disablemaintenancemode: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const serviceName = args['serviceName'] as string;
    const componentName = args['componentName'] as string | undefined;
    const hostName = args['hostName'] as string | undefined;

    if (componentName && hostName) {
      const body = { HostRoles: { maintenance_state: 'OFF' } };
      await ambariPut(`/clusters/${clusterName}/hosts/${hostName}/host_components/${componentName}`, body);
      return {
        status: 'disabled',
        target: 'host_component',
        component: componentName,
        host: hostName,
        message: `Maintenance mode disabled for ${componentName} on ${hostName}`
      };
    } else {
      const body = {
        RequestInfo: { context: 'Disable Maintenance Mode via MCP' },
        Body: { ServiceInfo: { maintenance_state: 'OFF' } }
      };
      await ambariPut(`/clusters/${clusterName}/services/${serviceName}`, body);
      return {
        status: 'disabled',
        target: 'service',
        service: serviceName,
        message: `Maintenance mode disabled for service ${serviceName}`
      };
    }
  },

  ambari_services_runservicecheck: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const serviceName = args['serviceName'] as string;
    const context = (args['context'] as string) || `${serviceName} Service Check via MCP`;

    // Different services have different service check commands
    let command = `${serviceName}_SERVICE_CHECK`;
    if (serviceName === 'ZOOKEEPER') {
      command = 'ZOOKEEPER_QUORUM_SERVICE_CHECK';
    }

    const body = {
      RequestInfo: {
        command,
        context,
        operation_level: {
          level: 'CLUSTER',
          cluster_name: clusterName
        }
      },
      'Requests/resource_filters': [
        { service_name: serviceName }
      ]
    };

    const data = await ambariPost(`/clusters/${clusterName}/requests`, body) as {
      Requests?: { id?: number; status?: string };
      href?: string;
    };

    return {
      status: 'submitted',
      serviceName,
      command,
      requestId: data.Requests?.id,
      requestStatus: data.Requests?.status,
      monitorUrl: data.href,
      message: `Service check submitted for ${serviceName}`
    };
  }
};

