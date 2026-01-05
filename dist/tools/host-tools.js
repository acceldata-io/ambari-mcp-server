/**
 * Host Management Tools for Ambari MCP Server
 */
import { ambariGet, getClusterName } from '../api-client.js';
import { formatTimestamp, formatBytes, safePercent } from '../utils.js';
// ============================================================================
// Tool Definitions
// ============================================================================
export const HOST_TOOLS = [
    {
        name: 'ambari_hosts_gethosts',
        description: 'Returns a collection of all hosts in the cluster with their status',
        inputSchema: {
            type: 'object',
            properties: {
                clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
                fields: { type: 'string', description: 'Filter fields in the response', default: 'Hosts/*' },
                sortBy: { type: 'string', description: 'Sort resources in result by (asc | desc)', default: 'Hosts/host_name.asc' },
                page_size: { type: 'integer', description: 'The number of resources to be returned', default: 50 }
            },
            required: []
        }
    },
    {
        name: 'ambari_hosts_gethost',
        description: 'Returns detailed information about a single host including hardware, metrics, and components',
        inputSchema: {
            type: 'object',
            properties: {
                hostName: { type: 'string', description: 'The name of the host' },
                clusterName: { type: 'string', description: 'The name of the cluster (optional)' },
                fields: { type: 'string', description: 'Filter fields in the response', default: 'Hosts/*,host_components/*,metrics/*' }
            },
            required: ['hostName']
        }
    },
    {
        name: 'ambari_hosts_gethostdetails',
        description: 'Returns comprehensive details for a host including metrics, components, alerts summary, and disk info',
        inputSchema: {
            type: 'object',
            properties: {
                hostName: { type: 'string', description: 'The name of the host' },
                clusterName: { type: 'string', description: 'The name of the cluster (optional)' }
            },
            required: ['hostName']
        }
    },
    {
        name: 'ambari_hosts_getallhostdetails',
        description: 'Returns detailed information for all hosts in the cluster',
        inputSchema: {
            type: 'object',
            properties: {
                clusterName: { type: 'string', description: 'The name of the cluster (optional)' }
            },
            required: []
        }
    },
    {
        name: 'ambari_hosts_gethostcomponents',
        description: 'Returns all components installed on a specific host',
        inputSchema: {
            type: 'object',
            properties: {
                hostName: { type: 'string', description: 'The name of the host' },
                clusterName: { type: 'string', description: 'The name of the cluster (optional)' }
            },
            required: ['hostName']
        }
    }
];
async function formatHostDetails(hostName, clusterName) {
    const data = await ambariGet(`/clusters/${clusterName}/hosts/${hostName}`, {
        fields: 'Hosts,host_components/HostRoles/state,host_components/HostRoles/service_name,host_components/HostRoles/component_name,metrics,alerts_summary,kerberos_identities'
    });
    const hostInfo = data.Hosts ?? {};
    const hostComponents = data.host_components ?? [];
    const metrics = data.metrics ?? {};
    const alertsSummary = data.alerts_summary ?? {};
    const lines = [
        `Host Details: ${hostInfo.host_name ?? hostName}`,
        '='.repeat(50),
        '',
        'Basic Information:',
        `  Host Name: ${hostInfo.host_name ?? hostName}`,
        `  Public Name: ${hostInfo.public_host_name ?? 'N/A'}`,
        `  IP Address: ${hostInfo.ip ?? 'N/A'}`,
        `  Cluster: ${hostInfo.cluster_name ?? clusterName}`,
        `  Host State: ${hostInfo.host_state ?? 'Unknown'}`,
        `  Host Status: ${hostInfo.host_status ?? 'Unknown'}`,
        `  Maintenance: ${hostInfo.maintenance_state ?? 'OFF'}`,
        '',
        'System Information:',
        `  OS Type: ${hostInfo.os_type ?? 'N/A'}`,
        `  OS Family: ${hostInfo.os_family ?? 'N/A'}`,
        `  Architecture: ${hostInfo.os_arch ?? 'N/A'}`,
        `  Rack: ${hostInfo.rack_info ?? 'N/A'}`,
        '',
        'Status Information:',
        `  Last Heartbeat: ${formatTimestamp(hostInfo.last_heartbeat_time)}`,
        `  Last Registration: ${formatTimestamp(hostInfo.last_registration_time)}`,
        `  Health Report: ${hostInfo.host_health_report || 'No issues reported'}`,
        `  Recovery Summary: ${hostInfo.recovery_summary ?? 'N/A'}`,
    ];
    // Alerts Summary
    if (Object.keys(alertsSummary).length > 0) {
        lines.push('');
        lines.push('Alerts Summary:');
        const critical = alertsSummary.CRITICAL ?? 0;
        const warning = alertsSummary.WARNING ?? 0;
        const ok = alertsSummary.OK ?? 0;
        const unknown = alertsSummary.UNKNOWN ?? 0;
        lines.push(`  Critical: ${critical}, Warning: ${warning}, OK: ${ok}, Unknown: ${unknown}`);
    }
    // Metrics
    if (metrics.cpu || metrics.memory) {
        lines.push('');
        lines.push('Performance Metrics:');
        if (metrics.cpu) {
            const cpu = metrics.cpu;
            lines.push(`  CPU Count: ${cpu.cpu_num ?? hostInfo.cpu_count ?? 'N/A'} (Physical: ${hostInfo.ph_cpu_count ?? 'N/A'})`);
            lines.push(`  CPU Usage: Idle ${cpu.cpu_idle?.toFixed(1) ?? 'N/A'}%, User ${cpu.cpu_user?.toFixed(1) ?? 'N/A'}%, System ${cpu.cpu_system?.toFixed(1) ?? 'N/A'}%`);
        }
        if (metrics.memory) {
            const mem = metrics.memory;
            const memTotal = mem.mem_total ?? 0;
            const memFree = mem.mem_free ?? 0;
            const memUsed = memTotal - memFree;
            lines.push(`  Memory: ${formatBytes(memUsed * 1024)} used of ${formatBytes(memTotal * 1024)} (${safePercent(memUsed, memTotal)} used)`);
            if (mem.swap_total) {
                const swapTotal = mem.swap_total;
                const swapFree = mem.swap_free ?? 0;
                lines.push(`  Swap: ${formatBytes((swapTotal - swapFree) * 1024)} used of ${formatBytes(swapTotal * 1024)}`);
            }
        }
        if (metrics.load) {
            const load = metrics.load;
            lines.push(`  Load Average: ${load.load_one ?? 0} / ${load.load_five ?? 0} / ${load.load_fifteen ?? 0} (1/5/15 min)`);
        }
        if (metrics.disk) {
            const disk = metrics.disk;
            lines.push(`  Disk: ${formatBytes((disk.disk_total ?? 0) * 1024 * 1024 * 1024)} total, ${formatBytes((disk.disk_free ?? 0) * 1024 * 1024 * 1024)} free`);
        }
    }
    // Disk Info
    const diskInfo = hostInfo.disk_info ?? [];
    if (diskInfo.length > 0) {
        lines.push('');
        lines.push(`Disk Details (${diskInfo.length} disks):`);
        for (const disk of diskInfo.slice(0, 5)) {
            lines.push(`  ${disk.mountpoint ?? 'Unknown'} (${disk.device ?? 'Unknown'}): ${disk.used ?? '0'} used of ${disk.size ?? '0'} (${disk.percent ?? '0%'})`);
        }
        if (diskInfo.length > 5) {
            lines.push(`  ... and ${diskInfo.length - 5} more disks`);
        }
    }
    // Host Components
    if (hostComponents.length > 0) {
        lines.push('');
        lines.push(`Host Components (${hostComponents.length}):`);
        // Group by service
        const byService = {};
        for (const comp of hostComponents) {
            const roles = comp.HostRoles ?? {};
            const serviceName = roles.service_name ?? 'Unknown';
            if (!byService[serviceName])
                byService[serviceName] = [];
            byService[serviceName].push({
                name: roles.component_name ?? 'Unknown',
                state: roles.state ?? 'Unknown'
            });
        }
        for (const [service, comps] of Object.entries(byService)) {
            lines.push(`  ${service}:`);
            for (const comp of comps) {
                const indicator = comp.state === 'STARTED' ? '✓' : comp.state === 'INSTALLED' ? '○' : '?';
                lines.push(`    ${indicator} ${comp.name} [${comp.state}]`);
            }
        }
    }
    // Agent Environment
    const agentEnv = hostInfo.last_agent_env;
    if (agentEnv) {
        lines.push('');
        lines.push('Agent Environment:');
        lines.push(`  Firewall: ${agentEnv.firewallName ?? 'Unknown'} (${agentEnv.firewallRunning ? 'Running' : 'Stopped'})`);
        lines.push(`  JCE Policy: ${agentEnv.hasUnlimitedJcePolicy ? 'Unlimited' : 'Limited'}`);
        lines.push(`  Umask: ${agentEnv.umask ?? 'N/A'}`);
        if (agentEnv.transparentHugePage) {
            lines.push(`  THP: ${agentEnv.transparentHugePage}`);
        }
        const liveServices = agentEnv.hostHealth?.liveServices ?? [];
        if (liveServices.length > 0) {
            lines.push(`  Live Services: ${liveServices.length}`);
        }
    }
    return {
        summary: lines.join('\n'),
        data
    };
}
// ============================================================================
// Tool Executors
// ============================================================================
export const hostToolExecutors = {
    ambari_hosts_gethosts: async (args) => {
        const clusterName = args['clusterName'] || await getClusterName();
        const params = {};
        if (args['fields'])
            params['fields'] = args['fields'];
        if (args['sortBy'])
            params['sortBy'] = args['sortBy'];
        if (args['page_size'])
            params['page_size'] = args['page_size'];
        const data = await ambariGet(`/clusters/${clusterName}/hosts`, params);
        const hosts = data.items ?? [];
        const lines = [
            `Hosts in Cluster: ${clusterName}`,
            '='.repeat(50),
            `Total: ${hosts.length} hosts`,
            ''
        ];
        for (const host of hosts) {
            const info = host.Hosts ?? {};
            const status = info.host_status ?? 'Unknown';
            const state = info.host_state ?? 'Unknown';
            const indicator = status === 'HEALTHY' ? '✓' : status === 'UNHEALTHY' ? '✗' : '?';
            lines.push(`${indicator} ${info.host_name ?? 'Unknown'} - Status: ${status}, State: ${state}`);
        }
        return {
            summary: lines.join('\n'),
            result: data
        };
    },
    ambari_hosts_gethost: async (args) => {
        const clusterName = args['clusterName'] || await getClusterName();
        const hostName = args['hostName'];
        const params = {};
        if (args['fields'])
            params['fields'] = args['fields'];
        const data = await ambariGet(`/clusters/${clusterName}/hosts/${hostName}`, params);
        return { result: data };
    },
    ambari_hosts_gethostdetails: async (args) => {
        const clusterName = args['clusterName'] || await getClusterName();
        const hostName = args['hostName'];
        return await formatHostDetails(hostName, clusterName);
    },
    ambari_hosts_getallhostdetails: async (args) => {
        const clusterName = args['clusterName'] || await getClusterName();
        // Get list of hosts first
        const hostsData = await ambariGet(`/clusters/${clusterName}/hosts`, {
            fields: 'Hosts/host_name'
        });
        const hosts = hostsData.items ?? [];
        const results = [];
        for (const host of hosts) {
            const hostName = host.Hosts?.host_name;
            if (!hostName)
                continue;
            try {
                const details = await formatHostDetails(hostName, clusterName);
                results.push({
                    hostName,
                    summary: details.summary,
                    data: details.data
                });
            }
            catch (error) {
                results.push({
                    hostName,
                    summary: `Error retrieving details: ${error instanceof Error ? error.message : String(error)}`,
                    data: null
                });
            }
        }
        const overallLines = [
            `All Host Details for Cluster: ${clusterName}`,
            '='.repeat(60),
            `Total: ${results.length} hosts`,
            ''
        ];
        for (const result of results) {
            overallLines.push(result.summary);
            overallLines.push('');
            overallLines.push('-'.repeat(60));
            overallLines.push('');
        }
        return {
            summary: overallLines.join('\n'),
            hosts: results.map(r => ({ hostName: r.hostName, data: r.data }))
        };
    },
    ambari_hosts_gethostcomponents: async (args) => {
        const clusterName = args['clusterName'] || await getClusterName();
        const hostName = args['hostName'];
        const data = await ambariGet(`/clusters/${clusterName}/hosts/${hostName}/host_components`, {
            fields: 'HostRoles/component_name,HostRoles/service_name,HostRoles/state,HostRoles/stale_configs'
        });
        const components = data.items ?? [];
        const lines = [
            `Components on Host: ${hostName}`,
            '='.repeat(50),
            `Total: ${components.length} components`,
            ''
        ];
        // Group by service
        const byService = {};
        for (const comp of components) {
            const roles = comp.HostRoles ?? {};
            const serviceName = roles.service_name ?? 'Unknown';
            if (!byService[serviceName])
                byService[serviceName] = [];
            byService[serviceName].push({
                name: roles.component_name ?? 'Unknown',
                state: roles.state ?? 'Unknown',
                stale: roles.stale_configs ?? false
            });
        }
        for (const [service, comps] of Object.entries(byService)) {
            lines.push(`${service}:`);
            for (const comp of comps) {
                const indicator = comp.state === 'STARTED' ? '✓' : comp.state === 'INSTALLED' ? '○' : '?';
                const staleMarker = comp.stale ? ' ⚠️ (stale)' : '';
                lines.push(`  ${indicator} ${comp.name} [${comp.state}]${staleMarker}`);
            }
            lines.push('');
        }
        return {
            summary: lines.join('\n'),
            result: data
        };
    }
};
//# sourceMappingURL=host-tools.js.map