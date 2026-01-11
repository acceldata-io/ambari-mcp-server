/**
 * Kubernetes Tools - Execute commands in Ambari pods running on Kubernetes
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
export declare const K8S_TOOLS: Tool[];
export declare const k8sToolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>>;
//# sourceMappingURL=k8s-tools.d.ts.map