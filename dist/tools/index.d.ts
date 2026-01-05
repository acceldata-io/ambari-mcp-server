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
/**
 * All available MCP tools
 */
export declare const ALL_TOOLS: Tool[];
/**
 * Combined tool executors map
 */
export declare const allToolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>>;
//# sourceMappingURL=index.d.ts.map