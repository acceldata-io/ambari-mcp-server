# Ambari MCP Server - Design Document

**Version:** 1.0.0  
**Date:** January 2026  
**Authors:** Ambari MCP Server Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Architecture](#3-architecture)
4. [Components](#4-components)
5. [Tool Catalog](#5-tool-catalog)
6. [Resource Catalog](#6-resource-catalog)
7. [Configuration](#7-configuration)
8. [Security](#8-security)
9. [Deployment](#9-deployment)
10. [Integration](#10-integration)
11. [Future Enhancements](#11-future-enhancements)

---

## 1. Executive Summary

### 1.1 Purpose

The Ambari MCP Server is a **Model Context Protocol (MCP)** server that enables AI assistants and LLM-powered applications to interact with Apache Ambari clusters. It provides a standardized interface for cluster management, service operations, configuration management, monitoring, and administrative tasks.

### 1.2 Key Features

- **52 Tools** for cluster operations, service management, alerts, configurations, and SSH operations
- **12 Resources** for structured data access
- **SSH Integration** for direct command execution on cluster nodes
- **Multi-transport support** (stdio for MCP clients)

### 1.3 Target Audience

- DevOps engineers managing Hadoop clusters
- Site Reliability Engineers (SREs)
- Data platform administrators
- AI/LLM application developers integrating with Hadoop infrastructure

---

## 2. System Overview

### 2.1 What is MCP?

The **Model Context Protocol (MCP)** is an open protocol that enables AI models to securely interact with external systems through:

- **Tools**: Functions the AI can invoke to perform actions
- **Resources**: Structured data the AI can read
- **Prompts**: Pre-defined conversation templates

### 2.2 What is Apache Ambari?

Apache Ambari is a management platform for provisioning, managing, and monitoring Apache Hadoop clusters. It provides:

- Cluster provisioning and configuration
- Service lifecycle management (start/stop/restart)
- Centralized monitoring and alerting
- Configuration management
- User and permission management

### 2.3 Problem Statement

Managing Hadoop clusters through Ambari typically requires:
- Manual navigation through the Ambari web UI
- Direct REST API calls with complex authentication
- SSH access to individual nodes for troubleshooting

This MCP server bridges the gap by allowing AI assistants to perform these operations through natural language commands.

---

## 3. Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP Clients                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Claude       │  │ Continue     │  │ Open WebUI   │           │
│  │ Desktop      │  │ (IDE)        │  │ + Ollama     │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
└─────────┼─────────────────┼─────────────────┼───────────────────┘
          │                 │                 │
          │    MCP Protocol (stdio/JSON-RPC)  │
          │                 │                 │
          └────────────────┬┴─────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│                    Ambari MCP Server                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                     MCP SDK Layer                          │ │
│  │  • Request Handler    • Tool Registry    • Resource Registry│ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                     Tool Modules                           │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │ │
│  │  │Cluster  │ │Service  │ │Host     │ │Alert    │          │ │
│  │  │Tools    │ │Tools    │ │Tools    │ │Tools    │          │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐                      │ │
│  │  │Config   │ │User     │ │Request  │                      │ │
│  │  │Tools    │ │Tools    │ │Tools    │                      │ │
│  │  └─────────┘ └─────────┘ └─────────┘                      │ │
│  │  ┌─────────┐                                               │ │
│  │  │SSH      │                                               │ │
│  │  │Tools    │                                               │ │
│  │  └─────────┘                                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   API Client Layer                         │ │
│  │  ┌─────────────────────────────────┐  ┌──────────────────┐ │ │
│  │  │ Ambari REST API Client          │  │ SSH Client       │ │ │
│  │  └────────────────┬────────────────┘  └────────┬─────────┘ │ │
│  └───────────────────┼────────────────────────────┼──────────┘ │
└──────────────────────┼────────────────────────────┼────────────┘
                       │                            │
                       ▼                            ▼
          ┌──────────────────────┐      ┌──────────────────┐
          │   Ambari Server      │      │  Cluster Nodes   │
          │   (REST API)         │      │  (via SSH)       │
          │   :8080 / :8443      │      │  :22             │
          └──────────────────────┘      └──────────────────┘
                       │                            │
                       └────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │      Hadoop Cluster           │
                    │  ┌─────┐ ┌─────┐ ┌─────┐     │
                    │  │Node1│ │Node2│ │Node3│ ... │
                    │  └─────┘ └─────┘ └─────┘     │
                    └───────────────────────────────┘
```

### 3.2 Component Interaction Flow

```
┌────────┐     ┌─────────────┐     ┌─────────────┐     ┌────────────┐
│  User  │────▶│  AI Client  │────▶│  MCP Server │────▶│  Ambari    │
│        │     │  (Claude)   │     │             │     │  Server    │
└────────┘     └─────────────┘     └─────────────┘     └────────────┘
    │                │                    │                   │
    │ "Restart HDFS" │                    │                   │
    │───────────────▶│                    │                   │
    │                │  tools/call        │                   │
    │                │  ambari_services_  │                   │
    │                │  restart_service   │                   │
    │                │───────────────────▶│                   │
    │                │                    │  PUT /services/   │
    │                │                    │  HDFS             │
    │                │                    │──────────────────▶│
    │                │                    │                   │
    │                │                    │◀──────────────────│
    │                │                    │  {request_id: 42} │
    │                │◀───────────────────│                   │
    │                │  Tool Result       │                   │
    │◀───────────────│                    │                   │
    │ "HDFS restart  │                    │                   │
    │  initiated,    │                    │                   │
    │  request #42"  │                    │                   │
```

### 3.3 Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 18+ |
| Language | TypeScript 5.x |
| MCP SDK | @modelcontextprotocol/sdk |
| HTTP Client | Axios |
| SSH Client | ssh2 |
| Configuration | dotenv |
| Transport | stdio (JSON-RPC 2.0) |

---

## 4. Components

### 4.1 Directory Structure

```
ambari-mcp-server/
├── src/
│   ├── index.ts              # Main entry point & MCP server
│   ├── config.ts             # Configuration management
│   ├── types.ts              # TypeScript type definitions
│   ├── api-client.ts         # Ambari REST API client
│   ├── ssh-client.ts         # SSH command execution
│   ├── resources.ts          # MCP Resource definitions
│   └── tools/
│       ├── index.ts          # Tool aggregator
│       ├── cluster-tools.ts  # Cluster management
│       ├── service-tools.ts  # Service operations
│       ├── host-tools.ts     # Host management
│       ├── alert-tools.ts    # Alert management
│       ├── config-tools.ts   # Configuration tools
│       ├── user-tools.ts     # User management
│       ├── request-tools.ts  # Request tracking
│       └── ssh-tools.ts      # SSH operations
├── dist/                     # Compiled JavaScript
├── package.json
├── tsconfig.json
├── .env                      # Configuration (gitignored)
├── env.example               # Configuration template
├── README.md
└── DESIGN.md                 # This document
```

### 4.2 Core Modules

#### 4.2.1 Configuration Module (`config.ts`)

Manages all configuration from environment variables:

```typescript
interface AmbariConfig {
  baseUrl: string;        // Ambari REST API URL
  username: string;       // Ambari username
  password: string;       // Ambari password
  clusterName: string;    // Target cluster name
  timeoutMs: number;      // Request timeout
  insecureSsl: boolean;   // Skip SSL verification
}

interface SshConfig {
  privateKeyPath: string; // Path to PEM file
  username: string;       // SSH username
  port: number;           // SSH port
  timeout: number;        // Connection timeout
  enabled: boolean;       // Whether SSH is configured
}
```

#### 4.2.2 API Client Module (`api-client.ts`)

Provides HTTP communication with Ambari:

- `executeAmbariRequest()` - Generic HTTP request handler
- `ambariGet()` / `ambariPost()` / `ambariPut()` / `ambariDelete()` - HTTP method wrappers
- `getClusterName()` - Auto-detect cluster name if not configured

#### 4.2.3 SSH Client Module (`ssh-client.ts`)

Enables remote command execution:

- `executeRemoteCommand()` - Run command on single host
- `executeRemoteCommandOnHosts()` - Run command on multiple hosts in parallel
- `isSshConfigured()` - Check if SSH is available

#### 4.2.4 Resources Module (`resources.ts`)

Defines MCP Resources for structured data access:

```typescript
const AMBARI_RESOURCES = [
  { uri: 'ambari://clusters', name: 'All Clusters' },
  { uri: 'ambari://cluster/{name}/services', name: 'Cluster Services' },
  { uri: 'ambari://cluster/{name}/hosts', name: 'Cluster Hosts' },
  { uri: 'ambari://cluster/{name}/alerts', name: 'Cluster Alerts' },
  // ... more resources
];
```

---

## 5. Tool Catalog

### 5.1 Tool Categories Summary

| Category | Count | Description |
|----------|-------|-------------|
| Cluster | 4 | Cluster information and management |
| Services | 13 | Service lifecycle and status |
| Hosts | 5 | Host information and management |
| Alerts | 13 | Alert monitoring and management |
| Config | 6 | Configuration management |
| Users | 2 | User administration |
| Requests | 4 | Operation request tracking |
| SSH | 5 | Remote command execution |
| **Total** | **52** | |

### 5.2 Cluster Tools

| Tool Name | Description |
|-----------|-------------|
| `ambari_cluster_info` | Get comprehensive cluster information |
| `ambari_clusters_getclusters` | List all clusters |
| `ambari_clusters_getcluster` | Get specific cluster details |
| `ambari_clusters_createcluster` | Create a new cluster |

### 5.3 Service Tools

| Tool Name | Description |
|-----------|-------------|
| `ambari_services_getservices` | List all services in cluster |
| `ambari_services_getservice` | Get specific service details |
| `ambari_services_startservice` | Start a service |
| `ambari_services_stopservice` | Stop a service |
| `ambari_services_restartservice` | Restart a service |
| `ambari_services_getservicestate` | Get service state details |
| `ambari_services_getserviceswithstaleconfigs` | Find services needing restart |
| `ambari_services_gethostcomponentswithstaleconfigs` | Find components needing restart |
| `ambari_services_restartcomponents` | Restart specific components |
| `ambari_services_enablemaintenancemode` | Enable maintenance mode |
| `ambari_services_disablemaintenancemode` | Disable maintenance mode |
| `ambari_services_runservicecheck` | Run service health check |
| `ambari_services_getservicecheckstatus` | Get service check status |

### 5.4 Host Tools

| Tool Name | Description |
|-----------|-------------|
| `ambari_hosts_gethosts` | List all hosts |
| `ambari_hosts_gethost` | Get host details with metrics |
| `ambari_hosts_gethostcomponents` | Get components on a host |
| `ambari_hosts_gethostmetrics` | Get host performance metrics |
| `ambari_hosts_getunhealthyhosts` | Find unhealthy hosts |

### 5.5 Alert Tools

| Tool Name | Description |
|-----------|-------------|
| `ambari_alerts_getalerts` | Get current alerts |
| `ambari_alerts_getalertsummary` | Get alert summary by severity |
| `ambari_alerts_getalertdetails` | Get specific alert details |
| `ambari_alerts_getalertdefinitions` | Get alert definitions |
| `ambari_alerts_updatealertdefinition` | Enable/disable alerts |
| `ambari_alerts_getalertgroups` | Get alert groups |
| `ambari_alerts_createalertgroup` | Create alert group |
| `ambari_alerts_updatealertgroup` | Update alert group |
| `ambari_alerts_deletealertgroup` | Delete alert group |
| `ambari_alerts_getalerthistory` | Get alert history |
| `ambari_alerts_gettargets` | Get notification targets |
| `ambari_alerts_createtarget` | Create notification target |
| `ambari_alerts_deletetarget` | Delete notification target |

### 5.6 Configuration Tools

| Tool Name | Description |
|-----------|-------------|
| `ambari_config_getconfigurations` | List configuration types |
| `ambari_config_getconfiguration` | Get specific configuration |
| `ambari_config_getserviceconfigs` | Get service configurations |
| `ambari_config_updateconfiguration` | Update configuration values |
| `ambari_config_getdesiredconfigs` | Get desired config tags |
| `ambari_config_compareconfigversions` | Compare config versions |

### 5.7 User Tools

| Tool Name | Description |
|-----------|-------------|
| `ambari_users_getusers` | List all users |
| `ambari_users_getuser` | Get user details |

### 5.8 Request Tools

| Tool Name | Description |
|-----------|-------------|
| `ambari_requests_getrequests` | List recent requests |
| `ambari_requests_getrequest` | Get request details |
| `ambari_requests_getrequesttasks` | Get request tasks |
| `ambari_requests_abortrequests` | Abort pending requests |

### 5.9 SSH Tools

| Tool Name | Description |
|-----------|-------------|
| `ambari_ssh_status` | Check SSH configuration status |
| `ambari_ssh_restart_agent` | Restart Ambari agent on hosts |
| `ambari_ssh_run_command` | Execute command on hosts |
| `ambari_ssh_check_agent_status` | Check agent status on hosts |
| `ambari_ssh_restart_agent_and_wait` | Restart agents and wait for re-registration |

---

## 6. Resource Catalog

### 6.1 Available Resources

| URI Pattern | Description |
|-------------|-------------|
| `ambari://clusters` | All clusters overview |
| `ambari://cluster/{name}` | Specific cluster details |
| `ambari://cluster/{name}/services` | All services in cluster |
| `ambari://cluster/{name}/hosts` | All hosts in cluster |
| `ambari://cluster/{name}/alerts` | Current alerts |
| `ambari://cluster/{name}/alerts/summary` | Alert summary |
| `ambari://cluster/{name}/configurations` | Configuration overview |
| `ambari://cluster/{name}/requests/recent` | Recent operations |
| `ambari://cluster/{name}/services/stale-configs` | Components needing restart |
| `ambari://cluster/{name}/service/{service}` | Service details |
| `ambari://cluster/{name}/service/{service}/components` | Service components |
| `ambari://host/{hostname}` | Host details |

### 6.2 Resource Response Format

All resources return JSON with:

```json
{
  "uri": "ambari://clusters",
  "type": "clusters",
  "timestamp": "2026-01-05T10:00:00.000Z",
  "executionTimeMs": 150,
  "data": { ... }
}
```

---

## 7. Configuration

### 7.1 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AMBARI_BASE_URL` | Yes | `http://localhost:8080/api/v1` | Ambari REST API URL |
| `AMBARI_USERNAME` | Yes | `admin` | Ambari username |
| `AMBARI_PASSWORD` | Yes | `admin` | Ambari password |
| `AMBARI_CLUSTER_NAME` | No | (auto-detect) | Target cluster name |
| `TIMEOUT_MS` | No | `30000` | Request timeout (ms) |
| `INSECURE_SSL` | No | `false` | Skip SSL verification |
| `SSH_PRIVATE_KEY_PATH` | No | - | Path to SSH private key |
| `SSH_USERNAME` | No | `root` | SSH username |
| `SSH_PORT` | No | `22` | SSH port |
| `SSH_TIMEOUT` | No | `10000` | SSH timeout (ms) |
| `DEBUG` | No | `0` | Enable debug logging |

### 7.2 Example Configuration

```bash
# .env file
AMBARI_BASE_URL=https://ambari.example.com:8443/api/v1
AMBARI_USERNAME=admin
AMBARI_PASSWORD=SecurePassword123
AMBARI_CLUSTER_NAME=production

TIMEOUT_MS=30000
INSECURE_SSL=1

SSH_PRIVATE_KEY_PATH=/home/user/.ssh/cluster-key.pem
SSH_USERNAME=hadoop
SSH_PORT=22
```

---

## 8. Security

### 8.1 Authentication

- **Ambari API**: HTTP Basic Authentication over HTTPS
- **SSH**: Private key authentication (PEM file)
- **MCP Transport**: stdio (local process communication)

### 8.2 Security Best Practices

1. **Credentials Storage**
   - Store credentials in `.env` file
   - Never commit `.env` to version control
   - Use environment variables in production

2. **SSL/TLS**
   - Use HTTPS for Ambari connections in production
   - Only disable SSL verification (`INSECURE_SSL=1`) for development

3. **SSH Keys**
   - Use dedicated SSH keys for MCP server
   - Restrict key permissions (`chmod 600`)
   - Use passphrase-protected keys when possible

4. **Principle of Least Privilege**
   - Create dedicated Ambari user for MCP server
   - Grant only necessary permissions
   - Use read-only access where appropriate

### 8.3 Audit Logging

All tool invocations are logged to stderr with:
- Timestamp
- Tool name
- Execution time
- Success/failure status

---

## 9. Deployment

### 9.1 Local Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run
npm start
```

### 9.2 MCP Client Configuration

#### Claude Desktop / Cursor

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

#### Continue (VS Code / IntelliJ)

```json
{
  "models": [...],
  "mcpServers": [
    {
      "name": "ambari",
      "command": "node",
      "args": ["/path/to/ambari-mcp-server/dist/index.js"]
    }
  ]
}
```

### 9.3 Production Deployment

For production environments, consider:

1. **Containerization**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --production
   COPY dist/ ./dist/
   CMD ["node", "dist/index.js"]
   ```

2. **Process Management**
   - Use PM2 or systemd for process supervision
   - Configure automatic restarts

3. **Monitoring**
   - Monitor stderr for error logs
   - Track execution times
   - Alert on connection failures

---

## 10. Integration

### 10.1 Supported MCP Clients

| Client | Platform | Status |
|--------|----------|--------|
| Claude Desktop | macOS, Windows | ✅ Tested |
| Cursor | macOS, Windows, Linux | ✅ Tested |
| Continue | VS Code, IntelliJ | ✅ Tested |
| Open WebUI | Web | ✅ Compatible |

### 10.2 LLM Compatibility

| LLM | Tool Calling | Recommended |
|-----|--------------|-------------|
| Claude 3.5 Sonnet | Excellent | ✅ |
| GPT-4 | Excellent | ✅ |
| Llama 3.1 8B+ | Good | ✅ |
| Mistral 7B | Good | ✅ |
| Smaller models | Limited | ⚠️ |

### 10.3 Sample Prompts

```
"What services are running in the cluster?"
"Restart the HDFS service"
"Show me any critical alerts"
"Which hosts need component restarts due to config changes?"
"Get the current YARN configuration"
"Restart Ambari agents on all nodes"
```

---

## 11. Future Enhancements

### 11.1 Planned Features

| Feature | Priority | Status |
|---------|----------|--------|
| HTTP/SSE Transport | High | Planned |
| Kerberos Authentication | Medium | Planned |
| Blueprint Management | Medium | Planned |
| Stack/Version Management | Low | Planned |
| Batch Operations | Low | Planned |

### 11.2 HTTP Transport (Planned)

Add HTTP transport for remote clients:

```typescript
// Planned: HTTP server with Bearer token auth
const httpServer = new HttpServer({
  port: 3000,
  auth: 'bearer',
  token: process.env.MCP_AUTH_TOKEN
});
```

---

## Appendix A: API Reference

### Ambari REST API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/clusters` | GET | List clusters |
| `/clusters/{name}` | GET/PUT | Cluster operations |
| `/clusters/{name}/services` | GET | List services |
| `/clusters/{name}/services/{service}` | GET/PUT | Service operations |
| `/clusters/{name}/hosts` | GET | List hosts |
| `/clusters/{name}/alerts` | GET | Get alerts |
| `/clusters/{name}/alert_definitions` | GET/PUT | Alert definitions |
| `/clusters/{name}/configurations` | GET/PUT | Configurations |
| `/clusters/{name}/requests` | GET/POST | Requests |
| `/users` | GET | List users |

---

## Appendix B: Error Handling

### Error Response Format

```json
{
  "code": -32603,
  "message": "Ambari API Error: GET /clusters | HTTP 401 Unauthorized",
  "data": {
    "diagnostics": {
      "url": "https://ambari:8443/api/v1/clusters",
      "method": "GET",
      "status": 401,
      "message": "Authentication required"
    }
  }
}
```

### Common Error Codes

| Code | Meaning | Resolution |
|------|---------|------------|
| -32600 | Invalid Request | Check tool parameters |
| -32601 | Method Not Found | Tool doesn't exist |
| -32602 | Invalid Params | Missing required parameters |
| -32603 | Internal Error | Check Ambari connection |

---

## Appendix C: Changelog

### Version 1.0.0 (January 2026)

- Initial release
- 52 tools across 8 categories
- 12 resources
- SSH integration
- Multi-client support (Claude, Cursor, Continue)

---

*End of Design Document*

