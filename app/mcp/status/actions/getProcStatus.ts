import { readFileSync } from "fs";
import pm2 from "pm2";
import { resolveFromUserData } from "@/helpers/paths";

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

export function formatMemory(bytes: number): string {
  if (bytes < 1024 * 1024) {
    // Less than 1MB, show in KB
    return `${(bytes / 1024).toFixed(1)}kb`;
  } else if (bytes < 1024 * 1024 * 1024) {
    // Less than 1GB, show in MB
    return `${(bytes / 1024 / 1024).toFixed(1)}mb`;
  } else {
    // 1GB or more, show in GB
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}gb`;
  }
}

export interface MCPStatus {
  name: string;
  pid: number | string;
  status: string;
  memory: string;
  cpu: string;
  uptime: string;
}

export const getProcStatus = async (
  mcpName: string
): Promise<{
  success: boolean;
  message: string;
  data?: MCPStatus[] | MCPStatus;
}> => {
  try {
    const configPath = resolveFromUserData("configuration.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));

    // Check if specific MCP exists in either root or installed section
    const mcpExists =
      mcpName === "all" ||
      config[mcpName] !== undefined ||
      (config.installed && config.installed[mcpName] !== undefined);

    if (!mcpExists) {
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
            memory: proc.monit?.memory ? formatMemory(proc.monit.memory) : "0",
            cpu: proc.monit?.cpu ? `${proc.monit.cpu.toFixed(1)}%` : "0%",
            uptime: proc.pm2_env?.pm_uptime
              ? formatUptime(Date.now() - proc.pm2_env.pm_uptime)
              : "N/A",
          };
        });

      // Get all installed MCPs from configuration
      const allMCPs = [];

      // Check root level packages (for backward compatibility)
      // Identify packages by checking if the value is an object and has a 'run' command
      const rootPackages = Object.keys(config).filter(
        (key) =>
          typeof config[key] === "object" &&
          config[key] !== null && // Ensure it's not null
          config[key].source
      );

      for (const configName of rootPackages) {
        // Use the same deterministic naming as everywhere else
        const expectedProcessName = configName.replace("/", "-");

        // Find exact match by process name
        const process = runningProcesses.find(
          (p) => p.name === expectedProcessName
        );

        if (process) {
          allMCPs.push({
            ...process,
            name: configName, // Use the config name for display
          });
        } else {
          // No matching process found, show as offline
          allMCPs.push({
            name: configName,
            pid: "N/A",
            status: "offline",
            memory: "N/A",
            cpu: "N/A",
            uptime: "N/A",
          });
        }
      }

      // Check installed packages
      if (config.installed) {
        for (const configName of Object.keys(config.installed)) {
          // Skip if already processed from root level
          if (rootPackages.includes(configName)) continue;

          // Use the same deterministic naming as everywhere else
          const expectedProcessName = configName.replace("/", "-");

          // Find exact match by process name
          const process = runningProcesses.find(
            (p) => p.name === expectedProcessName
          );

          if (process) {
            allMCPs.push({
              ...process,
              name: configName,
            });
          } else {
            allMCPs.push({
              name: configName,
              pid: "N/A",
              status: "offline",
              memory: "N/A",
              cpu: "N/A",
              uptime: "N/A",
            });
          }
        }
      }

      return {
        success: true,
        message: "Retrieved status for all MCPs",
        data: allMCPs,
      };
    } else {
      // For a specific MCP, try to find it in the PM2 processes
      // Use the same naming convention as everywhere else in the codebase
      const processName = `furi_${mcpName.replace("/", "-")}`;

      // Find process with exact match (should be deterministic now)
      const process = processList.find((proc) => proc.name === processName);

      if (!process) {
        // If the process is not found in PM2 but exists in config, show it as offline
        if (
          config[mcpName] ||
          (config.installed && config.installed[mcpName])
        ) {
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
          ? formatMemory(process.monit.memory)
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
