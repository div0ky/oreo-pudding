import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Mediator } from "./application/mediator/Mediator";
import { CreateCalendarEventCommand } from "./application/calendar/commands/CreateCalendarEventCommand";
import { CreateCalendarEventCommandHandler } from "./application/calendar/commands/CreateCalendarEventCommandHandler";
import { CalDavRepository } from "./infrastructure/calendar/repository/CalDavRepository";
import { ICalSerializationStrategy } from "./infrastructure/calendar/serialization/ICalSerializationStrategy";
import { InvalidDateRangeException } from "./domain/calendar/exceptions/InvalidDateRangeException";

// 1. Initialize CQRS Mediator & Handler Pipeline
const mediator = new Mediator();
const repository = new CalDavRepository();
const serializationStrategy = new ICalSerializationStrategy();
const handler = new CreateCalendarEventCommandHandler(repository, serializationStrategy);

mediator.registerCommand(CreateCalendarEventCommand, handler);

// 2. Define Network Edge Validation Schema using Zod
export const createCalendarEventSchema = z.object({
  bearerToken: z
    .string()
    .min(1, "Bearer token is required.")
    .refine(
      (val) => val === process.env.BEARER_TOKEN,
      "Unauthorized: The provided bearer token does not match the configured BEARER_TOKEN environment variable."
    ),
  appleId: z
    .string()
    .optional()
    .transform((val) => val || process.env.APP_ID)
    .refine(
      (val): val is string => !!val && val.trim() !== "",
      "Apple ID is required (specify it or set APP_ID env variable)."
    )
    .refine(
      (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      "Invalid Apple ID format. Must be a valid email address."
    ),
  appSpecificPassword: z
    .string()
    .optional()
    .transform((val) => val || process.env.APP_PASS)
    .refine(
      (val): val is string => !!val && val.trim() !== "",
      "App-Specific Password is required (specify it or set APP_PASS env variable)."
    )
    .refine(
      (val) => /^[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}$/.test(val),
      "Invalid App-Specific Password format. Must be formatted as xxxx-xxxx-xxxx-xxxx."
    ),
  title: z.string().min(1, "Title must not be empty."),
  description: z.string().optional().default(""),
  startDate: z
    .string()
    .datetime({ message: "Invalid start date format. Must be an ISO-8601 datetime string." }),
  endDate: z
    .string()
    .datetime({ message: "Invalid end date format. Must be an ISO-8601 datetime string." }),
  calendarPath: z.string().min(1, "Calendar path must not be empty.")
});

// 3. Configure the MCP Server instance
const server = new Server(
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

// 4. Setup Request Handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_calendar_event",
        description: "Creates an event in Apple Calendar via CalDAV.",
        inputSchema: {
          type: "object",
          properties: {
            bearerToken: {
              type: "string",
              description: "Security bearer token used for authenticating with the MCP server"
            },
            appleId: {
              type: "string",
              description: "Your Apple ID (email address) [optional, defaults to APP_ID env var]"
            },
            appSpecificPassword: {
              type: "string",
              description: "Your iCloud App-Specific Password (formatted as xxxx-xxxx-xxxx-xxxx) [optional, defaults to APP_PASS env var]"
            },
            title: { type: "string", description: "Title of the calendar event" },
            description: {
              type: "string",
              description: "Optional description or notes for the event"
            },
            startDate: {
              type: "string",
              description: "Start date/time of the event in ISO 8601 format (e.g. 2026-06-07T15:00:00Z)"
            },
            endDate: {
              type: "string",
              description: "End date/time of the event in ISO 8601 format (e.g. 2026-06-07T16:00:00Z)"
            },
            calendarPath: {
              type: "string",
              description:
                "iCloud CalDAV calendar path, typically '<principal-id>/calendars/<calendar-id>' (e.g. '123456789/calendars/home')"
            }
          },
          required: [
            "bearerToken",
            "title",
            "startDate",
            "endDate",
            "calendarPath"
          ]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "create_calendar_event") {
    return {
      content: [
        {
          type: "text",
          text: `Tool '${request.params.name}' not found.`
        }
      ],
      isError: true
    };
  }

  try {
    // Initial edge validation via Zod
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

    const {
      appleId,
      appSpecificPassword,
      title,
      description,
      startDate,
      endDate,
      calendarPath
    } = parsed.data;

    // Map validated parameters to the command DTO
    const command = new CreateCalendarEventCommand(
      appleId,
      appSpecificPassword,
      title,
      description,
      new Date(startDate),
      new Date(endDate),
      calendarPath
    );

    // Dispatch command to the application CQRS handler
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
    // Catch domain and repository exceptions explicitly and return standard error payloads
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
});

// 5. Connect and listen using standard I/O streams or SSE transport depending on PORT env variable
if (process.env.PORT) {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });
  await server.connect(transport);
  const port = parseInt(process.env.PORT, 10);
  Bun.serve({
    port,
    async fetch(req) {
      return transport.handleRequest(req);
    }
  });
  console.error(`Apple Calendar CalDAV MCP Server listening on SSE transport (port ${port}).`);
} else {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Apple Calendar CalDAV MCP Server listening on stdio transport.");
}
