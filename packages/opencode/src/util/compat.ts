/**
 * Compatibility utilities for Bun-specific APIs
 * Provides Node.js-compatible alternatives where needed
 */

import { createHash } from "crypto"
import { setTimeout as setTimeoutPromise } from "timers/promises"
import { writeFile } from "fs/promises"
import { spawnSync } from "child_process"
import { createServer } from "http"
import type { IncomingMessage, ServerResponse } from "http"

/**
 * Sleep for a given number of milliseconds
 * Compatible replacement for Bun.sleep()
 */
export const sleep = setTimeoutPromise

/**
 * Hash a string using SHA1 (compatible replacement for Bun.hash)
 * Note: Bun.hash uses xxHash3-XXH64, but SHA1 is sufficient for most use cases
 */
export function hash(input: string | Buffer): string {
  return createHash("sha1").update(input).digest("hex")
}

/**
 * Fast 32-bit hash (compatible replacement for Bun.hash.xxHash32)
 * Uses a simple hash algorithm for cache keys
 */
export function xxHash32(input: string): number {
  const hash = createHash("md5").update(input).digest()
  // Take first 4 bytes as 32-bit integer
  return hash.readUInt32LE(0)
}

/**
 * Get string width (number of columns in terminal)
 * Compatible replacement for Bun.stringWidth()
 */
export function stringWidth(str: string): number {
  // Simple implementation - counts characters
  // For more accurate width calculation with unicode, use 'string-width' package
  let width = 0
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    // Full-width characters (CJK, etc.)
    if (
      (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
      (code >= 0x2e80 && code <= 0x9fff) || // CJK
      (code >= 0xac00 && code <= 0xd7a3) || // Hangul Syllables
      (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
      (code >= 0xfe10 && code <= 0xfe19) || // Vertical forms
      (code >= 0xfe30 && code <= 0xfe6f) || // CJK Compatibility Forms
      (code >= 0xff00 && code <= 0xff60) || // Fullwidth Forms
      (code >= 0xffe0 && code <= 0xffe6) || // Fullwidth Forms
      (code >= 0x20000 && code <= 0x2fffd) || // CJK Extension B-F
      (code >= 0x30000 && code <= 0x3fffd) // CJK Extension G
    ) {
      width += 2
    } else {
      width += 1
    }
  }
  return width
}

/**
 * ANSI color codes
 * Compatible replacement for Bun.color()
 */
export const colors = {
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  reset: "\x1b[0m",
} as const

export function color(name: keyof typeof colors, _format?: "ansi"): string {
  return colors[name] || ""
}

/**
 * Write data to a file
 * Compatible replacement for Bun.write()
 */
export async function write(path: string, data: string | Buffer | Uint8Array): Promise<void> {
  await writeFile(path, data)
}

/**
 * Read from stdin until EOF
 * Compatible replacement for Bun.stdin.text()
 */
export async function stdinText(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    process.stdin.on("data", (chunk) => chunks.push(chunk))
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
    process.stdin.on("error", reject)
  })
}

/**
 * Write to stderr
 * Compatible replacement for Bun.stderr.write()
 */
export function stderrWrite(data: string | Buffer | Uint8Array): void {
  process.stderr.write(data)
}

/**
 * Find executable in PATH
 * Compatible replacement for Bun.which()
 */
export function which(command: string, options?: { PATH?: string }): string | null {
  const cmd = process.platform === "win32" ? "where" : "which"
  const proc = spawnSync(cmd, [command], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    env: {
      ...process.env,
      ...(options?.PATH ? { PATH: options.PATH } : {}),
    },
  })

  if (proc.status !== 0) return null
  const output = proc.stdout?.trim()
  if (!output) return null
  return output.split(/\r?\n/)[0] ?? null
}

type ServeOptions = {
  hostname?: string
  port?: number
  fetch: (request: Request) => Response | Promise<Response>
  websocket?: unknown
}

async function readIncoming(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === "GET" || req.method === "HEAD") return undefined
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  if (chunks.length === 0) return undefined
  return Buffer.concat(chunks)
}

function writeOutgoing(res: ServerResponse, response: Response) {
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  response
    .arrayBuffer()
    .then((body) => {
      res.end(Buffer.from(body))
    })
    .catch(() => {
      res.statusCode = 500
      res.end("Internal Server Error")
    })
}

/**
 * Start an HTTP server
 * Bun-compatible API with Node.js fallback for fetch-only servers
 */
export function serve(options: ServeOptions): {
  hostname: string
  port: number
  url: URL
  stop: (closeActiveConnections?: boolean) => Promise<void>
} {
  if (globalThis.Bun?.serve) {
    return globalThis.Bun.serve(options as any) as any
  }

  if (options.websocket) {
    throw new Error("WebSocket server requires Bun runtime")
  }

  const hostname = options.hostname ?? "127.0.0.1"
  const port = options.port ?? 0
  const server = createServer(async (req, res) => {
    const host = req.headers.host ?? `${hostname}:${port}`
    const url = new URL(req.url ?? "/", `http://${host}`)
    const body = await readIncoming(req)
    const request = new Request(url, {
      method: req.method,
      headers: req.headers as HeadersInit,
      body: body ? new Uint8Array(body) : undefined,
    })
    const response = await options.fetch(request)
    writeOutgoing(res, response)
  })

  server.listen(port, hostname)
  const address = server.address()
  const actualPort = typeof address === "object" && address ? address.port : port

  return {
    hostname,
    port: actualPort,
    url: new URL(`http://${hostname}:${actualPort}`),
    stop: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    },
  }
}
