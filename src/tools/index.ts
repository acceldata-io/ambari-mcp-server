/**
 * MCP Tools Index - Exports all tool definitions and executors
 */

export { CLUSTER_TOOLS, clusterToolExecutors } from './cluster-tools.js';
export { SERVICE_TOOLS, serviceToolExecutors } from './service-tools.js';
export { HOST_TOOLS, hostToolExecutors } from './host-tools.js';
export { ALERT_TOOLS, alertToolExecutors } from './alert-tools.js';
export { CONFIG_TOOLS, configToolExecutors } from './config-tools.js';
export { USER_TOOLS, userToolExecutors } from './user-tools.js';
export { REQUEST_TOOLS, requestToolExecutors } from './request-tools.js';
export { SSH_TOOLS, sshToolExecutors } from './ssh-tools.js';

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CLUSTER_TOOLS, clusterToolExecutors } from './cluster-tools.js';
import { SERVICE_TOOLS, serviceToolExecutors } from './service-tools.js';
import { HOST_TOOLS, hostToolExecutors } from './host-tools.js';
import { ALERT_TOOLS, alertToolExecutors } from './alert-tools.js';
import { CONFIG_TOOLS, configToolExecutors } from './config-tools.js';
import { USER_TOOLS, userToolExecutors } from './user-tools.js';
import { REQUEST_TOOLS, requestToolExecutors } from './request-tools.js';
import { SSH_TOOLS, sshToolExecutors } from './ssh-tools.js';

/**
 * All available MCP tools
 */
export const ALL_TOOLS: Tool[] = [
  ...CLUSTER_TOOLS,
  ...SERVICE_TOOLS,
  ...HOST_TOOLS,
  ...ALERT_TOOLS,
  ...CONFIG_TOOLS,
  ...USER_TOOLS,
  ...REQUEST_TOOLS,
  ...SSH_TOOLS,
];

/**
 * Combined tool executors map
 */
export const allToolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  ...clusterToolExecutors,
  ...serviceToolExecutors,
  ...hostToolExecutors,
  ...alertToolExecutors,
  ...configToolExecutors,
  ...userToolExecutors,
  ...requestToolExecutors,
  ...sshToolExecutors,
};

