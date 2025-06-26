import pm2 from "pm2";
import { readFileSync, writeFileSync } from "fs";
import { resolveFromUserData } from "@/helpers/paths";

/**
 * Core function to stop an MCP server without spinner UI
 */
export const stopMCPCore = async (
  mcpName: string
): Promise<{ success: boolean; message: string }> => {
  try {
    // Create PM2 process name from MCP Name
    const processName = `furi_${mcpName.replace("/", "-")}`;

    // Connect to PM2
    await new Promise<void>((resolve, reject) => {
      pm2.connect((err) => {
        if (err) {
          reject(new Error(`Failed to connect to PM2: ${err.message}`));
          return;
        }
        resolve();
      });
    });

    // Check if the process exists and is running
    const list = await new Promise<any[]>((resolve, reject) => {
      pm2.list((err, list) => {
        if (err) {
          reject(new Error(`Failed to get process list: ${err.message}`));
          return;
        }
        resolve(list);
      });
    });

    const processEntry = list.find((p) => p.name === processName);

    if (!processEntry) {
      return {
        success: false,
        message: `Process not found`,
      };
    }

    // Stop the process
    await new Promise<void>((resolve, reject) => {
      pm2.stop(processName, (err) => {
        if (err) {
          reject(new Error(`Failed to stop process: ${err.message}`));
          return;
        }
        resolve();
      });
    });

    // Update configuration with last action
    try {
      const configPath = resolveFromUserData("configuration.json");
      const config = JSON.parse(readFileSync(configPath, "utf-8"));

      if (config.installed[mcpName]) {
        config.installed[mcpName].userLastAction = "stop";

        // Write updated configuration back to file
        writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
      }
    } catch (configError) {}

    return {
      success: true,
      message: `[${mcpName}] Stopped`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `[${mcpName}] Failed to stop: ${error.message || String(error)}`,
    };
  } finally {
    // Always disconnect from PM2 to allow the process to exit
    pm2.disconnect();
  }
};
