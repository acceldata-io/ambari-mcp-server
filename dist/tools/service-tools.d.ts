/**
 * Service Management Tools for Ambari MCP Server
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
export declare const SERVICE_TOOLS: Tool[];
export declare const serviceToolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>>;
//# sourceMappingURL=service-tools.d.ts.map