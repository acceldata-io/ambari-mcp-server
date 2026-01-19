# Ambari MCP Server

A comprehensive Model Context Protocol (MCP) server for Apache Ambari, providing tools for cluster management, service operations, configuration management, status monitoring, and alert tracking.

## Features

### Cluster Management
- View all clusters and cluster details
- Get cluster health status and service overview
- Auto-detect cluster name from Ambari

### Service Management
- List all services with their current state
- Start, stop, and restart individual services
- Start/stop all services at once
- Get detailed service state with component breakdown
- Enable/disable maintenance mode
- Run service checks
- View stale configurations requiring restart

### Host Management
- List all hosts in the cluster
- Get detailed host information including:
  - Hardware specs (CPU, memory, disk)
  - Performance metrics (CPU usage, memory, load average)
  - Installed components and their state
  - Agent environment details
  - Alerts summary

### Alert Management
- Get current alerts with filtering (by state, service, host)
- View alert history with time range filtering
- Alert summary by state and service
- Manage alert definitions (enable/disable)
- Manage alert groups (create, update, delete)
- Manage notification targets

### Configuration Management
- List all configuration types
- Get specific configuration values
- Search configurations across all types
- Dump configurations with filtering
- Update configuration properties

### Ambari Metrics (AMS)
- List available metrics and app IDs
- Query time-series metrics
- Generate HDFS DFSAdmin-style reports
- Support for various precision levels

### Request/Operation Tracking
- Get status of specific requests
- View active (in-progress) operations
- List recent operations
- View task details for requests

### User Management
- List all Ambari users
- Get detailed user information

### Kubernetes Support
- Native support for Ambari clusters running on Kubernetes
- Execute commands in Ambari agent pods via `kubectl exec`
- Restart Ambari agents in K8s pods
- Check agent status across pods
- Get pod logs
- No SSH keys needed - uses kubeconfig for authentication

## Installation

### Prerequisites
- Node.js 18.0 or higher
- Access to an Apache Ambari server

### Setup

1. Clone the repository:
```bash
git clone https://github.com/your-org/ambari-mcp-server.git
cd ambari-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp env.example .env
```

Edit `.env` with your Ambari server details:
```env
AMBARI_BASE_URL=http://your-ambari-server:8080/api/v1
AMBARI_USERNAME=admin
AMBARI_PASSWORD=your-password
AMBARI_CLUSTER_NAME=your-cluster  # Optional, will auto-detect if not set
TIMEOUT_MS=30000

# Optional: Ambari Metrics Service (AMS)
AMBARI_METRICS_HOST=your-ams-host
AMBARI_METRICS_PORT=6188
```

4. Build the project:
```bash
npm run build
```

5. Start the server:
```bash
npm start
```

## Docker Usage

Run the Ambari MCP Server as a Docker container for simplified deployment.

📖 **See [DOCKER-README.md](./DOCKER-README.md) for complete Docker deployment instructions**, including:
- Quick start setup (3 steps)
- Configuration for Kubernetes and VM-based clusters
- **Multi-cluster setup** (connect to multiple Ambari environments)
- Claude Desktop / Cursor integration
- Troubleshooting guide

**Quick links:**
- **Docker Hub:** [bsprmkumar/ambari-mcp-server](https://hub.docker.com/r/bsprmkumar/ambari-mcp-server)
- **Template:** [ambari-mcp.env.template](./ambari-mcp.env.template)

## MCP Configuration (Node.js - Alternative)

If you prefer running with Node.js directly instead of Docker:

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "ambari": {
      "command": "node",
      "args": ["/path/to/ambari-mcp-server/dist/index.js"],
      "env": {
        "AMBARI_BASE_URL": "http://your-ambari-server:8080/api/v1",
        "AMBARI_USERNAME": "admin",
        "AMBARI_PASSWORD": "your-password"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "ambari": {
      "command": "node",
      "args": ["/path/to/ambari-mcp-server/dist/index.js"]
    }
  }
}
```

Make sure your `.env` file is properly configured.

## Available Tools

### Cluster Tools
| Tool | Description |
|------|-------------|
| `ambari_clusters_getclusters` | Returns all clusters managed by Ambari |
| `ambari_clusters_getcluster` | Returns detailed information about a specific cluster |
| `ambari_clusters_createcluster` | Creates a new cluster in Ambari |
| `ambari_cluster_info` | Retrieves comprehensive cluster information |

### Service Tools
| Tool | Description |
|------|-------------|
| `ambari_services_getservices` | Get all services with their current state |
| `ambari_services_getservice` | Get detailed information about a specific service |
| `ambari_services_getservicestate` | Get detailed state including components |
| `ambari_services_getcomponents` | Get all components for a service |
| `ambari_services_startservice` | Start a specific service |
| `ambari_services_stopservice` | Stop a specific service |
| `ambari_services_restartservice` | Restart a service (stop then start) |
| `ambari_services_startall` | Start all services in the cluster |
| `ambari_services_stopall` | Stop all services in the cluster |
| `ambari_services_getstaleconfigs` | Get components needing restart |
| `ambari_services_enablemaintenancemode` | Enable maintenance mode |
| `ambari_services_disablemaintenancemode` | Disable maintenance mode |
| `ambari_services_runservicecheck` | Run a service check |

### Host Tools
| Tool | Description |
|------|-------------|
| `ambari_hosts_gethosts` | Returns all hosts in the cluster |
| `ambari_hosts_gethost` | Returns information about a single host |
| `ambari_hosts_gethostdetails` | Returns comprehensive host details with metrics |
| `ambari_hosts_getallhostdetails` | Returns detailed info for all hosts |
| `ambari_hosts_gethostcomponents` | Returns all components on a host |

### Alert Tools
| Tool | Description |
|------|-------------|
| `ambari_alerts_getcurrent` | Get current alerts with filtering |
| `ambari_alerts_getsummary` | Get alert summary by state |
| `ambari_alerts_gethistory` | Get alert history with time range |
| `ambari_alerts_getdefinitions` | Get all alert definitions |
| `ambari_alerts_updatedefinition` | Update an alert definition |
| `ambari_alerts_getgroups` | Get all alert groups |
| `ambari_alerts_creategroup` | Create a new alert group |
| `ambari_alerts_updategroup` | Update an alert group |
| `ambari_alerts_deletegroup` | Delete an alert group |
| `ambari_alerts_gettargets` | Get notification targets |
| `ambari_alerts_createtarget` | Create notification target |
| `ambari_alerts_updatetarget` | Update notification target |
| `ambari_alerts_deletetarget` | Delete notification target |

### Configuration Tools
| Tool | Description |
|------|-------------|
| `ambari_config_gettypes` | Get all configuration types |
| `ambari_config_getconfig` | Get configuration for a specific type |
| `ambari_config_getproperty` | Get a specific property value |
| `ambari_config_search` | Search properties across all configs |
| `ambari_config_dump` | Dump configurations with filtering |
| `ambari_config_updateproperty` | Update a configuration property |

### Metrics Tools
| Tool | Description |
|------|-------------|
| `ambari_metrics_getmetadata` | Get available metrics metadata |
| `ambari_metrics_getappids` | List all application IDs |
| `ambari_metrics_query` | Query time-series metrics |
| `ambari_metrics_hdfs_report` | Generate HDFS capacity report |

### Request Tools
| Tool | Description |
|------|-------------|
| `ambari_requests_getstatus` | Get status of a specific request |
| `ambari_requests_getactive` | Get all active operations |
| `ambari_requests_getrecent` | Get recent operations |
| `ambari_requests_gettasks` | Get tasks for a request |

### User Tools
| Tool | Description |
|------|-------------|
| `ambari_users_list` | List all Ambari users |
| `ambari_users_get` | Get detailed user information |

### Kubernetes Tools
| Tool | Description |
|------|-------------|
| `ambari_k8s_status` | Check K8s configuration and kubectl availability |
| `ambari_k8s_list_pods` | List all Ambari pods matching the label selector |
| `ambari_k8s_restart_agent` | Restart Ambari agent in K8s pods |
| `ambari_k8s_run_command` | Execute a shell command in Ambari pods |
| `ambari_k8s_check_agent_status` | Check Ambari agent status in pods |
| `ambari_k8s_restart_agent_and_wait` | Restart agents and wait for re-registration |
| `ambari_k8s_get_pod_logs` | Get Ambari agent logs from a pod |

## Available Resources

Resources provide structured access to Ambari data:

| URI | Description |
|-----|-------------|
| `ambari://clusters` | List of all clusters |
| `ambari://cluster/{name}` | Cluster details |
| `ambari://cluster/{name}/services` | All services in cluster |
| `ambari://cluster/{name}/hosts` | All hosts in cluster |
| `ambari://cluster/{name}/alerts` | Current alerts |
| `ambari://cluster/{name}/alerts/summary` | Alert summary |
| `ambari://cluster/{name}/services/stale-configs` | Stale configurations |
| `ambari://cluster/{name}/service/{service}` | Service details |
| `ambari://cluster/{name}/service/{service}/components` | Service components |
| `ambari://host/{hostname}` | Host details |
| `ambari://cluster/{name}/requests/recent` | Recent operations |
| `ambari://cluster/{name}/configurations` | Configuration types |

## Development

### Build
```bash
npm run build
```

### Development mode
```bash
npm run dev
```

### Clean build
```bash
npm run rebuild
```

## License

Apache-2.0

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

