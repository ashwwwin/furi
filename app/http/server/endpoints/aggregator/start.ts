import { isPortFree } from "@/helpers/checkPort";
import {
  createServer,
  setPort,
  setTransportType,
  isServerRunning,
} from "@/aggregator/server/manager";

export async function startAggregatorResponse(
  transportType: "sse" | "stdio" = "stdio",
  port: number = 9338
): Promise<Response> {
  try {
    // Validate transport type
    if (transportType !== "sse" && transportType !== "stdio") {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Invalid transport type '${transportType}'. Valid options are 'sse' or 'stdio'.`,
        })
      );
    }

    // Validate port number
    if (isNaN(port) || !Number.isInteger(port) || port < 1 || port > 65535) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Invalid port number '${port}'. Must be an integer between 1 and 65535.`,
        })
      );
    }

    // Check if a server is already running
    try {
      const serverRunning = await isServerRunning();

      if (serverRunning) {
        return new Response(
          JSON.stringify({
            success: false,
            message:
              "MCP Aggregator is already running. To restart, use: furi meta restart",
          })
        );
      }
    } catch (checkError) {
      // Continue with start attempt even if we can't check status
    }

    // Check if the port is already in use (only for SSE transport)
    if (transportType === "sse") {
      try {
        const portInUse = await isPortFree(port);
        if (!portInUse) {
          return new Response(
            JSON.stringify({
              success: false,
              message: `Port ${port} is already in use. Please choose a different port.`,
            })
          );
        }
      } catch (portCheckError) {
        // Continue with start attempt even if we can't check port
      }
    }

    // Set configuration
    try {
      setPort(port);
      setTransportType(transportType);
    } catch (configError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Failed to set server configuration: ${
            configError instanceof Error
              ? configError.message
              : String(configError)
          }`,
        })
      );
    }

    // Start the server with PM2
    try {
      await createServer();
    } catch (startError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Failed to start MCP Aggregator server: ${
            startError instanceof Error
              ? startError.message
              : String(startError)
          }`,
        })
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `MCP Aggregator server started successfully. Running on http://127.0.0.1:${port}/sse`,
      })
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: `Failed to start MCP Aggregator server: ${
          error.message || "Unknown error"
        }`,
      })
    );
  }
}
