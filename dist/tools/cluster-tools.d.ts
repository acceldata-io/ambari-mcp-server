/**
 * Cluster Management Tools for Ambari MCP Server
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
export declare const CLUSTER_TOOLS: Tool[];
export declare const clusterToolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>>;
//# sourceMappingURL=cluster-tools.d.ts.map