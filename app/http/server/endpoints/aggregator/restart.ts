import {
  isServerRunning,
  stopServer,
  createServer,
  getServer,
  setPort,
  setTransportType,
} from "@/aggregator/server/manager";
import { getAggregatorPort } from "@/helpers/config";

export async function restartAggregatorResponse(): Promise<Response> {
  try {
    let serverInfo: any = null;

    // Check if server is running
    const serverRunning = await isServerRunning();

    if (!serverRunning) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "MCP Aggregator server is not running. Start the server with furi meta start",
        })
      );
    }

    try {
      // Get the server configuration to preserve transport type and port
      serverInfo = await getServer();
    } catch (getServerError) {
      // Will use default settings for restart if can't retrieve current settings
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
      // Continue with default values if settings can't be applied
    }

    // Stop the server
    try {
      await stopServer();
    } catch (stopError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Failed to stop MCP Aggregator server: ${
            stopError instanceof Error ? stopError.message : String(stopError)
          }`,
        })
      );
    }

    // Start a new server with the same settings
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

    // Use the actual port for display
    const displayPort = currentPort || getAggregatorPort();

    return new Response(
      JSON.stringify({
        success: true,
        message: `MCP Aggregator server restarted successfully. Running on http://127.0.0.1:${displayPort}/sse`,
      })
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: `Failed to restart MCP Aggregator server: ${
          error.message || "Unknown error"
        }`,
      })
    );
  }
}
