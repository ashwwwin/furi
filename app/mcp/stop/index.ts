import { createSpinner } from "nanospinner";
import pm2 from "pm2";

export const stopMCP = async (packageName: string) => {
  const spinner = createSpinner(`[${packageName}] Stopping`);
  spinner.start();

  try {
    // Create PM2 process name from package name
    const processName = `furi_${packageName.replace("/", "-")}`;

    // Connect to PM2
    await new Promise<void>((resolve, reject) => {
      pm2.connect((err) => {
        if (err) {
          reject(new Error(`Failed to connect to PM2: ${err.message}`));
          return;
        }
        resolve();
      });
    });

    // Check if the process exists and is running
    const list = await new Promise<any[]>((resolve, reject) => {
      pm2.list((err, list) => {
        if (err) {
          reject(new Error(`Failed to get process list: ${err.message}`));
          return;
        }
        resolve(list);
      });
    });

    const processEntry = list.find((p) => p.name === processName);

    if (!processEntry) {
      spinner.error(`[${packageName}] Process not found`);
      return;
    }

    // Stop the process
    await new Promise<void>((resolve, reject) => {
      pm2.delete(processName, (err) => {
        if (err) {
          reject(new Error(`Failed to stop process: ${err.message}`));
          return;
        }
        resolve();
      });
    });

    spinner.success(`[${packageName}] Stopped`);
  } catch (error: any) {
    spinner.error(
      `[${packageName}] Failed to stop: ${error.message || String(error)}`
    );
  } finally {
    // Always disconnect from PM2 to allow the process to exit
    pm2.disconnect();
  }
};
