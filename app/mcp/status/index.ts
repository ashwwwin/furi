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
    // First try to get custom log paths from PM2 process info
    const { execSync } = require("child_process");
    const pmName = `furi_${mcpName}`;
    let customErrorLog = "";
    let customOutLog = "";

    try {
      // Get process details from PM2 to check for custom log paths
      const pmInfo = execSync(`pm2 show ${pmName}`).toString();
      // Extract log paths from the output
      const outLogMatch = pmInfo.match(/out log path\s*:\s*([^\n]+)/i);
      const errLogMatch = pmInfo.match(/error log path\s*:\s*([^\n]+)/i);

      if (outLogMatch && outLogMatch[1]) {
        customOutLog = outLogMatch[1].trim();
      }

      if (errLogMatch && errLogMatch[1]) {
        customErrorLog = errLogMatch[1].trim();
      }
    } catch (e) {
      // Fallback silently if pm2 show fails
      console.log(`Could not load ${pmName}`);
    }

    const defaultLogsDir = path.join(os.homedir(), ".pm2", "logs");
    const furikakeLogsDir = path.join(
      process.env.BASE_PATH || "",
      ".furikake",
      "logs"
    );

    // List of possible log paths to check in order
    const possibleOutLogPaths = [
      customOutLog,
      path.join(furikakeLogsDir, `${mcpName}-out.log`),
      path.join(defaultLogsDir, `${pmName}-out.log`),
    ].filter(Boolean);

    const possibleErrLogPaths = [
      customErrorLog,
      path.join(furikakeLogsDir, `${mcpName}-error.log`),
      path.join(defaultLogsDir, `${pmName}-error.log`),
    ].filter(Boolean);

    // If custom paths didn't work, try to find logs in the default PM2 directory
    if (
      !possibleOutLogPaths.some((p) => fs.existsSync(p)) &&
      !possibleErrLogPaths.some((p) => fs.existsSync(p))
    ) {
      // Fallback to the original implementation
      const logsDir = path.join(os.homedir(), ".pm2", "logs");
      if (!fs.existsSync(logsDir)) {
        return "PM2 logs directory not found";
      }

      // List all files in the logs directory
      const dirFiles = fs.readdirSync(logsDir);

      // Get possible name variations to match against
      const simpleName = mcpName.split("/").pop() || mcpName;
      const baseNameWithoutDash = simpleName.replace(/-/g, "");

      // Pattern matching for various log file naming formats
      const patterns = [
        `furi_${mcpName}-out`,
        `furi_${simpleName}-out`,
        `furi_${baseNameWithoutDash}-out`,
        `${mcpName}-out`,
        `${simpleName}-out`,
        `${simpleName}-\\d+-out`, // For numbered format like perplexity-search-1-out-0.log
      ];

      const errPatterns = [
        `furi_${mcpName}-error`,
        `furi_${simpleName}-error`,
        `furi_${baseNameWithoutDash}-error`,
        `${mcpName}-error`,
        `${simpleName}-error`,
        `${simpleName}-\\d+-error`, // For numbered format
      ];

      // Find matching log files using regex patterns
      let outLogFile = null;
      let errLogFile = null;

      // Find stdout log file
      for (const pattern of patterns) {
        const regex = new RegExp(`^${pattern}`);
        const match = dirFiles.find((f) => regex.test(f));
        if (match) {
          outLogFile = match;
          possibleOutLogPaths.push(path.join(logsDir, outLogFile));
          break;
        }
      }

      // Find stderr log file
      for (const pattern of errPatterns) {
        const regex = new RegExp(`^${pattern}`);
        const match = dirFiles.find((f) => regex.test(f));
        if (match) {
          errLogFile = match;
          possibleErrLogPaths.push(path.join(logsDir, errLogFile));
          break;
        }
      }

      // Fallback: look for partial matches in filenames
      if (!outLogFile) {
        const partialName = simpleName.toLowerCase().split("-")[0] || "";
        outLogFile = dirFiles.find(
          (f) => f.toLowerCase().includes(partialName) && f.includes("-out")
        );
        if (outLogFile) {
          possibleOutLogPaths.push(path.join(logsDir, outLogFile));
        }
      }

      if (!errLogFile) {
        const partialName = simpleName.toLowerCase().split("-")[0] || "";
        errLogFile = dirFiles.find(
          (f) => f.toLowerCase().includes(partialName) && f.includes("-error")
        );
        if (errLogFile) {
          possibleErrLogPaths.push(path.join(logsDir, errLogFile));
        }
      }
    }

    let logOutput = "";

    // Get stdout logs from first existing log path
    const outLogPath = possibleOutLogPaths.find((p) => fs.existsSync(p));
    if (outLogPath) {
      try {
        const outLogs = execSync(`tail -n ${lines} "${outLogPath}"`).toString();
        if (outLogs.trim()) {
          logOutput += "➤ Output Logs \n" + outLogs + "\n";
        } else {
          logOutput += "\nNo logs found\n\n";
        }
      } catch (error) {
        logOutput += `Error reading log: ${error}\n\n`;
      }
    } else {
      logOutput += "\nNo log file found\n\n";
    }

    // Get stderr logs from first existing log path
    const errLogPath = possibleErrLogPaths.find((p) => fs.existsSync(p));
    if (errLogPath) {
      try {
        const errLogs = execSync(`tail -n ${lines} "${errLogPath}"`).toString();
        if (errLogs.trim()) {
          logOutput += "➤ Error Logs \n" + errLogs;
        } else {
          logOutput += "\nNo error logs found\n\n";
        }
      } catch (error) {
        logOutput += `Error reading error log: ${error}`;
      }
    } else {
      logOutput += "\nNo error log file found\n\n";
    }

    return logOutput;
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

      console.log(`\x1b[2mTo see logs use: furi status <mcpName>\x1b[0m`);
    } else if (result.data && !Array.isArray(result.data)) {
      spinner.success(`[${result.data.name}] found\n`);
      displaySingleStatus(result.data);

      // Show logs for the single MCP
      const lineCount = parseInt(lines, 10) || 15;
      const logs = getMCPLogs(result.data.name, lineCount);
      console.log(`\n\x1b[2m${logs}\x1b[0m`);

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
