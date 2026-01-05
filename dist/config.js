/**
 * Configuration management for Ambari MCP Server
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { fileURLToPath } from 'url';
// Emulate __dirname in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Load environment variables from .env file
 * Tries multiple locations for robustness when launched by MCP host
 */
function loadEnv() {
    // Allow explicit override via AMBARI_ENV_PATH
    const explicit = process.env['AMBARI_ENV_PATH']
        ? path.resolve(process.env['AMBARI_ENV_PATH'])
        : undefined;
    const candidatePaths = [
        explicit,
        path.resolve(__dirname, '../.env'), // when running built dist/index.js
        path.resolve(__dirname, '../../.env'), // when source is in src/
        path.resolve(process.cwd(), '.env') // when running from project root
    ].filter((p) => Boolean(p));
    for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
            dotenv.config({ path: p });
            console.error(`[env] Loaded .env from ${p}`);
            return p;
        }
    }
    console.error('[env] WARNING: .env file not found. Tried:', candidatePaths.join(', '));
    return undefined;
}
// Load environment on module initialization
const loadedEnvPath = loadEnv();
/**
 * Parse Ambari base URL and extract cluster name if present
 */
function parseBaseUrl(url) {
    // Normalize URL
    let baseUrl = url.trim();
    // Ensure /api/v1 suffix
    if (!baseUrl.includes('/api/v1')) {
        baseUrl = baseUrl.replace(/\/?$/, '/api/v1');
    }
    return { baseUrl };
}
/**
 * Get Ambari server configuration from environment variables
 */
export function getAmbariConfig() {
    const rawUrl = process.env['AMBARI_BASE_URL'] || 'http://localhost:8080/api/v1';
    const { baseUrl } = parseBaseUrl(rawUrl);
    // Check for SSL verification skip option
    const insecureSsl = process.env['INSECURE_SSL'] === '1' ||
        process.env['INSECURE_SSL'] === 'true' ||
        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] === '0';
    return {
        baseUrl,
        username: process.env['AMBARI_USERNAME'] || 'admin',
        password: process.env['AMBARI_PASSWORD'] || 'admin',
        clusterName: process.env['AMBARI_CLUSTER_NAME'] || '',
        timeoutMs: parseInt(process.env['TIMEOUT_MS'] || '30000', 10),
        insecureSsl,
    };
}
/**
 * Get an HTTPS agent with optional SSL verification skip
 */
export function getHttpsAgent() {
    const config = getAmbariConfig();
    if (config.insecureSsl) {
        return new https.Agent({
            rejectUnauthorized: false,
        });
    }
    return undefined;
}
/**
 * Get SSH configuration for connecting to cluster nodes
 */
export function getSshConfig() {
    const privateKeyPath = process.env['SSH_PRIVATE_KEY_PATH'] || '';
    const username = process.env['SSH_USERNAME'] || 'root';
    const port = parseInt(process.env['SSH_PORT'] || '22', 10);
    const timeout = parseInt(process.env['SSH_TIMEOUT'] || '10000', 10);
    // SSH is enabled if a private key path is configured and the file exists
    let enabled = false;
    if (privateKeyPath) {
        try {
            const resolvedPath = path.isAbsolute(privateKeyPath)
                ? privateKeyPath
                : path.resolve(process.cwd(), privateKeyPath);
            enabled = fs.existsSync(resolvedPath);
            if (!enabled) {
                console.error(`[ssh] WARNING: Private key file not found: ${resolvedPath}`);
            }
        }
        catch {
            enabled = false;
        }
    }
    return {
        privateKeyPath,
        username,
        port,
        timeout,
        enabled,
    };
}
/**
 * Get the resolved path to the SSH private key
 */
export function getSshPrivateKeyPath() {
    const config = getSshConfig();
    if (!config.privateKeyPath)
        return undefined;
    const resolvedPath = path.isAbsolute(config.privateKeyPath)
        ? config.privateKeyPath
        : path.resolve(process.cwd(), config.privateKeyPath);
    if (fs.existsSync(resolvedPath)) {
        return resolvedPath;
    }
    return undefined;
}
/**
 * Check if debug mode is enabled
 */
export function isDebugEnabled() {
    return process.env['DEBUG'] === '1' || process.env['ENV_DEBUG'] === '1';
}
/**
 * Log environment summary for debugging
 */
export function summarizeEnv() {
    const config = getAmbariConfig();
    const sshConfig = getSshConfig();
    const maskedPwd = config.password.replace(/./g, '*');
    console.error('[env] Summary:', JSON.stringify({
        loadedEnvPath,
        AMBARI_BASE_URL: config.baseUrl,
        AMBARI_USERNAME: config.username,
        AMBARI_PASSWORD_MASKED: maskedPwd,
        AMBARI_CLUSTER_NAME: config.clusterName || '(auto-detect)',
        TIMEOUT_MS: config.timeoutMs,
        SSH_ENABLED: sshConfig.enabled,
        SSH_USERNAME: sshConfig.username,
    }, null, 2));
}
// Log summary if debug enabled
if (isDebugEnabled()) {
    summarizeEnv();
}
//# sourceMappingURL=config.js.map