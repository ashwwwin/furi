import { createSpinner } from "nanospinner";
import { getProcStatus } from "./actions/getProcStatus";
import { displayStatus } from "./actions/displayStatus";
import fs from "fs";
import path from "path";
import os from "os";
import { $ } from "bun";
import pm2 from "pm2";
import {
  connectToPm2,
  disconnectFromPm2,
} from "@/helpers/mcpConnectionManager";

/**
 * Get PM2 logs for a specific MCP
 * @param mcpName Name of the MCP
 * @param lines Number of lines to show
 */
const getMCPLogs = async (
  mcpName: string,
  lines: number = 15
): Promise<{ success: boolean; output: string; error: string }> => {
  try {
    const pmName = `furi_${mcpName.replace("/", "-")}`;

    // Connect to PM2 (ref-counted)
    await connectToPm2();

    try {
      // Get process information to find log paths
      const processList = await new Promise<any[]>((resolve, reject) => {
        pm2.describe(pmName, (err, processInfo) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(processInfo);
        });
      });

      if (!processList || processList.length === 0) {
        return {
          success: false,
          output: `Process ${pmName} not found`,
          error: "",
        };
      }

      const processInfo = processList[0];

      // Get log paths from PM2
      const outLogPath = processInfo.pm2_env?.pm_out_log_path;
      const errLogPath = processInfo.pm2_env?.pm_err_log_path;

      let outputLogs = "";
      let errorLogs = "";

      // Get stdout logs directly with less filtering (more like native pm2 logs)
      if (outLogPath && fs.existsSync(outLogPath)) {
        try {
          const rawLogs = await $`tail -n ${lines} "${outLogPath}"`.text();
          outputLogs = rawLogs.trim();
        } catch (error) {
          outputLogs = `Error retrieving logs: ${error}`;
        }
      } else {
        outputLogs = "No output logs found";
      }

      // Get stderr logs directly with less filtering
      if (errLogPath && fs.existsSync(errLogPath)) {
        try {
          const rawLogs = await $`tail -n ${lines} "${errLogPath}"`.text();
          errorLogs = rawLogs.trim();
        } catch (error) {
          errorLogs = `Error retrieving error logs: ${error}`;
        }
      }

      return { success: true, output: outputLogs, error: errorLogs };
    } finally {
      // Always release PM2 lease
      await disconnectFromPm2();
    }
  } catch (error) {
    return {
      success: false,
      output: "",
      error: `Error retrieving logs: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};

export const statusMCP = async (
  mcpName: string,
  lines: string = "15"
): Promise<void> => {
  const spinner = createSpinner(
    `Retrieving status for ${mcpName === "all" ? "all MCPs" : mcpName}`
  );
  spinner.start();

  try {
    const result = await getProcStatus(mcpName);

    if (!result.success) {
      spinner.error(result.message);
      return;
    }

    if (mcpName === "all" && Array.isArray(result.data)) {
      spinner.success(`${result.data.length} found\n`);
      displayStatus(result.data, {
        showDetails: true,
      });

      console.log(`\n\x1b[2mTo see logs use: furi status <mcpName>\x1b[0m`);
    } else if (result.data && !Array.isArray(result.data)) {
      spinner.success(`[${result.data.name}] found\n`);

      // Show basic status info
      displayStatus(result.data);

      try {
        const lineCount = parseInt(lines, 10) || 15;
        const logs = await getMCPLogs(result.data.name, lineCount);

        if (!logs.success) {
          spinner.error(logs.error);
          return;
        }

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
          `\n\x1b[2mTo see more lines use: furi status ${mcpName} --lines <number>\x1b[0m`
        );
      } catch (err) {
        console.log(
          `\n\x1b[33mError retrieving logs: ${
            err instanceof Error ? err.message : String(err)
          }\x1b[0m`
        );
      }
    }
  } catch (error) {
    spinner.error(
      `Failed to get status: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

export { getMCPLogs };
