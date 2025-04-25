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
    // Handle different naming formats
    const simpleName = mcpName.split("/").pop()?.replace(/-/g, "") || mcpName;
    const pmName = `furi_${simpleName}`;
    const logsDir = path.join(os.homedir(), ".pm2", "logs");

    // Try to find matching log files - we need to handle cases where PM2 might use
    // a different name than what we expect
    const dirFiles = fs.readdirSync(logsDir);
    const possiblePrefixes = [
      pmName,
      `furi_${mcpName}`,
      `furi_${mcpName.split("/").pop() || mcpName}`,
    ];

    // Find the first matching log files
    let outLogFile = null;
    let errLogFile = null;

    for (const prefix of possiblePrefixes) {
      const outMatch = dirFiles.find(
        (f) => f.startsWith(prefix) && f.includes("-out.log")
      );
      const errMatch = dirFiles.find(
        (f) => f.startsWith(prefix) && f.includes("-error.log")
      );

      if (outMatch) outLogFile = outMatch;
      if (errMatch) errLogFile = errMatch;

      if (outLogFile || errLogFile) break;
    }

    const { execSync } = require("child_process");
    let logOutput = "";

    // Get stdout logs
    if (outLogFile) {
      const outLogPath = path.join(logsDir, outLogFile);
      const outLogs = execSync(`tail -n ${lines} "${outLogPath}"`).toString();
      if (outLogs.trim()) {
        logOutput += "=== STDOUT LOGS ===\n" + outLogs + "\n";
      }
    }

    // Get stderr logs
    if (errLogFile) {
      const errLogPath = path.join(logsDir, errLogFile);
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

      console.log(`\n\x1b[2mTo see logs use: furi status <mcpName>\x1b[0m`);
    } else if (result.data && !Array.isArray(result.data)) {
      spinner.success(`[${result.data.name}] found\n`);
      displaySingleStatus(result.data);

      // Show logs for the single MCP
      const lineCount = parseInt(lines, 10) || 15;
      const logs = getMCPLogs(result.data.name, lineCount);

      console.log(`\n\x1b[1mRecent logs (last ${lineCount} lines):\x1b[0m`);
      console.log(`\x1b[2m${logs}\x1b[0m`);

      console.log(
        `\n\x1b[2mTo see more lines use: furi status <mcpName> -l <lines>\x1b[0m`
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
