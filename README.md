# 🍃 Furikake (or furi) (WIP)

Furikake is an easy to use, local CLI & API for MCP management.

- Download MCPs [from GitHub]
- Process state management
- HTTP Routes
- Built with Bun and Typescript
- Logs for each MCP
- Fully featured CLI
- HTTP Routes
- is good with rice

Supports MCP's built with Typescript/Javascript;

## Installation (macOS/Linux)

```bash
curl -fsSL https://bun.sh/install | bash
```

## How to use

### Install a new MCP

Furikake works with any public github repo as follows:

```bash
furi add <author/repo>
```

_eg. furi add smithery-ai/mcp-fetch_

### Delete an MCP

```bash
furi delete <author/repo>
```

_eg. furi delete smithery-ai/mcp-fetch_

### List installed MCPs

Show all installed MCPs

```bash
furi list
```

## Closing notes

If you've made it this far in the documentation, I hope you find Furikake useful and time saving. I built this for fun, and a way for me to work MCP's easily. If you wish to contribute, feel free.
