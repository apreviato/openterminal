# openterminal

[![Based on opencode](https://img.shields.io/badge/based%20on-opencode-blue?style=flat-square)](https://github.com/sst/opencode)
[![Runtime: Bun](https://img.shields.io/badge/runtime-bun-f9f1e1?style=flat-square&logo=bun)](https://bun.sh)
[![Ollama focused](https://img.shields.io/badge/optimized%20for-Ollama-green?style=flat-square)](https://ollama.com)
[![License: MIT](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)](./LICENSE)

A local-first fork of [opencode](https://github.com/sst/opencode) — optimized for [Ollama](https://ollama.com), but fully compatible with external providers (Anthropic, OpenAI, Google, etc.).

---

## Inherited from opencode

openterminal is a direct fork of [opencode](https://github.com/sst/opencode). The core engine, configuration system, agents, skills, MCP servers, permissions, LSP, and worktree support all work **exactly the same way**. The [official opencode documentation](https://opencode.ai/docs) applies in full — just substitute directory names from `opencode` to `openterminal` where applicable (see [Path differences](#path-differences) below).

**All AI providers are fully supported** — Anthropic, OpenAI, Google, Ollama, and any other provider compatible with the [Vercel AI SDK](https://sdk.vercel.ai/providers/ai-sdk-providers). OpenTerminal is simply optimized for local-first workflows with Ollama.

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

| Purpose                | opencode                   | openterminal                   |
| ---------------------- | -------------------------- | ------------------------------ |
| Global config dir      | `~/.config/opencode/`      | `~/.config/openterminal/`      |
| Per-project config dir | `.opencode/`               | `.openterminal/`               |
| Data / database        | `~/.local/share/opencode/` | `~/.local/share/openterminal/` |
| Windows config         | `%APPDATA%\opencode\`      | `%APPDATA%\openterminal\`      |

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
        "baseURL": "http://localhost:11434/v1",
      },
    },
  },
  "model": "ollama/llama3.1:8b",
}
```

### Example: using external providers (Anthropic, OpenAI, etc.)

OpenTerminal is **fully compatible** with all AI providers supported by opencode. Simply configure them in your `opencode.json`:

```jsonc
// ~/.config/openterminal/opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "anthropic": {
      "npm": "@ai-sdk/anthropic",
      "name": "Anthropic",
      "apiKey": "sk-ant-...",
    },
    "openai": {
      "npm": "@ai-sdk/openai",
      "name": "OpenAI",
      "apiKey": "sk-...",
    },
  },
  "model": "anthropic/claude-sonnet-4",
}
```

Reference: [opencode.ai/docs/config](https://opencode.ai/docs/config)

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
    "modelID": "llama3.1:8b",
  },
  "permission": {
    "bash": "ask",
    "write_file": "allow",
  },
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
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
    },
  },
}
```

Reference: [opencode.ai/docs/mcp](https://opencode.ai/docs/mcp)

---

## Cronjobs

openterminal includes a built-in scheduler that lets you run AI agent tasks on a recurring schedule — without any external tooling beyond the OS scheduler (crontab on Linux/macOS, Task Scheduler on Windows).

### TUI — `/cronjobs`

Type `/cronjobs` in the command palette to open the management screen:

```
Cronjobs   scheduled AI tasks

  name                    schedule            agent            status
● daily-standup           0 9 * * 1-5         build            active
○ weekly-report           0 9 * * 1           (default)        inactive

c create   t toggle   d delete   ↑↓ navigate   esc back
```

**Keybinds:**

| Key       | Action                                  |
| --------- | --------------------------------------- |
| `c`       | Create a new cronjob (guided wizard)    |
| `t`       | Toggle active/inactive for selected job |
| `d`       | Delete selected job                     |
| `↑` / `↓` | Navigate the list                       |
| `Esc`     | Return to home                          |

The creation wizard walks you through: **name → schedule → agent → prompt**.

### CLI

```bash
# Interactive wizard (same steps as TUI)
openterminal cronjob create

# Non-interactive (scriptable)
openterminal cronjob create \
  --name daily-standup \
  --cron "0 9 * * 1-5" \
  --agent build \
  --prompt "Check git log for today's commits and write a standup summary."

# List all jobs
openterminal cronjob list

# Enable / disable
openterminal cronjob enable  daily-standup
openterminal cronjob disable daily-standup

# Delete
openterminal cronjob delete daily-standup

# Run manually (also called by the OS scheduler)
openterminal cronjob run daily-standup
```

### Job file format

Each cronjob is stored as a plain text file in `~/.config/openterminal/cronjob/<name>.md`:

```
daily-standup
0 9 * * 1-5
active
build
Check git log for today's commits and write a standup summary.
```

Lines: `name`, `cron expression`, `active|inactive`, `agent` (empty = default), then the prompt.

### Execution logs

Every run writes a structured entry to `~/.config/openterminal/cronjob/logs.txt`:

```
────────────────────────────────────────────────────────────
[2024-01-15 09:00:01]  START  daily-standup
  cron    : 0 9 * * 1-5
  agent   : build
  session : sess_abc123
  prompt  : Check git log for today's commits and write a standup.

  [tool:bash]  (1.2s)  {"command":"git log --oneline --since=yesterday"}
    → abc1234 feat: add new feature
      def5678 fix: resolve auth bug
  [text]  Here's today's standup summary:
          - Added new feature (abc1234)
          - Fixed auth bug (def5678)

[2024-01-15 09:00:05]  DONE  daily-standup  (4.2s)
────────────────────────────────────────────────────────────
```

The log path is printed after each run. Errors are flagged inline and also appear in the footer:

```
[2024-01-15 09:00:02]  ERROR  model not found
[2024-01-15 09:00:02]  FAIL   daily-standup  (0.8s)
```

### OS scheduling

When a job is created or enabled, openterminal registers it with the OS scheduler automatically:

- **Linux / macOS** — adds an entry to the user's crontab
- **Windows** — creates a Task Scheduler task via `schtasks`

When disabled or deleted, the OS entry is removed. The binary called by the scheduler is `~/.openterminal/bin/openterminal` (or override with `OPENTERMINAL_BIN`).

**Supported cron patterns on Windows** (Task Scheduler has a limited expression set):

| Pattern       | Meaning                   |
| ------------- | ------------------------- |
| `* * * * *`   | Every minute              |
| `*/N * * * *` | Every N minutes           |
| `M H * * *`   | Daily at HH:MM            |
| `M H * * D`   | Weekly on day D at HH:MM  |
| `M H D * *`   | Monthly on day D at HH:MM |

Complex expressions (ranges, lists, step values beyond `*/N`) are not supported on Windows — use a simpler preset or configure `schtasks` manually.

---

## Configurations

Type `/configurations` in the command palette to open the settings screen — a TUI interface that lets you view and edit every option that upstream opencode exposes only through environment variables or manual JSON editing.

```
Configuration   manage OpenTerminal settings
Showing 32 of 32 settings

  setting                  category      value          description
▸ Username                 General       (not set)      Custom username to display in conversations
  Log Level                General       (not set)      Logging verbosity (debug, info, warn, error)
  Default Model            Model         ollama/llama…  Default model to use (provider/model format)
  Small Model              Model         (not set)      Small model for tasks like title generation
  Auto Compaction          Compaction    enabled        Enable automatic compaction when context is full
  Compaction Threshold     Compaction    0.8            Context usage fraction to trigger compaction
  Bash Permission          Permissions   ask            Permission for shell commands (ask, allow, deny)
  Batch Tool               Experimental  disabled       Enable the experimental batch tool
  ...

e edit   r reset   f filter   ↑↓ navigate   esc back
```

**Keybinds:**

| Key       | Action                                             |
| --------- | -------------------------------------------------- |
| `e` / `↵` | Edit the selected setting (opens an inline dialog) |
| `r`       | Reset the selected setting to its default value    |
| `f`       | Cycle through category filters                     |
| `↑` / `↓` | Navigate the list (`k`/`j` also work)              |
| `Esc`     | Clear active filter, or return to home             |

**Categories covered:**

| Category     | Settings                                                                       |
| ------------ | ------------------------------------------------------------------------------ |
| General      | Username, Log Level, Share Mode, Auto Update, Snapshots                        |
| Model        | Default Model, Small Model                                                     |
| Agent        | Default Agent                                                                  |
| Server       | Port, Hostname, mDNS, mDNS Domain                                              |
| Permissions  | read, edit, bash, glob, grep, webfetch, task, question, todowrite, cronjob\_\* |
| Compaction   | Auto, Prune, Threshold, Reserved Tokens, Prune Minimum, Prune Protection       |
| Experimental | Batch Tool, Disable Paste Summary, Continue on Deny, EXA Search, MCP Timeout   |
| Enterprise   | Enterprise URL                                                                 |

Changes are written immediately to the global `opencode.json` via the SDK config API. Boolean settings use a select dialog (Enabled / Disabled); strings and numbers use an inline text prompt with validation. Pressing `r` removes the key from the config file, restoring the upstream default.

---

## Differences from upstream opencode

| Aspect                 | opencode                        | openterminal                                                            |
| ---------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| AI providers           | Anthropic, OpenAI, Google, etc. | **All providers supported** — optimized for Ollama                      |
| Model discovery        | Fetches from models.dev         | Disabled — configure models manually in `opencode.json`                 |
| Installation           | npm / brew / curl installer     | Local scripts (`install` / `install.ps1`)                               |
| Upgrade command        | Built-in auto-upgrade           | Disabled — use `git pull`                                               |
| Data directory         | `~/.local/share/opencode/`      | `~/.local/share/openterminal/`                                          |
| Config directory       | `~/.config/opencode/`           | `~/.config/openterminal/`                                               |
| Database               | `opencode.db`                   | `openterminal.db`                                                       |
| Internal RPC hostname  | `opencode.internal`             | `openterminal.internal`                                                 |
| Cronjobs               | Not available                   | Built-in (`/cronjobs`, `openterminal cronjob`)                          |
| Settings UI            | Edit JSON / env vars manually   | `/configurations` TUI screen — edit all settings interactively          |
| Markdown tables in TUI | May have alignment issues       | Fixed with @opentui v0.1.86 + `drawUnstyledText=true`                   |
| Bun-specific APIs      | Used extensively                | Partially migrated to Node.js equivalents for portability               |
| Build tooling          | Turborepo, npm scripts          | Native Bun scripts (`scripts/build-all.ts`, `scripts/typecheck-all.ts`) |
| Cloud dependencies     | SST, Pulumi, Nix                | Removed — local-only focus                                              |

Everything else — TUI, LSP, MCP, agents, skills, permissions, worktrees, session history — works identically to opencode.

---

## Recent improvements

### Markdown table rendering (fixed)

Early versions had alignment issues with markdown tables in the TUI. This has been resolved by:

- Upgrading `@opentui` from v0.1.81 → v0.1.86
- Setting `drawUnstyledText={true}` in the markdown renderer

Tables now render with proper column alignment. See [TABELAS-TUI.md](./TABELAS-TUI.md) for technical details.

### Node.js API migration (in progress)

OpenTerminal is gradually migrating from Bun-specific APIs to Node.js equivalents for better portability:

**Completed:**

- `Bun.sleep()` → `setTimeout` (timers/promises)
- `Bun.hash()` → `crypto.createHash()`
- `Bun.hash.xxHash32()` → `crypto.createHash('md5')`

**Remaining:** `Bun.stdin.text()`, `Bun.which()`, `Bun.write()`, `Bun.stderr.write()`, `Bun.stringWidth()`, `Bun.serve()`

See [util/compat.ts](./packages/opencode/src/util/compat.ts) for compatibility shims.

### Build tooling

Replaced Turborepo with native Bun scripts:

- `bun run typecheck` — type-check all packages
- `bun run build` — build all packages

Scripts are located in `scripts/typecheck-all.ts` and `scripts/build-all.ts`.

### Upstream sync

OpenTerminal periodically cherry-picks fixes and improvements from upstream [opencode](https://github.com/sst/opencode), skipping changes that target web, desktop, SDK, or cloud-only features.

**Sync coverage — v1.2.16 → v1.2.24**

| Version | Change                                                                  | File(s)                        | Status                                             |
| ------- | ----------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------- |
| v1.2.24 | Copilot GPT-5.4 xhigh support via `release_date` check                  | `provider/transform.ts`        | ✅ applied                                        |
| v1.2.23 | Disable fallback to free nano model (`getSmallModel`)                   | `provider/provider.ts`         | ⏭ skipped — fork has a different provider layer   |
| v1.2.24 | GitLab 1 M context header                                               | `provider/provider.ts`         | ⏭ skipped — fork does not support GitLab provider |
| v1.2.19 | Codex GPT-5.4 allowed models (Copilot Responses API)                    | `provider/sdk/copilot/`        | ⏭ skipped — Copilot SDK not present in fork       |

---

## Development

```bash
# Run from source
bun run dev         # start the TUI directly from source

# Build & typecheck
bun run build       # build all packages (scripts/build-all.ts)
bun run typecheck   # type-check all packages (scripts/typecheck-all.ts)

# Database
bun db              # drizzle-kit studio (inspect DB)
```

The database is stored at `~/.local/share/openterminal/openterminal.db`.

### Project structure

```
openterminal/
├── packages/
│   ├── opencode/       # Main CLI (TUI, tools, session management)
│   ├── sdk/js/         # JavaScript SDK
│   ├── plugin/         # Plugin system
│   ├── util/           # Shared utilities
│   └── script/         # Build scripts
├── scripts/            # Development scripts
│   ├── typecheck-all.ts
│   └── build-all.ts
└── patches/            # npm patches (applied via pnpm)
```

---

## Contributing

When contributing to OpenTerminal, please ensure:

1. **Provider compatibility is maintained** — all AI providers (Anthropic, OpenAI, Google, Ollama, etc.) must continue to work
2. **Opencode documentation remains valid** — configuration format and behavior should match upstream where possible
3. **Local-first focus** — prioritize features that work offline or with local models
4. **No breaking changes** — existing configurations and workflows should continue to work

### Syncing with upstream

OpenTerminal periodically syncs improvements from upstream opencode. When merging upstream changes:

- Preserve local-only features (cronjobs, custom scripts)
- Skip desktop/web/SDK changes (not used in OpenTerminal)
- Test with both Ollama and external providers (Anthropic, OpenAI)

---

## Credits

openterminal is built on top of [opencode](https://github.com/sst/opencode) by [SST](https://sst.dev). All upstream architecture, tooling, and documentation credit belongs to the opencode team.
