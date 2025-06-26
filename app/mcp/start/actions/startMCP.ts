import { readFileSync, writeFileSync } from "fs";
import pm2 from "pm2";
import { resolveFromUserData } from "@/helpers/paths";

export const startMCPCore = async (
  mcpName: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const configPath = resolveFromUserData("configuration.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));

    // Check both root level and installed section for MCP configuration
    const mcpConfig =
      config[mcpName] || (config.installed && config.installed[mcpName]);

    if (!mcpConfig) {
      return {
        success: false,
        message: `[${mcpName}] Configuration not found`,
      };
    }

    const runCommand = mcpConfig.run || "npm run start";
    const [cmd, ...args] = runCommand.split(" ");

    const cwd = mcpConfig.source || `installed/${mcpName}`;

    // Debug logging
    // console.log(`[${mcpName}] DEBUG: Using run command: ${runCommand}`);
    // console.log(`[${mcpName}] DEBUG: Working directory: ${cwd}`);
    // console.log(`[${mcpName}] DEBUG: Transport wrapper enabled: ${mcpConfig.transportWrapper}`);

    // Initialize environment variables with a clean slate
    const env: Record<string, string> = {};

    // Essential system environment variables
    if (process.env.PATH) env.PATH = process.env.PATH;
    if (process.env.HOME) env.HOME = process.env.HOME;
    if (process.env.USER) env.USER = process.env.USER;
    if (process.env.SHELL) env.SHELL = process.env.SHELL;
    if (process.env.TMPDIR) env.TMPDIR = process.env.TMPDIR;
    if (process.env.LANG) env.LANG = process.env.LANG;
    if (process.env.LC_ALL) env.LC_ALL = process.env.LC_ALL;

    // Node.js specific environment variables
    if (process.env.NODE_ENV) env.NODE_ENV = process.env.NODE_ENV;
    if (process.env.NODE_PATH) env.NODE_PATH = process.env.NODE_PATH;

    // Bun specific environment variables
    if (process.env.BUN_INSTALL) env.BUN_INSTALL = process.env.BUN_INSTALL;

    // Package manager specific
    if (process.env.npm_config_prefix)
      env.npm_config_prefix = process.env.npm_config_prefix;

    // Clean up any potentially problematic environment variables that might be inherited from the compiled executable
    // Remove the '_' variable that points to the executable path as it can confuse child processes
    delete env._;

    // Ensure we don't inherit PM2 specific variables that might interfere
    delete env.PM2_PROGRAMMATIC;
    delete env.PM2_JSON_PROCESSING;
    delete env.PM2_HOME;

    // Add environment variables from configuration
    if (mcpConfig?.env) {
      for (const [key, value] of Object.entries(mcpConfig.env)) {
        if (value !== undefined && value !== null) {
          env[key] = String(value);
        }
      }
    }

    // Block external ports by setting environment variables
    // This tells the MCP to use only stdio for communication and not open any network ports
    env.MCP_COMMUNICATION_MODE = "stdio_only";
    env.MCP_DISABLE_NETWORK = "true";

    // Setting to 0 makes most servers pick a random port
    env.PORT = "0";

    await new Promise<void>((resolve, reject) => {
      pm2.connect((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      pm2.start(
        {
          script: cmd,
          args: args,
          name: `furi_${mcpName.replace("/", "-")}`,
          cwd,
          watch: true,
          env: env,
          merge_logs: true,
          log_date_format: "YYYY-MM-DD HH:mm:ss Z",
          interpreter:
            cmd === "npm" ? "node" : cmd === "bun" ? "bun" : undefined,
        },
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });

    // Update configuration with last action
    try {
      if (config.installed[mcpName]) {
        config.installed[mcpName].userLastAction = "start";

        // Write updated configuration back to file
        writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
      }
    } catch (configError) {}

    return {
      success: true,
      message: `[${mcpName}] Started`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `[${mcpName}] Failed to start: ${
        error.message || String(error)
      }`,
    };
  } finally {
    pm2.disconnect();
  }
};
