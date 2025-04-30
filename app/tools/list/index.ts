import { createSpinner } from "nanospinner";
import { setupMcpConnection } from "../../helpers/mcpConnectionManager";
import { getTools } from "./actions/getTools";

export const listTools = async (mcpName: string) => {
  const spinner = createSpinner(`[${mcpName}] Connecting to MCP server`);
  spinner.start();

  try {
    // Setup MCP connection using shared utilities
    const resources = await setupMcpConnection(mcpName, spinner);
    if (!resources || !resources.client) {
      return; // Connection failed
    }

    const { client, disconnect } = resources;

    // Fetch tools using the action
    const toolsResult = await getTools(client);

    spinner.success(`[${mcpName}] Found ${toolsResult.tools.length} tool(s)`);

    // Display tools in a readable format (moved back to index.ts)
    if (toolsResult && toolsResult.tools && toolsResult.tools.length > 0) {
      console.log("\nTools:");
      toolsResult.tools.forEach((tool: any, index: number) => {
        console.log(`     \x1b[36m${index + 1}. ${tool.name}\x1b[0m`);
        if (tool.description) {
          console.log(
            `          \x1b[2m\x1b[3m${tool.description}\x1b[0m\x1b[0m`
          );
        }

        // Show input schema if available
        if (tool.inputSchema && tool.inputSchema.properties) {
          if (Object.keys(tool.inputSchema.properties).length === 0) {
            console.log("          ➤ Input data: (No parameters)");
          } else {
            console.log("          ➤ Input data:");
            const properties = tool.inputSchema.properties;
            Object.keys(properties).forEach((propName) => {
              const prop = properties[propName];
              const required =
                tool.inputSchema.required &&
                tool.inputSchema.required.includes(propName)
                  ? "\x1b[31m(required)\x1b[0m"
                  : "(optional)";
              console.log(
                `               \x1b[2m➤\x1b[0m ${propName} ${required}\n                    \x1b[2m${
                  prop.description || prop.type || ""
                }\x1b[0m`
              );
            });
          }
        }
        console.log(); // Empty line between tools
      });

      // Show example usage
      if (toolsResult.tools.length > 0) {
        const exampleTool = toolsResult.tools[0];
        console.log("     Example usage:");
        console.log(
          `          \x1b[32mfuri call ${mcpName} ${exampleTool.name} '{"param1":"value1","param2":"value2"}'\x1b[0m`
        );
        console.log(
          "\n\x1b[2m     Note: Parameters must be a valid JSON string enclosed in single quotes\x1b[0m"
        );
      }
    } else {
      console.log("\nNo tools available for this MCP server.");
    }

    // Cleanup resources
    await disconnect();
  } catch (error: any) {
    spinner.error(`[${mcpName}] Error: ${error.message || String(error)}`);
  }
};
