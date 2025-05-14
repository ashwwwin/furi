import { isPortFree } from "@/helpers/checkPort";
import { createServer, setPort, isServerRunning } from "../server/server";
import { createSpinner } from "nanospinner";

export const startHttpServer = async (port: number, exposeSudo = false) => {
  const spinner = createSpinner("Starting HTTP API server").start();

  try {
    const portInUse = await isPortFree(port);
    if (!portInUse) {
      spinner.error({
        text: `Port ${port} is already in use. Please choose a different port.`,
      });
      return;
    }

    const serverRunning = await isServerRunning();

    if (serverRunning) {
      spinner.warn({
        text: "HTTP API is already running\n     To restart, use: \x1b[2mfuri http restart\x1b[0m",
      });
      return;
    }

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

    await createServer(exposeSudo);

    spinner.success({ text: "HTTP API server started" });
    console.log(
      `     \x1b[2mHTTP API server running on http://127.0.0.1:${port}\x1b[0m`,
    );
    if (exposeSudo) {
      console.log(`\n\x1b[31mNotice: Admin routes are exposed via HTTP\x1b[0m`);
    } else {
      console.log(
        `\n\x1b[2mNotice: No Admin routes are exposed via HTTP\x1b[0m`,
      );
    }
  } catch (error: any) {
    console.log(error);
    spinner.error({
      text: `Failed to start HTTP API server: ${
        error.toString() || "Unknown error"
      }`,
    });
    return null;
  }
};
