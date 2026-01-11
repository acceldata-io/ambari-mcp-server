/**
 * Kubernetes Client - Execute commands in pods via kubectl exec
 */
import type { K8sCommandResult, K8sPodInfo } from './types.js';
/**
 * Execute a command in a Kubernetes pod via kubectl exec
 */
export declare function executeInPod(podName: string, command: string, options?: {
    namespace?: string;
    containerName?: string;
    timeout?: number;
    kubeconfigPath?: string;
}): Promise<K8sCommandResult>;
/**
 * Execute a command in multiple pods in parallel
 */
export declare function executeInPods(podNames: string[], command: string, options?: {
    namespace?: string;
    containerName?: string;
    timeout?: number;
    kubeconfigPath?: string;
    concurrency?: number;
}): Promise<K8sCommandResult[]>;
/**
 * Get list of pods matching the configured label selector
 */
export declare function getAmbariPods(options?: {
    namespace?: string;
    labelSelector?: string;
    kubeconfigPath?: string;
}): Promise<K8sPodInfo[]>;
/**
 * Check if Kubernetes mode is configured
 */
export declare function isK8sConfigured(): boolean;
/**
 * Get Kubernetes configuration status for display
 */
export declare function getK8sStatus(): {
    enabled: boolean;
    namespace: string;
    podLabelSelector: string;
    containerName: string;
    kubeconfigPath: string;
};
/**
 * Check if kubectl is available in PATH
 */
export declare function isKubectlAvailable(): Promise<boolean>;
//# sourceMappingURL=k8s-client.d.ts.map