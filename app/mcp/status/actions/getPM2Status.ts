import { readFileSync } from "fs";
import { join } from "path";
import pm2 from "pm2";

/**
 * Format uptime from milliseconds to a readable string
 */
export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Interface for MCP status information
 */
export interface MCPStatus {
  name: string;
  pid: number | string;
  status: string;
  memory: string;
  cpu: string;
  uptime: string;
}

/**
 * Core function to get status information for MCPs
 */
export const getPM2StatusCore = async (
  mcpName: string
): Promise<{
  success: boolean;
  message: string;
  data?: MCPStatus[] | MCPStatus;
}> => {
  try {
    const basePath = process.env.BASE_PATH || "";
    if (!basePath) {
      throw new Error("BASE_PATH environment variable is not set");
    }

    const configPath = join(basePath, ".furikake/configuration.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));

    if (mcpName !== "all" && !config[mcpName]) {
      return {
        success: false,
        message: `[${mcpName}] Configuration not found`,
      };
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

    const processList = await new Promise<any[]>((resolve, reject) => {
      pm2.list((err, list) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(list);
      });
    });

    if (mcpName === "all") {
      // Get all running MCP processes from PM2
      const runningProcesses = processList
        .filter((proc) => proc.name.startsWith("furi_"))
        .map((proc) => {
          // Extract the MCP name by removing the 'furi_' prefix
          const mcpName = proc.name.replace("furi_", "");

          return {
            name: mcpName,
            pid: proc.pid,
            status: proc.pm2_env?.status || "unknown",
            memory: proc.monit?.memory
              ? `${Math.round(proc.monit.memory / 1024 / 1024)}MB`
              : "N/A",
            cpu: proc.monit?.cpu ? `${proc.monit.cpu.toFixed(1)}%` : "N/A",
            uptime: proc.pm2_env?.pm_uptime
              ? formatUptime(Date.now() - proc.pm2_env.pm_uptime)
              : "N/A",
          };
        });

      // Get all installed MCPs from configuration
      const allMCPs = Object.keys(config).map((configName) => {
        // For each config entry, look for a matching PM2 process
        const process = runningProcesses.find((p) => p.name === configName);

        if (process) {
          return process;
        } else {
          // No matching process found, show as offline
          return {
            name: configName,
            pid: "N/A",
            status: "offline",
            memory: "N/A",
            cpu: "N/A",
            uptime: "N/A",
          };
        }
      });

      return {
        success: true,
        message: "Retrieved status for all MCPs",
        data: allMCPs,
      };
    } else {
      // For a specific MCP, try to find it in the PM2 processes
      const pmName = `furi_${mcpName}`;
      const process = processList.find((proc) => proc.name === pmName);

      if (!process) {
        // If the process is not found in PM2 but exists in config, show it as offline
        if (config[mcpName]) {
          const status: MCPStatus = {
            name: mcpName,
            pid: "N/A",
            status: "offline",
            memory: "N/A",
            cpu: "N/A",
            uptime: "N/A",
          };

          return {
            success: true,
            message: `Retrieved status for [${mcpName}]`,
            data: status,
          };
        }

        return {
          success: false,
          message: `[${mcpName}] Process not found`,
        };
      }

      const status: MCPStatus = {
        name: mcpName,
        pid: process.pid,
        status: process.pm2_env?.status || "unknown",
        memory: process.monit?.memory
          ? `${Math.round(process.monit.memory / 1024 / 1024)}MB`
          : "N/A",
        cpu: process.monit?.cpu ? `${process.monit.cpu.toFixed(1)}%` : "N/A",
        uptime: process.pm2_env?.pm_uptime
          ? formatUptime(Date.now() - process.pm2_env.pm_uptime)
          : "N/A",
      };

      return {
        success: true,
        message: `Retrieved status for [${mcpName}]`,
        data: status,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to get status: ${error.message || String(error)}`,
    };
  } finally {
    pm2.disconnect();
  }
};
