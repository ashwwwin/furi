# 🍃 Furikake (or furi) (WIP)

Furikake is an easy to use, local CLI & API for MCP management.

- Download MCPs [from GitHub]
- Fully featured CLI (with pretty loading)
- HTTP API Routes (stdio to http)
- Process state management [with PM2]
- Logs for each process
- Built with Bun and Typescript
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

### Start an MCP

```bash
furi start <author/repo>
```

_You can alias the <author/repo> in the configuration.json_

### Stop an MCP

```bash
furi stop <author/repo>
```

### Restart an MCP

```bash
furi restart <author/repo>
```

### Check the status of an MCP

```bash
furi status <author/repo>
```

### List all running MCPs

```bash
furi status all
```

### Using the HTTP API

Any MCP that is running, will automatically have an http route.
Turning an MCP on/off can only be done via the cli.
To access your MCP's via http, you can turn on the route via:

```bash
furi http on
```

To turn off the route, you can use:

```bash
furi http off
```

#### Routes

<(mcp-name)> == <(author/repo)|(alias)>

- /api/<(mcp-name)>/status
- /api/<(mcp-name)>/restart
- /api/<(mcp-name)>/logs
- /api/<(mcp-name)>/call

curl http://localhost:3000/api/status

```

## Closing notes

If you've made it this far in the documentation, I hope you find Furikake useful and time saving. I built this for fun, and a way for me to work MCP's easily. If you wish to contribute, feel free.

If you think this is a good idea, please star the repo! If you think this is a bad idea, please star the repo and leave a comment.
```
