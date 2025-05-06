import {
  addTools,
  startToolsPolling,
  startServer,
  stopToolsPolling,
} from "./server";

// Get configuration from environment variables
const port = parseInt(process.env.PORT || "9338", 10);
const transportType = (process.env.TRANSPORT_TYPE || "stdio") as
  | "sse"
  | "stdio";

// Track if the server has started successfully
let serverStarted = false;

async function start() {
  try {
    // Add initial tools
    await addTools();
    console.log("[Aggregator] Initial tools setup completed");

    // Start the tool polling with a 5-second interval
    startToolsPolling(5000);

    // Start the server with the appropriate transport
    if (transportType === "sse") {
      console.log(
        `[Aggregator] Starting server with SSE transport on port ${port}...`
      );
      // Start the server with SSE transport
      const transportConfig = {
        transportType: "sse",
        sse: {
          port: port,
          endpoint: "/sse",
        },
      };
      await startServer(transportConfig);
    } else {
      console.log("[Aggregator] Starting server with stdio transport...");
      // Start the server with stdio transport
      const transportConfig = {
        transportType: "stdio",
      };
      await startServer(transportConfig);
    }

    serverStarted = true;
    console.log("[Aggregator] Server started successfully");

    // Keep the process alive - don't exit for stdio mode
    if (transportType === "stdio") {
      // Set up a heartbeat to check health every 30 seconds
      const intervalId = setInterval(() => {
        console.log("[Aggregator] Heartbeat: server is running");
      }, 30000);

      // Save the interval ID to clear it on shutdown
      process.on("beforeExit", () => {
        clearInterval(intervalId);
      });
    }
  } catch (error: any) {
    console.error(
      "[Aggregator] Failed to initialize server:",
      error.message || String(error)
    );
    await cleanup();
    process.exit(1);
  }
}

// Clean up resources before shutdown
async function cleanup() {
  console.log("[Aggregator] Cleaning up resources...");
  try {
    // Stop the tool polling interval
    stopToolsPolling();

    // Additional cleanup if needed
    // ...

    console.log("[Aggregator] Cleanup completed");
  } catch (cleanupError) {
    console.error("[Aggregator] Error during cleanup:", cleanupError);
  }
}

// Handle process termination gracefully
process.on("SIGINT", async () => {
  console.log("[Aggregator] Received SIGINT, shutting down...");
  await cleanup();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[Aggregator] Received SIGTERM, shutting down...");
  await cleanup();
  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", async (error) => {
  console.error("[Aggregator] Uncaught exception:", error);
  await cleanup();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", async (reason) => {
  console.error("[Aggregator] Unhandled promise rejection:", reason);
  await cleanup();
  process.exit(1);
});

// Start the server
start().catch(async (error) => {
  console.error("[Aggregator] Unhandled error during startup:", error);
  await cleanup();
  process.exit(1);
});
