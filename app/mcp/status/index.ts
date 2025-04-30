import { createSpinner } from "nanospinner";
import { getProcStatus } from "./actions/getProcStatus";
import { displayStatus } from "./actions/displayStatus";
import fs from "fs";
import path from "path";
import os from "os";
import { $ } from "bun";

/**
 * Get PM2 logs for a specific MCP
 * @param mcpName Name of the MCP
 * @param lines Number of lines to show
 */
const getMCPLogs = async (
  mcpName: string,
  lines: number = 15
): Promise<{ output: string; error: string }> => {
  try {
    const pmName = `furi_${mcpName}`;
    let customErrorLog = "";
    let customOutLog = "";

    // Get log paths quietly
    try {
      const pm2Result = await $`pm2 show ${pmName}`.quiet();
      if (pm2Result.exitCode === 0) {
        const pmInfo = pm2Result.stdout.toString();
        const outLogMatch = pmInfo.match(/out log path\s*:\s*([^\n]+)/i);
        const errLogMatch = pmInfo.match(/error log path\s*:\s*([^\n]+)/i);

        if (outLogMatch && outLogMatch[1]) {
          customOutLog = outLogMatch[1].trim();
        }

        if (errLogMatch && errLogMatch[1]) {
          customErrorLog = errLogMatch[1].trim();
        }
      }
    } catch (e) {
      // Silent failure
    }

    const defaultLogsDir = path.join(os.homedir(), ".pm2", "logs");
    const furikakeLogsDir = path.join(
      process.env.BASE_PATH || "",
      ".furikake",
      "logs"
    );

    // Check these paths in order
    const possibleOutLogPaths = [
      path.join(furikakeLogsDir, `${mcpName}-out.log`),
      path.join(defaultLogsDir, `${pmName}-out.log`),
    ].filter(Boolean);

    const possibleErrLogPaths = [
      path.join(furikakeLogsDir, `${mcpName}-error.log`),
      path.join(defaultLogsDir, `${pmName}-error.log`),
    ].filter(Boolean);

    // Try alternative locations if needed
    if (
      !possibleOutLogPaths.some((p) => fs.existsSync(p)) &&
      !possibleErrLogPaths.some((p) => fs.existsSync(p))
    ) {
      const logsDir = path.join(os.homedir(), ".pm2", "logs");
      if (!fs.existsSync(logsDir)) {
        return { output: "PM2 logs directory not found", error: "" };
      }

      const dirFiles = fs.readdirSync(logsDir);
      const simpleName = mcpName.split("/").pop() || mcpName;
      const baseNameWithoutDash = simpleName.replace(/-/g, "");

      // Various naming patterns to try
      const patterns = [
        `furi_${mcpName}-out`,
        `furi_${simpleName}-out`,
        `furi_${baseNameWithoutDash}-out`,
        `${mcpName}-out`,
        `${simpleName}-out`,
        `${simpleName}-\\d+-out`,
      ];

      const errPatterns = [
        `furi_${mcpName}-error`,
        `furi_${simpleName}-error`,
        `furi_${baseNameWithoutDash}-error`,
        `${mcpName}-error`,
        `${simpleName}-error`,
        `${simpleName}-\\d+-error`,
      ];

      let outLogFile = null;
      let errLogFile = null;

      // Find matching logs
      for (const pattern of patterns) {
        const regex = new RegExp(`^${pattern}`);
        const match = dirFiles.find((f) => regex.test(f));
        if (match) {
          outLogFile = match;
          possibleOutLogPaths.push(path.join(logsDir, outLogFile));
          break;
        }
      }

      for (const pattern of errPatterns) {
        const regex = new RegExp(`^${pattern}`);
        const match = dirFiles.find((f) => regex.test(f));
        if (match) {
          errLogFile = match;
          possibleErrLogPaths.push(path.join(logsDir, errLogFile));
          break;
        }
      }

      // Try partial matches if needed
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

    let outputLogs = "";
    let errorLogs = "";

    // Get stdout logs
    const outLogPath = possibleOutLogPaths.find((p) => fs.existsSync(p));
    if (outLogPath) {
      try {
        const rawLogs = await $`tail -n ${lines * 3} "${outLogPath}"`.text();

        // Clean up the logs
        outputLogs = rawLogs
          .split("\n")
          .filter((line) => {
            return !(
              line.includes("> ") ||
              line.includes("npm ") ||
              line.trim() === ""
            );
          })
          .slice(-lines)
          .join("\n");
      } catch (error) {
        outputLogs = `Error running tail command: ${error}`;
      }
    } else {
      outputLogs = "No output log file found";
    }

    // Get stderr logs
    const errLogPath = possibleErrLogPaths.find((p) => fs.existsSync(p));
    if (errLogPath) {
      try {
        const rawLogs = await $`tail -n ${lines * 2} "${errLogPath}"`.text();

        // Clean up the logs
        errorLogs = rawLogs
          .split("\n")
          .filter((line) => line.trim() !== "")
          .slice(-lines)
          .join("\n");
      } catch (error) {
        errorLogs = `Error running tail command for errors: ${error}`;
      }
    } else {
      errorLogs = "No error log file found";
    }

    return { output: outputLogs, error: errorLogs };
  } catch (error) {
    return {
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

        let logsFound = false;

        // Show app logs if they contain meaningful content
        if (logs.output.trim()) {
          const meaningfulContent = logs.output.split("\n").some((line) => {
            const match = line.match(
              /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{2}:\d{2}: (.*)$/
            );
            return (
              (match &&
                match[1] &&
                match[1].trim() !== "" &&
                !match[1].includes("> ")) ||
              (!line.match(/^\d{4}-\d{2}-\d{2}/) && line.trim() !== "")
            );
          });

          if (meaningfulContent) {
            const filteredOutput = logs.output
              .split("\n")
              .filter((line) => {
                return !(line.includes("> ") || line.trim() === "");
              })
              .join("\n");

            if (filteredOutput.trim()) {
              console.log(`\n\x1b[36mApp Logs\x1b[0m`);
              console.log(`\x1b[2m${filteredOutput}\x1b[0m`);
              logsFound = true;
            }
          }
        }

        // Show error/output logs
        if (logs.error.trim()) {
          const filteredError = logs.error
            .split("\n")
            .filter((line) => {
              return (
                line.trim() !== "" &&
                !line.includes("Describing process with id")
              );
            })
            .join("\n");

          if (filteredError.trim()) {
            console.log(`\n\x1b[36mOutput Logs\x1b[0m`);
            console.log(`\x1b[2m${filteredError}\x1b[0m`);
            logsFound = true;
          }
        }

        if (!logsFound) {
          console.log(`\n\x1b[33mNo logs found for this process.\x1b[0m`);
        }

        console.log(
          `\n\x1b[2mTo see more lines use: furi status <mcpName> -l <lines>\x1b[0m`
        );
      } catch (err) {
        console.log(`\n\x1b[33mError retrieving logs: ${err}\x1b[0m`);
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
