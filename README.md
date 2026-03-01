# openterminal

[![Based on opencode](https://img.shields.io/badge/based%20on-opencode-blue?style=flat-square)](https://github.com/sst/opencode)
[![Runtime: Bun](https://img.shields.io/badge/runtime-bun-f9f1e1?style=flat-square&logo=bun)](https://bun.sh)
[![Local only](https://img.shields.io/badge/provider-Ollama%20only-green?style=flat-square)](https://ollama.com)
[![License: MIT](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)](./LICENSE)

A local-only fork of [opencode](https://github.com/sst/opencode) — stripped of all cloud providers, configured exclusively for [Ollama](https://ollama.com).

---

## Inherited from opencode

openterminal is a direct fork of [opencode](https://github.com/sst/opencode). The core engine, configuration system, agents, skills, MCP servers, permissions, LSP, and worktree support all work **exactly the same way**. The [official opencode documentation](https://opencode.ai/docs) applies in full — just substitute directory names from `opencode` to `openterminal` where applicable (see [Path differences](#path-differences) below).

---

## Installation (local development)

### Linux / macOS / Git Bash (Windows)

```bash
bash install
```

Creates `~/.openterminal/bin/openterminal`. Add to `PATH`:

```bash
export PATH="$HOME/.openterminal/bin:$PATH"
```

### Windows (PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

Creates `~/.openterminal/bin/openterminal.cmd`, adds it to the Windows user `PATH` automatically, and writes a Git Bash shim (`openterminal` with no extension) if `~/.bashrc` is found.

---

## Configuration

### Config file

The config file is still named `opencode.json` (or `opencode.jsonc`) — same as the upstream project — to stay compatible with the official JSON schema and documentation.

### Path differences

When following the [opencode docs](https://opencode.ai/docs/config), replace directory names as follows:

| Purpose | opencode | openterminal |
|---|---|---|
| Global config dir | `~/.config/opencode/` | `~/.config/openterminal/` |
| Per-project config dir | `.opencode/` | `.openterminal/` |
| Data / database | `~/.local/share/opencode/` | `~/.local/share/openterminal/` |
| Windows config | `%APPDATA%\opencode\` | `%APPDATA%\openterminal\` |

The config file name (`opencode.json`) stays the same inside those directories.

### Example: global config with Ollama

```jsonc
// ~/.config/openterminal/opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama",
      "options": {
        "baseURL": "http://localhost:11434/v1"
      }
    }
  },
  "model": "ollama/llama3.1:8b"
}
```

---

## Agents

Agents are configured **exactly as in opencode**, but in `.openterminal/` directories instead of `.opencode/`.

Reference: [opencode.ai/docs/agents](https://opencode.ai/docs/agents)

### Directory layout

```
.openterminal/
  agent/
    agents.md          ← global agent instructions (markdown appended to system prompt)
    my-agent/
      agent.json       ← agent configuration
      AGENT.md         ← agent prompt / instructions
```

The same layout works in the global config directory:

```
~/.config/openterminal/
  agent/
    agents.md
    my-agent/
      agent.json
      AGENT.md
```

### Example `agent.json`

```jsonc
{
  "name": "my-agent",
  "description": "Focused on code review",
  "model": {
    "providerID": "ollama",
    "modelID": "llama3.1:8b"
  },
  "permission": {
    "bash": "ask",
    "write_file": "allow"
  }
}
```

---

## Skills

Skills follow the exact same layout as opencode — `SKILL.md` files inside named subdirectories.

Reference: [opencode.ai/docs/skills](https://opencode.ai/docs/skills)

```
.openterminal/
  skill/
    my-skill/
      SKILL.md
```

openterminal also scans `.claude/skills/` and `.agents/skills/` for compatibility with Claude Code and other agent frameworks.

---

## MCP (Model Context Protocol)

MCP server configuration is identical to opencode. Add servers under the `mcp` key in `opencode.json`:

```jsonc
{
  "mcp": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  }
}
```

Reference: [opencode.ai/docs/mcp](https://opencode.ai/docs/mcp)

---

## Differences from upstream opencode

| Aspect | opencode | openterminal |
|---|---|---|
| AI providers | Anthropic, OpenAI, Google, etc. | `@ai-sdk/openai-compatible` only (Ollama) |
| Model discovery | Fetches from models.dev | Disabled — configure models locally |
| Installation | npm / brew / curl installer | Local scripts (`install` / `install.ps1`) |
| Upgrade command | Built-in auto-upgrade | Disabled — use `git pull` |
| Web / PR / GitHub commands | Available | Removed |
| Data directory | `~/.local/share/opencode/` | `~/.local/share/openterminal/` |
| Config directory | `~/.config/opencode/` | `~/.config/openterminal/` |
| Project config dir | `.opencode/` | `.openterminal/` |
| Database | `opencode.db` | `openterminal.db` |
| Internal RPC hostname | `opencode.internal` | `openterminal.internal` |

Everything else — TUI, LSP, MCP, agents, skills, permissions, worktrees, session history — works identically to opencode.

---

## Development

```bash
bun run dev         # start the TUI directly from source
bun db              # drizzle-kit studio (inspect DB)
```

The database is stored at `~/.local/share/openterminal/openterminal.db`.

---

## Credits

openterminal is built on top of [opencode](https://github.com/sst/opencode) by [SST](https://sst.dev). All upstream architecture, tooling, and documentation credit belongs to the opencode team.
