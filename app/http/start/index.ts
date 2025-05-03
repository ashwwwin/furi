import { isPortFree } from "@/helpers/checkPort";
import { createServer, setPort, isServerRunning } from "../server/server";
import { createSpinner } from "nanospinner";

export const startHttpServer = async (port: number, exposeSudo = false) => {
  const spinner = createSpinner("Starting HTTP API server").start();

  try {
    // Check if the port is already in use
    const portInUse = await isPortFree(port);
    if (!portInUse) {
      spinner.error({
        text: `Port ${port} is already in use. Please choose a different port.`,
      });
      return;
    }
    // Check if a server is already running
    const serverRunning = await isServerRunning();

    if (serverRunning) {
      spinner.warn({
        text: "HTTP API is already running\n     To restart, use: \x1b[2mfuri http restart\x1b[0m",
      });
      return;
    }

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
    await createServer(exposeSudo);

    spinner.success({ text: "HTTP API server started" });
    if (exposeSudo) {
      console.log(`\x1b[31mNotice: Admin routes are exposed via HTTP\x1b[0m`);
    } else {
      console.log(
        `HTTP API server running\n\x1b[2mNotice: No Admin routes are exposed via HTTP\x1b[0m`
      );
    }
  } catch (error: any) {
    spinner.error({
      text: `Failed to start HTTP API server: ${
        error.message || "Unknown error"
      }`,
    });
    return null;
  }
};
