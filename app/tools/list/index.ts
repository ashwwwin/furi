import { createSpinner } from "nanospinner";
import { getToolsFromMcp, getToolsFromAllMcps } from "./actions/getTools";
import type { McpToolsResult, Tool } from "./actions/getTools";

// Helper function to render a tool's details
const renderTool = (tool: Tool, index: number) => {
  console.log(`     \x1b[36m${index + 1}. ${tool.name}\x1b[0m`);
  if (tool.description) {
    console.log(`          \x1b[2m\x1b[3m${tool.description}\x1b[0m\x1b[0m`);
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
          tool.inputSchema?.required &&
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
};

// Helper function to display MCP tools
const displayMcpTools = (result: McpToolsResult, showMcpName: boolean) => {
  if (!result.success) {
    console.log(
      `\n${result.mcpName}: ${result.error || "Failed to fetch tools"}`
    );
    return;
  }

  if (result.tools.length === 0) {
    console.log(`\n${result.mcpName}: No tools available for this MCP server.`);
    return;
  }

  // Display header with or without MCP name
  console.log(`\n${showMcpName ? result.mcpName + " " : ""}Tools:`);

  // Render each tool
  result.tools.forEach((tool, index) => {
    renderTool(tool, index);
  });

  // Show example usage
  if (result.tools.length > 0 && result.tools[0]) {
    console.log("     Example usage:");
    console.log(
      `          \x1b[32mfuri call ${result.mcpName} ${result.tools[0].name} '{"param1":"value1","param2":"value2"}'\x1b[0m`
    );
  }
};

export const listTools = async (mcpName: string) => {
  const spinner = createSpinner(
    `Connecting to MCP ${mcpName === "all" ? "servers" : `server [${mcpName}]`}`
  );
  spinner.start();

  try {
    // Get tools from one or all MCPs
    const results =
      mcpName === "all"
        ? await getToolsFromAllMcps(spinner)
        : [await getToolsFromMcp(mcpName, spinner)];

    const successfulResults = results.filter((result) => result.success);

    if (successfulResults.length === 0) {
      spinner.error(`No ${mcpName === "all" ? "MCPs" : "tools"} found`);
      return;
    }

    if (mcpName === "all") {
      spinner.success(`Found tools from ${successfulResults.length} MCP(s)`);
    } else {
      const toolCount = successfulResults[0]?.tools.length || 0;
      spinner.success(`[${mcpName}] Found ${toolCount} tool(s)`);
    }

    // Display all results
    results.forEach((result) => {
      displayMcpTools(result, mcpName === "all");
    });

    // Show general note about parameters after listing all MCPs
    console.log(
      "\n\x1b[2m     Note: Parameters must be a valid JSON string enclosed in single quotes\x1b[0m"
    );
  } catch (error: any) {
    spinner.error(`Error: ${error.message || String(error)}`);
  }
};
