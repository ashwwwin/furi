import { createSpinner } from "nanospinner";
import { setupMcpConnection } from "../../helpers/mcpConnectionManager";

export const callTool = async (
  mcpName: string,
  toolName: string,
  data: string
) => {
  const spinner = createSpinner(`[${mcpName}] Connecting to MCP server`);
  spinner.start();

  try {
    // Setup MCP connection using shared utilities
    const resources = await setupMcpConnection(mcpName, spinner);
    if (!resources || !resources.client) {
      return; // Connection failed
    }

    const { client, disconnect } = resources;

    spinner.update(`[${mcpName}] Sending tool call request`);

    // List available tools
    const tools = await client.listTools();

    // Check if the requested method exists
    const requestedTool = tools.tools.find(
      (tool: any) => tool.name === toolName
    );
    if (!requestedTool) {
      spinner.error(
        `[${mcpName}] Tool '${toolName}' not found.\n     \x1b[2mTo view tools, use furi tools ${mcpName}\x1b[0m`
      );
      await disconnect();
      return;
    }

    // Parse and validate the input as JSON
    let toolParams: any;
    try {
      // Try to parse as JSON
      if (data.trim().startsWith("{")) {
        toolParams = JSON.parse(data);
      } else {
        // For simple string queries, convert to JSON format
        toolParams = { query: data };
      }
    } catch (e) {
      spinner.error(
        `[${mcpName}] Invalid JSON input format.\n     \x1b[2mInput must be a valid JSON string: '{"param1":"value1","param2":"value2"}'\x1b[0m`
      );
      await disconnect();
      return;
    }

    try {
      // Call the tool
      const result = await client.callTool({
        name: toolName,
        arguments: toolParams,
      });

      // Check for various error patterns in the result
      let hasError = false;

      if (result && result.error) {
        // Explicit error property
        spinner.error(`[${mcpName}] Tool call failed`);
        const errorDetails = formatErrorDetails(result.error);
        console.log(`\x1b[31mError: ${errorDetails}\x1b[0m`);
        hasError = true;
      } else if (
        result &&
        result.content &&
        Array.isArray(result.content) &&
        result.content.length > 0
      ) {
        // Process content and check for error patterns in text
        result.content.forEach((item: any) => {
          if (item.type === "text") {
            // Check if the text content looks like an error message
            const text = item.text || "";
            if (
              text.includes("error") ||
              text.includes("Error") ||
              text.includes("exception") ||
              text.includes("Exception") ||
              text.includes("[object Object]")
            ) {
              // This looks like an error message in the text output
              hasError = true;
            }
          }
        });

        // Only show success if no errors were detected
        if (!hasError) {
          spinner.success(`[${mcpName}] Tool call completed`);
        } else {
          spinner.error(`[${mcpName}] Tool call returned errors`);
        }

        // Display the content
        result.content.forEach((item: any) => {
          if (item.type === "text") {
            const text = item.text || "";
            if (
              text.includes("error") ||
              text.includes("Error") ||
              text.includes("exception") ||
              text.includes("Exception") ||
              text.includes("[object Object]")
            ) {
              console.log(`\x1b[31m${text}\x1b[0m`);
            } else {
              console.log(`\x1b[2m${text}\x1b[0m`);
            }
          } else if (item.type === "image") {
            console.log("     \x1b[2m[Image content received]\x1b[0m");
          }
        });

        // If we detected any errors in the output, print a troubleshooting tip
        if (hasError) {
          console.log(
            "\n\x1b[33mTroubleshooting tip: The request completed but returned errors.\x1b[0m"
          );
          console.log(
            "\x1b[33mCheck your parameters or try a different query.\x1b[0m"
          );
        }
      } else {
        // No content case
        spinner.success(`[${mcpName}] Tool call completed`);
        console.log(
          "     \x1b[2mNo content returned from the tool call\x1b[0m"
        );
      }
    } catch (callError) {
      // Handle errors during the tool call
      spinner.error(`[${mcpName}] Error during tool execution`);
      console.log(`\x1b[31m${formatErrorDetails(callError)}\x1b[0m`);
    }

    // Cleanup resources
    await disconnect();
  } catch (error: any) {
    spinner.error(
      `[${mcpName}] Error: ${error.message || formatErrorDetails(error)}`
    );
  }
};

// Helper function to properly format error details
function formatErrorDetails(error: any): string {
  if (!error) return "Unknown error";

  // If it's already a string, return it
  if (typeof error === "string") return error;

  // If it's an Error object with a message
  if (error.message) return error.message;

  try {
    // Try to convert to JSON string with indentation for readability
    return JSON.stringify(error, null, 2);
  } catch (e) {
    // If JSON stringify fails, try to extract properties manually
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

    // Last resort
    return String(error);
  }
}
