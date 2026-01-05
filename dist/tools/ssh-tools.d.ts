/**
 * SSH Tools - Execute commands on cluster hosts via SSH
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
export declare const SSH_TOOLS: Tool[];
export declare const sshToolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>>;
//# sourceMappingURL=ssh-tools.d.ts.map