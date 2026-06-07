import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardSSEServerTransport } from "./interface/mcp/WebStandardSSEServerTransport.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Mediator } from "./application/mediator/Mediator";
import { CreateCalendarEventCommand } from "./application/calendar/commands/CreateCalendarEventCommand";
import { CreateCalendarEventCommandHandler } from "./application/calendar/commands/CreateCalendarEventCommandHandler";
import { RetrieveCalendarEventsQuery, type CalendarEventDto } from "./application/calendar/queries/RetrieveCalendarEventsQuery";
import { RetrieveCalendarEventsQueryHandler } from "./application/calendar/queries/RetrieveCalendarEventsQueryHandler";
import { ListCalendarsQuery, type CalendarDto } from "./application/calendar/queries/ListCalendarsQuery";
import { ListCalendarsQueryHandler } from "./application/calendar/queries/ListCalendarsQueryHandler";
import { UpdateCalendarEventCommand } from "./application/calendar/commands/UpdateCalendarEventCommand";
import { UpdateCalendarEventCommandHandler } from "./application/calendar/commands/UpdateCalendarEventCommandHandler";
import { CalDavRepository } from "./infrastructure/calendar/repository/CalDavRepository";
import { ICalSerializationStrategy } from "./infrastructure/calendar/serialization/ICalSerializationStrategy";
import { InvalidDateRangeException } from "./domain/calendar/exceptions/InvalidDateRangeException";

// 1. Initialize CQRS Mediator & Handler Pipeline
const mediator = new Mediator();
const repository = new CalDavRepository();
const serializationStrategy = new ICalSerializationStrategy();

const createHandler = new CreateCalendarEventCommandHandler(repository, serializationStrategy);
const retrieveHandler = new RetrieveCalendarEventsQueryHandler(repository);
const listCalendarsHandler = new ListCalendarsQueryHandler(repository);
const updateHandler = new UpdateCalendarEventCommandHandler(repository, serializationStrategy);

mediator.registerCommand(CreateCalendarEventCommand, createHandler);
mediator.registerQuery(RetrieveCalendarEventsQuery, retrieveHandler);
mediator.registerQuery(ListCalendarsQuery, listCalendarsHandler);
export function getCredentials(): { appleId: string; appSpecificPassword: string } {
  const appleId = process.env.APP_ID;
  const appSpecificPassword = process.env.APP_PASS;

  if (!appleId || appleId.trim() === "") {
    throw new Error("Apple ID is required (set APP_ID env variable).");
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(appleId)) {
    throw new Error("Invalid Apple ID format. Must be a valid email address.");
  }

  if (!appSpecificPassword || appSpecificPassword.trim() === "") {
    throw new Error("App-Specific Password is required (set APP_PASS env variable).");
  }
  const aspRegex = /^[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}$/;
  if (!aspRegex.test(appSpecificPassword)) {
    throw new Error("Invalid App-Specific Password format. Must be formatted as xxxx-xxxx-xxxx-xxxx.");
  }

  return { appleId, appSpecificPassword };
}

// 2. Define Network Edge Validation Schema using Zod
export const createCalendarEventSchema = z.object({
  title: z.string().min(1, "Title must not be empty."),
  description: z.string().optional().default(""),
  location: z.string().optional().default(""),
  url: z.string().optional().default(""),
  startDate: z
    .string()
    .datetime({ message: "Invalid start date format. Must be an ISO-8601 datetime string." }),
  endDate: z
    .string()
    .datetime({ message: "Invalid end date format. Must be an ISO-8601 datetime string." })
});

export const retrieveCalendarEventsSchema = z.object({
  startDate: z
    .string()
    .datetime({ message: "Invalid start date format. Must be an ISO-8601 datetime string." })
    .optional(),
  endDate: z
    .string()
    .datetime({ message: "Invalid end date format. Must be an ISO-8601 datetime string." })
    .optional()
});

export const updateCalendarEventSchema = z.object({
  eventId: z.string().min(1, "Event ID must not be empty."),
  title: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  url: z.string().optional(),
  startDate: z
    .string()
    .datetime({ message: "Invalid start date format. Must be an ISO-8601 datetime string." })
    .optional(),
  endDate: z
    .string()
    .datetime({ message: "Invalid end date format. Must be an ISO-8601 datetime string." })
    .optional()
});

// 3. Configure the MCP Server instance factory
export function createMcpServer(): Server {
  const s = new Server(
    {
      name: "apple-calendar-mcp",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  setupMcpHandlers(s);
  return s;
}

function setupMcpHandlers(s: Server) {
  s.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_calendar_event",
        description: "Creates an event in Apple Calendar via CalDAV.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Title of the calendar event" },
            description: {
              type: "string",
              description: "Optional description or notes for the event"
            },
            location: {
              type: "string",
              description: "Optional location for the event"
            },
            url: {
              type: "string",
              description: "Optional URL for the event"
            },
            startDate: {
              type: "string",
              description: "Start date/time of the event in ISO 8601 format (e.g. 2026-06-07T15:00:00Z)"
            },
            endDate: {
              type: "string",
              description: "End date/time of the event in ISO 8601 format (e.g. 2026-06-07T16:00:00Z)"
            }
          },
          required: [
            "title",
            "startDate",
            "endDate"
          ]
        }
      },
      {
        name: "retrieve_calendar_events",
        description: "Retrieves events from Apple Calendar via CalDAV within a date range (defaults to current day).",
        inputSchema: {
          type: "object",
          properties: {
            startDate: {
              type: "string",
              description: "Start date/time in ISO 8601 format (e.g. 2026-06-07T00:00:00Z) [optional]"
            },
            endDate: {
              type: "string",
              description: "End date/time in ISO 8601 format (e.g. 2026-06-07T23:59:59Z) [optional]"
            }
          },
          required: []
        }
      },
      {
        name: "update_calendar_event",
        description: "Updates an existing event in Apple Calendar via CalDAV.",
        inputSchema: {
          type: "object",
          properties: {
            eventId: {
              type: "string",
              description: "The unique event ID (UID) of the event to update"
            },
            title: { type: "string", description: "Updated title of the calendar event [optional]" },
            description: {
              type: "string",
              description: "Updated description or notes [optional]"
            },
            location: {
              type: "string",
              description: "Updated location [optional]"
            },
            url: {
              type: "string",
              description: "Updated URL [optional]"
            },
            startDate: {
              type: "string",
              description: "Updated start date/time in ISO 8601 format [optional]"
            },
            endDate: {
              type: "string",
              description: "Updated end date/time in ISO 8601 format [optional]"
            }
          },
          required: ["eventId"]
        }
      },
      {
        name: "list_calendars",
        description: "Lists all available calendars for the authenticated iCloud account.",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      }
    ]
  };
});

s.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;

  if (toolName === "create_calendar_event") {
    try {
      const parsed = createCalendarEventSchema.safeParse(request.params.arguments);
      if (!parsed.success) {
        const details = parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ");
        return {
          content: [
            {
              type: "text",
              text: `Validation Error: ${details}`
            }
          ],
          isError: true
        };
      }

      const { appleId, appSpecificPassword } = getCredentials();
      const {
        title,
        description,
        location,
        url,
        startDate,
        endDate
      } = parsed.data;

      const command = new CreateCalendarEventCommand(
        appleId,
        appSpecificPassword,
        title,
        description,
        new Date(startDate),
        new Date(endDate),
        undefined, // calendarPath (always auto-discover)
        location,
        url
      );

      const eventId = await mediator.send<string>(command);

      return {
        content: [
          {
            type: "text",
            text: `Event successfully created with Domain Event ID: ${eventId}`
          }
        ]
      };
    } catch (error: any) {
      const isDomainError =
        error instanceof InvalidDateRangeException ||
        error.message.includes("Apple ID") ||
        error.message.includes("Password") ||
        error.message.includes("title") ||
        error.message.includes("path");

      const category = isDomainError ? "Domain Constraint" : "System Error";

      return {
        content: [
          {
            type: "text",
            text: `Failed to create calendar event [${category}]: ${error.message || error}`
          }
        ],
        isError: true
      };
    }
  }

  if (toolName === "retrieve_calendar_events") {
    try {
      const parsed = retrieveCalendarEventsSchema.safeParse(request.params.arguments);
      if (!parsed.success) {
        const details = parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ");
        return {
          content: [
            {
              type: "text",
              text: `Validation Error: ${details}`
            }
          ],
          isError: true
        };
      }

      const { appleId, appSpecificPassword } = getCredentials();
      const {
        startDate,
        endDate
      } = parsed.data;

      let start: Date;
      let end: Date;

      if (!startDate && !endDate) {
        // Default to current 24h day
        const today = new Date();
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
        end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
      } else if (startDate && !endDate) {
        // Default to 24h day from startDate
        start = new Date(startDate);
        end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
      } else {
        start = startDate ? new Date(startDate) : new Date(0);
        end = endDate ? new Date(endDate) : new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
      }

      const query = new RetrieveCalendarEventsQuery(
        appleId,
        appSpecificPassword,
        undefined, // calendarPath (always auto-discover)
        start,
        end
      );

      const events = await mediator.query<CalendarEventDto[]>(query);

      const response = {
        events,
        _swr: (events as any)._swr
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2)
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve calendar events: ${error.message || error}`
          }
        ],
        isError: true
      };
    }
  }

  if (toolName === "update_calendar_event") {
    try {
      const parsed = updateCalendarEventSchema.safeParse(request.params.arguments);
      if (!parsed.success) {
        const details = parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ");
        return {
          content: [
            {
              type: "text",
              text: `Validation Error: ${details}`
            }
          ],
          isError: true
        };
      }

      const { appleId, appSpecificPassword } = getCredentials();
      const {
        eventId,
        title,
        description,
        location,
        url,
        startDate,
        endDate
      } = parsed.data;

      const command = new UpdateCalendarEventCommand(
        appleId,
        appSpecificPassword,
        undefined, // calendarPath (always auto-discover)
        eventId,
        title,
        description,
        location,
        url,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      const updatedEventId = await mediator.send<string>(command);

      return {
        content: [
          {
            type: "text",
            text: `Event successfully updated with Domain Event ID: ${updatedEventId}`
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to update calendar event: ${error.message || error}`
          }
        ],
        isError: true
      };
    }
  }

  if (toolName === "list_calendars") {
    try {
      const listCalendarsSchema = z.object({});

      const parsed = listCalendarsSchema.safeParse(request.params.arguments);
      if (!parsed.success) {
        const details = parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ");
        return {
          content: [
            {
              type: "text",
              text: `Validation Error: ${details}`
            }
          ],
          isError: true
        };
      }

      const { appleId, appSpecificPassword } = getCredentials();

      const query = new ListCalendarsQuery(appleId, appSpecificPassword);
      const calendars = await mediator.query<CalendarDto[]>(query);

      const response = {
        calendars,
        _swr: (calendars as any)._swr
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2)
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to list calendars: ${error.message || error}`
          }
        ],
        isError: true
      };
    }
  }

  return {
    content: [
      {
        type: "text",
        text: `Tool '${toolName}' not found.`
      }
    ],
    isError: true
  };
});
}

// 5. Connect and listen using standard I/O streams or SSE transport depending on PORT env variable
if (process.env.PORT) {
  const activeTransports = new Map<string, WebStandardSSEServerTransport>();

  // Instantiate Streamable HTTP transport for backward compatibility
  const streamableTransport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });
  const primaryMcpServer = createMcpServer();
  await primaryMcpServer.connect(streamableTransport);

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id, Last-Event-ID, mcp-protocol-version",
    "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version"
  };

  const port = parseInt(process.env.PORT, 10);
  Bun.serve({
    port,
    async fetch(req) {
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      const url = new URL(req.url);
      const accept = req.headers.get("accept");
      const sessionIdHeader = req.headers.get("mcp-session-id");

      // Verify Authorization header if BEARER_TOKEN is configured in environment,
      // exempting public health checks and dashboard routes (GET /health, GET /, GET /dashboard, GET /dashboard.html)
      // when not requesting SSE/sessions.
      const isPublicEndpoint = (req.method === "GET" && (
        url.pathname === "/health" ||
        url.pathname === "/" ||
        url.pathname === "/dashboard" ||
        url.pathname === "/dashboard.html"
      )) && !(accept?.includes("text/event-stream") || sessionIdHeader);

      if (!isPublicEndpoint && process.env.BEARER_TOKEN) {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return new Response(
            JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header" }),
            {
              status: 401,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            }
          );
        }
        const token = authHeader.substring(7).trim();
        if (token !== process.env.BEARER_TOKEN) {
          return new Response(
            JSON.stringify({ error: "Unauthorized: Invalid Bearer Token" }),
            {
              status: 401,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            }
          );
        }
      }

      // SSE Connection Endpoint (GET /sse or GET /)
      if (req.method === "GET") {
        // Serve dashboard HTML if requested
        if (url.pathname === "/dashboard" || url.pathname === "/dashboard.html") {
          const htmlFile = Bun.file("dashboard.html");
          if (await htmlFile.exists()) {
            return new Response(htmlFile, {
              status: 200,
              headers: {
                "Content-Type": "text/html; charset=utf-8",
                ...corsHeaders
              }
            });
          }
        }

        if (url.pathname === "/sse") {
          const transport = new WebStandardSSEServerTransport("/messages");
          const sessionServer = createMcpServer();
          await sessionServer.connect(transport);

          activeTransports.set(transport.sessionId, transport);

          transport.onclose = () => {
            activeTransports.delete(transport.sessionId);
          };

          return transport.createResponse();
        }

        if (url.pathname === "/") {
          // If we have a session header, delegate to streamable HTTP transport
          if (sessionIdHeader) {
            return streamableTransport.handleRequest(req);
          }
          // Otherwise, if client requests event-stream, treat as classic SSE GET connection
          if (accept?.includes("text/event-stream")) {
            const transport = new WebStandardSSEServerTransport("/messages");
            const sessionServer = createMcpServer();
            await sessionServer.connect(transport);

            activeTransports.set(transport.sessionId, transport);

            transport.onclose = () => {
              activeTransports.delete(transport.sessionId);
            };

            return transport.createResponse();
          }
        }

        // Health check endpoint (GET /health or GET /)
        if (url.pathname === "/health" || url.pathname === "/") {
          return new Response(
            JSON.stringify({ status: "ok", message: "Apple Calendar MCP Server is active" }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            }
          );
        }
      }

      // Message posting endpoint (POST /messages)
      if (req.method === "POST") {
        if (url.pathname === "/messages") {
          const sessionId = url.searchParams.get("sessionId");
          if (!sessionId) {
            return new Response("Session ID required", { status: 400, headers: corsHeaders });
          }
          const transport = activeTransports.get(sessionId);
          if (!transport) {
            return new Response("Session not found/expired", { status: 404, headers: corsHeaders });
          }
          return transport.handlePostMessage(req);
        }

        // Delegate other POST requests (e.g. POST / or POST /mcp) to Streamable HTTP transport
        return streamableTransport.handleRequest(req);
      }

      // Delegate DELETE requests (e.g. session termination) to Streamable HTTP transport
      if (req.method === "DELETE") {
        return streamableTransport.handleRequest(req);
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });
    }
  });
  console.error(`Apple Calendar CalDAV MCP Server listening on SSE transport (port ${port}).`);
} else {
  const stdioServer = createMcpServer();
  const transport = new StdioServerTransport();
  await stdioServer.connect(transport);
  console.error("Apple Calendar CalDAV MCP Server listening on stdio transport.");
}

