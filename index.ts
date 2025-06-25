#!/usr/bin/env bun
import { Command } from "commander";
import { addPackage, removePackage, listPackages } from "@/packages";
import {
  getEnvironmentVariables,
  stopMCP,
  startMCP,
  renameMCP,
  restartMCP,
  statusMCP,
} from "@/mcp";
import { callTool, listTools } from "@/tools";
import {
  startHttpServer,
  stopHttpServer,
  restartHttpServer,
  httpStatus,
} from "@/http";
import {
  startMCPAggregatorServer,
  stopMCPAggregatorServer,
  restartMCPAggregatorServer,
  aggregatorStatus,
  connectMCPAggregatorServer,
} from "@/aggregator";
import { upgradeFuri } from "@/upgrade";
import { getBasePath, getUserDataPath } from "@/helpers/paths";
import {
  getHttpPort,
  saveHttpPort,
  getAggregatorPort,
  saveAggregatorPort,
} from "@/helpers/config";
import { version } from "./package.json";
import { jsonifyResponse } from "@/helpers/jsonify";
import {
  addResponse,
  removeResponse,
  listResponse,
  startMCPResponse,
  stopResponse,
  restartResponse,
  statusResponse,
  singleStatusResponse,
  singleToolsResponse,
  toolsResponse,
  callResponse,
  startAggregatorResponse,
  stopAggregatorResponse,
  restartAggregatorResponse,
  statusAggregatorResponse,
} from "@/http/server";
import { envResponse } from "@/http/server/endpoints/[mcpName]/env/getEnv";
import { httpStatusResponse } from "@/http/server/endpoints/http/status";
import { renameMCPResponse } from "@/http/server/endpoints/[mcpName]/rename";

const program = new Command();

program
  .name("furi")
  .summary("Furikake is a CLI & API for MCP management and execution")
  .version(version)
  .addHelpText(
    "before",
    `\x1b[2m🍃 Furikake
CLI & API for MCP management

https://furi.so
https://github.com/ashwwwin/furi
https://discord.com/invite/B8vAfRkdXS\n\x1b[0m`
  )
  .showHelpAfterError()
  .showSuggestionAfterError();

program
  .command("add")
  .description("Install a new MCP server")
  .argument("<mcpName>", "MCP name")
  .option("-j, --json", "JSON output")
  .action((mcpName, options) => {
    if (options.json) {
      jsonifyResponse(() => addResponse(`/add/${mcpName}`));
    } else {
      addPackage(mcpName);
    }
  });

program
  .command("remove")
  .description("Remove an installed MCP server")
  .argument("<mcpName>", "MCP name")
  .option("-j, --json", "JSON output")
  .action((mcpName, options) => {
    if (options.json) {
      jsonifyResponse(() => removeResponse(`${mcpName}/remove`));
    } else {
      removePackage(mcpName);
    }
  });

program
  .command("list")
  .description("List all installed MCP servers")
  .option("-d, --details", "Show detailed status information")
  .option("-j, --json", "JSON output")
  .action((options) => {
    if (options.json) {
      jsonifyResponse(() => listResponse(options.details));
    } else {
      listPackages(options.details);
    }
  });

program
  .command("env")
  .description("Get environment variables for the MCP server")
  .argument("<mcpName>", "MCP name")
  .option("-j, --json", "JSON output")
  .action((mcpName, options) => {
    if (options.json) {
      jsonifyResponse(() => envResponse(`${mcpName}/env`));
    } else {
      getEnvironmentVariables(mcpName);
    }
  });

program
  .command("start")
  .description("Start an MCP server")
  .argument("<mcpName>", "MCP name")
  .option(
    "-e, --env <json>",
    'Environment variables as JSON string: \'{"key":"value"}\''
  )
  .option("-j, --json", "JSON output")
  .action((mcpName, options) => {
    if (options.json) {
      jsonifyResponse(() =>
        startMCPResponse(`${mcpName}/start`, options.env, true)
      );
    } else {
      startMCP(mcpName, options.env);
    }
  });

program
  .command("stop")
  .description("Stop an MCP server")
  .argument("<mcpName>", "MCP name")
  .option("-j, --json", "JSON output")
  .action((mcpName, options) => {
    if (options.json) {
      jsonifyResponse(() => stopResponse(`${mcpName}/stop`));
    } else {
      stopMCP(mcpName);
    }
  });

program
  .command("restart")
  .description("Restart an MCP server")
  .argument("<mcpName>", "MCP name")
  .option("-j, --json", "JSON output")
  .action((mcpName, options) => {
    if (options.json) {
      jsonifyResponse(() => restartResponse(`${mcpName}/restart`));
    } else {
      restartMCP(mcpName);
    }
  });

program
  .command("status")
  .description("Get the status of an MCP server")
  .argument("[mcpName]", "MCP Name (defaults to 'all' to show all MCPs)", "all")
  .option(
    "-l, --lines <number>",
    "Number of log lines to show (for single MCP)",
    "15"
  )
  .option("-j, --json", "JSON output")
  .action((mcpName, options) => {
    if (options.json) {
      if (mcpName === "all") {
        jsonifyResponse(() => statusResponse());
      } else {
        jsonifyResponse(() =>
          singleStatusResponse(
            `${mcpName}/status`,
            new URL(`http://localhost/${mcpName}/status?lines=${options.lines}`)
          )
        );
      }
    } else {
      statusMCP(mcpName, options.lines);
    }
  });

program
  .command("rename")
  .description("Rename an alias in the configuration")
  .argument("<currentName>", "Current name/alias")
  .argument("<newName>", "New name/alias")
  .option("-j, --json", "JSON output")
  .action((currentName, newName, options) => {
    if (options.json) {
      jsonifyResponse(() =>
        renameMCPResponse(`${currentName}/rename`, undefined, newName)
      );
    } else {
      renameMCP(currentName, newName);
    }
  });

program
  .command("tools")
  .description("List all tools for an MCP server")
  .argument("[mcpName]", "MCP Name (defaults to 'all' to show all MCPs)", "all")
  .option("-j, --json", "JSON output")
  .action((mcpName, options) => {
    if (options.json) {
      if (!mcpName || mcpName === "all") {
        jsonifyResponse(() => toolsResponse()).then(() => {
          process.exit(0);
        });
      } else {
        jsonifyResponse(() => singleToolsResponse(`${mcpName}/tools`)).then(
          () => {
            process.exit(0);
          }
        );
      }
    } else {
      listTools(mcpName);
    }
  });

program
  .command("call")
  .description("Call a tool")
  .argument("<mcpName>", "MCP name")
  .argument("<toolName>", "Tool name")
  .argument("<data>", "Data as JSON string")
  .option("-j, --json", "JSON output")
  .action((mcpName, toolName, data, options) => {
    if (options.json) {
      jsonifyResponse(() =>
        callResponse(`${mcpName}/call/${toolName}`, data)
      ).then(() => {
        process.exit(0);
      });
    } else {
      callTool(mcpName, toolName, data).then(() => {
        process.exit(0);
      });
    }
  });

program
  .command("where")
  .description("Show Furikake installation and data directory paths")
  .option("-j, --json", "Output the path in JSON format")
  .option("-d, --data", "Output the path to the user data directory")
  .action((options) => {
    if (options.json) {
      if (options.data) {
        console.log(
          JSON.stringify({
            success: true,
            furikakePath: getUserDataPath(),
          })
        );
      } else {
        console.log(
          JSON.stringify({
            success: true,
            furikakePath: getBasePath(),
          })
        );
      }
    } else {
      if (options.data) {
        console.log(
          `Furikake user data is stored in: \n     \x1b[2m${getUserDataPath()}\x1b[0m`
        );
      } else {
        console.log(
          `Furikake app is installed in: \n     \x1b[2m${getBasePath()}\x1b[0m`
        );
      }
    }
  });

const httpCommand = new Command("http").description("HTTP API");

httpCommand
  .command("start")
  .description("Start the HTTP API server")
  .option("-p, --port <port>", "Port number")
  .option("--sudo", "Expose sudo routes", false)
  .option("-j, --json", "JSON output")
  .option("--no-pm2", "Do not use PM2 to start the server")
  .action(async (options) => {
    let port: number;

    if (options.port) {
      port = parseInt(options.port);
      saveHttpPort(port);
    } else {
      port = getHttpPort();
    }

    await startHttpServer(port, options.sudo, options.pm2 === false);
  });

httpCommand
  .command("stop")
  .description("Stop the HTTP API server")
  .option("-j, --json", "JSON output")
  .action(async () => {
    await stopHttpServer();
  });

httpCommand
  .command("restart")
  .description(
    "Restart the running HTTP API server (preserves --sudo and port settings)"
  )
  .option("-j, --json", "JSON output")
  .action(async () => {
    await restartHttpServer();
  });

httpCommand
  .command("status")
  .description("Show the status of the HTTP API server")
  .option("-l, --lines <number>", "Number of log lines to show", "15")
  .option("-j, --json", "JSON output")
  .action(async (options) => {
    if (options.json) {
      jsonifyResponse(() =>
        httpStatusResponse(undefined, parseInt(options.lines, 10))
      );
    } else {
      const lines = parseInt(options.lines, 10);
      await httpStatus(lines);
    }
  });

const metaCommand = new Command("meta").description("MCP Aggregator");

metaCommand
  .command("start")
  .description(
    "Starts the MCP aggregation server (aggregator uses SSE for CLI access, stdio for MCP connections)"
  )
  .option("-p, --port <port>", "Port number for SSE transport")
  .option("-j, --json", "JSON output")
  .action(async (options) => {
    // Aggregator always uses SSE for CLI access, stdio is used internally for MCP connections
    const transport = "sse";
    let port: number;

    if (options.port) {
      // Port explicitly provided, use it and save to config
      port = parseInt(options.port);
      saveAggregatorPort(port);
    } else {
      // No port provided, read from config or use default
      port = getAggregatorPort();
    }

    if (options.json) {
      jsonifyResponse(() => startAggregatorResponse(transport, port));
    } else {
      startMCPAggregatorServer(transport, port);
    }
  });

metaCommand
  .command("stop")
  .description("Stops the Meta MCP Aggregator server")
  .option("-j, --json", "JSON output")
  .action(async (options) => {
    if (options.json) {
      jsonifyResponse(() => stopAggregatorResponse());
    } else {
      await stopMCPAggregatorServer();
    }
  });

metaCommand
  .command("restart")
  .description("Restarts the Meta MCP Aggregator server")
  .option("-j, --json", "JSON output")
  .action(async (options) => {
    if (options.json) {
      jsonifyResponse(() => restartAggregatorResponse());
    } else {
      await restartMCPAggregatorServer();
    }
  });

metaCommand
  .command("status")
  .description("Shows the status of the Meta MCP Aggregator server")
  .option("-l, --lines <lines>", "Number of log lines to show", "15")
  .option("-j, --json", "JSON output")
  .action(async (options) => {
    const lines = parseInt(options.lines, 10);
    if (options.json) {
      jsonifyResponse(() => statusAggregatorResponse(lines));
    } else {
      await aggregatorStatus(lines);
    }
  });

program.addCommand(httpCommand);
program.addCommand(metaCommand);

program
  .command("connect")
  .description(
    "Start aggregator server in stdio mode for direct MCP client connections"
  )
  .action(async () => {
    await connectMCPAggregatorServer();
  });

program
  .command("upgrade")
  .description("Upgrade Furikake to the latest version")
  .action(async () => {
    await upgradeFuri();
  });

// Only run CLI parsing when this file is executed directly, not when imported
if (import.meta.main) {
  // Set a default action if no command is specified
  if (process.argv.length <= 2) {
    process.argv.push("--help");
  }

  program.parse(process.argv);
}
