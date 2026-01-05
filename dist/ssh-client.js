/**
 * SSH Client - Execute commands on remote hosts
 */
import { Client } from 'ssh2';
import fs from 'fs';
import { getSshConfig, getSshPrivateKeyPath } from './config.js';
/**
 * Execute a command on a remote host via SSH
 */
export async function executeRemoteCommand(host, command, options = {}) {
    const sshConfig = getSshConfig();
    const username = options.username || sshConfig.username;
    const port = options.port || sshConfig.port;
    const timeout = options.timeout || sshConfig.timeout;
    const keyPath = options.privateKeyPath || getSshPrivateKeyPath();
    if (!keyPath) {
        return {
            host,
            success: false,
            stdout: '',
            stderr: '',
            exitCode: null,
            error: 'SSH private key not configured. Set SSH_PRIVATE_KEY_PATH in .env file.',
        };
    }
    let privateKey;
    try {
        privateKey = fs.readFileSync(keyPath);
    }
    catch (err) {
        return {
            host,
            success: false,
            stdout: '',
            stderr: '',
            exitCode: null,
            error: `Failed to read private key file: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
    return new Promise((resolve) => {
        const client = new Client();
        let stdout = '';
        let stderr = '';
        let exitCode = null;
        let resolved = false;
        const timeoutId = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                client.end();
                resolve({
                    host,
                    success: false,
                    stdout,
                    stderr,
                    exitCode: null,
                    error: `Connection timed out after ${timeout}ms`,
                });
            }
        }, timeout);
        client.on('ready', () => {
            client.exec(command, (err, stream) => {
                if (err) {
                    clearTimeout(timeoutId);
                    resolved = true;
                    client.end();
                    resolve({
                        host,
                        success: false,
                        stdout: '',
                        stderr: '',
                        exitCode: null,
                        error: `Command execution failed: ${err.message}`,
                    });
                    return;
                }
                stream.on('close', (code) => {
                    clearTimeout(timeoutId);
                    if (!resolved) {
                        resolved = true;
                        exitCode = code;
                        client.end();
                        resolve({
                            host,
                            success: code === 0,
                            stdout: stdout.trim(),
                            stderr: stderr.trim(),
                            exitCode,
                        });
                    }
                });
                stream.on('data', (data) => {
                    stdout += data.toString();
                });
                stream.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
            });
        });
        client.on('error', (err) => {
            clearTimeout(timeoutId);
            if (!resolved) {
                resolved = true;
                resolve({
                    host,
                    success: false,
                    stdout: '',
                    stderr: '',
                    exitCode: null,
                    error: `SSH connection error: ${err.message}`,
                });
            }
        });
        client.connect({
            host,
            port,
            username,
            privateKey,
            readyTimeout: timeout,
        });
    });
}
/**
 * Execute a command on multiple hosts in parallel
 */
export async function executeRemoteCommandOnHosts(hosts, command, options = {}) {
    const concurrency = options.concurrency || 5;
    const results = [];
    // Process hosts in batches
    for (let i = 0; i < hosts.length; i += concurrency) {
        const batch = hosts.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch.map(host => executeRemoteCommand(host, command, options)));
        results.push(...batchResults);
    }
    return results;
}
/**
 * Check if SSH is configured and available
 */
export function isSshConfigured() {
    const sshConfig = getSshConfig();
    return sshConfig.enabled;
}
/**
 * Get SSH configuration status for display
 */
export function getSshStatus() {
    const config = getSshConfig();
    return {
        enabled: config.enabled,
        username: config.username,
        port: config.port,
        keyPath: getSshPrivateKeyPath(),
    };
}
//# sourceMappingURL=ssh-client.js.map