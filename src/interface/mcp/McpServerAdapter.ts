import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardSSEServerTransport } from "./WebStandardSSEServerTransport.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import type { IMediator } from "../../application/seedwork/IMediator";
import { ListToolsQuery } from "../../application/tool/queries/ListToolsQuery";
import { ExecuteToolCommand } from "../../application/tool/commands/ExecuteToolCommand";

export class McpServerAdapter {
  private readonly server: Server;
  private readonly serverName: string;
  private readonly serverVersion: string;

  constructor(
    private readonly mediator: IMediator,
    serverName = "oreo-pudding-mcp",
    serverVersion = "1.0.0"
  ) {
    this.serverName = serverName;
    this.serverVersion = serverVersion;

    this.server = new Server(
      {
        name: serverName,
        version: serverVersion
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupMcpHandlers(this.server);
  }

  private setupMcpHandlers(s: Server): void {
    s.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        const tools = await this.mediator.query(new ListToolsQuery());
        return { tools };
      } catch (error: any) {
        throw new Error(`Failed to list tools: ${error.message || error}`);
      }
    });

    s.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const name = request.params.name;
        const args = request.params.arguments || {};
        const resultText = await this.mediator.send<string>(
          new ExecuteToolCommand(name, args)
        );

        return {
          content: [
            {
              type: "text",
              text: resultText
            }
          ]
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error executing tool: ${error.message || error}`
            }
          ],
          isError: true
        };
      }
    });
  }

  private createServerInstance(): Server {
    const s = new Server(
      {
        name: this.serverName,
        version: this.serverVersion
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    this.setupMcpHandlers(s);
    return s;
  }

  public async start(): Promise<void> {
    if (process.env.PORT) {
      const activeTransports = new Map<string, WebStandardSSEServerTransport>();

      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id, Last-Event-ID, mcp-protocol-version",
        "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version"
      };

      const port = parseInt(process.env.PORT, 10);
      const self = this;
      Bun.serve({
        port,
        async fetch(req) {
          if (req.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders });
          }

          const url = new URL(req.url);

          // SSE Connection Endpoint (GET /sse or GET /)
          if (req.method === "GET" && (url.pathname === "/sse" || url.pathname === "/")) {
            const accept = req.headers.get("accept");
            if (accept?.includes("text/event-stream") || url.pathname === "/sse") {
              const transport = new WebStandardSSEServerTransport("/messages");
              const sessionServer = self.createServerInstance();
              await sessionServer.connect(transport);

              activeTransports.set(transport.sessionId, transport);

              transport.onclose = () => {
                activeTransports.delete(transport.sessionId);
              };

              return transport.createResponse();
            }
          }

          // Message posting endpoint (POST /messages)
          if (req.method === "POST" && url.pathname === "/messages") {
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

          // Health check endpoint (GET /health or GET /)
          if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
            return new Response(
              JSON.stringify({ status: "ok", message: `${self.serverName} is active` }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  ...corsHeaders
                }
              }
            );
          }

          return new Response("Not Found", { status: 404, headers: corsHeaders });
        }
      });
      console.error(`Oreo Pudding MCP Server started successfully on SSE transport (port ${port}).`);
    } else {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error("Oreo Pudding MCP Server started successfully on stdio transport.");
    }
  }
}
