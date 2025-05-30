import { addTools, startToolsPolling, startServer } from "@/aggregator/server/server";

export const connectMCPAggregatorServer = async () => {
  try {
    // Set environment for stdio transport
    process.env.TRANSPORT_TYPE = "stdio";
    // No port needed for stdio
    delete process.env.PORT;

    // Add initial tools
    await addTools();

    // Start the tool polling with a 5-second interval
    startToolsPolling(5000);

    // Start the server with stdio transport
    const transportConfig = {
      transportType: "stdio",
    };
    
    await startServer(transportConfig);

    // Handle graceful shutdown
    const cleanup = async () => {
      process.exit(0);
    };

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // Keep the process alive for MCP client connections
    
  } catch (error: any) {
    process.exit(1);
  }
};