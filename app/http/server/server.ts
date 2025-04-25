import pm2 from "pm2";
import path from "path";

// Constants for PM2
const PM2_APP_NAME = "furi-http-server";
export let port: number = 9339;

/**
 * Set the port for the HTTP server
 */
export const setPort = (newPort: number) => {
  port = newPort;
};

/**
 * Check if the server is running
 */
export const isServerRunning = (): Promise<boolean> => {
  return new Promise((resolve) => {
    pm2.connect((err) => {
      if (err) {
        resolve(false);
        return;
      }

      pm2.describe(PM2_APP_NAME, (err, processDescription) => {
        pm2.disconnect();

        if (err || !processDescription || processDescription.length === 0) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  });
};

/**
 * Get the server process description
 */
export const getServer = async () => {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        reject(err);
        return;
      }

      pm2.describe(PM2_APP_NAME, (err, processDescription: any) => {
        pm2.disconnect();

        if (err) {
          reject(err);
        } else if (!processDescription || processDescription.length === 0) {
          resolve(null);
        } else {
          resolve(processDescription[0]);
        }
      });
    });
  });
};

/**
 * Create and start the server
 */
export const createServer = async (): Promise<any> => {
  const isRunning = await isServerRunning();

  // If a server is already running, stop it first
  if (isRunning) {
    // console.log("Stopping existing server before starting a new one...");
    await stopServer();
  }

  // Connect to PM2 if not already connected
  return new Promise((resolve, reject) => {
    pm2.connect(async (err) => {
      if (err) {
        reject(err);
        return;
      }

      const serverFilePath = path.resolve(
        process.cwd(),
        "app/http/server/routes.ts"
      );

      pm2.start(
        {
          script: serverFilePath,
          name: PM2_APP_NAME,
          env: {
            PORT: port.toString(),
          },
          exec_mode: "fork",
          watch: false,
        },
        (err, apps: any) => {
          pm2.disconnect(); // Always disconnect after operation

          if (err) {
            reject(err);
            return;
          }

          resolve(apps && apps[0]);
        }
      );
    });
  });
};

/**
 * Stop the server
 */
export const stopServer = async (): Promise<boolean> => {
  const isRunning = await isServerRunning();

  if (!isRunning) {
    return false;
  }

  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        reject(err);
        return;
      }

      pm2.delete(PM2_APP_NAME, (err) => {
        pm2.disconnect();

        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  });
};
