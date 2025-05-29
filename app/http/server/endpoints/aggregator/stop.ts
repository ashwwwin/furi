import { isServerRunning, stopServer } from "@/aggregator/server/manager";

export async function stopAggregatorResponse(): Promise<Response> {
  try {
    // Check if the server is running
    let serverRunning;
    try {
      serverRunning = await isServerRunning();
    } catch (checkError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Failed to check if server is running: ${
            checkError instanceof Error
              ? checkError.message
              : String(checkError)
          }`,
        })
      );
    }

    if (!serverRunning) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "MCP Aggregator server is not running",
        })
      );
    }

    // Stop the server
    try {
      await stopServer();
      return new Response(
        JSON.stringify({
          success: true,
          message: "MCP Aggregator server stopped successfully",
        })
      );
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
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: `Failed to stop MCP Aggregator server: ${
          error.message || "Unknown error"
        }`,
      })
    );
  }
}
