import pm2 from "pm2";
import fs from "fs";
import { $ } from "bun";
import { formatUptime, formatMemory } from "@/mcp/status/actions/getProcStatus";

// !!! Ensure this matches the server.ts app name !!!
const appName = "furi-aggregator-server";
const pm2OperationTimeout = 10000;

// Connect to PM2 with timeout
const connectToPM2 = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("PM2 connection timeout"));
    }, pm2OperationTimeout);

    pm2.connect((err) => {
      clearTimeout(timeout);
      if (err) {
        reject(
          new Error(`Failed to connect to PM2: ${err.message || String(err)}`)
        );
        return;
      }
      resolve();
    });
  });
};

// Ensure PM2 gets disconnected properly
const disconnectFromPM2 = (): Promise<void> => {
  return new Promise<void>((resolve) => {
    try {
      pm2.disconnect();
    } catch (error) {
      // Silently ignore disconnection errors
    }
    resolve();
  });
};

const getAggregatorServerLogs = async (
  lines: number = 15
): Promise<{ output: string; error: string }> => {
  try {
    // Connect to PM2
    await connectToPM2();

    try {
      // Get process information to find log paths
      const processInfo = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("PM2 operation timeout"));
        }, pm2OperationTimeout);

        pm2.describe(appName, (err, proc) => {
          clearTimeout(timeout);
          if (err) {
            reject(
              new Error(
                `Failed to get process info: ${err.message || String(err)}`
              )
            );
            return;
          }
          if (!proc || proc.length === 0) {
            reject(new Error(`Process ${appName} not found`));
            return;
          }
          resolve(proc[0]);
        });
      });

      // Get log paths from PM2
      const outLogPath = processInfo.pm2_env?.pm_out_log_path;
      const errLogPath = processInfo.pm2_env?.pm_err_log_path;

      let outputContent = "";
      let errorContent = "";

      // Get stdout logs directly with minimal filtering
      if (outLogPath && fs.existsSync(outLogPath)) {
        try {
          const rawLogs = await $`tail -n ${lines} "${outLogPath}"`.text();
          outputContent = rawLogs.trim();
        } catch (e) {
          outputContent = `Error retrieving logs: ${e}`;
        }
      } else {
        outputContent = "No output logs found";
      }

      // Get stderr logs directly with minimal filtering
      if (errLogPath && fs.existsSync(errLogPath)) {
        try {
          const rawLogs = await $`tail -n ${lines} "${errLogPath}"`.text();
          errorContent = rawLogs.trim();
        } catch (e) {
          errorContent = `Error retrieving error logs: ${e}`;
        }
      } else {
        errorContent = "No error log files found";
      }

      return { output: outputContent, error: errorContent };
    } finally {
      // Always disconnect from PM2
      await disconnectFromPM2();
    }
  } catch (error) {
    return {
      output: "",
      error: `Error retrieving logs: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};

export async function statusAggregatorResponse(
  lines: number = 15
): Promise<Response> {
  let pm2Connected = false;

  try {
    // Connect to PM2
    await connectToPM2();
    pm2Connected = true;

    // Get server info with timeout
    const processInfo = await new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("PM2 operation timeout"));
      }, pm2OperationTimeout);

      pm2.describe(appName, (err, proc) => {
        clearTimeout(timeout);
        if (err) {
          reject(
            new Error(
              `Failed to get process info: ${err.message || String(err)}`
            )
          );
          return;
        }
        resolve(proc && proc.length > 0 ? proc[0] : null);
      });
    });

    if (!processInfo) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "MCP Aggregator server is not running",
        })
      );
    }

    // Get transport type and port from environment variables
    const transportType = processInfo.pm2_env?.env?.TRANSPORT_TYPE || "stdio";
    const port = processInfo.pm2_env?.env?.PORT || "9338";

    // Format the status data
    const status = {
      name: "MCP Aggregator Server",
      pid: processInfo.pid || "N/A",
      status: processInfo.pm2_env?.status || "unknown",
      memory: processInfo.monit?.memory
        ? formatMemory(processInfo.monit.memory)
        : "N/A",
      cpu: processInfo.monit?.cpu
        ? `${processInfo.monit.cpu.toFixed(1)}%`
        : "N/A",
      uptime: processInfo.pm2_env?.pm_uptime
        ? formatUptime(Date.now() - processInfo.pm2_env.pm_uptime)
        : "N/A",
      transport: transportType,
      port: transportType === "sse" ? port : "N/A",
    };

    // Get logs
    let logs = { output: "", error: "" };
    try {
      logs = await getAggregatorServerLogs(lines);
    } catch (err) {
      // Continue even if logs can't be retrieved
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "MCP Aggregator server status retrieved successfully",
        data: {
          status,
          transport: {
            type: transportType,
            port: transportType === "sse" ? port : "N/A",
          },
          logs,
        },
      })
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: `Failed to get MCP Aggregator server status: ${
          error.message || String(error)
        }`,
      })
    );
  } finally {
    // Ensure we disconnect from PM2 if connected
    if (pm2Connected) {
      await disconnectFromPM2();
    }
  }
}
