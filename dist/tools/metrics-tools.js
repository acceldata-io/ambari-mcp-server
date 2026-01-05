/**
 * Ambari Metrics (AMS) Tools for Ambari MCP Server
 */
import { executeAmbariMetricsRequest, ambariGet, getClusterName } from '../api-client.js';
import { getAmbariMetricsConfig } from '../config.js';
import { resolveMetricsTimeRange, metricsMapToSeries, summarizeMetricSeries, formatTimestamp, formatBytes } from '../utils.js';
// ============================================================================
// Tool Definitions
// ============================================================================
export const METRICS_TOOLS = [
    {
        name: 'ambari_metrics_getmetadata',
        description: 'Get available metrics metadata from Ambari Metrics Service (AMS)',
        inputSchema: {
            type: 'object',
            properties: {
                appId: { type: 'string', description: 'Filter by application ID (e.g., namenode, datanode, nodemanager)' },
                metricFilter: { type: 'string', description: 'Filter metric names by substring' },
                limit: { type: 'integer', description: 'Maximum number of metrics to return', default: 50 }
            },
            required: []
        }
    },
    {
        name: 'ambari_metrics_getappids',
        description: 'List all available application IDs in Ambari Metrics',
        inputSchema: {
            type: 'object',
            properties: {
                refresh: { type: 'boolean', description: 'Force refresh of cached data', default: false }
            },
            required: []
        }
    },
    {
        name: 'ambari_metrics_query',
        description: 'Query time-series metrics from Ambari Metrics Service',
        inputSchema: {
            type: 'object',
            properties: {
                metricNames: { type: 'string', description: 'Comma-separated list of metric names to query' },
                appId: { type: 'string', description: 'Application ID (e.g., namenode, datanode)' },
                hostname: { type: 'string', description: 'Filter by hostname (optional)' },
                duration: { type: 'string', description: 'Time duration to look back (e.g., 1h, 30m, 2d)', default: '1h' },
                startTime: { type: 'string', description: 'Start timestamp (epoch ms or ISO date)' },
                endTime: { type: 'string', description: 'End timestamp (epoch ms or ISO date)' },
                precision: { type: 'string', description: 'Data precision: seconds, minutes, hours, days' },
                includePoints: { type: 'boolean', description: 'Include individual data points in output', default: false },
                maxPoints: { type: 'integer', description: 'Maximum data points to return', default: 120 }
            },
            required: ['metricNames']
        }
    },
    {
        name: 'ambari_metrics_hdfs_report',
        description: 'Generate HDFS DFSAdmin-style capacity and DataNode report using Ambari metrics',
        inputSchema: {
            type: 'object',
            properties: {
                clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
                lookbackMinutes: { type: 'integer', description: 'Metrics lookback window in minutes', default: 10 }
            },
            required: []
        }
    }
];
function parseMetricsMetadata(response) {
    if (!response || typeof response !== 'object')
        return [];
    const respObj = response;
    if (respObj.error)
        return [];
    const section = respObj.metrics ?? respObj.items ?? respObj.Metrics ?? respObj.timelineMetrics;
    if (!section)
        return [];
    const entries = [];
    if (Array.isArray(section)) {
        for (const item of section) {
            if (typeof item === 'object' && item !== null) {
                entries.push(item);
            }
        }
    }
    else if (typeof section === 'object') {
        for (const [key, value] of Object.entries(section)) {
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (typeof item === 'object' && item !== null) {
                        const entry = item;
                        entry.appid = entry.appid ?? key;
                        entries.push(entry);
                    }
                }
            }
            else if (typeof value === 'object' && value !== null) {
                const entry = value;
                entry.metricname = entry.metricname ?? key;
                entries.push(entry);
            }
        }
    }
    return entries;
}
async function fetchLatestMetricValue(metricName, appId, hostname, durationMs = 600000) {
    const nowMs = Date.now();
    const startMs = nowMs - durationMs;
    const params = {
        metricNames: metricName,
        startTime: startMs,
        endTime: nowMs
    };
    if (appId)
        params['appId'] = appId;
    if (hostname)
        params['hostname'] = hostname;
    const result = await executeAmbariMetricsRequest('/metrics', params);
    if (result.error || !result.data)
        return undefined;
    const data = result.data;
    const metricsSection = data.metrics ?? data.timelineMetrics ?? [];
    let entries = [];
    if (Array.isArray(metricsSection)) {
        entries = metricsSection;
    }
    if (entries.length === 0)
        return undefined;
    const first = entries[0];
    if (!first?.metrics)
        return undefined;
    const series = metricsMapToSeries(first.metrics);
    if (series.length === 0)
        return undefined;
    return series[series.length - 1]?.value;
}
// ============================================================================
// Tool Executors
// ============================================================================
export const metricsToolExecutors = {
    ambari_metrics_getmetadata: async (args) => {
        const appId = args['appId'];
        const metricFilter = args['metricFilter'];
        const limit = args['limit'] ?? 50;
        const params = {};
        if (appId)
            params['appId'] = appId;
        const result = await executeAmbariMetricsRequest('/metrics/metadata', params);
        if (result.error) {
            return { error: true, message: `Failed to retrieve metrics metadata: ${result.error}` };
        }
        let entries = parseMetricsMetadata(result.data);
        // Filter by metric name if specified
        if (metricFilter) {
            const filterLower = metricFilter.toLowerCase();
            entries = entries.filter(e => {
                const name = e.metricname ?? e.metricName ?? e.name ?? '';
                return name.toLowerCase().includes(filterLower);
            });
        }
        const metricsConfig = getAmbariMetricsConfig();
        const lines = [
            'Ambari Metrics Metadata',
            `Endpoint: ${metricsConfig.baseUrl}/metrics/metadata`,
            `AppId Filter: ${appId ?? 'none'}`,
            `Metric Filter: ${metricFilter ?? 'none'}`,
            `Found: ${entries.length} metrics (showing ${Math.min(limit, entries.length)})`,
            ''
        ];
        for (const entry of entries.slice(0, limit)) {
            const name = entry.metricname ?? entry.metricName ?? entry.name ?? '<unknown>';
            const app = entry.appid ?? entry.appId ?? entry.application ?? '-';
            const units = entry.units ?? '-';
            const type = entry.type ?? '-';
            lines.push(`[${app}] ${name}`);
            lines.push(`    type=${type} | units=${units}`);
            if (entry.description) {
                lines.push(`    ${entry.description}`);
            }
            lines.push('');
        }
        if (entries.length > limit) {
            lines.push(`... ${entries.length - limit} more metrics not shown (increase limit)`);
        }
        return {
            summary: lines.join('\n'),
            count: entries.length,
            metrics: entries.slice(0, limit).map(e => ({
                name: e.metricname ?? e.metricName ?? e.name,
                appId: e.appid ?? e.appId,
                type: e.type,
                units: e.units,
                description: e.description
            }))
        };
    },
    ambari_metrics_getappids: async (args) => {
        const _refresh = args['refresh'];
        const result = await executeAmbariMetricsRequest('/metrics/metadata', {});
        if (result.error) {
            return { error: true, message: `Failed to retrieve app IDs: ${result.error}` };
        }
        const entries = parseMetricsMetadata(result.data);
        const appIds = new Set();
        for (const entry of entries) {
            const appId = entry.appid ?? entry.appId ?? entry.application;
            if (appId)
                appIds.add(appId);
        }
        const sortedAppIds = Array.from(appIds).sort();
        const lines = [
            'Ambari Metrics Application IDs',
            '='.repeat(40),
            `Total discovered: ${sortedAppIds.length}`,
            ''
        ];
        for (const appId of sortedAppIds) {
            const metricCount = entries.filter(e => (e.appid ?? e.appId ?? e.application) === appId).length;
            lines.push(`- ${appId} (${metricCount} metrics)`);
        }
        return {
            summary: lines.join('\n'),
            appIds: sortedAppIds
        };
    },
    ambari_metrics_query: async (args) => {
        const metricNames = args['metricNames'];
        const appId = args['appId'];
        const hostname = args['hostname'];
        const duration = args['duration'] ?? '1h';
        const startTime = args['startTime'];
        const endTime = args['endTime'];
        const precision = args['precision'];
        const includePoints = args['includePoints'] ?? false;
        const maxPoints = args['maxPoints'] ?? 120;
        const { startMs, endMs, description } = resolveMetricsTimeRange(duration, startTime, endTime);
        const params = {
            metricNames,
            startTime: startMs,
            endTime: endMs
        };
        if (appId)
            params['appId'] = appId;
        if (hostname)
            params['hostname'] = hostname;
        if (precision)
            params['precision'] = precision;
        const result = await executeAmbariMetricsRequest('/metrics', params);
        if (result.error) {
            return { error: true, message: `Metrics query failed: ${result.error}` };
        }
        const data = result.data;
        const metricsSection = data.metrics ?? data.timelineMetrics ?? [];
        let entries = [];
        if (Array.isArray(metricsSection)) {
            entries = metricsSection;
        }
        const metricsConfig = getAmbariMetricsConfig();
        const lines = [
            'Ambari Metrics Query Results',
            `Endpoint: ${metricsConfig.baseUrl}/metrics`,
            `Metric Names: ${metricNames}`,
            `AppId: ${appId ?? 'not specified'}`,
            `Hostname: ${hostname ?? 'cluster-wide'}`,
            `Time Window: ${description}`,
            `Results: ${entries.length} metric series`,
            ''
        ];
        const formatValue = (val) => {
            if (val === undefined)
                return '-';
            if (val === 0)
                return '0';
            if (Math.abs(val) >= 1000 || Math.abs(val) < 0.01) {
                return val.toPrecision(4);
            }
            return val.toFixed(2);
        };
        for (let idx = 0; idx < entries.length; idx++) {
            const entry = entries[idx];
            if (!entry)
                continue;
            const name = entry.metricname ?? entry.metricName ?? entry.name ?? '<unknown>';
            const app = entry.appid ?? entry.appId ?? '-';
            const host = entry.hostname ?? 'all';
            lines.push(`[${idx + 1}] ${name} (appId=${app}, host=${host})`);
            const series = metricsMapToSeries(entry.metrics);
            const summary = summarizeMetricSeries(series);
            if (!summary) {
                lines.push('    No datapoints returned for this metric.');
                lines.push('');
                continue;
            }
            lines.push(`    Points=${summary.count} | min=${formatValue(summary.min)} | max=${formatValue(summary.max)} | avg=${formatValue(summary.avg)}`);
            lines.push(`    first=${formatValue(summary.first)} @ ${formatTimestamp(summary.start_timestamp)}`);
            lines.push(`    last=${formatValue(summary.last)} @ ${formatTimestamp(summary.end_timestamp)}`);
            lines.push(`    delta=${formatValue(summary.delta)} over ${(summary.duration_ms / 1000).toFixed(1)}s`);
            if (includePoints && series.length > 0) {
                const sampled = series.length > maxPoints
                    ? series.filter((_, i) => i % Math.ceil(series.length / maxPoints) === 0).slice(0, maxPoints)
                    : series;
                lines.push('    Sampled datapoints:');
                for (const point of sampled) {
                    lines.push(`      • ${formatTimestamp(point.timestamp)} → ${formatValue(point.value)}`);
                }
                if (series.length > sampled.length) {
                    lines.push(`      ... ${series.length - sampled.length} additional points omitted`);
                }
            }
            lines.push('');
        }
        return {
            summary: lines.join('\n'),
            count: entries.length,
            metrics: entries.map(e => ({
                name: e.metricname ?? e.metricName ?? e.name,
                appId: e.appid ?? e.appId,
                hostname: e.hostname,
                summary: summarizeMetricSeries(metricsMapToSeries(e.metrics))
            }))
        };
    },
    ambari_metrics_hdfs_report: async (args) => {
        const clusterName = args['clusterName'] || await getClusterName();
        const lookbackMinutes = args['lookbackMinutes'] ?? 10;
        const lookbackMs = lookbackMinutes * 60 * 1000;
        // Capacity metrics from NameNode
        const capacityMetrics = {
            configuredCapacity: 'dfs.FSNamesystem.CapacityTotal',
            dfsUsed: 'dfs.FSNamesystem.CapacityUsed',
            dfsRemaining: 'dfs.FSNamesystem.CapacityRemaining',
            nonDfsUsed: 'dfs.FSNamesystem.CapacityUsedNonDFS',
            underReplicated: 'dfs.FSNamesystem.UnderReplicatedBlocks',
            corruptBlocks: 'dfs.FSNamesystem.CorruptBlocks',
            missingBlocks: 'dfs.FSNamesystem.MissingBlocks'
        };
        const clusterValues = {};
        for (const [key, metricName] of Object.entries(capacityMetrics)) {
            clusterValues[key] = await fetchLatestMetricValue(metricName, 'namenode', undefined, lookbackMs);
        }
        const configured = clusterValues['configuredCapacity'];
        const dfsUsed = clusterValues['dfsUsed'] ?? 0;
        const dfsRemaining = clusterValues['dfsRemaining'] ?? 0;
        const presentCapacity = dfsUsed + dfsRemaining;
        const lines = [
            `HDFS DFSAdmin Report (cluster: ${clusterName})`,
            '='.repeat(72),
            `Configured Capacity: ${formatBytes(configured)}`,
            `Present Capacity: ${formatBytes(presentCapacity)}`,
            `DFS Remaining: ${formatBytes(dfsRemaining)}`,
            `DFS Used: ${formatBytes(dfsUsed)}`,
            `DFS Used%: ${presentCapacity > 0 ? ((dfsUsed / presentCapacity) * 100).toFixed(2) + '%' : 'N/A'}`,
            '',
            'Replicated Blocks:',
            `  Under replicated blocks: ${clusterValues['underReplicated'] ?? 0}`,
            `  Blocks with corrupt replicas: ${clusterValues['corruptBlocks'] ?? 0}`,
            `  Missing blocks: ${clusterValues['missingBlocks'] ?? 0}`
        ];
        // Get DataNode hosts
        try {
            const hostsData = await ambariGet(`/clusters/${clusterName}/hosts`, {
                fields: 'Hosts/host_name,host_components/HostRoles/component_name'
            });
            const dataNodeHosts = (hostsData.items ?? []).filter(host => {
                const components = host.host_components ?? [];
                return components.some(c => c.HostRoles?.component_name === 'DATANODE');
            });
            lines.push('');
            lines.push('-'.repeat(72));
            lines.push(`Live datanodes (${dataNodeHosts.length}):`);
            for (const host of dataNodeHosts) {
                const hostName = host.Hosts?.host_name ?? 'unknown';
                lines.push('');
                lines.push(`Name: ${hostName}`);
                lines.push('Decommission Status: Normal');
                // Try to get DataNode metrics
                const dnCapacity = await fetchLatestMetricValue('FSDatasetState.org.apache.hadoop.hdfs.server.datanode.fsdataset.impl.FsDatasetImpl.Capacity', 'datanode', hostName, lookbackMs);
                const dnUsed = await fetchLatestMetricValue('FSDatasetState.org.apache.hadoop.hdfs.server.datanode.fsdataset.impl.FsDatasetImpl.DfsUsed', 'datanode', hostName, lookbackMs);
                const dnRemaining = await fetchLatestMetricValue('FSDatasetState.org.apache.hadoop.hdfs.server.datanode.fsdataset.impl.FsDatasetImpl.Remaining', 'datanode', hostName, lookbackMs);
                lines.push(`Configured Capacity: ${formatBytes(dnCapacity)}`);
                lines.push(`DFS Used: ${formatBytes(dnUsed)}`);
                lines.push(`DFS Remaining: ${formatBytes(dnRemaining)}`);
                if (dnCapacity && dnUsed) {
                    lines.push(`DFS Used%: ${((dnUsed / dnCapacity) * 100).toFixed(2)}%`);
                }
                if (dnCapacity && dnRemaining) {
                    lines.push(`DFS Remaining%: ${((dnRemaining / dnCapacity) * 100).toFixed(2)}%`);
                }
            }
        }
        catch (error) {
            lines.push('');
            lines.push(`Error retrieving DataNode information: ${error instanceof Error ? error.message : String(error)}`);
        }
        return {
            summary: lines.join('\n'),
            clusterCapacity: {
                configured,
                present: presentCapacity,
                used: dfsUsed,
                remaining: dfsRemaining,
                underReplicated: clusterValues['underReplicated'],
                corrupt: clusterValues['corruptBlocks'],
                missing: clusterValues['missingBlocks']
            }
        };
    }
};
//# sourceMappingURL=metrics-tools.js.map