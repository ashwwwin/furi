#!/usr/bin/env bun
// This file is managed by PM2

const PORT = parseInt(process.env.PORT || "9339");

console.log(`Starting Furi HTTP API server on port ${PORT}...`);

// TODO: Sudo route visibility
// If you want to expose the server to the public, set this to false
// This will allow anyone to start/stop and mcp.

// These are the SUDO routes:
// /<author>/<repo>/add (install a new MCP from a github repo)
// /<mcpName>/remove (delete an MCP by <mcpName>)
// /<mcpName>/start (start an MCP)
// /<mcpName>/logs
//  /<mcpName>/stop (stop an MCP)
//  /<mcpName>/restart (restart an MCP)
//  /<mcpName>/status (get detailed status of an MCP)
//  /status (get the status of ALL MCPs)
//  /stop (stop the HTTP API server)
//  /restart (restart the HTTP API server)
// These are all JSON responses.

// These are the PUBLIC routes:
// /list (get a list of all online MCPs)
// /<mcpName>/call/<toolName> (post as a JSON body)
// /<mcpName>/tools (get a list of tools for an MCP)

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      return new Response(`Furi API Server is running on port ${PORT}`);
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Furi HTTP API server is running at http://localhost:${PORT}`);
