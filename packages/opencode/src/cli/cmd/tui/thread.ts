import { cmd } from "@/cli/cmd/cmd"
import { tui } from "./app"
import { Rpc } from "@/util/rpc"
import { type rpc } from "./worker"
import path from "path"
import { fileURLToPath } from "url"
import { UI } from "@/cli/ui"
import { iife } from "@/util/iife"
import { Log } from "@/util/log"
import { withNetworkOptions, resolveNetworkOptions } from "@/cli/network"
import { Filesystem } from "@/util/filesystem"
import type { Event } from "@opencode-ai/sdk/v2"
import type { EventSource } from "./context/sdk"
import { win32DisableProcessedInput, win32InstallCtrlCGuard } from "./win32"
import { TuiConfig } from "@/config/tui"
import { Instance } from "@/project/instance"
import { stdinText } from "@/util/compat"

declare global {
  const OPENCODE_WORKER_PATH: string
}

type RpcClient = ReturnType<typeof Rpc.client<typeof rpc>>

function createWorkerFetch(client: RpcClient): typeof fetch {
  const fn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init)
    const body = request.body ? await request.text() : undefined
    const result = await client.call("fetch", {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
    })
    return new Response(result.body, {
      status: result.status,
      headers: result.headers,
    })
  }
  return fn as typeof fetch
}

function createEventSource(client: RpcClient): EventSource {
  return {
    on: (handler) => client.on<Event>("event", handler),
  }
}

export const TuiThreadCommand = cmd({
  command: "$0 [project]",
  describe: "start openterminal tui",
  builder: (yargs) =>
    withNetworkOptions(yargs)
      .positional("project", {
        type: "string",
        describe: "path to start openterminal in",
      })
      .option("model", {
        type: "string",
        alias: ["m"],
        describe: "model to use in the format of provider/model",
      })
      .option("continue", {
        alias: ["c"],
        describe: "continue the last session",
        type: "boolean",
      })
      .option("session", {
        alias: ["s"],
        type: "string",
        describe: "session id to continue",
      })
      .option("fork", {
        type: "boolean",
        describe: "fork the session when continuing (use with --continue or --session)",
      })
      .option("prompt", {
        type: "string",
        describe: "prompt to use",
      })
      .option("agent", {
        type: "string",
        describe: "agent to use",
      }),
  handler: async (args) => {
    // Keep ENABLE_PROCESSED_INPUT cleared even if other code flips it.
    // (Important when running under `bun run` wrappers on Windows.)
    const unguard = win32InstallCtrlCGuard()
    try {
      // Must be the very first thing — disables CTRL_C_EVENT before any Worker
      // spawn or async work so the OS cannot kill the process group.
      win32DisableProcessedInput()

      if (args.fork && !args.continue && !args.session) {
        UI.error("--fork requires --continue or --session")
        process.exitCode = 1
        return
      }

      // Resolve relative --project paths from the real PWD, then canonicalize
      // after chdir so the thread and worker share the same directory key.
      const root = path.resolve(process.env.OPENTERMINAL_CWD ?? process.env.PWD ?? process.cwd())
      const next = args.project
        ? path.resolve(path.isAbsolute(args.project) ? args.project : path.join(root, args.project))
        : path.resolve(process.cwd())

      const localWorker = new URL("./worker.ts", import.meta.url)
      const distWorker = new URL("./cli/cmd/tui/worker.js", import.meta.url)
      const workerPath = await iife(async () => {
        if (typeof OPENCODE_WORKER_PATH !== "undefined") return OPENCODE_WORKER_PATH
        if (await Filesystem.exists(fileURLToPath(distWorker))) return distWorker
        return localWorker
      })
      try {
        process.chdir(next)
      } catch (e) {
        UI.error("Failed to change directory to " + next)
        return
      }
      const cwd = path.resolve(process.cwd())

      const worker = new Worker(workerPath, {
        env: Object.fromEntries(
          Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
        ),
      })
      worker.onerror = (e) => {
        Log.Default.error(e)
      }
      const client = Rpc.client<typeof rpc>(worker)
      const onError = (e: unknown) => Log.Default.error(e)
      const onReload = () => {
        client.call("reload", undefined).catch((err) => {
          Log.Default.warn("worker reload failed", {
            error: err instanceof Error ? err.message : String(err),
          })
        })
      }
      process.on("uncaughtException", onError)
      process.on("unhandledRejection", onError)
      process.on("SIGUSR2", onReload)

      let stopped = false
      const stop = async () => {
        if (stopped) return
        stopped = true
        process.off("uncaughtException", onError)
        process.off("unhandledRejection", onError)
        process.off("SIGUSR2", onReload)
        await client.call("shutdown", undefined).catch((err) => {
          Log.Default.warn("worker shutdown failed", {
            error: err instanceof Error ? err.message : String(err),
          })
        })
        worker.terminate()
      }

      const prompt = await iife(async () => {
        const piped = !process.stdin.isTTY ? await stdinText() : undefined
        if (!args.prompt) return piped
        return piped ? piped + "\n" + args.prompt : args.prompt
      })
      const config = await Instance.provide({
        directory: cwd,
        fn: () => TuiConfig.get(),
      })

      // Check if server should be started (port or hostname explicitly set in CLI or config)
      const networkOpts = await resolveNetworkOptions(args)
      const shouldStartServer =
        process.argv.includes("--port") ||
        process.argv.includes("--hostname") ||
        process.argv.includes("--mdns") ||
        networkOpts.mdns ||
        networkOpts.port !== 0 ||
        networkOpts.hostname !== "127.0.0.1"

      let url: string
      let customFetch: typeof fetch | undefined
      let events: EventSource | undefined

      if (shouldStartServer) {
        // Start HTTP server for external access
        const server = await client.call("server", networkOpts)
        url = server.url
      } else {
        // Use direct RPC communication (no HTTP)
        url = "http://openterminal.internal"
        customFetch = createWorkerFetch(client)
        events = createEventSource(client)
      }

      setTimeout(() => {
        client.call("checkUpgrade", { directory: cwd }).catch(() => {})
      }, 1000)

      try {
        await tui({
          url,
          config,
          directory: cwd,
          fetch: customFetch,
          events,
          args: {
            continue: args.continue,
            sessionID: args.session,
            agent: args.agent,
            model: args.model,
            prompt,
            fork: args.fork,
          },
        })
      } finally {
        await stop()
      }
    } finally {
      unguard?.()
    }
    process.exit(0)
  },
})
