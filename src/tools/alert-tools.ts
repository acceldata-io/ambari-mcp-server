/**
 * Alert Management Tools for Ambari MCP Server
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ambariGet, ambariPost, ambariPut, ambariDelete, getClusterName } from '../api-client.js';
import { formatTimestamp } from '../utils.js';

// ============================================================================
// Tool Definitions
// ============================================================================

export const ALERT_TOOLS: Tool[] = [
  {
    name: 'ambari_alerts_getcurrent',
    description: 'Get all current alerts for the cluster with optional filtering by state, service, or host',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        state: { type: 'string', description: 'Filter by alert state: CRITICAL, WARNING, OK, UNKNOWN' },
        serviceName: { type: 'string', description: 'Filter by service name' },
        hostName: { type: 'string', description: 'Filter by host name' },
        maintenanceState: { type: 'string', description: 'Filter by maintenance state: ON, OFF' },
        format: { type: 'string', description: 'Output format: detailed, summary, compact', default: 'detailed' }
      },
      required: []
    }
  },
  {
    name: 'ambari_alerts_getsummary',
    description: 'Get alert summary in grouped format showing counts by state',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        excludeMaintenance: { type: 'boolean', description: 'Exclude alerts in maintenance mode', default: false }
      },
      required: []
    }
  },
  {
    name: 'ambari_alerts_gethistory',
    description: 'Get alert history with optional time range filtering',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        state: { type: 'string', description: 'Filter by alert state' },
        serviceName: { type: 'string', description: 'Filter by service name' },
        hostName: { type: 'string', description: 'Filter by host name' },
        fromTimestamp: { type: 'number', description: 'Start timestamp in milliseconds' },
        toTimestamp: { type: 'number', description: 'End timestamp in milliseconds' },
        limit: { type: 'integer', description: 'Maximum number of entries to return', default: 100 }
      },
      required: []
    }
  },
  {
    name: 'ambari_alerts_getdefinitions',
    description: 'Get all alert definitions for the cluster',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        serviceName: { type: 'string', description: 'Filter by service name' },
        enabled: { type: 'boolean', description: 'Filter by enabled status' }
      },
      required: []
    }
  },
  {
    name: 'ambari_alerts_updatedefinition',
    description: 'Update an alert definition (enable/disable or modify properties)',
    inputSchema: {
      type: 'object',
      properties: {
        definitionId: { type: 'integer', description: 'The alert definition ID' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        enabled: { type: 'boolean', description: 'Enable or disable the alert definition' },
        data: { type: 'string', description: 'JSON string of additional properties to update' }
      },
      required: ['definitionId']
    }
  },
  {
    name: 'ambari_alerts_getgroups',
    description: 'Get all alert groups for the cluster',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' }
      },
      required: []
    }
  },
  {
    name: 'ambari_alerts_creategroup',
    description: 'Create a new alert group',
    inputSchema: {
      type: 'object',
      properties: {
        groupName: { type: 'string', description: 'Name of the alert group' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        definitions: { type: 'string', description: 'JSON array of definition IDs to include' }
      },
      required: ['groupName']
    }
  },
  {
    name: 'ambari_alerts_updategroup',
    description: 'Update an existing alert group',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'integer', description: 'The alert group ID' },
        groupName: { type: 'string', description: 'New name for the alert group' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        definitions: { type: 'string', description: 'JSON array of definition IDs' }
      },
      required: ['groupId', 'groupName']
    }
  },
  {
    name: 'ambari_alerts_deletegroup',
    description: 'Delete an alert group',
    inputSchema: {
      type: 'object',
      properties: {
        groupId: { type: 'integer', description: 'The alert group ID to delete' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' }
      },
      required: ['groupId']
    }
  },
  {
    name: 'ambari_alerts_gettargets',
    description: 'Get all alert notification targets',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'ambari_alerts_createtarget',
    description: 'Create a new alert notification target',
    inputSchema: {
      type: 'object',
      properties: {
        notificationData: { type: 'string', description: 'JSON string containing notification target data (name, description, notification_type, properties, etc.)' }
      },
      required: ['notificationData']
    }
  },
  {
    name: 'ambari_alerts_updatetarget',
    description: 'Update an existing alert notification target',
    inputSchema: {
      type: 'object',
      properties: {
        targetId: { type: 'integer', description: 'The notification target ID' },
        notificationData: { type: 'string', description: 'JSON string containing updated notification target data' }
      },
      required: ['targetId', 'notificationData']
    }
  },
  {
    name: 'ambari_alerts_deletetarget',
    description: 'Delete an alert notification target',
    inputSchema: {
      type: 'object',
      properties: {
        targetId: { type: 'integer', description: 'The notification target ID to delete' }
      },
      required: ['targetId']
    }
  }
];

// ============================================================================
// Tool Executors
// ============================================================================

interface AlertItem {
  Alert?: {
    id?: number;
    definition_id?: number;
    definition_name?: string;
    service_name?: string;
    component_name?: string;
    host_name?: string;
    state?: string;
    text?: string;
    label?: string;
    maintenance_state?: string;
    original_timestamp?: number;
    latest_timestamp?: number;
  };
}

interface AlertHistoryItem {
  AlertHistory?: {
    id?: number;
    definition_id?: number;
    definition_name?: string;
    service_name?: string;
    component_name?: string;
    host_name?: string;
    state?: string;
    text?: string;
    label?: string;
    timestamp?: number;
  };
}

export const alertToolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {

  ambari_alerts_getcurrent: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const format = (args['format'] as string) || 'detailed';
    
    const params: Record<string, unknown> = {
      fields: '*',
      _: Date.now()
    };
    
    if (args['state']) params['Alert/state'] = args['state'];
    if (args['serviceName']) params['Alert/service_name'] = args['serviceName'];
    if (args['hostName']) params['Alert/host_name'] = args['hostName'];
    if (args['maintenanceState']) params['Alert/maintenance_state'] = args['maintenanceState'];

    const data = await ambariGet(`/clusters/${clusterName}/alerts`, params) as { items?: AlertItem[] };
    const alerts = data.items ?? [];

    // Group by state
    const byState: Record<string, AlertItem[]> = {
      CRITICAL: [],
      WARNING: [],
      UNKNOWN: [],
      OK: []
    };

    for (const alert of alerts) {
      const state = alert.Alert?.state ?? 'UNKNOWN';
      if (!byState[state]) byState[state] = [];
      byState[state]!.push(alert);
    }

    if (format === 'summary') {
      const lines: string[] = [
        `Alert Summary for Cluster: ${clusterName}`,
        '='.repeat(50),
        `CRITICAL: ${byState['CRITICAL']?.length ?? 0}`,
        `WARNING: ${byState['WARNING']?.length ?? 0}`,
        `UNKNOWN: ${byState['UNKNOWN']?.length ?? 0}`,
        `OK: ${byState['OK']?.length ?? 0}`,
        '',
        `Total Alerts: ${alerts.length}`
      ];
      return { summary: lines.join('\n'), counts: { critical: byState['CRITICAL']?.length ?? 0, warning: byState['WARNING']?.length ?? 0, ok: byState['OK']?.length ?? 0, unknown: byState['UNKNOWN']?.length ?? 0 } };
    }

    if (format === 'compact') {
      const lines: string[] = [
        `Alerts for Cluster: ${clusterName}`,
        '='.repeat(70),
        'State     | Service     | Host                    | Definition',
        '-'.repeat(70)
      ];

      for (const state of ['CRITICAL', 'WARNING', 'UNKNOWN', 'OK']) {
        for (const alert of byState[state] ?? []) {
          const a = alert.Alert ?? {};
          const stateStr = (state).padEnd(9);
          const service = (a.service_name ?? 'N/A').substring(0, 11).padEnd(11);
          const host = (a.host_name ?? 'N/A').substring(0, 23).padEnd(23);
          const def = (a.definition_name ?? 'Unknown').substring(0, 30);
          lines.push(`${stateStr} | ${service} | ${host} | ${def}`);
        }
      }

      return { summary: lines.join('\n'), total: alerts.length };
    }

    // Detailed format
    const lines: string[] = [
      `Current Alerts for Cluster: ${clusterName}`,
      '='.repeat(60),
      `Total: ${alerts.length} alerts`,
      ''
    ];

    let idx = 1;
    for (const state of ['CRITICAL', 'WARNING', 'UNKNOWN', 'OK']) {
      const stateAlerts = byState[state] ?? [];
      if (stateAlerts.length === 0) continue;

      lines.push(`=== ${state} ALERTS (${stateAlerts.length}) ===`);
      lines.push('');

      for (const alert of stateAlerts) {
        const a = alert.Alert ?? {};
        lines.push(`[${idx}] ${a.definition_name ?? 'Unknown'}`);
        lines.push(`    State: ${a.state ?? 'Unknown'}`);
        lines.push(`    Service: ${a.service_name ?? 'N/A'}`);
        lines.push(`    Component: ${a.component_name ?? 'N/A'}`);
        lines.push(`    Host: ${a.host_name ?? 'N/A'}`);
        lines.push(`    Maintenance: ${a.maintenance_state ?? 'OFF'}`);
        lines.push(`    Last Update: ${formatTimestamp(a.latest_timestamp)}`);
        if (a.text) {
          const text = a.text.length > 100 ? a.text.substring(0, 97) + '...' : a.text;
          lines.push(`    Text: ${text}`);
        }
        lines.push('');
        idx++;
      }
    }

    return {
      summary: lines.join('\n'),
      counts: {
        critical: byState['CRITICAL']?.length ?? 0,
        warning: byState['WARNING']?.length ?? 0,
        ok: byState['OK']?.length ?? 0,
        unknown: byState['UNKNOWN']?.length ?? 0
      },
      data: byState
    };
  },

  ambari_alerts_getsummary: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const excludeMaintenance = args['excludeMaintenance'] as boolean;

    const params: Record<string, unknown> = {
      format: 'groupedSummary',
      _: Date.now()
    };

    if (excludeMaintenance) {
      params['Alert/maintenance_state.in'] = 'OFF';
    }

    const data = await ambariGet(`/clusters/${clusterName}/alerts`, params) as {
      alerts_summary?: Record<string, { count?: number; maintenance_count?: number }>;
      alerts_summary_grouped?: Array<{
        definition_id?: number;
        definition_name?: string;
        summary?: Record<string, { count?: number }>;
      }>;
    };

    const summary = data.alerts_summary ?? {};
    const grouped = data.alerts_summary_grouped ?? [];

    const lines: string[] = [
      `Alert Summary for Cluster: ${clusterName}`,
      '='.repeat(50),
      ''
    ];

    let total = 0;
    for (const state of ['CRITICAL', 'WARNING', 'OK', 'UNKNOWN']) {
      const info = summary[state] ?? {};
      const count = info.count ?? 0;
      const maintenance = info.maintenance_count ?? 0;
      total += count;
      lines.push(`${state}: ${count}${maintenance > 0 ? ` (${maintenance} in maintenance)` : ''}`);
    }

    lines.push('');
    lines.push(`Total Alerts: ${total}`);

    if (grouped.length > 0) {
      lines.push('');
      lines.push('Top Alert Definitions:');
      for (const group of grouped.slice(0, 10)) {
        const defName = group.definition_name ?? 'Unknown';
        const groupSummary = group.summary ?? {};
        const counts: string[] = [];
        for (const state of ['CRITICAL', 'WARNING', 'OK', 'UNKNOWN']) {
          const cnt = groupSummary[state]?.count ?? 0;
          if (cnt > 0) counts.push(`${state}: ${cnt}`);
        }
        if (counts.length > 0) {
          lines.push(`  ${defName}: ${counts.join(', ')}`);
        }
      }
    }

    return {
      summary: lines.join('\n'),
      data: { summary, grouped }
    };
  },

  ambari_alerts_gethistory: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const limit = (args['limit'] as number) || 100;

    const params: Record<string, unknown> = {
      fields: '*',
      sortBy: 'AlertHistory/timestamp.desc',
      page_size: limit,
      _: Date.now()
    };

    if (args['state']) params['AlertHistory/state'] = args['state'];
    if (args['serviceName']) params['AlertHistory/service_name'] = args['serviceName'];
    if (args['hostName']) params['AlertHistory/host_name'] = args['hostName'];
    if (args['fromTimestamp']) params['AlertHistory/timestamp>='] = args['fromTimestamp'];
    if (args['toTimestamp']) params['AlertHistory/timestamp<='] = args['toTimestamp'];

    const data = await ambariGet(`/clusters/${clusterName}/alert_history`, params) as { items?: AlertHistoryItem[] };
    const history = data.items ?? [];

    const lines: string[] = [
      `Alert History for Cluster: ${clusterName}`,
      '='.repeat(70),
      `Showing: ${history.length} entries`,
      '',
      'Timestamp                  | State     | Service     | Definition',
      '-'.repeat(70)
    ];

    for (const entry of history) {
      const h = entry.AlertHistory ?? {};
      const ts = formatTimestamp(h.timestamp).split(' (')[1]?.replace(')', '') ?? '';
      const state = (h.state ?? 'UNKNOWN').padEnd(9);
      const service = (h.service_name ?? 'N/A').substring(0, 11).padEnd(11);
      const def = (h.definition_name ?? 'Unknown').substring(0, 35);
      lines.push(`${ts} | ${state} | ${service} | ${def}`);
    }

    return {
      summary: lines.join('\n'),
      count: history.length,
      result: data
    };
  },

  ambari_alerts_getdefinitions: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();

    const params: Record<string, unknown> = {
      fields: '*',
      _: Date.now()
    };

    if (args['serviceName']) params['AlertDefinition/service_name'] = args['serviceName'];
    if (args['enabled'] !== undefined) params['AlertDefinition/enabled'] = args['enabled'];

    const data = await ambariGet(`/clusters/${clusterName}/alert_definitions`, params);
    return { result: data };
  },

  ambari_alerts_updatedefinition: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const definitionId = args['definitionId'] as number;

    const body: Record<string, unknown> = {};

    if (args['enabled'] !== undefined) {
      body['AlertDefinition/enabled'] = args['enabled'];
    }

    if (args['data']) {
      const additionalData = typeof args['data'] === 'string' ? JSON.parse(args['data']) : args['data'];
      Object.assign(body, additionalData);
    }

    const data = await ambariPut(`/clusters/${clusterName}/alert_definitions/${definitionId}`, body);
    return { result: data, message: `Alert definition ${definitionId} updated successfully` };
  },

  ambari_alerts_getgroups: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();

    const data = await ambariGet(`/clusters/${clusterName}/alert_groups`, {
      fields: '*',
      _: Date.now()
    });
    return { result: data };
  },

  ambari_alerts_creategroup: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const groupName = args['groupName'] as string;

    const body: { AlertGroup: { name: string; definitions?: unknown[] } } = {
      AlertGroup: { name: groupName }
    };

    if (args['definitions']) {
      const definitions = typeof args['definitions'] === 'string' 
        ? JSON.parse(args['definitions']) 
        : args['definitions'];
      body.AlertGroup.definitions = definitions;
    }

    const data = await ambariPost(`/clusters/${clusterName}/alert_groups`, body);
    return { result: data, message: `Alert group '${groupName}' created successfully` };
  },

  ambari_alerts_updategroup: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const groupId = args['groupId'] as number;
    const groupName = args['groupName'] as string;

    const body: { AlertGroup: { name: string; definitions?: unknown[] } } = {
      AlertGroup: { name: groupName }
    };

    if (args['definitions']) {
      const definitions = typeof args['definitions'] === 'string' 
        ? JSON.parse(args['definitions']) 
        : args['definitions'];
      body.AlertGroup.definitions = definitions;
    }

    const data = await ambariPut(`/clusters/${clusterName}/alert_groups/${groupId}`, body);
    return { result: data, message: `Alert group ${groupId} updated successfully` };
  },

  ambari_alerts_deletegroup: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const groupId = args['groupId'] as number;

    const data = await ambariDelete(`/clusters/${clusterName}/alert_groups/${groupId}`);
    return { result: data, message: `Alert group ${groupId} deleted successfully` };
  },

  ambari_alerts_gettargets: async () => {
    const data = await ambariGet('/alert_targets', {
      fields: '*',
      _: Date.now()
    });
    return { result: data };
  },

  ambari_alerts_createtarget: async (args) => {
    const notificationData = typeof args['notificationData'] === 'string'
      ? JSON.parse(args['notificationData'])
      : args['notificationData'];

    const data = await ambariPost('/alert_targets', notificationData);
    return { result: data, message: 'Alert notification target created successfully' };
  },

  ambari_alerts_updatetarget: async (args) => {
    const targetId = args['targetId'] as number;
    const notificationData = typeof args['notificationData'] === 'string'
      ? JSON.parse(args['notificationData'])
      : args['notificationData'];

    const data = await ambariPut(`/alert_targets/${targetId}`, notificationData);
    return { result: data, message: `Alert notification target ${targetId} updated successfully` };
  },

  ambari_alerts_deletetarget: async (args) => {
    const targetId = args['targetId'] as number;

    const data = await ambariDelete(`/alert_targets/${targetId}`);
    return { result: data, message: `Alert notification target ${targetId} deleted successfully` };
  }
};

