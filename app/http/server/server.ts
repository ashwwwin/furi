import pm2 from "pm2";
import path from "path";
import { resolveFromBase } from "@/helpers/paths";

const appName = "furi-http-server";
export let port: number = 9339;

export const setPort = (newPort: number) => {
  port = newPort;
};

export const isServerRunning = (): Promise<boolean> => {
  return new Promise((resolve) => {
    pm2.connect((err) => {
      if (err) {
        resolve(false);
        return;
      }

      pm2.describe(appName, (err, processDescription) => {
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

export const getServer = async () => {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        reject(err);
        return;
      }

      pm2.describe(appName, (err, processDescription: any) => {
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

export const createServer = async (exposeSudo = false): Promise<any> => {
  const isRunning = await isServerRunning();

  // If a server is already running, stop it first
  if (isRunning) {
    // console.log("Stopping existing server");
    await stopServer();
  }

  return new Promise((resolve, reject) => {
    pm2.connect(async (err) => {
      if (err) {
        reject(err);
        return;
      }

      const serverFilePath = resolveFromBase("app/http/server/routes.ts");

      pm2.start(
        {
          script: serverFilePath,
          name: appName,
          env: {
            PORT: port.toString(),
            EXPOSE_SUDO: exposeSudo.toString(),
          },
          exec_mode: "fork",
          watch: false,
          interpreter: "bun",
        },
        (err, apps: any) => {
          pm2.disconnect();

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

      pm2.delete(appName, (err) => {
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
