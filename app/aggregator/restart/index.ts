import {
  isServerRunning,
  stopServer,
  createServer,
  getServer,
  setPort,
  setTransportType,
} from "@/aggregator/server/manager";
import { createSpinner } from "nanospinner";
import { getAggregatorPort } from "@/helpers/config";

export const restartMCPAggregatorServer = async () => {
  const spinner = createSpinner("Restarting MCP Aggregator server").start();
  let serverInfo: any = null;

  try {
    // Check if server is running
    const serverRunning = await isServerRunning();

    if (!serverRunning) {
      spinner.error({
        text: "MCP Aggregator server is not running\n     \x1b[2mStart the server with furi meta start\x1b[0m",
      });
      return;
    }

    try {
      // Get the server configuration to preserve transport type and port
      serverInfo = await getServer();
    } catch (getServerError) {
      spinner.warn({
        text: `Unable to retrieve server settings: ${
          getServerError instanceof Error
            ? getServerError.message
            : String(getServerError)
        }\n     Will use default settings for restart.`,
      });
    }

    // Set defaults if server info couldn't be retrieved
    const currentTransportType =
      serverInfo?.pm2_env?.env?.TRANSPORT_TYPE || "stdio";
    const currentPort = serverInfo?.pm2_env?.env?.PORT;

    try {
      if (currentPort) {
        setPort(parseInt(currentPort, 10));
      } else {
        // Fall back to saved configuration if current port can't be retrieved
        const savedPort = getAggregatorPort();
        setPort(savedPort);
      }

      if (currentTransportType) {
        setTransportType(currentTransportType as "sse" | "stdio");
      }
    } catch (settingsError) {
      spinner.warn({
        text: `Failed to apply settings: ${
          settingsError instanceof Error
            ? settingsError.message
            : String(settingsError)
        }\n     Will use default values.`,
      });
    }

    // Stop the server
    spinner.update({ text: "Stopping MCP Aggregator server" });
    try {
      await stopServer();
    } catch (stopError) {
      spinner.error({
        text: `Failed to stop MCP Aggregator server: ${
          stopError instanceof Error ? stopError.message : String(stopError)
        }`,
      });
      return;
    }

    // Start a new server with the same settings
    spinner.update({ text: "Starting MCP Aggregator server" });
    try {
      await createServer();
    } catch (startError) {
      spinner.error({
        text: `Failed to start MCP Aggregator server: ${
          startError instanceof Error ? startError.message : String(startError)
        }`,
      });
      return;
    }

    spinner.success({
      text: "MCP Aggregator server restarted",
    });

    // Use the actual port for display
    const displayPort = currentPort || getAggregatorPort();
    console.log(
      `     \x1b[2mAggregator running on http://127.0.0.1:${displayPort}/sse`
    );
  } catch (error: any) {
    spinner.error({
      text: `Failed to restart MCP Aggregator server: ${
        error.message || "Unknown error"
      }`,
    });
  }
};
