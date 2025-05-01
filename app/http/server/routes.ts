#!/usr/bin/env bun

import { callResponse } from "./endpoints/[mcpName]/call";
import { removeResponse } from "./endpoints/[mcpName]/remove";
import { specificToolsResponse } from "./endpoints/[mcpName]/tools";
import { addResponse } from "./endpoints/add";
import { listResponse } from "./endpoints/list";
import { statusResponse } from "./endpoints/status";
import { toolsResponse } from "./endpoints/tools";
import { singleStatusResponse } from "./endpoints/[mcpName]/status";
import { stopResponse } from "./endpoints/[mcpName]/stop";
import { restartResponse } from "./endpoints/[mcpName]/restart";
import { startMCPResponse } from "./endpoints/[mcpName]/start";

const PORT = parseInt(process.env.PORT || "9339");

console.log(`Starting Furi HTTP API server on port ${PORT}...`);

// TODO: Improve error messages in the endpoints (MCP not found is vague) (All throughout the endpoints directory)

// If you want to expose the server to the public, set this to false
// This will allow anyone to start/stop and mcp.

const exposeSudoRoutes = process.env.EXPOSE_SUDO === "true";

console.log(`Admin routes ${exposeSudoRoutes ? "enabled" : "disabled"}`);

// These are the PUBLIC routes:
// /list (get a list of all online MCPs)
// /tools (get a list of all available tools from all online MCPs)
// /<mcpName>/call/<toolName> (post as a JSON body)
// /<mcpName>/tools (get a list of tools for an MCP)

// These are the SUDO routes:
// /add/<author>/<repo> (install a new MCP from a github repo)
// /<mcpName>/remove (delete an MCP by <mcpName>)
// /status (get the status of ALL MCPs)
// /<mcpName>/status?lines=<number> (get the status + logs of an MCP)
// /<mcpName>/stop (stop an MCP)
// /<mcpName>/restart (restart an MCP)

// /<mcpName>/start?env=JSON.stringify({}) (start an MCP)
// These are all JSON responses.

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      return new Response(`Furi API Server is running on port ${PORT}`);
    }

    // eg. /list
    // Returns a list of all installed MCPs (or only running if ?all=true is not set)
    if (url.pathname === "/list") {
      const showAll = url.searchParams.get("all") === "true";
      return listResponse(showAll);
    }

    // eg. /tools
    // Returns a list of all available tools from all online MCPs
    if (url.pathname == "/tools") {
      return toolsResponse();
    }

    // eg. /mcpName/tools
    // Returns a list of tools for an MCP
    if (url.pathname.endsWith("/tools")) {
      return specificToolsResponse(url.pathname);
    }

    // eg. /mcpName/call/toolName
    // Calls a tool on an MCP and returns the result
    if (url.pathname.includes("/call/")) {
      return callResponse(url.pathname, await req.json());
    }

    if (!exposeSudoRoutes) {
      return new Response("Not Found", { status: 404 });
    }

    ////////////////////////////////////////////////////////////////////////////
    // Pages after this point are only accessible if exposeSudoRoutes is true //
    ////////////////////////////////////////////////////////////////////////////

    // eg. /status
    // Returns a list of all MCPs with details(running and stopped)
    if (url.pathname === "/status") {
      return statusResponse();
    }

    // eg. /add/author/repo
    // Installs a new MCP from a github repo
    if (url.pathname.startsWith("/add/")) {
      return addResponse(url.pathname);
    }

    // eg. /mcpName/remove
    // Removes an MCP by name
    if (url.pathname.endsWith("/remove")) {
      return removeResponse(url.pathname);
    }

    // eg. /mcpName/status (?lines=10, get the status + logs of an MCP)
    // Returns status and logs for the MCP
    if (url.pathname.endsWith("/status")) {
      return singleStatusResponse(url.pathname, url);
    }

    // eg. /mcpName/stop
    // Stops an MCP by name
    if (url.pathname.endsWith("/stop")) {
      return stopResponse(url.pathname);
    }

    // eg. /mcpName/restart
    // Restarts an MCP by name
    if (url.pathname.endsWith("/restart")) {
      return restartResponse(url.pathname);
    }

    // eg. /mcpName/start
    // Starts an MCP by name
    if (url.pathname.endsWith("/start")) {
      return startMCPResponse(url.pathname, req);
    }

    return new Response(
      JSON.stringify({ success: false, message: "Not Found" })
    );
  },
});

console.log(`Furi HTTP API server is running at http://localhost:${PORT}`);
