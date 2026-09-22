import { test, expect, describe } from "bun:test";

describe("Streamable HTTP multi-session lifecycle", () => {
  test("every initialize mints an independent session on a warm instance", async () => {
    const testPort = 55669;

    const proc = Bun.spawn(["bun", "run", "src/index.ts"], {
      env: {
        ...process.env,
        BEARER_TOKEN: "test-token-123",
        PORT: String(testPort)
      },
      stdout: "pipe",
      stderr: "pipe"
    });

    await new Promise((resolve) => setTimeout(resolve, 750));

    try {
      const url = `http://localhost:${testPort}/mcp`;
      const baseHeaders = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "Authorization": "Bearer test-token-123"
      };

      async function initialize() {
        const res = await fetch(url, {
          method: "POST",
          headers: baseHeaders,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2024-11-05",
              capabilities: {},
              clientInfo: { name: "test-streamable-client", version: "1.0.0" }
            }
          })
        });
        const sessionId = res.headers.get("mcp-session-id");
        const body = await res.text();
        return { status: res.status, sessionId, body };
      }

      async function listTools(sessionId: string) {
        const res = await fetch(url, {
          method: "POST",
          headers: { ...baseHeaders, "mcp-session-id": sessionId },
          body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })
        });
        const body = await res.text();
        return { status: res.status, body };
      }

      // First initialize mints session A
      const first = await initialize();
      expect(first.status).toBe(200);
      expect(first.sessionId).toBeTruthy();
      expect(first.body).toContain("protocolVersion");

      // Second initialize on the warm instance must mint a distinct session B,
      // not 400 with "Server already initialized"
      const second = await initialize();
      expect(second.status).toBe(200);
      expect(second.sessionId).toBeTruthy();
      expect(second.sessionId).not.toBe(first.sessionId);

      const sessionA = first.sessionId!;
      const sessionB = second.sessionId!;

      // Complete the handshake on both sessions
      for (const sid of [sessionA, sessionB]) {
        const notif = await fetch(url, {
          method: "POST",
          headers: { ...baseHeaders, "mcp-session-id": sid },
          body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })
        });
        expect(notif.status).toBe(202);
        await notif.text();
      }

      // Both sessions independently serve tools/list
      const listA = await listTools(sessionA);
      expect(listA.status).toBe(200);
      expect(listA.body).toContain("create_calendar_event");

      const listB = await listTools(sessionB);
      expect(listB.status).toBe(200);
      expect(listB.body).toContain("create_calendar_event");

      // Non-initialize request without a session header is rejected
      const noSession = await fetch(url, {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list" })
      });
      expect(noSession.status).toBe(400);
      const noSessionBody = (await noSession.json()) as any;
      expect(noSessionBody.error.code).toBe(-32000);

      // Unknown session id is rejected
      const bogus = await fetch(url, {
        method: "POST",
        headers: { ...baseHeaders, "mcp-session-id": crypto.randomUUID() },
        body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/list" })
      });
      expect(bogus.status).toBe(404);
      const bogusBody = (await bogus.json()) as any;
      expect(bogusBody.error.code).toBe(-32001);

      // Terminating session A must not affect session B
      const del = await fetch(url, {
        method: "DELETE",
        headers: { ...baseHeaders, "mcp-session-id": sessionA }
      });
      expect(del.status).toBe(200);
      await del.text();

      const listAfterDelete = await fetch(url, {
        method: "POST",
        headers: { ...baseHeaders, "mcp-session-id": sessionA },
        body: JSON.stringify({ jsonrpc: "2.0", id: 5, method: "tools/list" })
      });
      expect(listAfterDelete.status).toBe(404);
      await listAfterDelete.text();

      const listBAlive = await listTools(sessionB);
      expect(listBAlive.status).toBe(200);
      expect(listBAlive.body).toContain("create_calendar_event");
    } finally {
      proc.kill();
    }
  });
});
