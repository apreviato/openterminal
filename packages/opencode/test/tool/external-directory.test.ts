import { describe, expect, test } from "bun:test"
import path from "path"
import type { Tool } from "../../src/tool/tool"
import { Instance } from "../../src/project/instance"
import { assertExternalDirectory } from "../../src/tool/external-directory"
import type { PermissionNext } from "../../src/permission/next"

const baseCtx: Omit<Tool.Context, "ask"> = {
  sessionID: "test",
  messageID: "",
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => {},
}

describe("tool.assertExternalDirectory", () => {
  test("no-ops for empty target", async () => {
    const requests: Array<Omit<PermissionNext.Request, "id" | "sessionID" | "tool">> = []
    const ctx: Tool.Context = {
      ...baseCtx,
      ask: async (req) => {
        requests.push(req)
      },
    }

    await Instance.provide({
      directory: "/tmp",
      fn: async () => {
        await assertExternalDirectory(ctx)
      },
    })

    expect(requests.length).toBe(0)
  })

  test("no-ops for paths inside Instance.directory", async () => {
    const requests: Array<Omit<PermissionNext.Request, "id" | "sessionID" | "tool">> = []
    const ctx: Tool.Context = {
      ...baseCtx,
      ask: async (req) => {
        requests.push(req)
      },
    }

    await Instance.provide({
      directory: "/tmp/project",
      fn: async () => {
        await assertExternalDirectory(ctx, path.join("/tmp/project", "file.txt"))
      },
    })

    expect(requests.length).toBe(0)
  })

  test("asks with a single canonical glob", async () => {
    const requests: Array<Omit<PermissionNext.Request, "id" | "sessionID" | "tool">> = []
    const ctx: Tool.Context = {
      ...baseCtx,
      ask: async (req) => {
        requests.push(req)
      },
    }

    const directory = "/tmp/project"
    const target = "/tmp/outside/file.txt"
    const expected = path.join(path.dirname(target), "*").replaceAll("\\", "/")

    await Instance.provide({
      directory,
      fn: async () => {
        await assertExternalDirectory(ctx, target)
      },
    })

    const req = requests.find((r) => r.permission === "external_directory")
    expect(req).toBeDefined()
    expect(req!.patterns).toEqual([expected])
    expect(req!.always).toEqual([expected])
  })

  test("uses target directory when kind=directory", async () => {
    const requests: Array<Omit<PermissionNext.Request, "id" | "sessionID" | "tool">> = []
    const ctx: Tool.Context = {
      ...baseCtx,
      ask: async (req) => {
        requests.push(req)
      },
    }

    const directory = "/tmp/project"
    const target = "/tmp/outside"
    const expected = path.join(target, "*").replaceAll("\\", "/")

    await Instance.provide({
      directory,
      fn: async () => {
        await assertExternalDirectory(ctx, target, { kind: "directory" })
      },
    })

    const req = requests.find((r) => r.permission === "external_directory")
    expect(req).toBeDefined()
    expect(req!.patterns).toEqual([expected])
    expect(req!.always).toEqual([expected])
  })

  test("skips prompting when bypass=true", async () => {
    const requests: Array<Omit<PermissionNext.Request, "id" | "sessionID" | "tool">> = []
    const ctx: Tool.Context = {
      ...baseCtx,
      ask: async (req) => {
        requests.push(req)
      },
    }

    await Instance.provide({
      directory: "/tmp/project",
      fn: async () => {
        await assertExternalDirectory(ctx, "/tmp/outside/file.txt", { bypass: true })
      },
    })

    expect(requests.length).toBe(0)
  })

  test("blocks access to protected system directories", async () => {
    const requests: Array<Omit<PermissionNext.Request, "id" | "sessionID" | "tool">> = []
    const ctx: Tool.Context = {
      ...baseCtx,
      ask: async (req) => {
        requests.push(req)
      },
    }

    const target =
      process.platform === "win32"
        ? path.join(
            process.env.SystemRoot ?? process.env.windir ?? "C:\\Windows",
            "System32",
            "drivers",
            "etc",
            "hosts",
          )
        : process.platform === "darwin"
          ? "/System/Library/CoreServices/SystemVersion.plist"
          : "/etc/hosts"

    await Instance.provide({
      directory: "/tmp/project",
      fn: async () => {
        await expect(assertExternalDirectory(ctx, target)).rejects.toThrow("Access to system directories is blocked")
      },
    })

    expect(requests.length).toBe(0)
  })
})
