import { createSpinner } from "nanospinner";
import { getPM2StatusCore } from "./actions/getPM2Status";
import {
  displayAllStatuses,
  displaySingleStatus,
} from "./actions/displayStatus";
import fs from "fs";
import path from "path";
import os from "os";

/**
 * Get PM2 logs for a specific MCP
 * @param mcpName Name of the MCP
 * @param lines Number of lines to show (default: 15)
 */
const getMCPLogs = (mcpName: string, lines: number = 15): string => {
  try {
    const pmName = `furi_${mcpName}`;
    const logsDir = path.join(os.homedir(), ".pm2", "logs");
    const outLogPath = path.join(logsDir, `${pmName}-out.log`);
    const errLogPath = path.join(logsDir, `${pmName}-error.log`);
    const { execSync } = require("child_process");

    let logOutput = "";

    // Get stdout logs
    if (fs.existsSync(outLogPath)) {
      const outLogs = execSync(`tail -n ${lines} "${outLogPath}"`).toString();
      if (outLogs.trim()) {
        logOutput += "=== STDOUT LOGS ===\n" + outLogs + "\n";
      }
    }

    // Get stderr logs
    if (fs.existsSync(errLogPath)) {
      const errLogs = execSync(`tail -n ${lines} "${errLogPath}"`).toString();
      if (errLogs.trim()) {
        logOutput += "=== STDERR LOGS ===\n" + errLogs;
      }
    }

    return logOutput || "No logs found";
  } catch (error) {
    return `Error retrieving logs: ${
      error instanceof Error ? error.message : String(error)
    }`;
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
    const result = await getPM2StatusCore(mcpName);

    if (!result.success) {
      spinner.error(result.message);
      return;
    }

    if (mcpName === "all" && Array.isArray(result.data)) {
      spinner.success(`${result.data.length} found\n`);
      displayAllStatuses(result.data, {
        showDetails: true,
      });

      console.log(
        `\n\x1b[2mIf you want to see logs use: furi status <mcpName>\x1b[0m`
      );
    } else if (result.data && !Array.isArray(result.data)) {
      spinner.success(`[${result.data.name}] found\n`);
      displaySingleStatus(result.data);

      // Show logs for the single MCP
      const lineCount = parseInt(lines, 10) || 15;
      const logs = getMCPLogs(result.data.name, lineCount);

      console.log(`\n\x1b[1mRecent logs (last ${lineCount} lines):\x1b[0m`);
      console.log(`\x1b[2m${logs}\x1b[0m`);

      console.log(
        `\n\x1b[2mIf you want to see more lines use: furi status <mcpName> -l <lines>\x1b[0m`
      );
    }
  } catch (error) {
    spinner.error(
      `Failed to get status: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};
