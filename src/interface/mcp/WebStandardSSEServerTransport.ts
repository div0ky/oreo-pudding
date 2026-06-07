import type { Transport, TransportSendOptions } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage, JSONRPCMessageSchema, MessageExtraInfo } from "@modelcontextprotocol/sdk/types.js";

/**
 * A Web-Standards-compatible SSE Server Transport.
 * Emulates the classic GET-first SSE transport style:
 *   1. Client opens GET stream to establish SSE channel.
 *   2. Server sends an initial 'endpoint' redirect event directing where to POST messages.
 *   3. Client posts requests to that POST endpoint.
 */
export class WebStandardSSEServerTransport implements Transport {
  private _endpoint: string;
  private _sessionId: string;
  private _controller?: ReadableStreamDefaultController;
  private _encoder = new TextEncoder();
  private _closed = false;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: <T extends JSONRPCMessage>(message: T, extra?: MessageExtraInfo) => void;

  constructor(endpoint: string) {
    this._endpoint = endpoint;
    this._sessionId = crypto.randomUUID();
  }

  get sessionId(): string {
    return this._sessionId;
  }

  async start(): Promise<void> {
    // start is a no-op; initialization is handled in createResponse()
  }

  /**
   * Creates the HTTP Response containing the text/event-stream ReadableStream.
   */
  createResponse(): Response {
    const stream = new ReadableStream({
      start: (controller) => {
        this._controller = controller;

        // Build the relative/absolute endpoint URL with our sessionId
        const endpointUrl = new URL(this._endpoint, "http://localhost");
        endpointUrl.searchParams.set("sessionId", this._sessionId);
        const relativeUrlWithSession = endpointUrl.pathname + endpointUrl.search + endpointUrl.hash;

        // Immediately send the endpoint redirect event to client
        controller.enqueue(
          this._encoder.encode(`event: endpoint\ndata: ${relativeUrlWithSession}\n\n`)
        );
      },
      cancel: () => {
        this._closed = true;
        this.onclose?.();
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Expose-Headers": "*"
      }
    });
  }

  /**
   * Processes a client's incoming JSON-RPC POST request and forwards it to the MCP Server.
   */
  async handlePostMessage(req: Request): Promise<Response> {
    try {
      const body = await req.json();
      const parsedMessage = JSONRPCMessageSchema.parse(body);

      const requestInfo = {
        headers: Object.fromEntries(req.headers.entries()),
        url: new URL(req.url)
      };

      // Forward to MCP server onmessage handler
      this.onmessage?.(parsedMessage, { requestInfo });

      return new Response("Accepted", {
        status: 202,
        headers: {
          "Content-Type": "text/plain",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*"
        }
      });
    } catch (error: any) {
      this.onerror?.(error);
      return new Response(String(error.message || error), {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  }

  async close(): Promise<void> {
    if (!this._closed) {
      this._closed = true;
      try {
        this._controller?.close();
      } catch {
        // Stream might be closed already
      }
      this.onclose?.();
    }
  }

  async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
    if (this._closed || !this._controller) {
      throw new Error("Transport is closed or not connected");
    }
    const eventData = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
    this._controller.enqueue(this._encoder.encode(eventData));
  }
}
