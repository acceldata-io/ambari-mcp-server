/**
 * SSH Tools - Execute commands on cluster hosts via SSH
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { executeRemoteCommand, executeRemoteCommandOnHosts, isSshConfigured, getSshStatus } from '../ssh-client.js';
import { ambariGet, getClusterName } from '../api-client.js';

// ============================================================================
// Tool Definitions
// ============================================================================

export const SSH_TOOLS: Tool[] = [
  {
    name: 'ambari_ssh_status',
    description: 'Check if SSH is configured and show SSH connection settings',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'ambari_ssh_restart_agent',
    description: 'Restart the Ambari agent on one or more hosts. If no hosts specified, restarts on all cluster hosts.',
    inputSchema: {
      type: 'object',
      properties: {
        hosts: {
          type: 'string',
          description: 'Comma-separated list of hostnames to restart agent on. If empty, restarts on all cluster hosts.',
        },
        sudo: {
          type: 'boolean',
          description: 'Whether to use sudo for the restart command (default: true)',
          default: true,
        },
      },
      required: [],
    },
  },
  {
    name: 'ambari_ssh_run_command',
    description: 'Execute a shell command on one or more cluster hosts via SSH',
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute on the remote host(s)',
        },
        hosts: {
          type: 'string',
          description: 'Comma-separated list of hostnames. If empty, runs on all cluster hosts.',
        },
        sudo: {
          type: 'boolean',
          description: 'Whether to prefix the command with sudo',
          default: false,
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'ambari_ssh_check_agent_status',
    description: 'Check the status of Ambari agent on one or more hosts',
    inputSchema: {
      type: 'object',
      properties: {
        hosts: {
          type: 'string',
          description: 'Comma-separated list of hostnames. If empty, checks all cluster hosts.',
        },
      },
      required: [],
    },
  },
  {
    name: 'ambari_ssh_restart_agent_and_wait',
    description: 'Restart the Ambari agent on hosts and wait for them to re-register with the server',
    inputSchema: {
      type: 'object',
      properties: {
        hosts: {
          type: 'string',
          description: 'Comma-separated list of hostnames. If empty, restarts on all cluster hosts.',
        },
        waitTimeSeconds: {
          type: 'number',
          description: 'Maximum time to wait for agents to re-register (default: 60)',
          default: 60,
        },
      },
      required: [],
    },
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all host names from the cluster
 */
async function getAllClusterHosts(): Promise<string[]> {
  const clusterName = await getClusterName();
  const response = await ambariGet(`/clusters/${clusterName}/hosts`, {
    fields: 'Hosts/host_name',
  }) as { items?: Array<{ Hosts?: { host_name?: string } }> };
  
  const hosts: string[] = [];
  for (const item of response.items ?? []) {
    const hostName = item.Hosts?.host_name;
    if (hostName) {
      hosts.push(hostName);
    }
  }
  
  return hosts.sort();
}

/**
 * Parse comma-separated host list or get all hosts
 */
async function resolveHosts(hostsArg?: string): Promise<string[]> {
  if (hostsArg && hostsArg.trim()) {
    return hostsArg.split(',').map(h => h.trim()).filter(h => h);
  }
  return getAllClusterHosts();
}

/**
 * Format results for display
 */
function formatResults(results: Array<{ host: string; success: boolean; stdout: string; stderr: string; exitCode: number | null; error?: string }>): string {
  const lines: string[] = [];
  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  lines.push(`Results: ${succeeded.length} succeeded, ${failed.length} failed out of ${results.length} hosts\n`);
  
  for (const result of results) {
    lines.push(`━━━ ${result.host} ━━━`);
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

export const sshToolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  
  ambari_ssh_status: async () => {
    const status = getSshStatus();
    
    return {
      ssh_configured: status.enabled,
      username: status.username,
      port: status.port,
      private_key_path: status.keyPath || '(not configured)',
      message: status.enabled
        ? `SSH is configured. Username: ${status.username}, Port: ${status.port}`
        : 'SSH is not configured. Set SSH_PRIVATE_KEY_PATH in your .env file to enable SSH features.',
    };
  },
  
  ambari_ssh_restart_agent: async (args) => {
    if (!isSshConfigured()) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'SSH is not configured. Please set SSH_PRIVATE_KEY_PATH in your .env file.'
      );
    }
    
    const hostsArg = args['hosts'] as string | undefined;
    const sudo = args['sudo'] !== false; // default to true
    const hosts = await resolveHosts(hostsArg);
    
    if (hosts.length === 0) {
      throw new McpError(ErrorCode.InvalidRequest, 'No hosts found to restart agent on.');
    }
    
    const command = sudo
      ? 'sudo ambari-agent restart'
      : 'ambari-agent restart';
    
    console.error(`[ssh] Restarting Ambari agent on ${hosts.length} hosts...`);
    
    const results = await executeRemoteCommandOnHosts(hosts, command);
    
    return {
      summary: `Ambari agent restart initiated on ${hosts.length} hosts`,
      hosts_count: hosts.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: formatResults(results),
    };
  },
  
  ambari_ssh_run_command: async (args) => {
    if (!isSshConfigured()) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'SSH is not configured. Please set SSH_PRIVATE_KEY_PATH in your .env file.'
      );
    }
    
    const commandArg = args['command'] as string;
    if (!commandArg || !commandArg.trim()) {
      throw new McpError(ErrorCode.InvalidParams, 'command parameter is required');
    }
    
    const hostsArg = args['hosts'] as string | undefined;
    const sudo = args['sudo'] === true;
    const hosts = await resolveHosts(hostsArg);
    
    if (hosts.length === 0) {
      throw new McpError(ErrorCode.InvalidRequest, 'No hosts found to run command on.');
    }
    
    const command = sudo ? `sudo ${commandArg}` : commandArg;
    
    console.error(`[ssh] Running command on ${hosts.length} hosts: ${command}`);
    
    const results = await executeRemoteCommandOnHosts(hosts, command);
    
    return {
      summary: `Command executed on ${hosts.length} hosts`,
      command: command,
      hosts_count: hosts.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: formatResults(results),
    };
  },
  
  ambari_ssh_check_agent_status: async (args) => {
    if (!isSshConfigured()) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'SSH is not configured. Please set SSH_PRIVATE_KEY_PATH in your .env file.'
      );
    }
    
    const hostsArg = args['hosts'] as string | undefined;
    const hosts = await resolveHosts(hostsArg);
    
    if (hosts.length === 0) {
      throw new McpError(ErrorCode.InvalidRequest, 'No hosts found to check.');
    }
    
    // Check agent status using ambari-agent status command
    const command = 'ambari-agent status 2>/dev/null || echo "Status unknown"';
    
    console.error(`[ssh] Checking Ambari agent status on ${hosts.length} hosts...`);
    
    const results = await executeRemoteCommandOnHosts(hosts, command);
    
    // Parse results to determine status
    const hostStatuses = results.map(r => {
      let status = 'unknown';
      if (r.success) {
        const output = r.stdout.toLowerCase();
        if (output.includes('active') || output.includes('running')) {
          status = 'running';
        } else if (output.includes('inactive') || output.includes('stopped')) {
          status = 'stopped';
        }
      } else {
        status = r.error || 'connection failed';
      }
      return {
        host: r.host,
        status,
        raw_output: r.stdout || r.stderr || r.error,
      };
    });
    
    const running = hostStatuses.filter(h => h.status === 'running').length;
    const stopped = hostStatuses.filter(h => h.status === 'stopped').length;
    const unknown = hostStatuses.filter(h => h.status !== 'running' && h.status !== 'stopped').length;
    
    return {
      summary: `Agent status: ${running} running, ${stopped} stopped, ${unknown} unknown`,
      total_hosts: hosts.length,
      running,
      stopped,
      unknown,
      hosts: hostStatuses,
    };
  },
  
  ambari_ssh_restart_agent_and_wait: async (args) => {
    if (!isSshConfigured()) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'SSH is not configured. Please set SSH_PRIVATE_KEY_PATH in your .env file.'
      );
    }
    
    const hostsArg = args['hosts'] as string | undefined;
    const waitTimeSeconds = (args['waitTimeSeconds'] as number) || 60;
    const hosts = await resolveHosts(hostsArg);
    
    if (hosts.length === 0) {
      throw new McpError(ErrorCode.InvalidRequest, 'No hosts found.');
    }
    
    const clusterName = await getClusterName();
    
    // Step 1: Get current heartbeat times
    console.error(`[ssh] Recording current heartbeat times for ${hosts.length} hosts...`);
    const beforeHeartbeats: Record<string, number> = {};
    
    for (const host of hosts) {
      try {
        const hostInfo = await ambariGet(`/clusters/${clusterName}/hosts/${host}`, {
          fields: 'Hosts/last_heartbeat_time',
        }) as { Hosts?: { last_heartbeat_time?: number } };
        beforeHeartbeats[host] = hostInfo.Hosts?.last_heartbeat_time ?? 0;
      } catch {
        beforeHeartbeats[host] = 0;
      }
    }
    
    // Step 2: Restart agents
    console.error(`[ssh] Restarting Ambari agent on ${hosts.length} hosts...`);
    const restartCommand = 'sudo ambari-agent restart';
    const restartResults = await executeRemoteCommandOnHosts(hosts, restartCommand);
    
    const restartedHosts = restartResults.filter(r => r.success).map(r => r.host);
    const failedRestarts = restartResults.filter(r => !r.success);
    
    if (restartedHosts.length === 0) {
      return {
        summary: 'Failed to restart agent on any host',
        restart_results: formatResults(restartResults),
      };
    }
    
    // Step 3: Wait for agents to re-register
    console.error(`[ssh] Waiting up to ${waitTimeSeconds}s for ${restartedHosts.length} agents to re-register...`);
    
    const startTime = Date.now();
    const endTime = startTime + (waitTimeSeconds * 1000);
    const reregistered: string[] = [];
    const pending = new Set(restartedHosts);
    
    while (pending.size > 0 && Date.now() < endTime) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
      
      for (const host of Array.from(pending)) {
        try {
          const hostInfo = await ambariGet(`/clusters/${clusterName}/hosts/${host}`, {
            fields: 'Hosts/last_heartbeat_time,Hosts/host_status',
          }) as { Hosts?: { last_heartbeat_time?: number; host_status?: string } };
          
          const newHeartbeat = hostInfo.Hosts?.last_heartbeat_time ?? 0;
          const oldHeartbeat = beforeHeartbeats[host] ?? 0;
          const status = hostInfo.Hosts?.host_status;
          
          // Consider re-registered if heartbeat is newer and status is HEALTHY
          if (newHeartbeat > oldHeartbeat && status === 'HEALTHY') {
            reregistered.push(host);
            pending.delete(host);
            console.error(`[ssh] Agent re-registered: ${host}`);
          }
        } catch {
          // Continue waiting
        }
      }
    }
    
    const waitedSeconds = Math.round((Date.now() - startTime) / 1000);
    
    return {
      summary: `${reregistered.length}/${restartedHosts.length} agents re-registered after restart (waited ${waitedSeconds}s)`,
      total_hosts: hosts.length,
      restart_succeeded: restartedHosts.length,
      restart_failed: failedRestarts.length,
      reregistered: reregistered.length,
      still_pending: Array.from(pending),
      reregistered_hosts: reregistered,
      failed_restart_hosts: failedRestarts.map(r => ({ host: r.host, error: r.error || r.stderr })),
      wait_time_seconds: waitedSeconds,
    };
  },
};

