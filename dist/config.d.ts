/**
 * Configuration management for Ambari MCP Server
 */
import https from 'https';
import type { AmbariConfig, SshConfig, K8sConfig } from './types.js';
/**
 * Get Ambari server configuration from environment variables
 */
export declare function getAmbariConfig(): AmbariConfig;
/**
 * Get an HTTPS agent with optional SSL verification skip
 */
export declare function getHttpsAgent(): https.Agent | undefined;
/**
 * Get SSH configuration for connecting to cluster nodes
 */
export declare function getSshConfig(): SshConfig;
/**
 * Get the resolved path to the SSH private key
 */
export declare function getSshPrivateKeyPath(): string | undefined;
/**
 * Get Kubernetes configuration for connecting to cluster pods
 */
export declare function getK8sConfig(): K8sConfig;
/**
 * Check if debug mode is enabled
 */
export declare function isDebugEnabled(): boolean;
/**
 * Log environment summary for debugging
 */
export declare function summarizeEnv(): void;
//# sourceMappingURL=config.d.ts.map