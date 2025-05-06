import { isPortFree } from "@/helpers/checkPort";
import { createSpinner } from "nanospinner";
import {
  createServer,
  setPort,
  setTransportType,
  isServerRunning,
} from "../server/manager";

export async function startMCPAggregatorServer(
  transportType: "sse" | "stdio" = "stdio",
  port: number = 9338
) {
  const spinner = createSpinner("Starting MCP Aggregator server").start();

  try {
    // Validate transport type
    if (transportType !== "sse" && transportType !== "stdio") {
      spinner.error({
        text: `Invalid transport type '${transportType}'. Valid options are 'sse' or 'stdio'.`,
      });
      return;
    }

    // Validate port number
    if (isNaN(port) || !Number.isInteger(port) || port < 1 || port > 65535) {
      spinner.error({
        text: `Invalid port number '${port}'. Must be an integer between 1 and 65535.`,
      });
      return;
    }

    // Check if a server is already running
    try {
      const serverRunning = await isServerRunning();

      if (serverRunning) {
        spinner.warn({
          text: "MCP Aggregator is already running\n     To restart, use: \x1b[2mfuri meta restart\x1b[0m",
        });
        return;
      }
    } catch (checkError) {
      spinner.warn({
        text: `Unable to determine if server is running: ${
          checkError instanceof Error ? checkError.message : String(checkError)
        }\n     Will attempt to start anyway.`,
      });
    }

    // Check if the port is already in use (only for SSE transport)
    if (transportType === "sse") {
      try {
        const portInUse = await isPortFree(port);
        if (!portInUse) {
          spinner.error({
            text: `Port ${port} is already in use. Please choose a different port.`,
          });
          return;
        }
      } catch (portCheckError) {
        spinner.warn({
          text: `Unable to check port availability: ${
            portCheckError instanceof Error
              ? portCheckError.message
              : String(portCheckError)
          }\n     Will attempt to start anyway.`,
        });
      }
    }

    // Set configuration
    try {
      setPort(port);
      setTransportType(transportType);
    } catch (configError) {
      spinner.error({
        text: `Failed to set server configuration: ${
          configError instanceof Error
            ? configError.message
            : String(configError)
        }`,
      });
      return;
    }

    // Start the server with PM2
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

    spinner.success({ text: "MCP Aggregator server started" });
    console.log(
      `     \x1b[2mAggregator running on http://127.0.0.1:${port}/sse`
    );
  } catch (error: any) {
    spinner.error({
      text: `Failed to start MCP Aggregator server: ${
        error.message || "Unknown error"
      }`,
    });
    return null;
  }
}
