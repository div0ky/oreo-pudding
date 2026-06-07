import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import type { IMediator } from "../../application/seedwork/IMediator";
import { ListToolsQuery } from "../../application/tool/queries/ListToolsQuery";
import { ExecuteToolCommand } from "../../application/tool/commands/ExecuteToolCommand";

export class McpServerAdapter {
  private readonly server: Server;

  constructor(
    private readonly mediator: IMediator,
    serverName = "oreo-pudding-mcp",
    serverVersion = "1.0.0"
  ) {
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

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        const tools = await this.mediator.query(new ListToolsQuery());
        return { tools };
      } catch (error: any) {
        throw new Error(`Failed to list tools: ${error.message || error}`);
      }
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
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

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Oreo Pudding MCP Server started successfully on stdio transport.");
  }
}
