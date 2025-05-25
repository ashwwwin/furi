// Display HTTP server status in CLI format
import chalk from "chalk";
import { displayStatus } from "@/mcp/status/actions/displayStatus";
import {
  getHttpServerStatusData,
  getHttpServerLogsOnly,
  type HttpServerLogs,
} from "./actions/getHttpStatus";

// Display logs in CLI format
const displayLogs = (logs: HttpServerLogs): void => {
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
    `\n\x1b[2mTo see more lines use: furi http status --lines <number>\x1b[0m`
  );
};

// Function that gets logs by calling getHttpServerStatusData (for API use)
export const getHttpServerLogs = getHttpServerLogsOnly;

// Display HTTP server status and logs in CLI
export const getHttpServerStatus = async (
  lines: number = 15
): Promise<void> => {
  try {
    const statusData = await getHttpServerStatusData(lines);

    if (statusData.serverStatus === "offline") {
      console.log(
        chalk.yellow(statusData.message || "HTTP API server is not running")
      );
      return;
    }

    // Display the status using the existing displayStatus function
    if (statusData.status) {
      displayStatus(statusData.status);
    }

    // Display logs
    displayLogs(statusData.logs);
  } catch (error: any) {
    console.error(
      chalk.red(
        `Failed to get HTTP API server status: ${
          error.message || String(error)
        }`
      )
    );
  } finally {
    process.exit(0);
  }
};

// Export a function to run this command
export default async function httpStatus(lines: number = 15): Promise<void> {
  await getHttpServerStatus(lines);
}
