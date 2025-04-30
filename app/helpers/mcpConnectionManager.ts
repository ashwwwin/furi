import { readFileSync } from "fs";
import { join } from "path";
import pm2 from "pm2";

// Types for MCP client and transport
export interface McpClient {
  connect: (transport: any) => Promise<void>;
  listTools: () => Promise<any>;
  callTool: (options: { name: string; arguments: any }) => Promise<any>;
  close: () => Promise<void>;
}

export interface McpTransport {
  close: () => Promise<void>;
}

export interface ConnectionResources {
  client: McpClient | null;
  transport: McpTransport | null;
  disconnect: () => Promise<void>;
}

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
  const basePath = process.env.BASE_PATH || "";
  if (!basePath) {
    throw new Error("BASE_PATH environment variable is not set");
  }

  const configPath = join(basePath, ".furikake/configuration.json");
  const config = JSON.parse(readFileSync(configPath, "utf-8"));

  // Check both root level and installed section for MCP configuration
  const mcpConfig =
    config[mcpName] || (config.installed && config.installed[mcpName]);

  const cwdRelative = mcpConfig?.source || `.furikake/installed/${mcpName}`;
  const cwdAbsolute = join(basePath, cwdRelative);

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

// Setup MCP connection
export const setupMcpConnection = async (
  mcpName: string,
  spinner?: any
): Promise<ConnectionResources | null> => {
  // Store resources to clean up
  let client: McpClient | null = null;
  let transport: McpTransport | null = null;

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
    const isRunning = await checkProcessStatus(mcpName, spinner);
    if (!isRunning) {
      await disconnectFromPm2();
      return null;
    }

    // Get package configuration
    const { cwdAbsolute, env, cmd, cmdArgs } = getPackageConfig(mcpName);

    // Create an MCP client
    client = new Client({
      name: "furikake-cli",
      version: "0.0.1",
    });

    // Create direct stdio transport with environment variables
    transport = new StdioClientTransport({
      command: cmd,
      args: cmdArgs,
      cwd: cwdAbsolute,
      env: env,
      stderr: "ignore", // Suppress console output from the MCP server
    });

    await client.connect(transport);

    return {
      client,
      transport,
      disconnect: async () => {
        try {
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
      },
    };
  } catch (error: any) {
    if (spinner) {
      spinner.error(`[${mcpName}] Error: ${error.message || String(error)}`);
    }

    // Cleanup on error
    try {
      if (transport && typeof transport.close === "function") {
        await transport.close();
      }
      if (client && typeof client.close === "function") {
        await client.close();
      }
      await disconnectFromPm2();
    } catch (cleanupError) {
      console.error("Error during cleanup:", cleanupError);
    }

    return null;
  }
};
