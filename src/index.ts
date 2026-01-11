#!/usr/bin/env node
/**
 * Ambari MCP Server - Main Entry Point
 * 
 * A comprehensive Model Context Protocol (MCP) server for Apache Ambari
 * providing tools for cluster management, service operations, configuration
 * management, status monitoring, and alert tracking.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult, ReadResourceResult, TextContent } from '@modelcontextprotocol/sdk/types.js';

import { getAmbariConfig, getSshConfig, getK8sConfig } from './config.js';
import { ALL_TOOLS, allToolExecutors } from './tools/index.js';
import { AMBARI_RESOURCES, readResource } from './resources.js';

// ============================================================================
// Server Configuration
// ============================================================================

const server = new Server(
  {
    name: 'ambari-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {}
    }
  }
);

// ============================================================================
// Request Handlers
// ============================================================================

/**
 * List all available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: ALL_TOOLS,
  };
});

/**
 * List all available resources
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: AMBARI_RESOURCES,
  };
});

/**
 * Read a specific resource
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request): Promise<ReadResourceResult> => {
  const { uri } = request.params;

  try {
    const resourceContent = await readResource(uri);

    return {
      contents: [
        {
          uri: resourceContent.uri,
          mimeType: resourceContent.mimeType,
          text: resourceContent.text,
        }
      ],
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new McpError(
      ErrorCode.InternalError,
      `Resource access failed for ${uri}: ${errorMessage}`,
      { uri, originalError: errorMessage }
    );
  }
});

/**
 * Execute a tool
 */
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: args } = request.params;

  // Validate tool exists
  const executor = allToolExecutors[name];
  if (!executor) {
    const availableTools = Object.keys(allToolExecutors).slice(0, 10).join(', ');
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Unknown tool: ${name}. Available tools include: ${availableTools}...`
    );
  }

  // Validate tool is in ALL_TOOLS list
  const toolDefinition = ALL_TOOLS.find(tool => tool.name === name);
  if (!toolDefinition) {
    throw new McpError(
      ErrorCode.InternalError,
      `Tool ${name} executor exists but tool definition is missing`
    );
  }

  try {
    const startTime = Date.now();
    const result = await executor((args ?? {}) as Record<string, unknown>);
    const executionTime = Date.now() - startTime;

    // Format the result
    let responseText: string;
    
    if (typeof result === 'object' && result !== null && 'summary' in result) {
      // If result has a summary field, use it as the primary text
      const resultObj = result as { summary: string; [key: string]: unknown };
      responseText = resultObj.summary;
      
      // Append structured data if there's more than just the summary
      const otherKeys = Object.keys(resultObj).filter(k => k !== 'summary');
      if (otherKeys.length > 0) {
        const additionalData: Record<string, unknown> = {};
        for (const key of otherKeys) {
          additionalData[key] = resultObj[key];
        }
        responseText += '\n\n--- Additional Data ---\n' + JSON.stringify(additionalData, null, 2);
      }
    } else {
      // Otherwise, JSON stringify the whole result
      responseText = JSON.stringify({
        tool: name,
        executionTimeMs: executionTime,
        timestamp: new Date().toISOString(),
        result
      }, null, 2);
    }

    const response: CallToolResult = {
      content: [
        {
          type: 'text',
          text: responseText,
        } as TextContent,
      ],
      isError: false,
    };

    return response;
  } catch (error) {
    // Handle MCP errors directly
    if (error instanceof McpError) {
      throw error;
    }

    // Handle Axios/HTTP errors with detailed information
    if (error && typeof error === 'object' && 'response' in error) {
      const httpError = error as {
        message?: string;
        response?: { status?: number; statusText?: string };
        config?: { url?: string; method?: string };
      };
      
      throw new McpError(
        ErrorCode.InternalError,
        `Ambari API Error: ${httpError.message ?? 'Unknown error'}`,
        {
          httpStatus: httpError.response?.status,
          httpStatusText: httpError.response?.statusText,
          url: httpError.config?.url,
          method: httpError.config?.method?.toUpperCase(),
        }
      );
    }

    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed for ${name}: ${errorMessage}`,
      { tool: name, originalError: errorMessage }
    );
  }
});

// ============================================================================
// Server Startup
// ============================================================================

async function main(): Promise<void> {
  const config = getAmbariConfig();
  const sshConfig = getSshConfig();
  const k8sConfig = getK8sConfig();

  const sslStatus = config.insecureSsl ? 'DISABLED (insecure)' : 'enabled';
  const sshStatus = sshConfig.enabled 
    ? `enabled (${sshConfig.username}@port ${sshConfig.port})`
    : 'not configured';
  const k8sStatus = k8sConfig.enabled
    ? `enabled (${k8sConfig.namespace}/${k8sConfig.podLabelSelector})`
    : 'not configured';
  
  console.error('╔════════════════════════════════════════════════════════════╗');
  console.error('║             Ambari MCP Server v1.0.0                       ║');
  console.error('╠════════════════════════════════════════════════════════════╣');
  console.error(`║ Ambari URL: ${config.baseUrl.padEnd(47)}║`);
  console.error(`║ Username: ${config.username.padEnd(49)}║`);
  console.error(`║ Cluster: ${(config.clusterName || '(auto-detect)').padEnd(50)}║`);
  console.error(`║ Timeout: ${(config.timeoutMs + 'ms').padEnd(50)}║`);
  console.error(`║ SSL Verify: ${sslStatus.padEnd(47)}║`);
  console.error(`║ SSH: ${sshStatus.padEnd(54)}║`);
  console.error(`║ K8s: ${k8sStatus.padEnd(54)}║`);
  console.error('╠════════════════════════════════════════════════════════════╣');
  console.error(`║ Available Tools: ${String(ALL_TOOLS.length).padEnd(42)}║`);
  console.error(`║ Available Resources: ${String(AMBARI_RESOURCES.length).padEnd(38)}║`);
  console.error('╚════════════════════════════════════════════════════════════╝');

  // Tool categories
  const toolCategories: Record<string, number> = {};
  for (const tool of ALL_TOOLS) {
    const category = tool.name.split('_')[1] ?? 'other';
    toolCategories[category] = (toolCategories[category] ?? 0) + 1;
  }

  console.error('\nTool Categories:');
  for (const [category, count] of Object.entries(toolCategories).sort()) {
    console.error(`  - ${category}: ${count} tools`);
  }

  console.error('\nStarting server on stdio transport...');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Ambari MCP Server is now running.');
}

// Handle errors
main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});

