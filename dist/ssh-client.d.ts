/**
 * SSH Client - Execute commands on remote hosts
 */
import type { SshCommandResult } from './types.js';
/**
 * Execute a command on a remote host via SSH
 */
export declare function executeRemoteCommand(host: string, command: string, options?: {
    username?: string;
    port?: number;
    timeout?: number;
    privateKeyPath?: string;
}): Promise<SshCommandResult>;
/**
 * Execute a command on multiple hosts in parallel
 */
export declare function executeRemoteCommandOnHosts(hosts: string[], command: string, options?: {
    username?: string;
    port?: number;
    timeout?: number;
    privateKeyPath?: string;
    concurrency?: number;
}): Promise<SshCommandResult[]>;
/**
 * Check if SSH is configured and available
 */
export declare function isSshConfigured(): boolean;
/**
 * Get SSH configuration status for display
 */
export declare function getSshStatus(): {
    enabled: boolean;
    username: string;
    port: number;
    keyPath: string | undefined;
};
//# sourceMappingURL=ssh-client.d.ts.map