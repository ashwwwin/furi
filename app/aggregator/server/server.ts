import { FastMCP } from "fastmcp";
import { z } from "zod";
import { getTools } from "@/tools/list/actions/getTools";
import { getProcStatus } from "@/mcp/status/actions/getProcStatus";
import { disconnectFromPm2 } from "@/helpers/mcpConnectionManager";

// Create a separate connection pool for the aggregator
import { McpConnectionPool } from "@/helpers/mcpConnectionManager";
const aggregatorPool = new McpConnectionPool("furi");

// Helper to check if we're in stdio mode (should suppress logging)
const isStdioMode = () => process.env.TRANSPORT_TYPE === "stdio";

type ToolSchema = {
  properties: Record<string, any>;
  required?: string[];
};

type RemoteTool = {
  name: string;
  description?: string;
  inputSchema?: ToolSchema;
  execute: (args: any) => Promise<any>;
};

type McpToolGroup = {
  mcpName: string;
  tools: RemoteTool[];
};

// Helper function to ensure tool name doesn't exceed 60 characters (54 + "furi: " prefix)
function createToolName(mcpName: string, toolName: string): string {
  const combined = `${mcpName}-${toolName}`;
  if (combined.length <= 55) {
    return combined.replace("--", "-");
  }

  // If too long, truncate the MCP name while preserving the tool name
  const maxMcpNameLength = 55 - toolName.length - 1; // -1 for the colon
  if (maxMcpNameLength > 0) {
    const result = `${mcpName.substring(0, maxMcpNameLength)}-${toolName}`;
    return result.replace("--", "-");
  }

  // If tool name itself is too long, truncate both
  // Reserve 1 character for the colon, split remaining 53 characters
  const availableSpace = 55 - 1; // Reserve 1 for the colon
  const halfSpace = Math.floor(availableSpace / 2);
  const result = `${mcpName.substring(0, halfSpace)}-${toolName.substring(
    0,
    halfSpace,
  )}`;
  return result.replace("--", "-");
}

// Helper function to fetch tools from all configured MCP servers
async function getToolsFromAllMcps(): Promise<McpToolGroup[]> {
  try {
    const result = await getProcStatus("all");

    // Always disconnect from PM2 after getting status
    try {
      await disconnectFromPm2();
    } catch (error) {
      // Silently ignore disconnection errors
    }

    if (!result.success || !Array.isArray(result.data)) {
      // Keep essential error logs
      if (!isStdioMode()) {
        console.error("Failed to get MCPs list");
      }
      return [];
    }

    // Filter to only include online MCPs
    const onlineMcps = result.data
      .filter((mcp) => mcp.status === "online" && mcp.pid !== "N/A")
      .map((mcp) => mcp.name);

    const mcpTools: McpToolGroup[] = [];
    for (const mcpName of onlineMcps) {
      try {
        // Use the aggregator's own connection pool
        const connection = await aggregatorPool.getConnection(mcpName);

        if (!connection || !connection.client) {
          // Reduce this to a debug-level message
          if (process.env.DEBUG) {
            console.warn(`Could not connect to MCP: ${mcpName}`);
          }
          continue;
        }

        const { client } = connection;

        // Fetch tools using the action
        const toolsResult = await getTools(client);

        mcpTools.push({
          mcpName,
          tools: toolsResult.tools.map((tool: any) => ({
            name: createToolName(mcpName, tool.name),
            description: tool.description || `Tool from ${mcpName}`,
            inputSchema: tool.inputSchema,
            execute: async (args: any) => {
              try {
                // Use the aggregator's pooled connection - maintains persistence across calls
                const pooledConnection =
                  await aggregatorPool.getConnection(mcpName);
                if (!pooledConnection || !pooledConnection.client) {
                  throw new Error(`Failed to connect to MCP: ${mcpName}`);
                }

                // Execute tool with persistent connection - state is maintained
                const result = await pooledConnection.client.callTool({
                  name: tool.name,
                  arguments: args,
                });

                // Connection remains active for subsequent calls
                return result;
              } catch (error: any) {
                // Keep error logs for troubleshooting tool execution issues
                if (!isStdioMode()) {
                  console.error(
                    `Error calling ${tool.name} on ${mcpName}:`,
                    error,
                  );
                }
                throw new Error(
                  `Failed to execute ${tool.name}: ${
                    error.message || "Unknown error"
                  }`,
                );
              }
            },
          })),
        });
      } catch (error: any) {
        // Keep error logs but make them less verbose
        if (!isStdioMode()) {
          console.error(
            `Error with MCP ${mcpName}: ${error.message || String(error)}`,
          );
        }
      }
    }

    return mcpTools;
  } catch (error: any) {
    // Keep critical error logs
    if (!isStdioMode()) {
      console.error("Error fetching MCPs:", error.message || String(error));
    }
    return [];
  }
}

// Create a FastMCP server instance with silent logging
let server = new FastMCP({
  name: "Furikake MCP Server",
  version: "1.0.0",
});

// Initialize server with event listeners and resources
function initializeServer(serverInstance: FastMCP) {
  // Configure for silent operation by setting properties directly
  try {
    // Access the internal logger if it exists
    if ((serverInstance as any).logger) {
      (serverInstance as any).logger.level = "error";
    }

    // Set options if they exist
    if ((serverInstance as any).options) {
      (serverInstance as any).options.silent = true;
    }
  } catch (error) {
    // Silently ignore if properties don't exist
  }

  // Add resource template
  serverInstance.addResourceTemplate({
    uriTemplate: "file:///logs/{name}.log",
    name: "Application Logs",
    mimeType: "text/plain",
    arguments: [
      {
        name: "name",
        description: "Name of the log",
        required: true,
        enum: ["system", "application", "error"],
      },
    ],
    async load({ name }) {
      return {
        text: `Example log content for ${name}`,
      };
    },
  });

  // Add event listeners
  serverInstance.on("connect", (event) => {
    if (!isStdioMode()) {
      console.log("Client connected");
    }
  });

  serverInstance.on("disconnect", (event) => {
    if (!isStdioMode()) {
      console.log("Client disconnected");
    }
  });

  return serverInstance;
}

// Initialize the server
initializeServer(server);

// Set up polling to regularly check for changes and update tools
let toolUpdateInterval: NodeJS.Timeout | null = null;
let transportConfig: any = null;
let previousMcpList: string[] = [];

// Start polling for tool updates
function startToolsPolling(intervalMs = 10000) {
  if (toolUpdateInterval) {
    clearInterval(toolUpdateInterval);
  }

  toolUpdateInterval = setInterval(async () => {
    try {
      const result = await getProcStatus("all");

      // Always disconnect from PM2 after getting status
      try {
        await disconnectFromPm2();
      } catch (error) {
        // Silently ignore disconnection errors
      }

      if (result.success && Array.isArray(result.data)) {
        // Extract MCP names from the status data - make sure we clean up names properly
        const currentMcpList = result.data
          .filter((mcp) => mcp.status === "online" && mcp.pid !== "N/A")
          .map((mcp) => mcp.name);

        // Check if there's a difference in MCPs
        const hasChanges = !arraysEqual(previousMcpList, currentMcpList);

        if (hasChanges) {
          // Only log the change details when it happens for easier troubleshooting
          if (!isStdioMode()) {
            console.log(
              `MCP list changed: ${previousMcpList.length} → ${currentMcpList.length} MCPs`,
            );
          }

          // Update the cached list
          previousMcpList = [...currentMcpList];

          // Update tools while maintaining persistent connections
          await updateTools();
        }
      }
    } catch (error) {
      // Keep error logs for troubleshooting
      console.error("Error checking for tool updates:", error);
    }
  }, intervalMs);

  if (!isStdioMode()) {
    console.log(
      `Tool polling enabled (interval: ${intervalMs}ms) - persistent connections maintained`,
    );
  }
}

// Update tools without recreating the server
async function updateTools() {
  try {
    // Get fresh tools from all MCPs (no need to cleanup connections since we use the shared pool)
    const mcpTools = await getToolsFromAllMcps();

    // Since FastMCP doesn't expose a way to remove tools or list existing tools,
    // we'll create a new server instance and transfer the configuration
    const newServer = new FastMCP({
      name: "Furikake MCP Server",
      version: "1.0.0",
      // Use TypeScript casting to avoid linter errors
      ...({ logLevel: "error" } as any),
    });

    // Initialize the new server
    initializeServer(newServer);

    // Add tools to the new server
    mcpTools.forEach((toolGroup) => {
      const { mcpName, tools } = toolGroup;
      tools.forEach((tool) => {
        // Convert the inputSchema to a zod object if it's not already one
        let parameters;
        if (tool.inputSchema) {
          if ("properties" in tool.inputSchema) {
            // Convert JSON Schema properties to Zod schemas
            const schemaObj: Record<string, any> = {};
            Object.entries(tool.inputSchema.properties).forEach(
              ([key, prop]) => {
                let zodType;

                // Determine proper Zod type based on JSON Schema type
                switch (prop.type) {
                  case "string":
                    zodType = z.string();
                    // Add validation rules if specified
                    if (prop.pattern)
                      zodType = zodType.regex(new RegExp(prop.pattern));
                    if (prop.minLength) zodType = zodType.min(prop.minLength);
                    if (prop.maxLength) zodType = zodType.max(prop.maxLength);
                    if (prop.enum) zodType = z.enum(prop.enum);
                    break;

                  case "number":
                    zodType = z.number();
                    if (prop.minimum !== undefined)
                      zodType = zodType.min(prop.minimum);
                    if (prop.maximum !== undefined)
                      zodType = zodType.max(prop.maximum);
                    break;

                  case "integer":
                    zodType = z.number().int();
                    if (prop.minimum !== undefined)
                      zodType = zodType.min(prop.minimum);
                    if (prop.maximum !== undefined)
                      zodType = zodType.max(prop.maximum);
                    break;

                  case "boolean":
                    zodType = z.boolean();
                    break;

                  case "array":
                    // Handle array types
                    if (prop.items) {
                      const itemType = prop.items.type || "any";
                      let itemZodType;

                      switch (itemType) {
                        case "string":
                          itemZodType = z.string();
                          break;
                        case "number":
                          itemZodType = z.number();
                          break;
                        case "integer":
                          itemZodType = z.number().int();
                          break;
                        case "boolean":
                          itemZodType = z.boolean();
                          break;
                        default:
                          itemZodType = z.any();
                          break;
                      }

                      zodType = z.array(itemZodType);
                      if (prop.minItems) zodType = zodType.min(prop.minItems);
                      if (prop.maxItems) zodType = zodType.max(prop.maxItems);
                    } else {
                      zodType = z.array(z.any());
                    }
                    break;

                  case "object":
                    // Handle nested object types recursively
                    if (prop.properties) {
                      const nestedObj: Record<string, any> = {};
                      Object.entries(prop.properties).forEach(
                        ([nestedKey, nestedProp]) => {
                          // Simple handling for nested properties
                          nestedObj[nestedKey] = z
                            .any()
                            .describe(
                              (nestedProp as any).description || nestedKey,
                            );
                        },
                      );
                      zodType = z.object(nestedObj);
                    } else {
                      zodType = z.record(z.any());
                    }
                    break;

                  default:
                    zodType = z.any();
                    break;
                }

                // Add description
                zodType = zodType.describe(prop.description || key);

                // Make optional if not required
                if (
                  tool.inputSchema &&
                  tool.inputSchema.required &&
                  !tool.inputSchema.required.includes(key)
                ) {
                  zodType = zodType.optional();
                }

                schemaObj[key] = zodType;
              },
            );
            parameters = z.object(schemaObj);
          } else {
            parameters = tool.inputSchema;
          }
        } else {
          parameters = z.object({});
        }

        newServer.addTool({
          name: tool.name,
          description: tool.description || "",
          parameters,
          execute: tool.execute,
        });
      });
    });

    // Store the original transport configuration
    const originalTransport = (server as any).transport;

    // Extract port information from transport config
    let port: number | undefined;
    if (transportConfig && transportConfig.sse && transportConfig.sse.port) {
      port = transportConfig.sse.port;
    } else if (
      originalTransport &&
      originalTransport.sse &&
      originalTransport.sse.port
    ) {
      port = originalTransport.sse.port;
    }

    // Create a promise to wait for server to stop
    const stopPromise = new Promise<void>((resolve) => {
      // Try to stop the server silently
      try {
        server.stop();
        if (!isStdioMode()) {
          console.log("Server stopped successfully");
        }
      } catch (error) {
        // Silently ignore stop errors
      }

      // Give it a brief moment to fully release the port
      setTimeout(resolve, 1000);
    });

    // Wait for the server to stop
    await stopPromise;

    // Replace the global server reference
    server = newServer;

    // Restart with the same transport configuration if available, but silently
    try {
      if (transportConfig) {
        if (!isStdioMode()) {
          console.log(`Restarting server with port ${port || "unknown"}`);
        }
        server.start({
          ...transportConfig,
          ...({ silent: true } as any),
        });
        if (!isStdioMode()) {
          console.log("Server restarted with updated tools");
        }
      } else if (originalTransport) {
        // Try to use the original transport configuration as a fallback
        if (!isStdioMode()) {
          console.log(
            `Restarting server with original transport (port: ${
              port || "unknown"
            })`,
          );
        }
        server.start({
          ...originalTransport,
          ...({ silent: true } as any),
        });
        if (!isStdioMode()) {
          console.log(
            "Server restarted with updated tools using original transport",
          );
        }
      }
    } catch (error) {
      if (!isStdioMode()) {
        console.error("Error restarting server:", error);
      }
    }
  } catch (error: any) {
    if (!isStdioMode()) {
      console.error("Error updating tools:", error);
    }
  }
}

// Add tools to server initially with persistent connections
async function addTools() {
  try {
    const mcpTools = await getToolsFromAllMcps();

    // Update the list of active MCPs
    previousMcpList = mcpTools.map((group) => group.mcpName);

    // Concise log for initial setup
    if (!isStdioMode()) {
      console.log(
        `Initializing with ${previousMcpList.length} MCPs (persistent connections)`,
      );
    }

    // Track total tool count
    let totalTools = 0;

    mcpTools.forEach((toolGroup) => {
      const { mcpName, tools } = toolGroup;
      tools.forEach((tool) => {
        // Convert the inputSchema to a zod object if it's not already one
        let parameters;
        if (tool.inputSchema) {
          if ("properties" in tool.inputSchema) {
            // Convert JSON Schema properties to Zod schemas
            const schemaObj: Record<string, any> = {};
            Object.entries(tool.inputSchema.properties).forEach(
              ([key, prop]) => {
                let zodType;

                // Determine proper Zod type based on JSON Schema type
                switch (prop.type) {
                  case "string":
                    zodType = z.string();
                    // Add validation rules if specified
                    if (prop.pattern)
                      zodType = zodType.regex(new RegExp(prop.pattern));
                    if (prop.minLength) zodType = zodType.min(prop.minLength);
                    if (prop.maxLength) zodType = zodType.max(prop.maxLength);
                    if (prop.enum) zodType = z.enum(prop.enum);
                    break;

                  case "number":
                    zodType = z.number();
                    if (prop.minimum !== undefined)
                      zodType = zodType.min(prop.minimum);
                    if (prop.maximum !== undefined)
                      zodType = zodType.max(prop.maximum);
                    break;

                  case "integer":
                    zodType = z.number().int();
                    if (prop.minimum !== undefined)
                      zodType = zodType.min(prop.minimum);
                    if (prop.maximum !== undefined)
                      zodType = zodType.max(prop.maximum);
                    break;

                  case "boolean":
                    zodType = z.boolean();
                    break;

                  case "array":
                    // Handle array types
                    if (prop.items) {
                      const itemType = prop.items.type || "any";
                      let itemZodType;

                      switch (itemType) {
                        case "string":
                          itemZodType = z.string();
                          break;
                        case "number":
                          itemZodType = z.number();
                          break;
                        case "integer":
                          itemZodType = z.number().int();
                          break;
                        case "boolean":
                          itemZodType = z.boolean();
                          break;
                        default:
                          itemZodType = z.any();
                          break;
                      }

                      zodType = z.array(itemZodType);
                      if (prop.minItems) zodType = zodType.min(prop.minItems);
                      if (prop.maxItems) zodType = zodType.max(prop.maxItems);
                    } else {
                      zodType = z.array(z.any());
                    }
                    break;

                  case "object":
                    // Handle nested object types recursively
                    if (prop.properties) {
                      const nestedObj: Record<string, any> = {};
                      Object.entries(prop.properties).forEach(
                        ([nestedKey, nestedProp]) => {
                          // Simple handling for nested properties
                          nestedObj[nestedKey] = z
                            .any()
                            .describe(
                              (nestedProp as any).description || nestedKey,
                            );
                        },
                      );
                      zodType = z.object(nestedObj);
                    } else {
                      zodType = z.record(z.any());
                    }
                    break;

                  default:
                    zodType = z.any();
                    break;
                }

                // Add description
                zodType = zodType.describe(prop.description || key);

                // Make optional if not required
                if (
                  tool.inputSchema &&
                  tool.inputSchema.required &&
                  !tool.inputSchema.required.includes(key)
                ) {
                  zodType = zodType.optional();
                }

                schemaObj[key] = zodType;
              },
            );
            parameters = z.object(schemaObj);
          } else {
            parameters = tool.inputSchema;
          }
        } else {
          parameters = z.object({});
        }

        server.addTool({
          name: tool.name,
          description: tool.description || "",
          parameters,
          execute: tool.execute,
        });

        totalTools++;
      });
    });

    // Single summary log instead of per-MCP logs
    if (!isStdioMode()) {
      console.log(
        `Initialized ${totalTools} tools from ${mcpTools.length} MCPs with persistent connections`,
      );
    }
  } catch (error: any) {
    if (!isStdioMode()) {
      console.error("Error adding remote tools:", error);
    }
  }
}

// Helper function to compare two arrays for equality
function arraysEqual(a: any[], b: any[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  // Sort both arrays to ensure consistent comparison
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();

  for (let i = 0; i < sortedA.length; i++) {
    if (sortedA[i] !== sortedB[i]) return false;
  }

  return true;
}

// Modified server start function that saves the transport config
async function startServer(config: any) {
  // Save the transport configuration for later restarts
  transportConfig = config;

  // Extract port information for better error reporting
  let port =
    config && config.sse && config.sse.port ? config.sse.port : "unknown";

  // Helper function to wait for a specified time
  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  // Start the server with the provided configuration and silent option
  try {
    if (!isStdioMode()) {
      console.log(`Starting server with port ${port}...`);
    }

    // If there's already a server running with this port, try to stop it first
    try {
      server.stop();
      if (!isStdioMode()) {
        console.log(`Stopped previous server instance`);
      }

      // Brief delay to allow port release
      await sleep(1000);

      server.start({
        ...config,
        ...({ silent: true } as any),
      });
      if (!isStdioMode()) {
        console.log(`Server started successfully on port ${port}`);
      }
    } catch (stopError) {
      // If server wasn't running, just start it directly
      server.start({
        ...config,
        ...({ silent: true } as any),
      });
      if (!isStdioMode()) {
        console.log(`Server started successfully on port ${port}`);
      }
    }
  } catch (error) {
    if (!isStdioMode()) {
      console.error(`Error starting server on port ${port}:`, error);

      // If we get an EADDRINUSE error, provide a helpful message
      if (error instanceof Error && error.message.includes("EADDRINUSE")) {
        console.error(`Port ${port} is already in use`);
      }
    }
  }
}

// Stop polling for tool updates
function stopToolsPolling() {
  if (toolUpdateInterval) {
    clearInterval(toolUpdateInterval);
    toolUpdateInterval = null;
    if (!isStdioMode()) {
      console.log("Tool polling stopped");
    }
  }
}

// Cleanup aggregator connections
async function cleanupAggregatorConnections() {
  try {
    await aggregatorPool.closeAllConnections();
    if (!isStdioMode()) {
      console.log("Aggregator connections cleaned up");
    }
  } catch (error) {
    if (!isStdioMode()) {
      console.error("Error cleaning up aggregator connections:", error);
    }
  }
}

export {
  server,
  addTools,
  startToolsPolling,
  stopToolsPolling,
  startServer,
  updateTools,
  cleanupAggregatorConnections,
};
