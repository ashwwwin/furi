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

  try {
    // Prepare arguments for executeToolCall
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

    // Execute Tool Call using the updated function signature
    const result = await executeToolCall(mcpName, toolName, dataString);

    // Handle Result/Error from executeToolCall
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
  }
};
