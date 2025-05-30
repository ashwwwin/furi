import { createSpinner } from "nanospinner";
import { executeToolCall } from "./actions/callTool";

export const callTool = async (
  mcpName: string,
  toolName: string,
  data: string
) => {
  const spinner = createSpinner(`[${mcpName}] Connecting to MCP server`);
  spinner.start();

  try {
    spinner.update(`[${mcpName}] Sending tool call request to '${toolName}'`);

    // Call the tool using the updated action - no need for setupMcpConnection anymore
    const result = await executeToolCall(mcpName, toolName, data);

    // --- Display Logic (kept in index.ts) ---
    if (result && result.error) {
      // Handle errors returned from executeToolCall (e.g., tool not found, JSON parse error, client.callTool error)
      spinner.error(`[${mcpName}] Tool call failed`);
      console.log(`\x1b[31mError: ${formatErrorDetails(result.error)}\x1b[0m`);
    } else {
      // Successful call (or at least, no error thrown by executeToolCall)
      let hasErrorInOutput = false;
      if (
        result &&
        result.content &&
        Array.isArray(result.content) &&
        result.content.length > 0
      ) {
        // Check for error patterns in the result content
        result.content.forEach((item: any) => {
          if (item.type === "text") {
            const text = item.text || "";
            if (
              text.toLowerCase().includes("error") ||
              text.toLowerCase().includes("exception") ||
              text.includes("[object Object]") // Common stringification error
            ) {
              hasErrorInOutput = true;
            }
          }
        });

        if (!hasErrorInOutput) {
          spinner.success(`[${mcpName}] Tool call completed`);
        } else {
          spinner.error(`[${mcpName}] Tool call returned errors`);
        }

        // Display the content
        result.content.forEach((item: any) => {
          if (item.type === "text") {
            const text = item.text || "";
            if (hasErrorInOutput) {
              console.log(`\x1b[31m${text}\x1b[0m`); // Print errors in red
            } else {
              console.log(`\x1b[2m${text}\x1b[0m`); // Print normal output dimmed
            }
          } else if (item.type === "image") {
            console.log("     \x1b[2m[Image content received]\x1b[0m");
          }
        });

        if (hasErrorInOutput) {
          console.log(
            "\n\x1b[33mTroubleshooting tip: The request completed but returned errors.\x1b[0m"
          );
          console.log(
            "\x1b[33mCheck your parameters or try a different query.\x1b[0m"
          );
        }
      } else {
        // No content returned
        spinner.success(`[${mcpName}] Tool call completed`);
        console.log(
          "     \x1b[2mNo content returned from the tool call\x1b[0m"
        );
      }
    }
  } catch (error: any) {
    // Catch connection errors or unexpected issues
    spinner.error(`[${mcpName}] Error: ${formatErrorDetails(error)}`);
  }
};

// Helper function to properly format error details
function formatErrorDetails(error: any): string {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;

  try {
    return JSON.stringify(error, null, 2);
  } catch (e) {
    try {
      const properties = Object.getOwnPropertyNames(error);
      if (properties.length > 0) {
        const details = properties
          .map((prop) => {
            try {
              const value = error[prop];
              return `${prop}: ${
                typeof value === "object" ? JSON.stringify(value) : value
              }`;
            } catch (e) {
              return `${prop}: [Unable to stringify]`;
            }
          })
          .join(", ");
        return details;
      }
    } catch (innerE) {
      // Ignore errors during deep inspection
    }
    return String(error);
  }
}
