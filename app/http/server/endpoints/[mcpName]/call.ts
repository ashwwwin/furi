import { setupMcpConnection } from "@/helpers/mcpConnectionManager";
import { executeToolCall } from "@/tools/call/actions/callTool";
import { extractMcpName } from "@/http/server/utils";

// Minimal error formatter for the HTTP response
const formatError = (error: any): string => {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  return "An unexpected error occurred."; // Avoid sending detailed internal errors
};

export const callResponse = async (pathname: string, body: any) => {
  // Extract mcpName from pathname
  const mcpNameResult = extractMcpName(pathname, "call");
  if (mcpNameResult instanceof Response) {
    return mcpNameResult;
  }
  const mcpName = mcpNameResult;

  // Extract toolName from pathname
  const pathParts = pathname.split("/").filter(Boolean);
  const callIndex = pathParts.indexOf("call");
  const toolName =
    callIndex > -1 && callIndex < pathParts.length - 1
      ? pathParts[callIndex + 1]
      : undefined;
  if (!toolName) {
    return new Response(
      JSON.stringify({ success: false, message: "Tool name missing in path" }),
      { status: 400 }
    );
  }

  let disconnect: (() => Promise<void>) | undefined;
  try {
    // 1. Setup Connection (without spinner)
    const resources = await setupMcpConnection(mcpName); // Pass undefined for spinner
    if (!resources || !resources.client) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to connect to MCP: ${mcpName}`,
        }),
        { status: 503 } // Service Unavailable
      );
    }
    disconnect = resources.disconnect;
    const client = resources.client;

    // 2. Prepare arguments for executeToolCall
    // executeToolCall expects data as a string. Handle both CLI (string) and HTTP (object) inputs.
    let dataString: string;
    try {
      // If body is already a string (from CLI usage), use it directly
      if (typeof body === "string") {
        dataString = body;
      } else {
        // If body is an object (from HTTP API), stringify it
        dataString = JSON.stringify(body);
      }
    } catch (e) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to stringify request body",
        }),
        { status: 400 } // Bad Request
      );
    }

    // 3. Execute Tool Call
    const result = await executeToolCall(client, toolName, dataString);

    // 4. Handle Result/Error from executeToolCall
    if (result && result.error) {
      // Error explicitly returned by executeToolCall (e.g., tool not found, invalid args)
      return new Response(
        JSON.stringify({ success: false, error: formatError(result.error) }),
        { status: 400 } // Bad Request (likely client error)
      );
    } else {
      // Success
      return new Response(JSON.stringify({ success: true, data: result }));
    }
  } catch (error: any) {
    // Catch connection errors or other unexpected issues during the process
    console.error(`[${mcpName}] Error during tool call API request:`, error); // Log server-side
    return new Response(
      JSON.stringify({ success: false, error: formatError(error) }),
      { status: 500 } // Internal Server Error
    );
  } finally {
    // 5. Ensure Disconnection
    if (disconnect) {
      await disconnect().catch((disconnectError) => {
        // Log disconnect error but don't affect the response sent to the client
        console.error(
          `[${mcpName}] Error disconnecting after tool call API request:`,
          disconnectError
        );
      });
    }
  }
};
