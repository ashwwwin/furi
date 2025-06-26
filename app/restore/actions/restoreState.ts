import { readFileSync } from "fs";
import { resolveFromUserData } from "@/helpers/paths";
import { startMCPCore } from "@/mcp/start/actions/startMCP";
import { stopMCPCore } from "@/mcp/stop/actions/stopMCP";

interface RestoreResult {
  success: boolean;
  restored?: {
    start: string[];
    stop: string[];
  };
  message?: string;
  details?: Array<{
    mcpName: string;
    action: "start" | "stop";
    success: boolean;
    message: string;
  }>;
}

export const restoreMCPsStateCore = async (): Promise<RestoreResult> => {
  try {
    // Read configuration file
    const configPath = resolveFromUserData("configuration.json");
    let config;

    try {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch (error) {
      return {
        success: false,
        message: "Failed to read configuration file",
      };
    }

    // Check if installed section exists
    if (!config.installed || Object.keys(config.installed).length === 0) {
      return {
        success: true,
        restored: { start: [], stop: [] },
        message: "No installed MCPs found",
      };
    }

    const installedMCPs = Object.keys(config.installed);
    const restored = { start: [] as string[], stop: [] as string[] };
    const details: RestoreResult["details"] = [];

    // Process each installed MCP
    for (const mcpName of installedMCPs) {
      const mcpConfig = config.installed[mcpName];

      if (!mcpConfig.userLastAction) {
        // Skip MCPs that have no recorded last action - nothing to restore
        continue;
      }

      try {
        if (mcpConfig.userLastAction === "start") {
          const result = await startMCPCore(mcpName);
          details.push({
            mcpName,
            action: "start",
            success: result.success,
            message: result.message,
          });

          if (result.success) {
            restored.start.push(mcpName);
          }
        } else if (mcpConfig.userLastAction === "stop") {
          const result = await stopMCPCore(mcpName);
          details.push({
            mcpName,
            action: "stop",
            success: result.success,
            message: result.message,
          });

          if (result.success) {
            restored.stop.push(mcpName);
          }
        } else {
          details.push({
            mcpName,
            action: mcpConfig.userLastAction as "start" | "stop",
            success: false,
            message: `Unknown last action: ${mcpConfig.userLastAction}`,
          });
        }
      } catch (error) {
        details.push({
          mcpName,
          action: mcpConfig.userLastAction as "start" | "stop",
          success: false,
          message: `Error during restore: ${error}`,
        });
      }
    }

    // Check if any operations failed
    const hasFailures = details.some((d) => !d.success);

    return {
      success: !hasFailures,
      restored,
      details,
      message: hasFailures
        ? `Some operations failed during restore`
        : details.length === 0
        ? `No MCPs found with recorded last actions to restore`
        : `Successfully restored ${
            restored.start.length + restored.stop.length
          } MCP(s) from ${details.length} MCP(s) with recorded actions`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to restore MCPs state: ${error}`,
    };
  }
};
