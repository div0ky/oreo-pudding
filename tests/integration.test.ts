import { test, expect, describe } from "bun:test";
import { AppleCredentials } from "../src/domain/calendar/value-objects/AppleCredentials";
import { DateRange } from "../src/domain/calendar/value-objects/DateRange";
import { EventDetails } from "../src/domain/calendar/value-objects/EventDetails";
import { CalendarPath } from "../src/domain/calendar/value-objects/CalendarPath";
import { CalendarEvent } from "../src/domain/calendar/CalendarEvent";
import { CalDavRepository } from "../src/infrastructure/calendar/repository/CalDavRepository";
import { ICalSerializationStrategy } from "../src/infrastructure/calendar/serialization/ICalSerializationStrategy";

// Discovered live calendar path for testing
const TEST_CALENDAR_PATH = "1720006229/calendars/home";

describe("Live CalDAV Repository Integration", () => {
  const appleId = process.env.APP_ID;
  const appSpecificPassword = process.env.APP_PASS;

  test("should create and delete a live calendar event via CalDAV", async () => {
    expect(appleId).toBeDefined();
    expect(appSpecificPassword).toBeDefined();

    const credentials = new AppleCredentials(appleId!, appSpecificPassword!);
    const repository = new CalDavRepository();
    const serializationStrategy = new ICalSerializationStrategy();

    // 1. Create a calendar event in the domain layer
    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    const dateRange = new DateRange(start, end);
    const details = new EventDetails("CalDAV Repository Integration Test", "Created by automated tests.");
    const event = CalendarEvent.create(dateRange, details);

    const payload = serializationStrategy.serialize(event);
    const path = new CalendarPath(TEST_CALENDAR_PATH);

    console.log(`[Test] Creating live event ${event.id.value} on ${TEST_CALENDAR_PATH}...`);

    // 2. Save using the repository (sends PUT to CalDAV)
    await repository.save(event, payload, credentials, path);
    console.log(`[Test] Event ${event.id.value} created successfully.`);

    // 3. Clean up: Delete the event via direct HTTP DELETE
    console.log(`[Test] Cleaning up live event ${event.id.value}...`);
    const cleanPath = TEST_CALENDAR_PATH.startsWith("/") ? TEST_CALENDAR_PATH : `/${TEST_CALENDAR_PATH}`;
    const url = `https://caldav.icloud.com${cleanPath}/${event.id.value}.ics`;

    const headers = new Headers();
    headers.set("Authorization", credentials.toBasicAuthHeader());
    headers.set("User-Agent", "Oreo-Pudding-CalDAV/1.0");

    const deleteResponse = await fetch(url, {
      method: "DELETE",
      headers
    });

    console.log(`[Test] Clean up response status: ${deleteResponse.status}`);
    expect(deleteResponse.status).toBeLessThan(300); // Should be 2xx (200 or 204 usually)
  });
});

describe("MCP Server JSON-RPC E2E Integration", () => {
  const appleId = process.env.APP_ID;
  const appSpecificPassword = process.env.APP_PASS;
  const bearerToken = process.env.BEARER_TOKEN;

  test("should run the MCP server, complete handshake, list tools, call tool, and validate authentication", async () => {
    expect(bearerToken).toBeDefined();

    // Spawn MCP server subprocess
    const proc = Bun.spawn(["bun", "run", "src/index.ts"], {
      stdout: "pipe",
      stdin: "pipe",
      stderr: "ignore" // Ignore out-of-band logger messages on stderr
    });

    const writer = proc.stdin;
    const reader = proc.stdout.getReader();
    let buffer = "";

    async function readLine(): Promise<string> {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          throw new Error("Stdout stream closed before reading a full JSON-RPC line");
        }
        buffer += new TextDecoder().decode(value);
        const newlineIndex = buffer.indexOf("\n");
        if (newlineIndex !== -1) {
          const line = buffer.substring(0, newlineIndex);
          buffer = buffer.substring(newlineIndex + 1);
          return line;
        }
      }
    }

    async function sendRequest(req: Record<string, any>): Promise<any> {
      const raw = JSON.stringify(req) + "\n";
      writer.write(raw);
      await writer.flush();
      const responseLine = await readLine();
      return JSON.parse(responseLine);
    }

    try {
      // 1. Send initialize request
      const initResponse = await sendRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0"
          }
        }
      });
      expect(initResponse.id).toBe(1);
      expect(initResponse.result).toBeDefined();
      expect(initResponse.result.protocolVersion).toBeDefined();

      // 2. Send initialized notification (no response expected)
      const rawNotification = JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized"
      }) + "\n";
      writer.write(rawNotification);
      await writer.flush();

      // 3. Send tools/list request
      const listResponse = await sendRequest({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list"
      });
      expect(listResponse.id).toBe(2);
      expect(listResponse.result).toBeDefined();
      expect(listResponse.result.tools).toBeDefined();
      
      const tools = listResponse.result.tools;
      const createEventTool = tools.find((t: any) => t.name === "create_calendar_event");
      expect(createEventTool).toBeDefined();
      expect(createEventTool.description).toContain("Creates an event");

      // 4. Call tool with invalid bearer token -> should return Validation Error / Unauthorized
      const badCallResponse = await sendRequest({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "create_calendar_event",
          arguments: {
            bearerToken: "invalid-bearer-token",
            appleId,
            appSpecificPassword,
            title: "Bad Auth Event",
            startDate: new Date(Date.now() + 60000).toISOString(),
            endDate: new Date(Date.now() + 120000).toISOString(),
            calendarPath: TEST_CALENDAR_PATH
          }
        }
      });
      expect(badCallResponse.id).toBe(3);
      expect(badCallResponse.result).toBeDefined();
      expect(badCallResponse.result.isError).toBe(true);
      expect(badCallResponse.result.content[0].text).toContain("Validation Error");

      // 5. Call tool with correct credentials and details -> should succeed
      const now = new Date();
      const startDate = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(); // 3 hours from now
      const endDate = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(); // 4 hours from now

      const goodCallResponse = await sendRequest({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "create_calendar_event",
          arguments: {
            bearerToken,
            appleId,
            appSpecificPassword,
            title: "E2E Test Event via JSON-RPC",
            description: "Created in E2E integration test block.",
            startDate,
            endDate,
            calendarPath: TEST_CALENDAR_PATH
          }
        }
      });

      expect(goodCallResponse.id).toBe(4);
      expect(goodCallResponse.result).toBeDefined();
      expect(goodCallResponse.result.isError).not.toBe(true);
      
      const successText = goodCallResponse.result.content[0].text;
      expect(successText).toContain("Event successfully created with Domain Event ID:");

      // Parse the created event ID from the response text
      const idMatch = successText.match(/Domain Event ID: ([a-f0-9-]{36})/);
      expect(idMatch).not.toBeNull();
      const createdEventId = idMatch[1];
      console.log(`[E2E] Event successfully created through MCP with ID: ${createdEventId}`);

      // 6. Clean up: Delete the created event from the live calendar
      console.log(`[E2E] Cleaning up E2E event ${createdEventId}...`);
      const credentials = new AppleCredentials(appleId!, appSpecificPassword!);
      const cleanPath = TEST_CALENDAR_PATH.startsWith("/") ? TEST_CALENDAR_PATH : `/${TEST_CALENDAR_PATH}`;
      const url = `https://caldav.icloud.com${cleanPath}/${createdEventId}.ics`;

      const headers = new Headers();
      headers.set("Authorization", credentials.toBasicAuthHeader());
      headers.set("User-Agent", "Oreo-Pudding-CalDAV/1.0");

      const deleteResponse = await fetch(url, {
        method: "DELETE",
        headers
      });

      console.log(`[E2E] Clean up response status: ${deleteResponse.status}`);
      expect(deleteResponse.status).toBeLessThan(300);

    } finally {
      // Force kill the subprocess to ensure no hanging processes
      proc.kill();
    }
  });
});

describe("MCP Server SSE E2E Integration", () => {
  test("should start up as HTTP server when PORT is provided and respond to SSE handshake", async () => {
    // Dynamic free port for testing
    const testPort = 55667;

    // Spawn server process with PORT env variable
    const proc = Bun.spawn(["bun", "run", "src/index.ts"], {
      env: {
        ...process.env,
        PORT: String(testPort)
      },
      stdout: "pipe",
      stderr: "pipe"
    });

    // Wait briefly for the server to spin up and bind to port
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const url = `http://localhost:${testPort}/`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "test-sse-client",
              version: "1.0.0"
            }
          }
        })
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/event-stream");

      // Verify we can read the response stream and get the initialize response
      const reader = response.body?.getReader();
      expect(reader).toBeDefined();

      const { value } = await reader!.read();
      const text = new TextDecoder().decode(value);
      
      expect(text).toContain("event: message");
      expect(text).toContain("protocolVersion");
      expect(text).toContain("result");
    } finally {
      proc.kill();
    }
  });
});

