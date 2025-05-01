import {
  isServerRunning,
  stopServer,
  createServer,
  getServer,
  setPort,
} from "../server/server";
import { createSpinner } from "nanospinner";

export const restartHttpServer = async () => {
  const spinner = createSpinner("Restarting HTTP API server").start();

  try {
    // Check if server is running
    const serverRunning = await isServerRunning();

    if (!serverRunning) {
      spinner.error({
        text: "HTTP API server is not running\n     \x1b[2mStart the server with furi http start\x1b[0m",
      });
      return;
    }

    // Get the server configuration to preserve sudo flag and port
    const serverInfo = (await getServer()) as any;
    const exposeSudo = serverInfo?.pm2_env?.env?.EXPOSE_SUDO === "true";
    const currentPort = serverInfo?.pm2_env?.env?.PORT;

    if (currentPort) {
      setPort(parseInt(currentPort, 10));
    }

    // Stop the server
    spinner.update({ text: "Stopping HTTP API server" });
    await stopServer();

    // Start a new server with the same sudo setting
    spinner.update({ text: "Starting HTTP API server" });
    await createServer(exposeSudo);

    spinner.success({
      text: "HTTP API server restarted",
    });

    console.log(
      exposeSudo
        ? `\x1b[31mNotice: Admin routes are exposed via HTTP\x1b[0m`
        : `\x1b[2mNotice: No Admin routes are exposed via HTTP API\x1b[0m`
    );
  } catch (error: any) {
    spinner.error({
      text: `Failed to restart HTTP API server: ${
        error.message || "Unknown error"
      }`,
    });
  }
};
