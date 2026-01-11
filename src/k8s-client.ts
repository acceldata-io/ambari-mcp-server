/**
 * Kubernetes Client - Execute commands in pods via kubectl exec
 */

import { spawn } from 'child_process';
import { getK8sConfig } from './config.js';
import type { K8sCommandResult, K8sPodInfo } from './types.js';

/**
 * Execute a command in a Kubernetes pod via kubectl exec
 */
export async function executeInPod(
  podName: string,
  command: string,
  options: {
    namespace?: string;
    containerName?: string;
    timeout?: number;
    kubeconfigPath?: string;
  } = {}
): Promise<K8sCommandResult> {
  const k8sConfig = getK8sConfig();
  
  const namespace = options.namespace || k8sConfig.namespace;
  const containerName = options.containerName || k8sConfig.containerName;
  const timeout = options.timeout || k8sConfig.timeout;
  const kubeconfigPath = options.kubeconfigPath || k8sConfig.kubeconfigPath;
  
  return new Promise((resolve) => {
    const args: string[] = [];
    
    // Add kubeconfig if specified
    if (kubeconfigPath) {
      args.push('--kubeconfig', kubeconfigPath);
    }
    
    // Add namespace
    args.push('-n', namespace);
    
    // Add exec command
    args.push('exec', podName);
    
    // Add container name if specified
    if (containerName) {
      args.push('-c', containerName);
    }
    
    // Add the command to execute
    args.push('--', 'sh', '-c', command);
    
    let stdout = '';
    let stderr = '';
    let resolved = false;
    
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill('SIGTERM');
        resolve({
          pod: podName,
          success: false,
          stdout,
          stderr,
          exitCode: null,
          error: `Command timed out after ${timeout}ms`,
        });
      }
    }, timeout);
    
    const proc = spawn('kubectl', args);
    
    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code: number | null) => {
      clearTimeout(timeoutId);
      if (!resolved) {
        resolved = true;
        resolve({
          pod: podName,
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code,
        });
      }
    });
    
    proc.on('error', (err: Error) => {
      clearTimeout(timeoutId);
      if (!resolved) {
        resolved = true;
        resolve({
          pod: podName,
          success: false,
          stdout: '',
          stderr: '',
          exitCode: null,
          error: `Failed to execute kubectl: ${err.message}. Is kubectl installed and in PATH?`,
        });
      }
    });
  });
}

/**
 * Execute a command in multiple pods in parallel
 */
export async function executeInPods(
  podNames: string[],
  command: string,
  options: {
    namespace?: string;
    containerName?: string;
    timeout?: number;
    kubeconfigPath?: string;
    concurrency?: number;
  } = {}
): Promise<K8sCommandResult[]> {
  const concurrency = options.concurrency || 5;
  const results: K8sCommandResult[] = [];
  
  // Process pods in batches
  for (let i = 0; i < podNames.length; i += concurrency) {
    const batch = podNames.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(pod => executeInPod(pod, command, options))
    );
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Get list of pods matching the configured label selector
 */
export async function getAmbariPods(options: {
  namespace?: string;
  labelSelector?: string;
  kubeconfigPath?: string;
} = {}): Promise<K8sPodInfo[]> {
  const k8sConfig = getK8sConfig();
  
  const namespace = options.namespace || k8sConfig.namespace;
  const labelSelector = options.labelSelector || k8sConfig.podLabelSelector;
  const kubeconfigPath = options.kubeconfigPath || k8sConfig.kubeconfigPath;
  
  if (!labelSelector) {
    return [];
  }
  
  return new Promise((resolve) => {
    const args: string[] = [];
    
    if (kubeconfigPath) {
      args.push('--kubeconfig', kubeconfigPath);
    }
    
    args.push('-n', namespace);
    args.push('get', 'pods');
    args.push('-l', labelSelector);
    args.push('-o', 'json');
    
    let stdout = '';
    let stderr = '';
    
    const proc = spawn('kubectl', args);
    
    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code: number | null) => {
      if (code !== 0) {
        console.error(`[k8s] Failed to get pods: ${stderr}`);
        resolve([]);
        return;
      }
      
      try {
        const response = JSON.parse(stdout);
        const pods: K8sPodInfo[] = [];
        
        for (const item of response.items || []) {
          const metadata = item.metadata || {};
          const spec = item.spec || {};
          const status = item.status || {};
          
          // Check if pod is ready
          const conditions = status.conditions || [];
          const readyCondition = conditions.find((c: { type: string }) => c.type === 'Ready');
          const isReady = readyCondition?.status === 'True';
          
          // Get container names
          const containers = (spec.containers || []).map((c: { name: string }) => c.name);
          
          pods.push({
            name: metadata.name,
            namespace: metadata.namespace,
            nodeName: spec.nodeName || '',
            status: status.phase || 'Unknown',
            ready: isReady,
            containers,
            hostIP: status.hostIP || '',
            podIP: status.podIP || '',
          });
        }
        
        resolve(pods);
      } catch (err) {
        console.error(`[k8s] Failed to parse pod list: ${err}`);
        resolve([]);
      }
    });
    
    proc.on('error', (err: Error) => {
      console.error(`[k8s] Failed to execute kubectl: ${err.message}`);
      resolve([]);
    });
  });
}

/**
 * Check if Kubernetes mode is configured
 */
export function isK8sConfigured(): boolean {
  const k8sConfig = getK8sConfig();
  return k8sConfig.enabled;
}

/**
 * Get Kubernetes configuration status for display
 */
export function getK8sStatus(): {
  enabled: boolean;
  namespace: string;
  podLabelSelector: string;
  containerName: string;
  kubeconfigPath: string;
} {
  const config = getK8sConfig();
  return {
    enabled: config.enabled,
    namespace: config.namespace,
    podLabelSelector: config.podLabelSelector,
    containerName: config.containerName,
    kubeconfigPath: config.kubeconfigPath,
  };
}

/**
 * Check if kubectl is available in PATH
 */
export async function isKubectlAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('kubectl', ['version', '--client', '-o', 'json']);
    
    proc.on('close', (code: number | null) => {
      resolve(code === 0);
    });
    
    proc.on('error', () => {
      resolve(false);
    });
  });
}
