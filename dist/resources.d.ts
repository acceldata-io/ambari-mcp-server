/**
 * MCP Resources for Ambari MCP Server
 * Provides structured access to Ambari data via resource URIs
 */
import type { Resource } from '@modelcontextprotocol/sdk/types.js';
export declare const AMBARI_RESOURCES: Resource[];
interface ParsedUri {
    type: string;
    clusterName?: string;
    serviceName?: string;
    hostName?: string;
}
export declare function parseResourceUri(uri: string): ParsedUri;
export declare function readResource(uri: string): Promise<{
    uri: string;
    mimeType: string;
    text: string;
}>;
export {};
//# sourceMappingURL=resources.d.ts.map