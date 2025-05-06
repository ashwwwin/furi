import chalk from "chalk";
import pm2 from "pm2";
import fs from "fs";
import { $ } from "bun";
import { formatUptime } from "@/mcp/status/actions/getProcStatus";
import { displayStatus } from "@/mcp/status/actions/displayStatus";

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

export const getAggregatorServerStatus = async (lines: number = 15) => {
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
      console.log(chalk.yellow(`MCP Aggregator server is not running`));
      return;
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
        ? `${Math.round(processInfo.monit.memory / 1024 / 1024)}MB`
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

    // Display the status
    displayStatus(status);

    // Display additional transport info
    console.log(
      `\n\x1b[36mTransport:\x1b[0m ${transportType}${
        transportType === "sse" ? ` (port: ${port})` : ""
      }`
    );

    // Display logs
    try {
      const logs = await getAggregatorServerLogs(lines);

      // Display logs in a simpler format similar to PM2 logs
      if (logs.output.trim()) {
        console.log(`\n\x1b[36mLogs:\x1b[0m`);
        console.log(`\x1b[2m${logs.output}\x1b[0m`);
      }

      // Only show error logs if they have content
      if (logs.error.trim()) {
        console.log(`\n\x1b[31mError logs:\x1b[0m`);
        console.log(`\x1b[2m${logs.error}\x1b[0m`);
      }

      if (!logs.output.trim() && !logs.error.trim()) {
        console.log(`\n\x1b[33mNo logs found for this process.\x1b[0m`);
      }

      console.log(
        `\n\x1b[2mTo see more lines use: furi meta status --lines <number>\x1b[0m`
      );
    } catch (err) {
      console.log(
        `\n\x1b[33mError retrieving logs: ${
          err instanceof Error ? err.message : String(err)
        }\x1b[0m`
      );
    }
  } catch (error: any) {
    console.error(
      chalk.red(
        `Failed to get MCP Aggregator server status: ${
          error.message || String(error)
        }`
      )
    );
  } finally {
    // Ensure we disconnect from PM2 if connected
    if (pm2Connected) {
      await disconnectFromPM2();
    }
    process.exit(0);
  }
};

// Export a function to run this command
export default async function aggregatorStatus(lines: number = 15) {
  await getAggregatorServerStatus(lines);
}
