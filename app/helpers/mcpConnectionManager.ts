import { readFileSync } from "fs";
import pm2 from "pm2";
import { resolveFromBase, getBasePath } from "@/helpers/paths";
import { isAbsolute } from "path";

// Types for MCP client and transport
export interface McpClient {
  connect: (transport: any) => Promise<void>;
  listTools: () => Promise<any>;
  callTool: (options: { name: string; arguments: any }) => Promise<any>;
  close: () => Promise<void>;
}

export interface McpTransport {
  close?: () => Promise<void>;
}

export interface ConnectionResources {
  client: McpClient;
  transport: McpTransport;
  disconnect: () => Promise<void>;
}

// Connection pool to maintain persistent connections
export class McpConnectionPool {
  private connections: Map<string, ConnectionResources> = new Map();
  private connectionPromises: Map<string, Promise<ConnectionResources | null>> =
    new Map();
  private readonly poolName: string;

  constructor(poolName: string = "default") {
    this.poolName = poolName;
  }

  async getConnection(mcpName: string): Promise<ConnectionResources | null> {
    // Use namespaced key to avoid conflicts with other pools
    const connectionKey = `${this.poolName}:${mcpName}`;

    // Check if we already have a connection
    const existing = this.connections.get(connectionKey);
    if (existing) {
      try {
        // Test if connection is still alive by making a simple call
        await existing.client.listTools();
        return existing;
      } catch (error) {
        // Connection is dead, remove it and create a new one
        console.warn(`[${mcpName}] Connection is dead, recreating...`);
        this.connections.delete(connectionKey);
        try {
          await existing.disconnect();
        } catch (disconnectError) {
          // Ignore disconnect errors for dead connections
        }
      }
    }

    // Check if we're already creating a connection
    const existingPromise = this.connectionPromises.get(connectionKey);
    if (existingPromise) {
      return existingPromise;
    }

    // Create new connection
    const connectionPromise = this.createConnection(mcpName, connectionKey);
    this.connectionPromises.set(connectionKey, connectionPromise);

    try {
      const connection = await connectionPromise;
      if (connection) {
        this.connections.set(connectionKey, connection);
      }
      return connection;
    } finally {
      this.connectionPromises.delete(connectionKey);
    }
  }

  private async createConnection(
    mcpName: string,
    connectionKey: string
  ): Promise<ConnectionResources | null> {
    try {
      // Dynamically import the MCP SDK
      const ClientModule = await import(
        "@modelcontextprotocol/sdk/client/index.js"
      );
      const StdioModule = await import(
        "@modelcontextprotocol/sdk/client/stdio.js"
      );

      const Client = ClientModule.Client;
      const StdioClientTransport = StdioModule.StdioClientTransport;

      // Connect to PM2
      await connectToPm2();

      // Check if the process is running
      const isRunning = await checkProcessStatus(mcpName);
      if (!isRunning) {
        await disconnectFromPm2();
        return null;
      }

      // Get package configuration
      const { cwdAbsolute, env, cmd, cmdArgs } = getPackageConfig(mcpName);

      // Create an MCP client with pool-specific name
      const client = new Client({
        name: `furikake-cli-${this.poolName}`,
        version: "0.0.1",
      });

      // Create stdio transport
      const transport = new StdioClientTransport({
        command: cmd,
        args: cmdArgs,
        cwd: cwdAbsolute,
        env: env,
        stderr: "ignore",
      });

      await client.connect(transport);

      const disconnect = async () => {
        try {
          // Remove from pool
          this.connections.delete(connectionKey);

          // Close transport if it exists
          if (transport && typeof transport.close === "function") {
            await transport.close();
          }

          // Close client if it exists
          if (client && typeof client.close === "function") {
            await client.close();
          }

          // Disconnect from PM2
          await disconnectFromPm2();
        } catch (cleanupError) {
          console.error("Error during cleanup:", cleanupError);
        }
      };

      return {
        client,
        transport,
        disconnect,
      };
    } catch (error: any) {
      console.error(
        `[${mcpName}] Error creating connection: ${
          error.message || String(error)
        }`
      );

      // Cleanup on error
      try {
        await disconnectFromPm2();
      } catch (cleanupError) {
        console.error("Error during cleanup:", cleanupError);
      }

      return null;
    }
  }

  async closeConnection(mcpName: string): Promise<void> {
    const connectionKey = `${this.poolName}:${mcpName}`;
    const connection = this.connections.get(connectionKey);
    if (connection) {
      this.connections.delete(connectionKey);
      try {
        await connection.disconnect();
      } catch (error) {
        console.error(`[${mcpName}] Error closing connection:`, error);
      }
    }
  }

  async closeAllConnections(): Promise<void> {
    const connections = Array.from(this.connections.entries());
    this.connections.clear();

    await Promise.all(
      connections.map(async ([connectionKey, connection]) => {
        try {
          await connection.disconnect();
        } catch (error) {
          console.error(`[${connectionKey}] Error closing connection:`, error);
        }
      })
    );
  }

  getPoolStats(): {
    poolName: string;
    activeConnections: number;
    pendingConnections: number;
  } {
    return {
      poolName: this.poolName,
      activeConnections: this.connections.size,
      pendingConnections: this.connectionPromises.size,
    };
  }
}

// Global connection pool instance for CLI/API calls (separate from aggregator)
const connectionPool = new McpConnectionPool("furi");

// Export function to get pooled connection
export const getPooledConnection = (
  mcpName: string
): Promise<ConnectionResources | null> => {
  return connectionPool.getConnection(mcpName);
};

// Export function to close specific connection
export const closePooledConnection = (mcpName: string): Promise<void> => {
  return connectionPool.closeConnection(mcpName);
};

// Export function to close all connections (useful for cleanup)
export const closeAllPooledConnections = (): Promise<void> => {
  return connectionPool.closeAllConnections();
};

// Export function to get pool statistics (for debugging)
export const getPoolStats = () => {
  return connectionPool.getPoolStats();
};

// Connect to PM2
export const connectToPm2 = async (): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        reject(new Error(`Failed to connect to PM2: ${err.message}`));
        return;
      }
      resolve();
    });
  });
};

// Disconnect from PM2
export const disconnectFromPm2 = (): Promise<void> => {
  return new Promise<void>((resolve) => {
    pm2.disconnect();
    resolve();
  });
};

// Get PM2 process list
export const getPm2List = async (): Promise<any[]> => {
  return new Promise<any[]>((resolve, reject) => {
    pm2.list((err, list) => {
      if (err) {
        reject(new Error(`Failed to get process list: ${err.message}`));
        return;
      }
      resolve(list);
    });
  });
};

// Get PM2 process info
export const getPm2ProcessInfo = async (processName: string): Promise<any> => {
  return new Promise<any>((resolve, reject) => {
    pm2.describe(processName, (err, proc) => {
      if (err) {
        reject(new Error(`Failed to get process info: ${err.message}`));
        return;
      }
      resolve(proc[0]);
    });
  });
};

// Check if process is running and valid
export const checkProcessStatus = async (
  mcpName: string,
  spinner?: any
): Promise<boolean> => {
  const processName = `furi_${mcpName.replace("/", "-")}`;
  const list = await getPm2List();

  const processEntry = list.find((p) => p.name === processName);

  if (!processEntry) {
    if (spinner) {
      spinner.error(
        `[${mcpName}] Server not running \n     \x1b[2mStart it first with furi start ${mcpName}\x1b[0m`
      );
    }
    return false;
  }

  if (processEntry.pm2_env.status !== "online") {
    if (spinner) {
      spinner.error(
        `[${mcpName}] Process is not running (status: ${processEntry.pm2_env.status})`
      );
    }
    return false;
  }

  return true;
};

// Get configuration for a package
export const getPackageConfig = (
  mcpName: string
): {
  cwdAbsolute: string;
  env: Record<string, string>;
  cmd: string;
  cmdArgs: string[];
} => {
  const configPath = resolveFromBase("configuration.json");
  const config = JSON.parse(readFileSync(configPath, "utf-8"));

  const mcpConfig =
    config[mcpName] || (config.installed && config.installed[mcpName]);

  if (!mcpConfig) {
    throw new Error(`[${mcpName}] Configuration not found in getPackageConfig`);
  }

  let cwdAbsolute: string;
  if (mcpConfig.source) {
    cwdAbsolute = mcpConfig.source;
    if (!isAbsolute(cwdAbsolute)) {
      // console.warn(
      //   `[${mcpName}] mcpConfig.source was not an absolute path. Resolving from base. Source: ${cwdAbsolute}`
      // );
      cwdAbsolute = resolveFromBase(cwdAbsolute);
    }
  } else {
    // console.warn(
    //   `[${mcpName}] mcpConfig.source is not defined. Falling back to default installed path structure.`
    // );
    const parts = mcpName.split("/");
    const owner = parts[0];
    const repo = parts[1];
    if (owner && repo) {
      cwdAbsolute = resolveFromBase("installed", owner, repo);
    } else {
      cwdAbsolute = resolveFromBase("installed", mcpName);
    }
  }

  // Prepare environment variables
  const env: Record<string, string> = {};

  // Add relevant environment variables from process.env
  if (process.env.PATH) env.PATH = process.env.PATH;
  if (process.env.NODE_ENV) env.NODE_ENV = process.env.NODE_ENV;
  if (process.env.HOME) env.HOME = process.env.HOME;
  if (process.env.USER) env.USER = process.env.USER;

  // Add package-specific environment variables
  if (mcpConfig?.env) {
    // Only include non-undefined values
    for (const [key, value] of Object.entries(mcpConfig.env)) {
      if (value !== undefined && value !== null) {
        env[key] = String(value);
      }
    }
  }

  // Get the command and args from the config file
  const configCmd = mcpConfig?.run || "npm run start";
  const [cmd, ...cmdArgs] = configCmd.split(" ");

  return { cwdAbsolute, env, cmd, cmdArgs };
};

// Setup MCP connection (legacy function, kept for backward compatibility)
export const setupMcpConnection = async (
  mcpName: string,
  spinner?: any
): Promise<ConnectionResources | null> => {
  // For backward compatibility, use the pooled connection
  const connection = await getPooledConnection(mcpName);
  if (!connection && spinner) {
    spinner.error(`[${mcpName}] Failed to connect to MCP server`);
  }
  return connection;
};
