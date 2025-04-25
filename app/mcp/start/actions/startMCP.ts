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

    if (!config[mcpName]) {
      return {
        success: false,
        message: `[${mcpName}] Configuration not found`,
      };
    }

    const runCommand = config[mcpName].run || "npm run start";
    const [cmd, ...args] = runCommand.split(" ");

    const cwd = config[mcpName].source || `.furikake/installed/${mcpName}`;

    let envVars: { variables: string[] } = { variables: [] };
    try {
      envVars = await scanEnvVars(mcpName);

      const missingEnvVars = envVars.variables.filter((varName) => {
        return !config[mcpName]?.env || !config[mcpName].env[varName];
      });

      if (missingEnvVars.length > 0) {
        // TODO: spinner.warning to the user that they need to set the environment variables
        // Ask them to run anyways, input now (loop for all missing env vars) or exit
        // Check howthe user wants to continue

        console.warn(
          `\n[${mcpName}] Missing environment variable(s): ${missingEnvVars.join(
            ", "
          )}`
        );
      }
    } catch (error) {
      console.warn(
        `[${mcpName}] Failed to scan environment variables: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const env: Record<string, string> = {};

    if (process.env.PATH) env.PATH = process.env.PATH;
    if (process.env.NODE_ENV) env.NODE_ENV = process.env.NODE_ENV;
    if (process.env.HOME) env.HOME = process.env.HOME;
    if (process.env.USER) env.USER = process.env.USER;

    if (config[mcpName]?.env) {
      for (const [key, value] of Object.entries(config[mcpName].env)) {
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
          output: join(
            process.cwd(),
            `.furikake/logs/${mcpName.replace("/", "-")}-out.log`
          ),
          error: join(
            process.cwd(),
            `.furikake/logs/${mcpName.replace("/", "-")}-error.log`
          ),
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
