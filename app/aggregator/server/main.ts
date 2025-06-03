import {
  addTools,
  startToolsPolling,
  startServer,
  stopToolsPolling,
} from "./server";

// Helper to check if we're in stdio mode (should suppress logging)
const isStdioMode = () => process.env.TRANSPORT_TYPE === "stdio";

// Get configuration from environment variables
const port = parseInt(process.env.PORT || "9338", 10);
const transportType = (process.env.TRANSPORT_TYPE || "stdio") as
  | "sse"
  | "stdio";

// For stdio transport, we don't need a port
const usePort = transportType === "sse" ? port : undefined;

// Track if the server has started successfully
let serverStarted = false;

async function start() {
  try {
    // Add initial tools
    await addTools();
    if (!isStdioMode()) {
      console.log("[Aggregator] Initial tools setup completed");
    }

    // Start the tool polling with a 5-second interval
    startToolsPolling(5000);

    // Start the server with the appropriate transport
    if (transportType === "sse") {
      if (!isStdioMode()) {
        console.log(
          `[Aggregator] Starting server with SSE transport on port ${port}...`
        );
      }
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
      if (!isStdioMode()) {
        console.log(
          "[Aggregator] Starting server with stdio transport (persistent mode)..."
        );
      }
      // Start the server with stdio transport - this maintains persistent connections
      const transportConfig = {
        transportType: "stdio",
      };
      await startServer(transportConfig);
    }

    serverStarted = true;
    if (!isStdioMode()) {
      console.log(
        "[Aggregator] Server started successfully with persistent connections"
      );
    }

    // Keep the process alive - don't exit for stdio mode
    if (transportType === "stdio") {
      if (!isStdioMode()) {
        console.log(
          "[Aggregator] Stdio transport active - maintaining persistent MCP connections"
        );
      }

      // Set up a heartbeat to check health every 30 seconds
      const intervalId = setInterval(() => {
        if (!isStdioMode()) {
          console.log(
            "[Aggregator] Heartbeat: server is running with persistent connections"
          );
        }
      }, 30000);

      // Save the interval ID to clear it on shutdown
      process.on("beforeExit", () => {
        clearInterval(intervalId);
      });

      // For stdio, we need to ensure the process stays alive
      // The process will only exit on explicit signals or errors
      if (!isStdioMode()) {
        console.log(
          "[Aggregator] Process will maintain persistent connections until explicitly stopped"
        );
      }
    }
  } catch (error: any) {
    if (!isStdioMode()) {
      console.error(
        "[Aggregator] Failed to initialize server:",
        error.message || String(error)
      );
    }
    await cleanup();
    process.exit(1);
  }
}

// Clean up resources before shutdown
async function cleanup() {
  if (!isStdioMode()) {
    console.log("[Aggregator] Cleaning up resources...");
  }
  try {
    // Stop the tool polling interval
    stopToolsPolling();

    // Additional cleanup if needed
    // ...

    if (!isStdioMode()) {
      console.log("[Aggregator] Cleanup completed");
    }
  } catch (cleanupError) {
    if (!isStdioMode()) {
      console.error("[Aggregator] Error during cleanup:", cleanupError);
    }
  }
}

// Handle process termination gracefully
process.on("SIGINT", async () => {
  if (!isStdioMode()) {
    console.log("[Aggregator] Received SIGINT, shutting down...");
  }
  await cleanup();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  if (!isStdioMode()) {
    console.log("[Aggregator] Received SIGTERM, shutting down...");
  }
  await cleanup();
  process.exit(0);
});

// Handle uncaught exceptions
process.on("uncaughtException", async (error) => {
  if (!isStdioMode()) {
    console.error("[Aggregator] Uncaught exception:", error);
  }
  await cleanup();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", async (reason) => {
  if (!isStdioMode()) {
    console.error("[Aggregator] Unhandled promise rejection:", reason);
  }
  await cleanup();
  process.exit(1);
});

// Start the server
start().catch(async (error) => {
  if (!isStdioMode()) {
    console.error("[Aggregator] Unhandled error during startup:", error);
  }
  await cleanup();
  process.exit(1);
});
