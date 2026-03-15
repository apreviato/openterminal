import { describe, expect, test } from "bun:test"
import { enforceWindowsCRLF, hasMixedLineEndings, normalizeToCRLF, normalizeToLF } from "../../src/util/line-ending"

describe("util.line-ending", () => {
  test("normalizes mixed endings to LF", () => {
    const input = "a\r\nb\nc\rd"
    expect(normalizeToLF(input)).toBe("a\nb\nc\nd")
  })

  test("normalizes mixed endings to CRLF", () => {
    const input = "a\r\nb\nc\rd"
    expect(normalizeToCRLF(input)).toBe("a\r\nb\r\nc\r\nd")
  })

  test("detects mixed line endings", () => {
    expect(hasMixedLineEndings("a\r\nb\n")).toBe(true)
    expect(hasMixedLineEndings("a\nb\n")).toBe(false)
    expect(hasMixedLineEndings("a\r\nb\r\n")).toBe(false)
  })

  test("enforces CRLF only on windows when enabled", () => {
    expect(enforceWindowsCRLF({ content: "a\n", enabled: true, platform: "win32" })).toBe("a\r\n")
    expect(enforceWindowsCRLF({ content: "a\n", enabled: false, platform: "win32" })).toBe("a\n")
    expect(enforceWindowsCRLF({ content: "a\n", enabled: true, platform: "linux" })).toBe("a\n")
  })
})
