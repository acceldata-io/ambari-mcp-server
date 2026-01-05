/**
 * Request/Operation Tracking Tools for Ambari MCP Server
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
export declare const REQUEST_TOOLS: Tool[];
export declare const requestToolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>>;
//# sourceMappingURL=request-tools.d.ts.map