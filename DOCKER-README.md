# Ambari MCP Server - Docker Deployment Guide

This guide works for both **Kubernetes-based** and **VM-based** Ambari clusters.

## Quick Start (3 Steps)

### Step 1: Create `~/.ambari-mcp.env`

Run this command to create the configuration file:

```bash
cat > ~/.ambari-mcp.env << 'EOF'
# ============================================================================
# Ambari MCP Server Configuration
# ============================================================================
# This file configures both K8s and VM-based Ambari clusters.
# Set the appropriate section based on your deployment type.
# ============================================================================

# ----------------------------------------------------------------------------
# AMBARI SERVER SETTINGS (REQUIRED)
# ----------------------------------------------------------------------------

AMBARI_BASE_URL=https://your-ambari-server:8080/api/v1
AMBARI_USERNAME=admin
AMBARI_PASSWORD=your-password
AMBARI_CLUSTER_NAME=
INSECURE_SSL=1
TIMEOUT_MS=30000
DEBUG=0

# ----------------------------------------------------------------------------
# OPTION A: KUBERNETES DEPLOYMENT
# ----------------------------------------------------------------------------
# Use this section if your Ambari agents run in Kubernetes pods.
# 
# To find your pod label selector:
#   kubectl get pods -n YOUR_NAMESPACE --show-labels
# ----------------------------------------------------------------------------

# LOCAL: Path to kubeconfig on YOUR machine
K8S_LOCAL_KUBECONFIG=

# K8s cluster settings
K8S_NAMESPACE=default
K8S_POD_LABEL_SELECTOR=
K8S_CONTAINER_NAME=
K8S_TIMEOUT=30000

# CONTAINER: Paths inside Docker (don't change)
K8S_KUBECONFIG_PATH=/app/.kube/kubeconfig
KUBECONFIG=/app/.kube/kubeconfig

# ----------------------------------------------------------------------------
# OPTION B: VM-BASED DEPLOYMENT (SSH)
# ----------------------------------------------------------------------------
# Use this section if your Ambari agents run on traditional VMs.
# ----------------------------------------------------------------------------

# LOCAL: Path to SSH private key on YOUR machine
SSH_LOCAL_KEY_PATH=

# SSH settings
SSH_USERNAME=root
SSH_PORT=22
SSH_TIMEOUT=10000

# CONTAINER: Path inside Docker (don't change)
SSH_PRIVATE_KEY_PATH=/app/ssh-keys/id_rsa
EOF
```

Then edit the file with your settings:

```bash
nano ~/.ambari-mcp.env
```

**Choose your deployment type:**

| Deployment | What to set |
|------------|-------------|
| **Kubernetes** | Set `K8S_LOCAL_KUBECONFIG` and `K8S_POD_LABEL_SELECTOR` |
| **VM (SSH)** | Set `SSH_LOCAL_KEY_PATH` and `SSH_USERNAME` |
| **API only** | Leave both empty (just Ambari API access) |

### Step 2: Add to Claude Desktop Config

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ambari": {
      "command": "sh",
      "args": [
        "-c",
        "set -a; source ~/.ambari-mcp.env; set +a; docker rm -f ambari-mcp-server >/dev/null 2>&1; docker run -i --rm --name ambari-mcp-server --env-file ~/.ambari-mcp.env ${SSH_LOCAL_KEY_PATH:+-v \"$SSH_LOCAL_KEY_PATH\":/app/ssh-keys/id_rsa:ro} ${K8S_LOCAL_KUBECONFIG:+-v \"$K8S_LOCAL_KUBECONFIG\":/app/.kube/kubeconfig:ro} bsprmkumar/ambari-mcp-server:latest"
      ]
    }
  }
}
```

> **Note:** This config reads mount paths from `~/.ambari-mcp.env`:
> - `SSH_LOCAL_KEY_PATH` → mounts your SSH key (for VM clusters)
> - `K8S_LOCAL_KUBECONFIG` → mounts your kubeconfig (for K8s clusters)
> 
> Claude will automatically pull the Docker image on first run.

### Step 3: Restart Claude Desktop

Close and reopen Claude Desktop. That's it! 🎉

---

## Configuration Examples

> **Note:** Use the same Claude config from Step 2 for all examples. Just edit `~/.ambari-mcp.env` to switch between setups.

### Example 1: Basic Ambari (Just API Access)

Edit `~/.ambari-mcp.env`:
```env
AMBARI_BASE_URL=https://ambari.example.com:8080/api/v1
AMBARI_USERNAME=admin
AMBARI_PASSWORD=MyPassword123
INSECURE_SSL=1

# Leave these empty for API-only access
SSH_LOCAL_KEY_PATH=
K8S_LOCAL_KUBECONFIG=
```

### Example 2: Ambari with Kubernetes

Edit `~/.ambari-mcp.env`:
```env
AMBARI_BASE_URL=https://ambari.example.com:8080/api/v1
AMBARI_USERNAME=admin
AMBARI_PASSWORD=MyPassword123
INSECURE_SSL=1

# LOCAL: Path on your machine
K8S_LOCAL_KUBECONFIG=/path/to/your/kubeconfig

# K8s cluster settings
K8S_NAMESPACE=ambari
K8S_POD_LABEL_SELECTOR=app=ambari-agent

# CONTAINER: Paths inside Docker (don't change)
K8S_KUBECONFIG_PATH=/app/.kube/kubeconfig
KUBECONFIG=/app/.kube/kubeconfig

# Leave SSH empty for K8s
SSH_LOCAL_KEY_PATH=
```

### Example 3: Ambari with SSH

Edit `~/.ambari-mcp.env`:
```env
AMBARI_BASE_URL=https://ambari.example.com:8080/api/v1
AMBARI_USERNAME=admin
AMBARI_PASSWORD=MyPassword123
INSECURE_SSL=1

# LOCAL: Path on your machine
SSH_LOCAL_KEY_PATH=/path/to/your/ssh-key.pem

# SSH settings
SSH_USERNAME=root
SSH_PORT=22

# CONTAINER: Path inside Docker (don't change)
SSH_PRIVATE_KEY_PATH=/app/ssh-keys/id_rsa

# Leave K8s empty for SSH
K8S_LOCAL_KUBECONFIG=
```

---

## What Can You Ask Claude?

Once configured, try these commands:

### Cluster & Services
- "List all services in my cluster"
- "What's the status of HDFS?"
- "Start the YARN service"
- "Show stale configurations"
- "Restat ambari agents on cluster"

### Alerts
- "Show current alerts"
- "What critical alerts are there?"

### Hosts
- "List all hosts"
- "Show details for host node1"

### Kubernetes (when configured)
- "Check K8s status"
- "List K8s pods"
- "Restart Ambari agent on K8s pods"
- "Run 'hostname' on all pods"

### SSH (when configured)
- "Check SSH status"
- "Restart Ambari agent on all hosts"
- "Run 'df -h' on host node1"

---

## Troubleshooting

### Check if it's working
```bash
docker ps | grep ambari-mcp-server
```

### View logs
```bash
tail -50 ~/Library/Logs/Claude/mcp-server-ambari.log
```

### Test manually
```bash
docker run --rm --env-file ~/.ambari-mcp.env bsprmkumar/ambari-mcp-server:latest sh -c "echo 'OK'"
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Image not found | Claude auto-pulls; or run: `docker pull bsprmkumar/ambari-mcp-server:latest` |
| SSL error | Set `INSECURE_SSL=1` in ~/.ambari-mcp.env |
| K8s not working | Check kubeconfig path in volume mount |
| Container name conflict | Config includes auto-cleanup; just restart Claude |

---

## Docker Hub

**Image:** `bsprmkumar/ambari-mcp-server:latest`

**URL:** https://hub.docker.com/r/bsprmkumar/ambari-mcp-server
