import fs from "fs";
import { $ } from "bun";
import pm2 from "pm2";
import { formatUptime } from "@/mcp/status/actions/getProcStatus";

export interface HttpServerStatus {
  name: string;
  pid: string;
  status: string;
  memory: string;
  cpu: string;
  uptime: string;
}

export interface HttpServerLogs {
  output: string;
  error: string;
}

export interface HttpServerStatusData {
  serverStatus: "online" | "offline";
  message?: string;
  status?: HttpServerStatus;
  logs: HttpServerLogs;
}

// Helper function to connect to PM2
const connectToPM2 = (): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    pm2.connect((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
};

// Helper function to get process info from PM2
const getProcessInfo = (appName: string): Promise<any> => {
  return new Promise<any>((resolve, reject) => {
    pm2.describe(appName, (err, proc) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(proc[0]);
    });
  });
};

// Helper function to format status data
const formatStatusData = (processInfo: any): HttpServerStatus => {
  return {
    name: "HTTP API Server",
    pid: processInfo.pid || "N/A",
    status: processInfo.pm2_env?.status || "unknown",
    memory: processInfo.monit?.memory
      ? `${Math.round(processInfo.monit.memory / 1024 / 1024)}MB`
      : "N/A",
    cpu: processInfo.monit?.cpu
      ? `${processInfo.monit.cpu.toFixed(1)}%`
      : "N/A",
    uptime: processInfo.pm2_env?.pm_uptime
      ? formatUptime(Date.now() - processInfo.pm2_env.pm_uptime)
      : "N/A",
  };
};

// Get logs from PM2 log files
export const getHttpServerLogs = async (
  lines: number = 15,
  processInfo: any
): Promise<HttpServerLogs> => {
  try {
    // Get log paths from PM2
    const outLogPath = processInfo.pm2_env?.pm_out_log_path;
    const errLogPath = processInfo.pm2_env?.pm_err_log_path;

    let outputContent = "";
    let errorContent = "";

    // Get stdout logs
    if (outLogPath && fs.existsSync(outLogPath)) {
      try {
        const rawLogs = await $`tail -n ${lines} "${outLogPath}"`.text();
        outputContent = rawLogs.trim();
      } catch (e) {
        outputContent = `Error retrieving logs: ${e}`;
      }
    } else {
      outputContent = "No output logs found";
    }

    // Get stderr logs
    if (errLogPath && fs.existsSync(errLogPath)) {
      try {
        const rawLogs = await $`tail -n ${lines} "${errLogPath}"`.text();
        errorContent = rawLogs.trim();
      } catch (e) {
        errorContent = `Error retrieving error logs: ${e}`;
      }
    } else {
      errorContent = "No error log files found";
    }

    return { output: outputContent, error: errorContent };
  } catch (error) {
    return {
      output: "",
      error: `Error retrieving logs: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};

// Get complete HTTP server status and logs data
export const getHttpServerStatusData = async (
  lines: number = 15
): Promise<HttpServerStatusData> => {
  const appName = "furi-http-server";

  try {
    // Connect to PM2
    await connectToPM2();

    // Get server info
    const processInfo = await getProcessInfo(appName);

    if (!processInfo) {
      pm2.disconnect();
      return {
        serverStatus: "offline",
        message: "HTTP API server is not running",
        logs: { output: "", error: "" },
      };
    }

    // Format the status data
    const status = formatStatusData(processInfo);

    // Get logs
    const logs = await getHttpServerLogs(lines, processInfo);

    pm2.disconnect();

    return {
      serverStatus: "online",
      status,
      logs,
    };
  } catch (error: any) {
    pm2.disconnect();
    throw new Error(
      `Failed to get HTTP API server status: ${error.message || String(error)}`
    );
  }
};

// Simplified function to get only logs (for API endpoints that only need logs)
export const getHttpServerLogsOnly = async (
  lines: number = 15
): Promise<HttpServerLogs> => {
  try {
    const statusData = await getHttpServerStatusData(lines);
    if (statusData.serverStatus === "offline") {
      return {
        output: "",
        error: statusData.message || "HTTP API server is not running",
      };
    }
    return statusData.logs;
  } catch (error) {
    return {
      output: "",
      error: `Error retrieving logs: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};
