import { readFileSync } from "fs";
import { join } from "path";
import pm2 from "pm2";
import { scanEnvVars } from "../../env/actions/scanEnvVars";

/**
 * Core function to start an MCP server without spinner UI
 */
export const startMCPCore = async (
  mcpName: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const basePath = process.env.BASE_PATH || "";
    if (!basePath) {
      throw new Error("BASE_PATH environment variable is not set");
    }

    const configPath = join(basePath, ".furikake/configuration.json");
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

    const cwd = mcpConfig.source || `.furikake/installed/${mcpName}`;

    // Initialize environment variables
    const env: Record<string, string> = {};
    if (process.env.PATH) env.PATH = process.env.PATH;
    if (process.env.NODE_ENV) env.NODE_ENV = process.env.NODE_ENV;
    if (process.env.HOME) env.HOME = process.env.HOME;
    if (process.env.USER) env.USER = process.env.USER;

    // Add environment variables from configuration
    if (mcpConfig?.env) {
      for (const [key, value] of Object.entries(mcpConfig.env)) {
        if (value !== undefined && value !== null) {
          env[key] = String(value);
        }
      }
    }

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
