import { createSpinner } from "nanospinner";
import { setupMcpConnection } from "../../helpers/mcpConnectionManager";

export const listTools = async (packageName: string) => {
  const spinner = createSpinner(`[${packageName}] Connecting to MCP server`);
  spinner.start();

  try {
    // Setup MCP connection using shared utilities
    const resources = await setupMcpConnection(packageName, spinner);
    if (!resources || !resources.client) {
      return; // Connection failed
    }

    const { client, disconnect } = resources;

    spinner.update(`[${packageName}] Retrieving available tools`);

    // List available tools
    const tools = await client.listTools();

    spinner.success(`[${packageName}] Available tools`);

    // Display tools in a readable format
    if (tools && tools.tools && tools.tools.length > 0) {
      console.log("\nTools:");
      tools.tools.forEach((tool: any, index: number) => {
        console.log(`  \x1b[36m${index + 1}. ${tool.name}\x1b[0m`);
        if (tool.description) {
          console.log(`     ${tool.description}`);
        }

        // Show input schema if available
        if (tool.inputSchema && tool.inputSchema.properties) {
          console.log("     Parameters:");
          const properties = tool.inputSchema.properties;
          Object.keys(properties).forEach((propName) => {
            const prop = properties[propName];
            const required =
              tool.inputSchema.required &&
              tool.inputSchema.required.includes(propName)
                ? "\x1b[31m(required)\x1b[0m"
                : "(optional)";
            console.log(
              `       - ${propName} ${required}: ${
                prop.description || prop.type || ""
              }`
            );
          });
        }
        console.log(); // Empty line between tools
      });

      // Show example usage
      if (tools.tools.length > 0) {
        const exampleTool = tools.tools[0];
        console.log("Example usage:");
        console.log(
          `  \x1b[32mfuri call ${packageName} ${exampleTool.name} '{"param1":"value1","param2":"value2"}'\x1b[0m\n`
        );
        console.log(
          "  \x1b[2mNote: Parameters must be a valid JSON string enclosed in single quotes\x1b[0m"
        );
      }
    } else {
      console.log("\nNo tools available for this MCP server.");
    }

    // Cleanup resources
    await disconnect();
  } catch (error: any) {
    spinner.error(`[${packageName}] Error: ${error.message || String(error)}`);
  }
};
