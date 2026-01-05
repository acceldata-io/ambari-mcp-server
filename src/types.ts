/**
 * Type definitions for Ambari MCP Server
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface AmbariConfig {
  baseUrl: string;
  username: string;
  password: string;
  clusterName: string;
  timeoutMs: number;
  /** Skip SSL certificate verification (for self-signed certs) */
  insecureSsl: boolean;
}

export interface SshConfig {
  /** Path to PEM private key file */
  privateKeyPath: string;
  /** SSH username (default: root) */
  username: string;
  /** SSH port (default: 22) */
  port: number;
  /** Connection timeout in ms (default: 10000) */
  timeout: number;
  /** Whether SSH is enabled/configured */
  enabled: boolean;
}

export interface SshCommandResult {
  host: string;
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface AmbariApiResponse<T = unknown> {
  status: number;
  statusText: string;
  data: T;
}

export interface AmbariError {
  status?: number;
  message: string;
  url?: string;
  method?: string;
  code?: string;
}

// ============================================================================
// Cluster Types
// ============================================================================

export interface ClusterInfo {
  cluster_name: string;
  version: string;
  provisioning_state?: string;
  security_type?: string;
  total_hosts?: number;
  desired_configs?: Record<string, { tag: string }>;
}

export interface ClusterResponse {
  Clusters: ClusterInfo;
  href?: string;
}

// ============================================================================
// Service Types
// ============================================================================

export interface ServiceInfo {
  service_name: string;
  cluster_name: string;
  state: ServiceState;
  maintenance_state?: MaintenanceState;
  credential_store_enabled?: boolean;
}

export type ServiceState = 
  | 'STARTED'
  | 'INSTALLED'
  | 'STARTING'
  | 'STOPPING'
  | 'INSTALLING'
  | 'INSTALL_FAILED'
  | 'MAINTENANCE'
  | 'UNKNOWN'
  | 'INIT';

export type MaintenanceState = 'ON' | 'OFF' | 'IMPLIED_FROM_SERVICE' | 'IMPLIED_FROM_HOST';

export interface ServiceComponent {
  ServiceComponentInfo: {
    component_name: string;
    service_name: string;
    cluster_name: string;
    state: ServiceState;
    category: 'MASTER' | 'SLAVE' | 'CLIENT';
    total_count?: number;
    started_count?: number;
    installed_count?: number;
  };
  host_components?: HostComponent[];
}

export interface HostComponent {
  HostRoles: {
    component_name: string;
    host_name: string;
    service_name: string;
    state: ServiceState;
    stale_configs?: boolean;
    maintenance_state?: MaintenanceState;
    actual_configs?: Record<string, unknown>;
  };
  href?: string;
}

// ============================================================================
// Host Types
// ============================================================================

export interface HostInfo {
  host_name: string;
  public_host_name?: string;
  ip?: string;
  cluster_name: string;
  host_state: string;
  host_status: string;
  maintenance_state?: MaintenanceState;
  os_type?: string;
  os_family?: string;
  os_arch?: string;
  cpu_count?: number;
  ph_cpu_count?: number;
  total_mem?: number;
  rack_info?: string;
  last_heartbeat_time?: number;
  last_registration_time?: number;
  host_health_report?: string;
  recovery_summary?: string;
  disk_info?: DiskInfo[];
  last_agent_env?: AgentEnvironment;
}

export interface DiskInfo {
  available: string;
  used: string;
  percent: string;
  size: string;
  type: string;
  mountpoint: string;
  device?: string;
}

export interface AgentEnvironment {
  hostHealth?: {
    liveServices?: Array<{
      name: string;
      status: string;
      desc?: string;
    }>;
    activeJavaProcs?: Array<unknown>;
    agentTimeStampAtReporting?: number;
    serverTimeStampAtReporting?: number;
  };
  umask?: string;
  firewallRunning?: boolean;
  firewallName?: string;
  hasUnlimitedJcePolicy?: boolean;
  reverseLookup?: boolean;
  transparentHugePage?: string;
  installedPackages?: Array<unknown>;
  existingRepos?: Array<unknown>;
  existingUsers?: Array<unknown>;
  alternatives?: Array<unknown>;
  stackFoldersAndFiles?: Array<unknown>;
}

export interface HostMetrics {
  cpu?: {
    cpu_num?: number;
    cpu_idle?: number;
    cpu_user?: number;
    cpu_system?: number;
    cpu_nice?: number;
    cpu_wio?: number;
  };
  memory?: {
    mem_total?: number;
    mem_free?: number;
    mem_cached?: number;
    mem_shared?: number;
    swap_total?: number;
    swap_free?: number;
  };
  load?: {
    load_one?: number;
    load_five?: number;
    load_fifteen?: number;
  };
  disk?: {
    disk_total?: number;
    disk_free?: number;
    read_bytes?: number;
    write_bytes?: number;
    read_count?: number;
    write_count?: number;
  };
  network?: {
    bytes_in?: number;
    bytes_out?: number;
    pkts_in?: number;
    pkts_out?: number;
  };
  process?: {
    proc_total?: number;
    proc_run?: number;
  };
  boottime?: number;
}

// ============================================================================
// Alert Types
// ============================================================================

export type AlertState = 'OK' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';

export interface AlertInfo {
  id: number;
  definition_id: number;
  definition_name: string;
  service_name: string;
  component_name?: string;
  host_name?: string;
  instance?: string;
  label: string;
  state: AlertState;
  text: string;
  scope: 'SERVICE' | 'HOST' | 'ANY';
  maintenance_state: MaintenanceState;
  original_timestamp?: number;
  latest_timestamp: number;
}

export interface AlertDefinition {
  id: number;
  name: string;
  label: string;
  description?: string;
  service_name: string;
  component_name?: string;
  scope: string;
  enabled: boolean;
  ignore_host: boolean;
  repeat_tolerance: number;
  repeat_tolerance_enabled: boolean;
  source: {
    type: string;
    [key: string]: unknown;
  };
}

export interface AlertGroup {
  id: number;
  name: string;
  default: boolean;
  definitions?: Array<{ id: number }>;
  targets?: Array<{ id: number }>;
}

export interface AlertTarget {
  id: number;
  name: string;
  description?: string;
  notification_type: string;
  enabled: boolean;
  properties: Record<string, string>;
  groups?: Array<{ id: number; name: string }>;
}

export interface AlertHistoryEntry {
  id: number;
  definition_id: number;
  definition_name: string;
  service_name: string;
  component_name?: string;
  host_name?: string;
  instance?: string;
  label: string;
  state: AlertState;
  text: string;
  timestamp: number;
}

// ============================================================================
// Request Types
// ============================================================================

export interface AmbariRequest {
  id: number;
  request_status: RequestStatus;
  request_context: string;
  progress_percent: number;
  start_time?: number;
  end_time?: number;
  create_time?: number;
}

export type RequestStatus = 
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'ABORTED'
  | 'TIMEDOUT'
  | 'QUEUED';

// ============================================================================
// Configuration Types
// ============================================================================

export interface ConfigurationInfo {
  type: string;
  tag: string;
  version?: number;
  service_name?: string;
  properties?: Record<string, string>;
  properties_attributes?: Record<string, Record<string, string>>;
}

// ============================================================================
// User Types
// ============================================================================

export interface UserInfo {
  user_id?: number;
  user_name: string;
  local_user_name?: string;
  display_name?: string;
  user_type?: string;
  admin?: boolean;
  active?: boolean;
  ldap_user?: boolean;
  consecutive_failures?: number;
  created?: number;
  groups?: string[];
}

// ============================================================================
// Metrics Types
// ============================================================================

export interface MetricMetadata {
  metricname: string;
  appid?: string;
  appId?: string;
  application?: string;
  hostname?: string;
  instanceId?: string;
  type?: string;
  units?: string;
  description?: string;
}

export interface MetricDataPoint {
  timestamp: number;
  value: number;
}

export interface MetricSeries {
  metricname: string;
  appid?: string;
  hostname?: string;
  metrics: Record<string, number>;
}

export interface MetricSummary {
  count: number;
  min: number;
  max: number;
  avg: number;
  first: number;
  last: number;
  delta: number;
  start_timestamp: number;
  end_timestamp: number;
  duration_ms: number;
}

// ============================================================================
// Tool Input Types
// ============================================================================

export interface PaginationParams {
  page_size?: number;
  from?: number;
  to?: number;
}

export interface FieldParams {
  fields?: string;
  sortBy?: string;
}

