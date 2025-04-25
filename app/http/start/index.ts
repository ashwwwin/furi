import { createServer, setPort, isServerRunning } from "../server/server";
import { createSpinner } from "nanospinner";

export const startHttpServer = async (port?: number, exposeSudo = true) => {
  const spinner = createSpinner("Starting HTTP API server").start();

  try {
    // Check if a server is already running
    const serverRunning = await isServerRunning();

    // Set port if provided
    if (port) {
      setPort(port);
      if (serverRunning) {
        spinner.update({
          text: `Replacing existing server with a new one on port ${port}...`,
        });
      }
    } else if (serverRunning) {
      spinner.warn({
        text: "Server is already running. Use 'restart' to restart it.",
      });
      return;
    }

    // Start the server
    await createServer();

    spinner.success({ text: "HTTP API server started" });
    console.log(`\x1b[31mNotice: Admin routes are exposed via HTTP\x1b[0m`);
  } catch (error: any) {
    spinner.error({
      text: `Failed to start HTTP API server: ${
        error.message || "Unknown error"
      }`,
    });
    return null;
  }
};
