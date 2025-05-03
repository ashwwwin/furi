import { startMCP } from "@/mcp/start";
import { extractMcpName } from "../../utils";

// Minimal error formatter for the HTTP response
const formatError = (error: any): string => {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  return "An unexpected error occurred."; // Avoid sending detailed internal errors
};

export const startMCPResponse = async (
  pathname: string,
  req: Request
): Promise<Response> => {
  try {
    // Extract MCP name from pathname using the utility function
    const mcpNameResult = extractMcpName(pathname, "start");
    if (mcpNameResult instanceof Response) {
      return mcpNameResult;
    }
    const mcpName = mcpNameResult;

    // Get environment variables from request body if provided
    let envJson: string | undefined;

    if (req.method === "POST") {
      try {
        const body = (await req.json()) as Record<string, unknown>;
        if (Object.keys(body).length > 0) {
          envJson = JSON.stringify(body);
        }
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            message: `Invalid request body: ${formatError(error)}`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    try {
      // Start the MCP with the provided environment variables
      await startMCP(mcpName, envJson);

      return new Response(
        JSON.stringify({
          success: true,
          message: `MCP ${mcpName} started successfully${
            envJson ? " with provided environment variables" : ""
          }`,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (startError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Failed to start MCP: ${formatError(startError)}`,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error(`Error in startMCPResponse:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        message: `Server error: ${formatError(error)}`,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
