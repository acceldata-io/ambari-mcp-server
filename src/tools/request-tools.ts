/**
 * Request/Operation Tracking Tools for Ambari MCP Server
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ambariGet, getClusterName } from '../api-client.js';
import { formatTimestamp, REQUEST_STATUS_DESCRIPTIONS } from '../utils.js';

// ============================================================================
// Tool Definitions
// ============================================================================

export const REQUEST_TOOLS: Tool[] = [
  {
    name: 'ambari_requests_getstatus',
    description: 'Get the status and progress of a specific Ambari request/operation',
    inputSchema: {
      type: 'object',
      properties: {
        requestId: { type: 'integer', description: 'The ID of the request to check' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' }
      },
      required: ['requestId']
    }
  },
  {
    name: 'ambari_requests_getactive',
    description: 'Get all currently active (in-progress) requests/operations',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' }
      },
      required: []
    }
  },
  {
    name: 'ambari_requests_getrecent',
    description: 'Get recent requests/operations with their status',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        limit: { type: 'integer', description: 'Maximum number of requests to return', default: 20 },
        status: { type: 'string', description: 'Filter by status: COMPLETED, FAILED, IN_PROGRESS, PENDING, ABORTED' }
      },
      required: []
    }
  },
  {
    name: 'ambari_requests_gettasks',
    description: 'Get tasks/steps for a specific request',
    inputSchema: {
      type: 'object',
      properties: {
        requestId: { type: 'integer', description: 'The ID of the request' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        status: { type: 'string', description: 'Filter tasks by status' }
      },
      required: ['requestId']
    }
  }
];

// ============================================================================
// Tool Executors
// ============================================================================

interface RequestInfo {
  id?: number;
  request_status?: string;
  request_context?: string;
  progress_percent?: number;
  start_time?: number;
  end_time?: number;
  create_time?: number;
  type?: string;
  queued_task_count?: number;
  task_count?: number;
  completed_task_count?: number;
  failed_task_count?: number;
  aborted_task_count?: number;
  timed_out_task_count?: number;
}

interface TaskInfo {
  id?: number;
  host_name?: string;
  role?: string;
  command?: string;
  status?: string;
  start_time?: number;
  end_time?: number;
  attempt_cnt?: number;
  stderr?: string;
  stdout?: string;
}

export const requestToolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {

  ambari_requests_getstatus: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const requestId = args['requestId'] as number;

    const data = await ambariGet(`/clusters/${clusterName}/requests/${requestId}`, {
      fields: 'Requests/*'
    }) as {
      Requests?: RequestInfo;
    };

    const request = data.Requests ?? {};
    const status = request.request_status ?? 'Unknown';
    const statusDescription = REQUEST_STATUS_DESCRIPTIONS[status] ?? '';

    const lines: string[] = [
      `REQUEST STATUS: ${requestId}`,
      '='.repeat(50),
      `Cluster: ${clusterName}`,
      `Request ID: ${request.id ?? requestId}`,
      `Status: ${status}`,
      `Progress: ${request.progress_percent ?? 0}%`,
      `Context: ${request.request_context ?? 'No context'}`,
      ''
    ];

    if (statusDescription) {
      lines.push(`Description: ${statusDescription}`);
      lines.push('');
    }

    lines.push('Timing:');
    if (request.create_time) lines.push(`  Created: ${formatTimestamp(request.create_time)}`);
    if (request.start_time) lines.push(`  Started: ${formatTimestamp(request.start_time)}`);
    if (request.end_time) lines.push(`  Ended: ${formatTimestamp(request.end_time)}`);

    if (request.task_count) {
      lines.push('');
      lines.push('Task Summary:');
      lines.push(`  Total Tasks: ${request.task_count}`);
      lines.push(`  Completed: ${request.completed_task_count ?? 0}`);
      lines.push(`  Failed: ${request.failed_task_count ?? 0}`);
      lines.push(`  Aborted: ${request.aborted_task_count ?? 0}`);
      lines.push(`  Timed Out: ${request.timed_out_task_count ?? 0}`);
      lines.push(`  Queued: ${request.queued_task_count ?? 0}`);
    }

    return {
      summary: lines.join('\n'),
      request: {
        id: request.id,
        status,
        progress: request.progress_percent,
        context: request.request_context,
        taskSummary: {
          total: request.task_count,
          completed: request.completed_task_count,
          failed: request.failed_task_count,
          aborted: request.aborted_task_count
        }
      }
    };
  },

  ambari_requests_getactive: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();

    // Try to get only in-progress requests
    let data = await ambariGet(`/clusters/${clusterName}/requests`, {
      fields: 'Requests/id,Requests/request_status,Requests/request_context,Requests/progress_percent,Requests/start_time',
      'Requests/request_status': 'IN_PROGRESS',
      sortBy: 'Requests/id.desc'
    }) as {
      items?: Array<{ Requests?: RequestInfo }>;
    };

    let requests = data.items ?? [];

    // If specific filter doesn't work, get all and filter manually
    if (requests.length === 0) {
      data = await ambariGet(`/clusters/${clusterName}/requests`, {
        fields: 'Requests/id,Requests/request_status,Requests/request_context,Requests/progress_percent,Requests/start_time',
        sortBy: 'Requests/id.desc',
        page_size: 50
      }) as {
        items?: Array<{ Requests?: RequestInfo }>;
      };

      requests = (data.items ?? []).filter(r => {
        const status = r.Requests?.request_status ?? '';
        return ['IN_PROGRESS', 'PENDING', 'QUEUED'].includes(status);
      });
    }

    if (requests.length === 0) {
      return {
        summary: `No active requests in cluster '${clusterName}'.\nAll operations have completed.`,
        count: 0,
        requests: []
      };
    }

    const lines: string[] = [
      `Active Requests for Cluster: ${clusterName}`,
      '='.repeat(60),
      `Active Operations: ${requests.length}`,
      ''
    ];

    for (let i = 0; i < requests.length; i++) {
      const req = requests[i]?.Requests ?? {};
      lines.push(`${i + 1}. Request ID: ${req.id ?? 'Unknown'}`);
      lines.push(`   Status: ${req.request_status ?? 'Unknown'}`);
      lines.push(`   Progress: ${req.progress_percent ?? 0}%`);
      lines.push(`   Context: ${req.request_context ?? 'No context'}`);
      lines.push(`   Started: ${formatTimestamp(req.start_time)}`);
      lines.push('');
    }

    lines.push('Tip: Use ambari_requests_getstatus(requestId) for detailed progress.');

    return {
      summary: lines.join('\n'),
      count: requests.length,
      requests: requests.map(r => r.Requests)
    };
  },

  ambari_requests_getrecent: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const limit = (args['limit'] as number) ?? 20;
    const status = args['status'] as string | undefined;

    const params: Record<string, unknown> = {
      fields: 'Requests/id,Requests/request_status,Requests/request_context,Requests/progress_percent,Requests/start_time,Requests/end_time',
      sortBy: 'Requests/id.desc',
      page_size: limit
    };

    if (status) {
      params['Requests/request_status'] = status;
    }

    const data = await ambariGet(`/clusters/${clusterName}/requests`, params) as {
      items?: Array<{ Requests?: RequestInfo }>;
    };

    const requests = data.items ?? [];

    const lines: string[] = [
      `Recent Requests for Cluster: ${clusterName}`,
      '='.repeat(70),
      `Showing: ${requests.length} requests${status ? ` (filtered by ${status})` : ''}`,
      '',
      'ID       | Status       | Progress | Context',
      '-'.repeat(70)
    ];

    for (const item of requests) {
      const req = item.Requests ?? {};
      const id = String(req.id ?? '?').padEnd(8);
      const st = (req.request_status ?? 'Unknown').padEnd(12);
      const progress = `${req.progress_percent ?? 0}%`.padEnd(8);
      const context = (req.request_context ?? 'No context').substring(0, 35);
      lines.push(`${id} | ${st} | ${progress} | ${context}`);
    }

    // Summary by status
    const statusCounts: Record<string, number> = {};
    for (const item of requests) {
      const st = item.Requests?.request_status ?? 'Unknown';
      statusCounts[st] = (statusCounts[st] ?? 0) + 1;
    }

    lines.push('');
    lines.push('Summary:');
    for (const [st, count] of Object.entries(statusCounts)) {
      lines.push(`  ${st}: ${count}`);
    }

    return {
      summary: lines.join('\n'),
      count: requests.length,
      statusCounts,
      requests: requests.map(r => r.Requests)
    };
  },

  ambari_requests_gettasks: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const requestId = args['requestId'] as number;
    const statusFilter = args['status'] as string | undefined;

    const params: Record<string, unknown> = {
      fields: 'Tasks/id,Tasks/host_name,Tasks/role,Tasks/command,Tasks/status,Tasks/start_time,Tasks/end_time'
    };

    if (statusFilter) {
      params['Tasks/status'] = statusFilter;
    }

    const data = await ambariGet(`/clusters/${clusterName}/requests/${requestId}/tasks`, params) as {
      items?: Array<{ Tasks?: TaskInfo }>;
    };

    const tasks = data.items ?? [];

    const lines: string[] = [
      `Tasks for Request: ${requestId}`,
      '='.repeat(70),
      `Total Tasks: ${tasks.length}${statusFilter ? ` (filtered by ${statusFilter})` : ''}`,
      '',
      'ID   | Host                    | Role           | Status',
      '-'.repeat(70)
    ];

    for (const item of tasks) {
      const task = item.Tasks ?? {};
      const id = String(task.id ?? '?').padEnd(4);
      const host = (task.host_name ?? 'N/A').substring(0, 23).padEnd(23);
      const role = (task.role ?? 'N/A').substring(0, 14).padEnd(14);
      const status = task.status ?? 'Unknown';
      lines.push(`${id} | ${host} | ${role} | ${status}`);
    }

    // Summary by status
    const statusCounts: Record<string, number> = {};
    for (const item of tasks) {
      const st = item.Tasks?.status ?? 'Unknown';
      statusCounts[st] = (statusCounts[st] ?? 0) + 1;
    }

    lines.push('');
    lines.push('Task Status Summary:');
    for (const [st, count] of Object.entries(statusCounts)) {
      lines.push(`  ${st}: ${count}`);
    }

    return {
      summary: lines.join('\n'),
      count: tasks.length,
      statusCounts,
      tasks: tasks.map(t => t.Tasks)
    };
  }
};

