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

      const listCalendarsTool = tools.find((t: any) => t.name === "list_calendars");
      expect(listCalendarsTool).toBeDefined();
      expect(listCalendarsTool.description).toContain("Lists all available calendars");

      // 4. Call tool with missing title parameter -> should return Validation Error
      const badCallResponse = await sendRequest({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "create_calendar_event",
          arguments: {
            appleId,
            appSpecificPassword,
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

      // 5. Call list_calendars tool
      const listCalendarsResponse = await sendRequest({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "list_calendars",
          arguments: {
            appleId,
            appSpecificPassword
          }
        }
      });
      console.log("listCalendarsResponse:", JSON.stringify(listCalendarsResponse, null, 2));
      expect(listCalendarsResponse.id).toBe(4);
      expect(listCalendarsResponse.result).toBeDefined();
      expect(listCalendarsResponse.result.isError).not.toBe(true);
      const calendarList = JSON.parse(listCalendarsResponse.result.content[0].text);
      expect(Array.isArray(calendarList)).toBe(true);
      expect(calendarList.length).toBeGreaterThan(0);
      expect(calendarList[0].path).toBeDefined();

      // 6. Call tool with correct credentials and details -> should succeed
      const now = new Date();
      const startDate = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(); // 3 hours from now
      const endDate = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(); // 4 hours from now

      const goodCallResponse = await sendRequest({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "create_calendar_event",
          arguments: {
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

      expect(goodCallResponse.id).toBe(5);
      expect(goodCallResponse.result).toBeDefined();
      expect(goodCallResponse.result.isError).not.toBe(true);
      
      const successText = goodCallResponse.result.content[0].text;
      expect(successText).toContain("Event successfully created with Domain Event ID:");

      // Parse the created event ID from the response text
      const idMatch = successText.match(/Domain Event ID: ([a-f0-9-]{36})/);
      expect(idMatch).not.toBeNull();
      const createdEventId = idMatch[1];
      console.log(`[E2E] Event successfully created through MCP with ID: ${createdEventId}`);

      // 7. Clean up: Delete the created event from the live calendar
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

      // 8. Call create_calendar_event without calendarPath (auto-discovery test)
      console.log("[E2E] Testing calendar path auto-discovery...");
      const discoverCallResponse = await sendRequest({
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "create_calendar_event",
          arguments: {
            appleId,
            appSpecificPassword,
            title: "E2E Auto-Discovered Calendar Event",
            description: "Created in E2E integration test block via auto-discovery.",
            startDate,
            endDate
          }
        }
      });
      console.log("discoverCallResponse:", JSON.stringify(discoverCallResponse, null, 2));
      expect(discoverCallResponse.id).toBe(6);
      expect(discoverCallResponse.result).toBeDefined();
      expect(discoverCallResponse.result.isError).not.toBe(true);
      const discoverSuccessText = discoverCallResponse.result.content[0].text;
      expect(discoverSuccessText).toContain("Event successfully created with Domain Event ID:");

      const discIdMatch = discoverSuccessText.match(/Domain Event ID: ([a-f0-9-]{36})/);
      expect(discIdMatch).not.toBeNull();
      const discEventId = discIdMatch[1];
      console.log(`[E2E] Auto-discovered event created successfully with ID: ${discEventId}`);

      // Clean up auto-discovered event using the same ranking heuristic
      const rankCal = (name: string, path: string): number => {
        const n = name.toLowerCase();
        const p = path.toLowerCase();
        if (n === "home" || p.includes("/home")) return 100;
        if (n === "personal" || p.includes("/personal")) return 90;
        if (n === "default" || p.includes("/default")) return 80;
        if (n === "ajs" || n.includes("ajs") || p.includes("ajs")) return 70;
        if (n.includes("calendar") || p.includes("calendar")) return 60;
        if (n.includes("reminder") || n.includes("todo") || n.includes("task")) return -10;
        return 0;
      };
      const sortedList = [...calendarList].sort((a, b) => rankCal(b.name, b.path) - rankCal(a.name, a.path));
      const defaultCalPath = sortedList[0].path;

      const cleanDiscPath = defaultCalPath.startsWith("/") ? defaultCalPath : `/${defaultCalPath}`;
      const discUrl = `https://caldav.icloud.com${cleanDiscPath}/${discEventId}.ics`;
      const discDeleteResponse = await fetch(discUrl, {
        method: "DELETE",
        headers
      });
      console.log(`[E2E] Auto-discovered event clean up response status: ${discDeleteResponse.status}`);
      expect(discDeleteResponse.status).toBeLessThan(300);

    } finally {
      // Force kill the subprocess to ensure no hanging processes
      proc.kill();
    }
  });
});

describe("MCP Server SSE E2E Integration", () => {
  test("should start up as HTTP server when PORT is provided and respond to SSE handshake with correct Authorization header", async () => {
    // Dynamic free port for testing
    const testPort = 55667;

    // Spawn server process with PORT and BEARER_TOKEN env variables
    const proc = Bun.spawn(["bun", "run", "src/index.ts"], {
      env: {
        ...process.env,
        BEARER_TOKEN: "test-token-123",
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
          "Accept": "application/json, text/event-stream",
          "Authorization": "Bearer test-token-123"
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

  test("should reject SSE handshake with 401 if Authorization header is invalid or missing", async () => {
    // Dynamic free port for testing
    const testPort = 55668;

    // Spawn server process with PORT and BEARER_TOKEN env variables
    const proc = Bun.spawn(["bun", "run", "src/index.ts"], {
      env: {
        ...process.env,
        BEARER_TOKEN: "test-token-123",
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
          "Accept": "application/json, text/event-stream",
          "Authorization": "Bearer wrong-token"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05"
          }
        })
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain("Unauthorized");
    } finally {
      proc.kill();
    }
  });
});

