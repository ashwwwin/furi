// Show single line status response for `furi-http-server` from `pm2`
import chalk from "chalk";
import pm2 from "pm2";
import fs from "fs";
import { $ } from "bun";
import { formatUptime } from "@/mcp/status/actions/getProcStatus";
import { displayStatus } from "@/mcp/status/actions/displayStatus";

const getHttpServerLogs = async (
  lines: number = 15,
): Promise<{ output: string; error: string }> => {
  try {
    const appName = "furi-http-server";

    // Connect to PM2
    await new Promise<void>((resolve, reject) => {
      pm2.connect((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

    try {
      // Get process information to find log paths
      const processInfo = await new Promise<any>((resolve, reject) => {
        pm2.describe(appName, (err, proc) => {
          if (err) {
            reject(err);
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
      pm2.disconnect();
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

export const getHttpServerStatus = async (lines: number = 15) => {
  try {
    const appName = "furi-http-server";

    // Connect to PM2
    await new Promise<void>((resolve, reject) => {
      pm2.connect((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

    // Get server info
    const processInfo = await new Promise<any>((resolve, reject) => {
      pm2.describe(appName, (err, proc) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(proc[0]);
      });
    });

    if (!processInfo) {
      console.log(chalk.yellow(`HTTP API server is not running`));
      return;
    }

    // Format the status data
    const status = {
      name: "HTTP API Server",
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
    };

    // Display the status
    displayStatus(status);

    // Display logs
    try {
      const logs = await getHttpServerLogs(lines);

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
        `\n\x1b[2mTo see more lines use: furi http status --lines <number>\x1b[0m`,
      );
    } catch (err) {
      console.log(`\n\x1b[33mError retrieving logs: ${err}\x1b[0m`);
    }
  } catch (error: any) {
    console.error(
      chalk.red(
        `Failed to get HTTP API server status: ${
          error.message || String(error)
        }`,
      ),
    );
  } finally {
    pm2.disconnect();
    process.exit(0);
  }
};

// Export a function to run this command
export default async function httpStatus(lines: number = 15) {
  await getHttpServerStatus(lines);
}
