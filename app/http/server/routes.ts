#!/usr/bin/env bun

import type { Server } from "bun";
import { callResponse } from "./endpoints/[mcpName]/call";
import { removeResponse } from "./endpoints/[mcpName]/remove";
import { singleToolsResponse } from "./endpoints/[mcpName]/tools";
import { addResponse } from "./endpoints/add";
import { listResponse } from "./endpoints/list";
import { statusResponse } from "./endpoints/status";
import { toolsResponse } from "./endpoints/tools";
import { singleStatusResponse } from "./endpoints/[mcpName]/status";
import { stopResponse } from "./endpoints/[mcpName]/stop";
import { restartResponse } from "./endpoints/[mcpName]/restart";
import { startMCPResponse } from "./endpoints/[mcpName]/start";
import { envResponse } from "./endpoints/[mcpName]/env";
import { httpStatusResponse } from "./endpoints/http/status";
import { renameMCPResponse } from "./endpoints/[mcpName]/rename";
import { whereResponse } from "./endpoints/where/where";

export function startHttpRoutes(
  port: number,
  exposeSudoRoutes: boolean = false
) {
  // TODO: Improve error messages in the endpoints (MCP not found is vague)
  // (All throughout the endpoints directory)

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
  // TODO: /<mcpName>/env (get the environment variables for an MCP)

  // /<mcpName>/start?env=JSON.stringify({}) (start an MCP)
  // These are all JSON responses.

  const server = Bun.serve({
    port: port,
    async fetch(req: Request, server: Server) {
      const url = new URL(req.url);

      if (
        process.env.HTTP_AUTH_TOKEN &&
        process.env.HTTP_AUTH_TOKEN !== req.headers.get("Authorization")
      ) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Unauthorized, please pass a valid Authorization header",
          }),
          {
            status: 401,
          }
        );
      }

      if (url.pathname === "/") {
        return new Response(`Furi API Server is running on port ${port}`);
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
        return singleToolsResponse(url.pathname);
      }

      // eg. /mcpName/call/toolName
      // Calls a tool on an MCP and returns the result
      if (url.pathname.includes("/call/")) {
        return callResponse(url.pathname, await req.json());
      }

      // eg. /isSudo
      // Returns true if the server is running in sudo mode
      if (url.pathname == "/isSudo") {
        return new Response(
          JSON.stringify({ success: true, isSudo: exposeSudoRoutes })
        );
      }

      if (!exposeSudoRoutes) {
        return new Response(
          JSON.stringify({ success: false, message: "Not Found" })
        );
      }

      ////////////////////////////////////////////////////////////////////////////
      // Pages after this point are only accessible if exposeSudoRoutes is true //
      ////////////////////////////////////////////////////////////////////////////

      // eg. /status
      // Returns a list of all MCPs with details (running and stopped)
      if (url.pathname === "/status") {
        return statusResponse();
      }

      if (url.pathname.endsWith("/rename")) {
        return renameMCPResponse(url.pathname, url);
      }

      // eg. /add/author/repo
      // Installs a new MCP from a github repo
      if (url.pathname.startsWith("/add/")) {
        // Set longer timeout for installs (60s)
        server.timeout(req, 60);

        return await addResponse(url.pathname);
      }

      // eg. /mcpName/remove
      // Removes an MCP by name
      if (url.pathname.endsWith("/remove")) {
        return removeResponse(url.pathname);
      }

      // eg. /mcpName/env
      // Returns the environment variables for an MCP
      if (url.pathname.endsWith("/env")) {
        return envResponse(url.pathname);
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

      // eg. /http/status
      // Returns the status of the HTTP server
      if (url.pathname.endsWith("/http/status")) {
        return httpStatusResponse(url);
      }

      // eg. /where
      // Returns the path to the .furikake directory
      if (url.pathname.endsWith("/where")) {
        return whereResponse();
      }

      return new Response(
        JSON.stringify({ success: false, message: "Not Found" })
      );
    },
  });

  return server;
}

// When run directly (not imported), start the server with environment variables
if (import.meta.main) {
  const PORT = parseInt(process.env.PORT || "9339");
  const exposeSudoRoutes = process.env.EXPOSE_SUDO === "true";
  startHttpRoutes(PORT, exposeSudoRoutes);
}
