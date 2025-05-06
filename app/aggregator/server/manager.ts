import pm2 from "pm2";
import path from "path";

const appName = "furi-aggregator-server";
export let port: number = 9338;
export let transportType: "sse" | "stdio" = "stdio";

const pm2OperationTimeout = 10000;

export const setPort = (newPort: number) => {
  port = newPort;
};

export const setTransportType = (newTransportType: "sse" | "stdio") => {
  transportType = newTransportType;
};

// Connect to PM2 with timeout
const connectToPM2 = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("PM2 connection timeout"));
    }, pm2OperationTimeout);

    pm2.connect((err) => {
      clearTimeout(timeout);
      if (err) {
        reject(
          new Error(`Failed to connect to PM2: ${err.message || String(err)}`)
        );
        return;
      }
      resolve();
    });
  });
};

export const isServerRunning = async (): Promise<boolean> => {
  try {
    await connectToPM2();

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        pm2.disconnect();
        resolve(false);
      }, pm2OperationTimeout);

      pm2.describe(appName, (err, processDescription) => {
        clearTimeout(timeout);
        pm2.disconnect();

        if (err || !processDescription || processDescription.length === 0) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.error(
      `Error checking if server is running: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return false;
  }
};

export const getServer = async () => {
  try {
    await connectToPM2();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pm2.disconnect();
        reject(new Error("PM2 getServer operation timeout"));
      }, pm2OperationTimeout);

      pm2.describe(appName, (err, processDescription: any) => {
        clearTimeout(timeout);
        pm2.disconnect();

        if (err) {
          reject(
            new Error(
              `Failed to get server info: ${err.message || String(err)}`
            )
          );
        } else if (!processDescription || processDescription.length === 0) {
          resolve(null);
        } else {
          resolve(processDescription[0]);
        }
      });
    });
  } catch (error) {
    console.error(
      `Error getting server info: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
};

export const createServer = async (): Promise<any> => {
  try {
    const isRunning = await isServerRunning();

    // If a server is already running, stop it first
    if (isRunning) {
      await stopServer();
    }

    await connectToPM2();

    return new Promise((resolve, reject) => {
      const serverFilePath = path.resolve(
        process.env.BASE_PATH || process.env.HOME || process.cwd(),
        ".furikake/app/aggregator/server/main.ts"
      );

      const timeout = setTimeout(() => {
        pm2.disconnect();
        reject(new Error("PM2 createServer operation timeout"));
      }, pm2OperationTimeout);

      pm2.start(
        {
          script: serverFilePath,
          name: appName,
          env: {
            PORT: port.toString(),
            TRANSPORT_TYPE: transportType,
          },
          exec_mode: "fork",
          watch: false,
          max_memory_restart: "200M", // Restart if memory exceeds 200MB
        },
        (err, apps: any) => {
          clearTimeout(timeout);
          pm2.disconnect();

          if (err) {
            reject(
              new Error(`Failed to start server: ${err.message || String(err)}`)
            );
            return;
          }

          resolve(apps && apps[0]);
        }
      );
    });
  } catch (error) {
    console.error(
      `Error creating server: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
};

export const stopServer = async (): Promise<boolean> => {
  try {
    const isRunning = await isServerRunning();

    if (!isRunning) {
      return false;
    }

    await connectToPM2();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pm2.disconnect();
        reject(new Error("PM2 stopServer operation timeout"));
      }, pm2OperationTimeout);

      pm2.delete(appName, (err) => {
        clearTimeout(timeout);
        pm2.disconnect();

        if (err) {
          reject(
            new Error(`Failed to stop server: ${err.message || String(err)}`)
          );
        } else {
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.error(
      `Error stopping server: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    throw error;
  }
};
