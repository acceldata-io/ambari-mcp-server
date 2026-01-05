/**
 * Configuration Management Tools for Ambari MCP Server
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ambariGet, ambariPut, getClusterName } from '../api-client.js';

// ============================================================================
// Tool Definitions
// ============================================================================

export const CONFIG_TOOLS: Tool[] = [
  {
    name: 'ambari_config_gettypes',
    description: 'Get all available configuration types for the cluster',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' }
      },
      required: []
    }
  },
  {
    name: 'ambari_config_getconfig',
    description: 'Get configuration for a specific config type',
    inputSchema: {
      type: 'object',
      properties: {
        configType: { type: 'string', description: 'The configuration type (e.g., core-site, hdfs-site, yarn-site)' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        tag: { type: 'string', description: 'Specific configuration tag/version (optional, uses latest if not specified)' }
      },
      required: ['configType']
    }
  },
  {
    name: 'ambari_config_getproperty',
    description: 'Get a specific configuration property value',
    inputSchema: {
      type: 'object',
      properties: {
        configType: { type: 'string', description: 'The configuration type (e.g., core-site)' },
        propertyName: { type: 'string', description: 'The property name to retrieve' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' }
      },
      required: ['configType', 'propertyName']
    }
  },
  {
    name: 'ambari_config_search',
    description: 'Search for configuration properties across all config types',
    inputSchema: {
      type: 'object',
      properties: {
        searchTerm: { type: 'string', description: 'Search term to find in property names or values' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        serviceFilter: { type: 'string', description: 'Filter by service name (optional)' }
      },
      required: ['searchTerm']
    }
  },
  {
    name: 'ambari_config_dump',
    description: 'Dump all configurations or filter by service/type',
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
        configType: { type: 'string', description: 'Focus on one config type (optional)' },
        serviceFilter: { type: 'string', description: 'Filter by service name substring (optional)' },
        filter: { type: 'string', description: 'Filter by property name substring (optional)' },
        summarize: { type: 'boolean', description: 'Only show counts and sample keys', default: false },
        includeValues: { type: 'boolean', description: 'Include property values in output', default: true },
        limit: { type: 'integer', description: 'Max number of config types to output (0 = unlimited)', default: 20 },
        maxChars: { type: 'integer', description: 'Truncate output if exceeds this length', default: 30000 }
      },
      required: []
    }
  },
  {
    name: 'ambari_config_updateproperty',
    description: 'Update a configuration property value (requires service restart to take effect)',
    inputSchema: {
      type: 'object',
      properties: {
        configType: { type: 'string', description: 'The configuration type (e.g., core-site)' },
        propertyName: { type: 'string', description: 'The property name to update' },
        propertyValue: { type: 'string', description: 'The new value for the property' },
        clusterName: { type: 'string', description: 'The name of the cluster (optional)' }
      },
      required: ['configType', 'propertyName', 'propertyValue']
    }
  }
];

// ============================================================================
// Helper Types
// ============================================================================

interface DesiredConfigs {
  [configType: string]: {
    tag: string;
    version?: number;
  };
}

interface ConfigItem {
  type?: string;
  tag?: string;
  version?: number;
  Config?: {
    cluster_name?: string;
  };
  properties?: Record<string, string>;
  properties_attributes?: Record<string, Record<string, string>>;
}

// ============================================================================
// Tool Executors
// ============================================================================

export const configToolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {

  ambari_config_gettypes: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();

    const data = await ambariGet(`/clusters/${clusterName}`, {
      fields: 'Clusters/desired_configs'
    }) as {
      Clusters?: {
        desired_configs?: DesiredConfigs;
      };
    };

    const desiredConfigs = data.Clusters?.desired_configs ?? {};
    const configTypes = Object.keys(desiredConfigs).sort();

    const lines: string[] = [
      `Configuration Types for Cluster: ${clusterName}`,
      '='.repeat(50),
      `Total: ${configTypes.length} configuration types`,
      ''
    ];

    for (const configType of configTypes) {
      const info = desiredConfigs[configType];
      lines.push(`  ${configType} (tag: ${info?.tag ?? 'unknown'})`);
    }

    return {
      summary: lines.join('\n'),
      configTypes,
      details: desiredConfigs
    };
  },

  ambari_config_getconfig: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const configType = args['configType'] as string;
    let tag = args['tag'] as string | undefined;

    // Get latest tag if not specified
    if (!tag) {
      const clusterData = await ambariGet(`/clusters/${clusterName}`, {
        fields: 'Clusters/desired_configs'
      }) as {
        Clusters?: { desired_configs?: DesiredConfigs };
      };

      const desiredConfigs = clusterData.Clusters?.desired_configs ?? {};
      const configInfo = desiredConfigs[configType];
      
      if (!configInfo) {
        return {
          error: true,
          message: `Configuration type '${configType}' not found. Use ambari_config_gettypes to see available types.`
        };
      }
      
      tag = configInfo.tag;
    }

    const data = await ambariGet(`/clusters/${clusterName}/configurations`, {
      type: configType,
      tag: tag ?? ''
    }) as {
      items?: ConfigItem[];
    };

    const items = data.items ?? [];
    if (items.length === 0) {
      return {
        error: true,
        message: `No configuration found for type '${configType}' with tag '${tag}'`
      };
    }

    const config = items[0] ?? {};
    const properties = config.properties ?? {};
    const attributes = config.properties_attributes ?? {};

    const lines: string[] = [
      `Configuration: ${configType}`,
      '='.repeat(50),
      `Tag: ${tag}`,
      `Properties: ${Object.keys(properties).length}`,
      ''
    ];

    const sortedKeys = Object.keys(properties).sort();
    for (const key of sortedKeys) {
      const value = properties[key] ?? '';
      const displayValue = value.includes('\n') 
        ? value.replace(/\n/g, '\\n').substring(0, 80) + '...'
        : value.length > 100 ? value.substring(0, 97) + '...' : value;
      lines.push(`  ${key} = ${displayValue}`);
    }

    return {
      summary: lines.join('\n'),
      configType,
      tag,
      properties,
      attributes
    };
  },

  ambari_config_getproperty: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const configType = args['configType'] as string;
    const propertyName = args['propertyName'] as string;

    // Get latest tag
    const clusterData = await ambariGet(`/clusters/${clusterName}`, {
      fields: 'Clusters/desired_configs'
    }) as {
      Clusters?: { desired_configs?: DesiredConfigs };
    };

    const desiredConfigs = clusterData.Clusters?.desired_configs ?? {};
    const configInfo = desiredConfigs[configType];
    
    if (!configInfo) {
      return {
        error: true,
        message: `Configuration type '${configType}' not found`
      };
    }

    const data = await ambariGet(`/clusters/${clusterName}/configurations`, {
      type: configType,
      tag: configInfo.tag
    }) as {
      items?: ConfigItem[];
    };

    const items = data.items ?? [];
    const config = items[0] ?? {};
    const properties = config.properties ?? {};
    const value = properties[propertyName];

    if (value === undefined) {
      return {
        error: true,
        message: `Property '${propertyName}' not found in ${configType}`,
        availableProperties: Object.keys(properties).slice(0, 20)
      };
    }

    return {
      configType,
      propertyName,
      value,
      tag: configInfo.tag
    };
  },

  ambari_config_search: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const searchTerm = (args['searchTerm'] as string).toLowerCase();
    const serviceFilter = args['serviceFilter'] as string | undefined;

    // Get all config types
    const clusterData = await ambariGet(`/clusters/${clusterName}`, {
      fields: 'Clusters/desired_configs'
    }) as {
      Clusters?: { desired_configs?: DesiredConfigs };
    };

    const desiredConfigs = clusterData.Clusters?.desired_configs ?? {};
    let configTypes = Object.keys(desiredConfigs);

    // Filter by service if specified
    if (serviceFilter) {
      const sf = serviceFilter.toLowerCase();
      configTypes = configTypes.filter(t => t.toLowerCase().includes(sf));
    }

    const results: Array<{
      configType: string;
      propertyName: string;
      value: string;
      matchType: 'key' | 'value' | 'both';
    }> = [];

    for (const configType of configTypes) {
      const configInfo = desiredConfigs[configType];
      if (!configInfo) continue;

      try {
        const data = await ambariGet(`/clusters/${clusterName}/configurations`, {
          type: configType,
          tag: configInfo.tag
        }) as {
          items?: ConfigItem[];
        };

        const items = data.items ?? [];
        const config = items[0] ?? {};
        const properties = config.properties ?? {};

        for (const [key, value] of Object.entries(properties)) {
          const keyMatch = key.toLowerCase().includes(searchTerm);
          const valueMatch = (value ?? '').toLowerCase().includes(searchTerm);

          if (keyMatch || valueMatch) {
            results.push({
              configType,
              propertyName: key,
              value: value ?? '',
              matchType: keyMatch && valueMatch ? 'both' : keyMatch ? 'key' : 'value'
            });
          }
        }
      } catch {
        // Skip config types that fail to load
      }
    }

    const lines: string[] = [
      `Configuration Search Results`,
      '='.repeat(50),
      `Search Term: "${searchTerm}"`,
      `Results: ${results.length} matches`,
      ''
    ];

    for (const result of results.slice(0, 50)) {
      const displayValue = result.value.length > 60 
        ? result.value.substring(0, 57) + '...' 
        : result.value;
      lines.push(`[${result.configType}] ${result.propertyName}`);
      lines.push(`  Value: ${displayValue}`);
      lines.push(`  Match: ${result.matchType}`);
      lines.push('');
    }

    if (results.length > 50) {
      lines.push(`... and ${results.length - 50} more results`);
    }

    return {
      summary: lines.join('\n'),
      count: results.length,
      results: results.slice(0, 100)
    };
  },

  ambari_config_dump: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const configType = args['configType'] as string | undefined;
    const serviceFilter = args['serviceFilter'] as string | undefined;
    const filter = args['filter'] as string | undefined;
    const summarize = args['summarize'] as boolean ?? false;
    const includeValues = args['includeValues'] as boolean ?? true;
    const limit = (args['limit'] as number) ?? 20;
    const maxChars = (args['maxChars'] as number) ?? 30000;

    const filterLower = filter?.toLowerCase();

    // Get desired configs
    const clusterData = await ambariGet(`/clusters/${clusterName}`, {
      fields: 'Clusters/desired_configs'
    }) as {
      Clusters?: { desired_configs?: DesiredConfigs };
    };

    const desiredConfigs = clusterData.Clusters?.desired_configs ?? {};

    if (Object.keys(desiredConfigs).length === 0) {
      return { error: true, message: 'No configuration data found in cluster.' };
    }

    // Single config type mode
    if (configType) {
      const configInfo = desiredConfigs[configType];
      if (!configInfo) {
        const suggestions = Object.keys(desiredConfigs)
          .filter(t => t.toLowerCase().includes(configType.toLowerCase()))
          .slice(0, 8);
        return {
          error: true,
          message: `Config type '${configType}' not found.`,
          suggestions
        };
      }

      const data = await ambariGet(`/clusters/${clusterName}/configurations`, {
        type: configType,
        tag: configInfo.tag
      }) as {
        items?: ConfigItem[];
      };

      const items = data.items ?? [];
      const config = items[0] ?? {};
      let properties = config.properties ?? {};

      // Apply filter
      if (filterLower) {
        properties = Object.fromEntries(
          Object.entries(properties).filter(([k]) => 
            k.toLowerCase().includes(filterLower) || configType.toLowerCase().includes(filterLower)
          )
        );
      }

      const lines: string[] = [
        `CONFIG TYPE: ${configType}`,
        `Tag: ${configInfo.tag}`,
        `Keys: ${Object.keys(properties).length}`,
        '',
        'Properties:'
      ];

      for (const key of Object.keys(properties).sort()) {
        const value = properties[key] ?? '';
        const displayValue = value.includes('\n') ? value.replace(/\n/g, '\\n') : value;
        lines.push(`  ${key} = ${displayValue}`);
      }

      let result = lines.join('\n');
      if (result.length > maxChars) {
        result = result.substring(0, maxChars) + `\n... [TRUNCATED ${result.length - maxChars} chars]`;
      }

      return { summary: result, properties };
    }

    // Bulk mode
    let typeNames = Object.keys(desiredConfigs).sort();
    
    if (serviceFilter) {
      const sf = serviceFilter.toLowerCase();
      typeNames = typeNames.filter(t => t.toLowerCase().includes(sf));
    }

    const blocks: string[] = [];
    let emitted = 0;

    for (const cfgType of typeNames) {
      const configInfo = desiredConfigs[cfgType];
      if (!configInfo) continue;

      try {
        const data = await ambariGet(`/clusters/${clusterName}/configurations`, {
          type: cfgType,
          tag: configInfo.tag
        }) as {
          items?: ConfigItem[];
        };

        const items = data.items ?? [];
        const config = items[0] ?? {};
        let properties = config.properties ?? {};

        // Skip if filter specified and no match
        if (filterLower && !cfgType.toLowerCase().includes(filterLower)) {
          const hasMatch = Object.keys(properties).some(k => k.toLowerCase().includes(filterLower));
          if (!hasMatch) continue;
        }

        if (summarize) {
          const sampleKeys = Object.keys(properties).slice(0, 5);
          blocks.push(`[${cfgType}] tag=${configInfo.tag} keys=${Object.keys(properties).length} sample=${JSON.stringify(sampleKeys)}`);
        } else if (!includeValues) {
          const keys = Object.keys(properties)
            .filter(k => !filterLower || k.toLowerCase().includes(filterLower) || cfgType.toLowerCase().includes(filterLower))
            .sort()
            .slice(0, 50);
          blocks.push(`[${cfgType}] tag=${configInfo.tag} key_count=${Object.keys(properties).length} keys=${JSON.stringify(keys)}`);
        } else {
          const lines = [`[${cfgType}] tag=${configInfo.tag} keys=${Object.keys(properties).length}`];
          for (const key of Object.keys(properties).sort()) {
            if (filterLower && !key.toLowerCase().includes(filterLower) && !cfgType.toLowerCase().includes(filterLower)) {
              continue;
            }
            const value = properties[key] ?? '';
            const displayValue = value.includes('\n') ? value.replace(/\n/g, '\\n') : value;
            lines.push(`  ${key} = ${displayValue}`);
          }
          blocks.push(lines.join('\n'));
        }

        emitted++;
        if (limit > 0 && emitted >= limit) break;
      } catch {
        // Skip failed config types
      }
    }

    if (blocks.length === 0) {
      return {
        error: true,
        message: 'No configuration data matched filter.'
      };
    }

    const header = [
      'AMBARI CONFIGURATION DUMP',
      `cluster=${clusterName}`,
      `total_types_considered=${Object.keys(desiredConfigs).length}`,
      `types_output=${emitted}`,
      `mode=${summarize ? 'summarize' : includeValues ? 'full-values' : 'keys-only'}`
    ];

    if (serviceFilter) header.push(`service_filter='${serviceFilter}'`);
    if (filter) header.push(`filter='${filter}'`);

    let result = header.join('\n') + '\n\n' + blocks.join('\n\n');
    if (result.length > maxChars) {
      result = result.substring(0, maxChars) + `\n... [TRUNCATED ${result.length - maxChars} chars]`;
    }

    return { summary: result };
  },

  ambari_config_updateproperty: async (args) => {
    const clusterName = (args['clusterName'] as string) || await getClusterName();
    const configType = args['configType'] as string;
    const propertyName = args['propertyName'] as string;
    const propertyValue = args['propertyValue'] as string;

    // Get current configuration
    const clusterData = await ambariGet(`/clusters/${clusterName}`, {
      fields: 'Clusters/desired_configs'
    }) as {
      Clusters?: { desired_configs?: DesiredConfigs };
    };

    const desiredConfigs = clusterData.Clusters?.desired_configs ?? {};
    const configInfo = desiredConfigs[configType];

    if (!configInfo) {
      return {
        error: true,
        message: `Configuration type '${configType}' not found`
      };
    }

    // Get current properties
    const data = await ambariGet(`/clusters/${clusterName}/configurations`, {
      type: configType,
      tag: configInfo.tag
    }) as {
      items?: ConfigItem[];
    };

    const items = data.items ?? [];
    const config = items[0] ?? {};
    const currentProperties = config.properties ?? {};

    // Update the property
    const updatedProperties = {
      ...currentProperties,
      [propertyName]: propertyValue
    };

    // Create new configuration with updated properties
    const body = {
      Clusters: {
        desired_config: {
          type: configType,
          tag: `version${Date.now()}`,
          properties: updatedProperties
        }
      }
    };

    await ambariPut(`/clusters/${clusterName}`, body);

    return {
      success: true,
      message: `Property '${propertyName}' in ${configType} updated successfully`,
      configType,
      propertyName,
      oldValue: currentProperties[propertyName],
      newValue: propertyValue,
      note: 'Restart affected services to apply the configuration change'
    };
  }
};

