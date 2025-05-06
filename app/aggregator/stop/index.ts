import { isServerRunning, stopServer } from "../server/manager";
import { createSpinner } from "nanospinner";

export const stopMCPAggregatorServer = async () => {
  const spinner = createSpinner("Stopping MCP Aggregator server...").start();

  try {
    // Check if the server is running
    let serverRunning;
    try {
      serverRunning = await isServerRunning();
    } catch (checkError) {
      spinner.error({
        text: `Failed to check if server is running: ${
          checkError instanceof Error ? checkError.message : String(checkError)
        }`,
      });
      return;
    }

    if (!serverRunning) {
      spinner.warn({ text: "MCP Aggregator server is not running" });
      return;
    }

    // Stop the server
    try {
      await stopServer();
      spinner.success({ text: "MCP Aggregator server offline" });
    } catch (stopError) {
      spinner.error({
        text: `Failed to stop MCP Aggregator server: ${
          stopError instanceof Error ? stopError.message : String(stopError)
        }`,
      });
    }
  } catch (error: any) {
    spinner.error({
      text: `Failed to stop MCP Aggregator server: ${
        error.message || "Unknown error"
      }`,
    });
  }
};
