# ============================================================================
# Ambari MCP Server - Docker Image
# ============================================================================
# Multi-stage build for optimized image size
# 
# Build: docker build -t ambari-mcp-server .
# Run:   docker run -i --rm \
#          -e AMBARI_BASE_URL=https://ambari-host:8080/api/v1 \
#          -e AMBARI_USERNAME=admin \
#          -e AMBARI_PASSWORD=admin \
#          ambari-mcp-server
# ============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build Stage
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first (for better layer caching)
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for TypeScript compilation)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript to JavaScript
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

# -----------------------------------------------------------------------------
# Stage 2: Production Stage
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Add labels for metadata
LABEL org.opencontainers.image.title="Ambari MCP Server"
LABEL org.opencontainers.image.description="Model Context Protocol server for Apache Ambari cluster management"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/odp-acceldata-io/ambari-mcp-server"

# Create non-root user for security
RUN addgroup -g 1001 -S mcpuser && \
    adduser -u 1001 -S mcpuser -G mcpuser

# Set working directory
WORKDIR /app

# Copy only production dependencies and built files from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Create directory for SSH keys (optional mounting)
RUN mkdir -p /app/ssh-keys && chown mcpuser:mcpuser /app/ssh-keys

# Switch to non-root user
USER mcpuser

# -----------------------------------------------------------------------------
# Environment Variables (with defaults)
# -----------------------------------------------------------------------------
# These can be overridden at runtime with -e or --env-file

# Ambari Configuration
ENV AMBARI_BASE_URL="http://localhost:8080/api/v1"
ENV AMBARI_USERNAME="admin"
ENV AMBARI_PASSWORD="admin"
ENV AMBARI_CLUSTER_NAME=""

# Request Configuration
ENV TIMEOUT_MS="30000"
ENV INSECURE_SSL="0"

# Debug Configuration
ENV DEBUG="0"
ENV ENV_DEBUG="0"

# SSH Configuration (optional)
ENV SSH_PRIVATE_KEY_PATH=""
ENV SSH_USERNAME="root"
ENV SSH_PORT="22"
ENV SSH_TIMEOUT="10000"

# Node.js Configuration
ENV NODE_ENV="production"

# -----------------------------------------------------------------------------
# Entrypoint
# -----------------------------------------------------------------------------
# MCP servers communicate via stdio, so we run the server directly
CMD ["node", "dist/index.js"]
