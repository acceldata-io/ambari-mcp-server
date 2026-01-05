/**
 * User Management Tools for Ambari MCP Server
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ambariGet } from '../api-client.js';
import { formatTimestamp } from '../utils.js';

// ============================================================================
// Tool Definitions
// ============================================================================

export const USER_TOOLS: Tool[] = [
  {
    name: 'ambari_users_list',
    description: 'List all users in the Ambari system',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'ambari_users_get',
    description: 'Get detailed information about a specific user',
    inputSchema: {
      type: 'object',
      properties: {
        userName: { type: 'string', description: 'The username to retrieve details for' }
      },
      required: ['userName']
    }
  }
];

// ============================================================================
// Tool Executors
// ============================================================================

interface UserItem {
  Users?: {
    user_name?: string;
    user_id?: number;
    local_user_name?: string;
    display_name?: string;
    user_type?: string;
    admin?: boolean;
    active?: boolean;
    ldap_user?: boolean;
    consecutive_failures?: number;
    created?: number;
    groups?: string[];
  };
  href?: string;
}

interface UserDetailResponse {
  Users?: {
    user_id?: number;
    user_name?: string;
    local_user_name?: string;
    display_name?: string;
    user_type?: string;
    admin?: boolean;
    active?: boolean;
    ldap_user?: boolean;
    consecutive_failures?: number;
    created?: number;
    groups?: string[];
  };
  sources?: Array<{
    AuthenticationSourceInfo?: {
      source_id?: number;
    };
    href?: string;
  }>;
  privileges?: unknown[];
  widget_layouts?: unknown[];
}

export const userToolExecutors: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {

  ambari_users_list: async () => {
    const data = await ambariGet('/users') as {
      items?: UserItem[];
    };

    const users = data.items ?? [];

    const lines: string[] = [
      '=== AMBARI USERS ===',
      '',
      `${'User Name'.padEnd(20)} ${'Type'.padEnd(15)} ${'Admin'.padEnd(8)} ${'Active'.padEnd(8)} ${'LDAP'.padEnd(8)}`,
      '-'.repeat(70)
    ];

    for (const user of users) {
      const userInfo = user.Users ?? {};
      const userName = (userInfo.user_name ?? 'N/A').padEnd(20);
      const userType = (userInfo.user_type ?? 'LOCAL').padEnd(15);
      const admin = (userInfo.admin ? 'Yes' : 'No').padEnd(8);
      const active = (userInfo.active ? 'Yes' : 'No').padEnd(8);
      const ldap = (userInfo.ldap_user ? 'Yes' : 'No').padEnd(8);
      lines.push(`${userName} ${userType} ${admin} ${active} ${ldap}`);
    }

    lines.push('');
    lines.push('='.repeat(70));
    lines.push(`Total Users: ${users.length}`);

    return {
      summary: lines.join('\n'),
      count: users.length,
      users: users.map(u => u.Users)
    };
  },

  ambari_users_get: async (args) => {
    const userName = args['userName'] as string;

    const data = await ambariGet(`/users/${userName}`) as UserDetailResponse;

    const userInfo = data.Users ?? {};
    const sources = data.sources ?? [];
    const privileges = data.privileges ?? [];
    const widgetLayouts = data.widget_layouts ?? [];

    const lines: string[] = [
      `=== USER DETAILS: ${userName} ===`,
      '',
      'BASIC INFORMATION:',
      `  User ID: ${userInfo.user_id ?? 'N/A'}`,
      `  User Name: ${userInfo.user_name ?? 'N/A'}`,
      `  Local User Name: ${userInfo.local_user_name ?? 'N/A'}`,
      `  Display Name: ${userInfo.display_name ?? 'N/A'}`,
      `  User Type: ${userInfo.user_type ?? 'N/A'}`,
      '',
      'STATUS:',
      `  Admin: ${userInfo.admin ? 'Yes' : 'No'}`,
      `  Active: ${userInfo.active ? 'Yes' : 'No'}`,
      `  LDAP User: ${userInfo.ldap_user ? 'Yes' : 'No'}`,
      `  Consecutive Failures: ${userInfo.consecutive_failures ?? 'N/A'}`,
      ''
    ];

    if (userInfo.created) {
      lines.push('TIMESTAMPS:');
      lines.push(`  Created: ${formatTimestamp(userInfo.created)}`);
      lines.push('');
    }

    const groups = userInfo.groups ?? [];
    lines.push('GROUPS:');
    if (groups.length > 0) {
      for (const group of groups) {
        lines.push(`  - ${group}`);
      }
    } else {
      lines.push('  (No groups assigned)');
    }
    lines.push('');

    lines.push('AUTHENTICATION SOURCES:');
    if (sources.length > 0) {
      for (const source of sources) {
        const sourceInfo = source.AuthenticationSourceInfo ?? {};
        lines.push(`  Source ID: ${sourceInfo.source_id ?? 'N/A'}`);
        lines.push(`  HREF: ${source.href ?? 'N/A'}`);
      }
    } else {
      lines.push('  (No authentication sources)');
    }
    lines.push('');

    lines.push('PRIVILEGES:');
    if (privileges.length > 0) {
      for (const privilege of privileges) {
        lines.push(`  - ${JSON.stringify(privilege)}`);
      }
    } else {
      lines.push('  (No privileges assigned)');
    }
    lines.push('');

    lines.push('WIDGET LAYOUTS:');
    if (widgetLayouts.length > 0) {
      lines.push(`  Count: ${widgetLayouts.length}`);
    } else {
      lines.push('  (No widget layouts)');
    }

    lines.push('');
    lines.push('='.repeat(50));

    return {
      summary: lines.join('\n'),
      user: userInfo,
      sources,
      privileges,
      widgetLayouts
    };
  }
};

