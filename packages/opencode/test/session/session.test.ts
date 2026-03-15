import { describe, expect, test } from "bun:test"
import path from "path"
import { Session } from "../../src/session"
import { Bus } from "../../src/bus"
import { Log } from "../../src/util/log"
import { Instance } from "../../src/project/instance"
import { Identifier } from "../../src/id/id"

const projectRoot = path.join(__dirname, "../..")
Log.init({ print: false })

describe("session.started event", () => {
  test("should emit session.started event when session is created", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        let eventReceived = false
        let receivedInfo: Session.Info | undefined

        const unsub = Bus.subscribe(Session.Event.Created, (event) => {
          eventReceived = true
          receivedInfo = event.properties.info as Session.Info
        })

        const session = await Session.create({})

        await new Promise((resolve) => setTimeout(resolve, 100))

        unsub()

        expect(eventReceived).toBe(true)
        expect(receivedInfo).toBeDefined()
        expect(receivedInfo?.id).toBe(session.id)
        expect(receivedInfo?.projectID).toBe(session.projectID)
        expect(receivedInfo?.directory).toBe(session.directory)
        expect(receivedInfo?.title).toBe(session.title)

        await Session.remove(session.id)
      },
    })
  })

  test("session.started event should be emitted before session.updated", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const events: string[] = []

        const unsubStarted = Bus.subscribe(Session.Event.Created, () => {
          events.push("started")
        })

        const unsubUpdated = Bus.subscribe(Session.Event.Updated, () => {
          events.push("updated")
        })

        const session = await Session.create({})

        await new Promise((resolve) => setTimeout(resolve, 100))

        unsubStarted()
        unsubUpdated()

        expect(events).toContain("started")
        expect(events).toContain("updated")
        expect(events.indexOf("started")).toBeLessThan(events.indexOf("updated"))

        await Session.remove(session.id)
      },
    })
  })
})

describe("session.messagesPage", () => {
  test("paginates messages with cursor", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})
        const created = [1000, 2000, 3000]

        for (const time of created) {
          await Session.updateMessage({
            id: Identifier.ascending("message"),
            role: "user",
            sessionID: session.id,
            agent: "default",
            model: {
              providerID: "openai",
              modelID: "gpt-4",
            },
            time: { created: time },
          })
        }

        const first = await Session.messagesPage({
          sessionID: session.id,
          limit: 2,
        })

        expect(first.items.map((item) => item.info.time.created)).toEqual([2000, 3000])
        expect(first.nextCursor).toBe(2000)

        const second = await Session.messagesPage({
          sessionID: session.id,
          limit: 2,
          cursor: first.nextCursor,
        })

        expect(second.items.map((item) => item.info.time.created)).toEqual([1000])
        expect(second.nextCursor).toBeUndefined()

        await Session.remove(session.id)
      },
    })
  })
})
