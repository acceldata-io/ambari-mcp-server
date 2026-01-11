/**
 * Kubernetes Tools - Execute commands in Ambari pods running on Kubernetes
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import {
  executeInPod,
  executeInPods,
  getAmbariPods,
  isK8sConfigured,
  getK8sStatus,
  isKubectlAvailable,
} from '../k8s-client.js';
import { ambariGet, getClusterName } from '../api-client.js';
import type { K8sPodInfo } from '../types.js';

// ============================================================================
// Tool Definitions
// ============================================================================

export const K8S_TOOLS: Tool[] = [
  {
    name: 'ambari_k8s_status',
    description: 'Check if Kubernetes mode is configured and show K8s connection settings. Also verifies kubectl availability.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'ambari_k8s_list_pods',
    description: 'List all Ambari pods running in the Kubernetes cluster that match the configured label selector.',
    inputSchema: {
      type: 'object',
      properties: {
        labelSelector: {
          type: 'string',
          description: 'Override the default pod label selector (e.g., "app=ambari-agent")',
        },
        namespace: {
          type: 'string',
          description: 'Override the default namespace',
        },
      },
      required: [],
    },
  },
  {
    name: 'ambari_k8s_restart_agent',
    description: 'Restart the Ambari agent in one or more Kubernetes pods. If no pods specified, restarts in all matching pods.',
    inputSchema: {
      type: 'object',
      properties: {
        pods: {
          type: 'string',
          description: 'Comma-separated list of pod names to restart agent in. If empty, restarts in all matching pods.',
        },
        namespace: {
          type: 'string',
          description: 'Override the default namespace',
        },
      },
      required: [],
    },
  },
  {
    name: 'ambari_k8s_run_command',
    description: 'Execute a shell command in one or more Ambari Kubernetes pods',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute in the pod(s)',
        },
        pods: {
          type: 'string',
          description: 'Comma-separated list of pod names. If empty, runs on all matching pods.',
        },
        namespace: {
          type: 'string',
          description: 'Override the default namespace',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'ambari_k8s_check_agent_status',
    description: 'Check the status of Ambari agent in one or more Kubernetes pods',
    inputSchema: {
      type: 'object',
      properties: {
        pods: {
          type: 'string',
          description: 'Comma-separated list of pod names. If empty, checks all matching pods.',
        },
        namespace: {
          type: 'string',
          description: 'Override the default namespace',
        },
      },
      required: [],
    },
  },
  {
    name: 'ambari_k8s_restart_agent_and_wait',
    description: 'Restart the Ambari agent in Kubernetes pods and wait for them to re-register with the server',
    inputSchema: {
      type: 'object',
      properties: {
        pods: {
          type: 'string',
          description: 'Comma-separated list of pod names. If empty, restarts in all matching pods.',
        },
        waitTimeSeconds: {
          type: 'number',
          description: 'Maximum time to wait for agents to re-register (default: 60)',
          default: 60,
        },
        namespace: {
          type: 'string',
          description: 'Override the default namespace',
        },
      },
      required: [],
    },
  },
  {
    name: 'ambari_k8s_get_pod_logs',
    description: 'Get logs from an Ambari Kubernetes pod',
    inputSchema: {
      type: 'object',
      properties: {
        pod: {
          type: 'string',
          description: 'The pod name to get logs from',
        },
        tailLines: {
          type: 'number',
          description: 'Number of lines to tail from the end (default: 100)',
          default: 100,
        },
        containerName: {
          type: 'string',
          description: 'Container name if the pod has multiple containers',
        },
        namespace: {
          type: 'string',
          description: 'Override the default namespace',
        },
      },
      required: ['pod'],
    },
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get pod names from comma-separated list or get all matching pods
 */
async function resolvePods(podsArg?: string, namespace?: string): Promise<string[]> {
  if (podsArg && podsArg.trim()) {
    return podsArg.split(',').map(p => p.trim()).filter(p => p);
  }
  
  const pods = await getAmbariPods({ namespace });
  return pods.filter(p => p.ready && p.status === 'Running').map(p => p.name);
}

/**
 * Get pod to hostname mapping by checking hostnames inside pods
 */
async function getPodHostnameMap(pods: K8sPodInfo[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  
  const results = await executeInPods(
    pods.map(p => p.name),
    'hostname -f 2>/dev/null || hostname',
    { concurrency: 10 }
  );
  
  for (const result of results) {
    if (result.success && result.stdout) {
      map[result.pod] = result.stdout.trim();
    }
  }
  
  return map;
}

/**
 * Format results for display
 */
function formatResults(results: Array<{ pod: string; success: boolean; stdout: string; stderr: string; exitCode: number | null; error?: string }>): string {
  const lines: string[] = [];
  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  lines.push(`Results: ${succeeded.length} succeeded, ${failed.length} failed out of ${results.length} pods\n`);
  
  for (const result of results) {
    lines.push(`━━━ ${result.pod} ━━━`);
    lines.push(`Status: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`);
    if (result.exitCode !== null) {
      lines.push(`Exit Code: ${result.exitCode}`);
    }
    if (result.stdout) {
      lines.push(`Output:\n${result.stdout}`);
    }
    if (result.stderr) {
      lines.push(`Stderr:\n${result.stderr}`);
    }
    if (result.error) {
      lines.push(`Error: ${result.error}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

// ============================================================================
// Tool Executors
// ============================================================================

export const k8sToolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  
  ambari_k8s_status: async () => {
    const status = getK8sStatus();
    const kubectlAvailable = await isKubectlAvailable();
    
    let message: string;
    if (!status.enabled) {
      message = 'Kubernetes mode is not configured. Set K8S_POD_LABEL_SELECTOR in your .env file to enable K8s features.';
    } else if (!kubectlAvailable) {
      message = 'Kubernetes mode is configured but kubectl is not available in PATH. Please install kubectl.';
    } else {
      message = `Kubernetes mode is configured. Namespace: ${status.namespace}, Label Selector: ${status.podLabelSelector}`;
    }
    
    return {
      k8s_configured: status.enabled,
      kubectl_available: kubectlAvailable,
      namespace: status.namespace,
      pod_label_selector: status.podLabelSelector || '(not configured)',
      container_name: status.containerName || '(use default)',
      kubeconfig_path: status.kubeconfigPath || '(use default)',
      message,
    };
  },
  
  ambari_k8s_list_pods: async (args) => {
    if (!isK8sConfigured()) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Kubernetes mode is not configured. Please set K8S_POD_LABEL_SELECTOR in your .env file.'
      );
    }
    
    const labelSelector = args['labelSelector'] as string | undefined;
    const namespace = args['namespace'] as string | undefined;
    
    const pods = await getAmbariPods({ namespace, labelSelector });
    
    if (pods.length === 0) {
      return {
        summary: 'No pods found matching the label selector',
        pods: [],
      };
    }
    
    // Get hostnames for each pod
    const hostnameMap = await getPodHostnameMap(pods);
    
    const podDetails = pods.map(pod => ({
      name: pod.name,
      namespace: pod.namespace,
      node: pod.nodeName,
      status: pod.status,
      ready: pod.ready,
      hostname: hostnameMap[pod.name] || '(unknown)',
      podIP: pod.podIP,
      hostIP: pod.hostIP,
      containers: pod.containers,
    }));
    
    return {
      summary: `Found ${pods.length} pods matching the label selector`,
      total_pods: pods.length,
      running_pods: pods.filter(p => p.status === 'Running').length,
      ready_pods: pods.filter(p => p.ready).length,
      pods: podDetails,
    };
  },
  
  ambari_k8s_restart_agent: async (args) => {
    if (!isK8sConfigured()) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Kubernetes mode is not configured. Please set K8S_POD_LABEL_SELECTOR in your .env file.'
      );
    }
    
    const podsArg = args['pods'] as string | undefined;
    const namespace = args['namespace'] as string | undefined;
    const pods = await resolvePods(podsArg, namespace);
    
    if (pods.length === 0) {
      throw new McpError(ErrorCode.InvalidRequest, 'No pods found to restart agent in.');
    }
    
    // Restart command for Ambari agent
    const command = 'ambari-agent restart 2>&1 || (ambari-agent stop; sleep 2; ambari-agent start)';
    
    console.error(`[k8s] Restarting Ambari agent in ${pods.length} pods...`);
    
    const results = await executeInPods(pods, command, { namespace });
    
    return {
      summary: `Ambari agent restart initiated in ${pods.length} pods`,
      pods_count: pods.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: formatResults(results),
    };
  },
  
  ambari_k8s_run_command: async (args) => {
    if (!isK8sConfigured()) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Kubernetes mode is not configured. Please set K8S_POD_LABEL_SELECTOR in your .env file.'
      );
    }
    
    const commandArg = args['command'] as string;
    if (!commandArg || !commandArg.trim()) {
      throw new McpError(ErrorCode.InvalidParams, 'command parameter is required');
    }
    
    const podsArg = args['pods'] as string | undefined;
    const namespace = args['namespace'] as string | undefined;
    const pods = await resolvePods(podsArg, namespace);
    
    if (pods.length === 0) {
      throw new McpError(ErrorCode.InvalidRequest, 'No pods found to run command in.');
    }
    
    console.error(`[k8s] Running command in ${pods.length} pods: ${commandArg}`);
    
    const results = await executeInPods(pods, commandArg, { namespace });
    
    return {
      summary: `Command executed in ${pods.length} pods`,
      command: commandArg,
      pods_count: pods.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: formatResults(results),
    };
  },
  
  ambari_k8s_check_agent_status: async (args) => {
    if (!isK8sConfigured()) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Kubernetes mode is not configured. Please set K8S_POD_LABEL_SELECTOR in your .env file.'
      );
    }
    
    const podsArg = args['pods'] as string | undefined;
    const namespace = args['namespace'] as string | undefined;
    const pods = await resolvePods(podsArg, namespace);
    
    if (pods.length === 0) {
      throw new McpError(ErrorCode.InvalidRequest, 'No pods found to check.');
    }
    
    // Check agent status
    const command = 'ambari-agent status 2>/dev/null || echo "Status unknown"';
    
    console.error(`[k8s] Checking Ambari agent status in ${pods.length} pods...`);
    
    const results = await executeInPods(pods, command, { namespace });
    
    // Parse results to determine status
    const podStatuses = results.map(r => {
      let status = 'unknown';
      if (r.success) {
        const output = r.stdout.toLowerCase();
        if (output.includes('running') || output.includes('active')) {
          status = 'running';
        } else if (output.includes('stopped') || output.includes('inactive') || output.includes('dead')) {
          status = 'stopped';
        }
      } else {
        status = r.error || 'exec failed';
      }
      return {
        pod: r.pod,
        status,
        raw_output: r.stdout || r.stderr || r.error,
      };
    });
    
    const running = podStatuses.filter(p => p.status === 'running').length;
    const stopped = podStatuses.filter(p => p.status === 'stopped').length;
    const unknown = podStatuses.filter(p => p.status !== 'running' && p.status !== 'stopped').length;
    
    return {
      summary: `Agent status: ${running} running, ${stopped} stopped, ${unknown} unknown`,
      total_pods: pods.length,
      running,
      stopped,
      unknown,
      pods: podStatuses,
    };
  },
  
  ambari_k8s_restart_agent_and_wait: async (args) => {
    if (!isK8sConfigured()) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Kubernetes mode is not configured. Please set K8S_POD_LABEL_SELECTOR in your .env file.'
      );
    }
    
    const podsArg = args['pods'] as string | undefined;
    const namespace = args['namespace'] as string | undefined;
    const waitTimeSeconds = (args['waitTimeSeconds'] as number) || 60;
    const podNames = await resolvePods(podsArg, namespace);
    
    if (podNames.length === 0) {
      throw new McpError(ErrorCode.InvalidRequest, 'No pods found.');
    }
    
    const clusterName = await getClusterName();
    
    // Get pod to hostname mapping
    const pods = await getAmbariPods({ namespace });
    const hostnameMap = await getPodHostnameMap(pods);
    
    // Step 1: Get current heartbeat times for hosts
    console.error(`[k8s] Recording current heartbeat times for ${podNames.length} pods...`);
    const beforeHeartbeats: Record<string, number> = {};
    
    for (const podName of podNames) {
      const hostname = hostnameMap[podName];
      if (hostname) {
        try {
          const hostInfo = await ambariGet(`/clusters/${clusterName}/hosts/${hostname}`, {
            fields: 'Hosts/last_heartbeat_time',
          }) as { Hosts?: { last_heartbeat_time?: number } };
          beforeHeartbeats[podName] = hostInfo.Hosts?.last_heartbeat_time ?? 0;
        } catch {
          beforeHeartbeats[podName] = 0;
        }
      }
    }
    
    // Step 2: Restart agents
    console.error(`[k8s] Restarting Ambari agent in ${podNames.length} pods...`);
    const restartCommand = 'ambari-agent restart 2>&1 || (ambari-agent stop; sleep 2; ambari-agent start)';
    const restartResults = await executeInPods(podNames, restartCommand, { namespace });
    
    const restartedPods = restartResults.filter(r => r.success).map(r => r.pod);
    const failedRestarts = restartResults.filter(r => !r.success);
    
    if (restartedPods.length === 0) {
      return {
        summary: 'Failed to restart agent in any pod',
        restart_results: formatResults(restartResults),
      };
    }
    
    // Step 3: Wait for agents to re-register
    console.error(`[k8s] Waiting up to ${waitTimeSeconds}s for ${restartedPods.length} agents to re-register...`);
    
    const startTime = Date.now();
    const endTime = startTime + (waitTimeSeconds * 1000);
    const reregistered: string[] = [];
    const pending = new Set(restartedPods);
    
    while (pending.size > 0 && Date.now() < endTime) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
      
      for (const podName of Array.from(pending)) {
        const hostname = hostnameMap[podName];
        if (!hostname) continue;
        
        try {
          const hostInfo = await ambariGet(`/clusters/${clusterName}/hosts/${hostname}`, {
            fields: 'Hosts/last_heartbeat_time,Hosts/host_status',
          }) as { Hosts?: { last_heartbeat_time?: number; host_status?: string } };
          
          const newHeartbeat = hostInfo.Hosts?.last_heartbeat_time ?? 0;
          const oldHeartbeat = beforeHeartbeats[podName] ?? 0;
          const status = hostInfo.Hosts?.host_status;
          
          // Consider re-registered if heartbeat is newer and status is HEALTHY
          if (newHeartbeat > oldHeartbeat && status === 'HEALTHY') {
            reregistered.push(podName);
            pending.delete(podName);
            console.error(`[k8s] Agent re-registered: ${podName} (${hostname})`);
          }
        } catch {
          // Continue waiting
        }
      }
    }
    
    const waitedSeconds = Math.round((Date.now() - startTime) / 1000);
    
    return {
      summary: `${reregistered.length}/${restartedPods.length} agents re-registered after restart (waited ${waitedSeconds}s)`,
      total_pods: podNames.length,
      restart_succeeded: restartedPods.length,
      restart_failed: failedRestarts.length,
      reregistered: reregistered.length,
      still_pending: Array.from(pending),
      reregistered_pods: reregistered,
      failed_restart_pods: failedRestarts.map(r => ({ pod: r.pod, error: r.error || r.stderr })),
      wait_time_seconds: waitedSeconds,
    };
  },
  
  ambari_k8s_get_pod_logs: async (args) => {
    if (!isK8sConfigured()) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Kubernetes mode is not configured. Please set K8S_POD_LABEL_SELECTOR in your .env file.'
      );
    }
    
    const podName = args['pod'] as string;
    if (!podName || !podName.trim()) {
      throw new McpError(ErrorCode.InvalidParams, 'pod parameter is required');
    }
    
    const tailLines = (args['tailLines'] as number) || 100;
    const containerName = args['containerName'] as string | undefined;
    const namespace = args['namespace'] as string | undefined;
    
    // Get Ambari agent logs
    const command = `tail -n ${tailLines} /var/log/ambari-agent/ambari-agent.log 2>/dev/null || cat /var/log/ambari-agent/ambari-agent.log 2>/dev/null | tail -n ${tailLines}`;
    
    console.error(`[k8s] Getting logs from pod ${podName}...`);
    
    const result = await executeInPod(podName, command, { namespace, containerName });
    
    if (!result.success) {
      return {
        summary: `Failed to get logs from pod ${podName}`,
        error: result.error || result.stderr,
      };
    }
    
    return {
      summary: `Retrieved last ${tailLines} lines of logs from pod ${podName}`,
      pod: podName,
      lines_requested: tailLines,
      logs: result.stdout,
    };
  },
};
