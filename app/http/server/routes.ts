#!/usr/bin/env bun
// This file is managed by PM2

const PORT = parseInt(process.env.PORT || "9339");

console.log(`Starting Furi HTTP API server on port ${PORT}...`);

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
