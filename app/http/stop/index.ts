import { isServerRunning, stopServer } from "../server/server";
import { createSpinner } from "nanospinner";

export const stopHttpServer = async () => {
  const spinner = createSpinner("Stopping HTTP API server...").start();

  try {
    const serverRunning = await isServerRunning();

    if (!serverRunning) {
      spinner.warn({ text: "No HTTP API server is running" });
      return;
    }

    await stopServer();
    spinner.success({ text: "HTTP API server offline" });
  } catch (error: any) {
    spinner.error({
      text: `Failed to stop HTTP API server: ${
        error.message || "Unknown error"
      }`,
    });
  }
};
