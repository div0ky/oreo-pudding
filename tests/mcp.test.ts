import { test, expect, describe } from "bun:test";
import { ToolName } from "../src/domain/tool/ToolName";
import { ToolId } from "../src/domain/tool/ToolId";
import { ToolDescription } from "../src/domain/tool/ToolDescription";
import { ToolSchema } from "../src/domain/tool/ToolSchema";
import { ToolSchemaBuilder } from "../src/domain/tool/ToolSchemaBuilder";
import { Tool } from "../src/domain/tool/Tool";
import type { ToolStrategy } from "../src/domain/tool/ToolStrategy";
import { Mediator } from "../src/application/mediator/Mediator";
import { EventDispatcher } from "../src/infrastructure/events/EventDispatcher";
import { InMemoryToolRepository } from "../src/infrastructure/repository/InMemoryToolRepository";
import { RegisterToolCommand } from "../src/application/tool/commands/RegisterToolCommand";
import { RegisterToolCommandHandler } from "../src/application/tool/commands/RegisterToolCommandHandler";
import { ExecuteToolCommand } from "../src/application/tool/commands/ExecuteToolCommand";
import { ExecuteToolCommandHandler } from "../src/application/tool/commands/ExecuteToolCommandHandler";
import { ListToolsQuery } from "../src/application/tool/queries/ListToolsQuery";
import { ListToolsQueryHandler } from "../src/application/tool/queries/ListToolsQueryHandler";
import { LoggingCommandHandlerDecorator } from "../src/application/decorators/LoggingHandlerDecorators";
import { ToolExecutedEvent } from "../src/domain/tool/events/ToolExecutedEvent";

describe("Domain-Driven Design (DDD) & Invariants", () => {
  test("ToolName should validate MCP name rules", () => {
    // Valid names
    expect(new ToolName("valid-tool_name").value).toBe("valid-tool_name");
    expect(new ToolName("Tool123").value).toBe("Tool123");

    // Invalid names should throw
    expect(() => new ToolName("")).toThrow();
    expect(() => new ToolName("invalid name")).toThrow();
    expect(() => new ToolName("invalid/name")).toThrow();
    expect(() => new ToolName("invalid$name")).toThrow();
  });

  test("ValueObjects should check structural equality", () => {
    const name1 = new ToolName("my-tool");
    const name2 = new ToolName("my-tool");
    const name3 = new ToolName("other-tool");

    expect(name1.equals(name2)).toBe(true);
    expect(name1.equals(name3)).toBe(false);
  });

  test("Builder pattern should construct correct ToolSchema", () => {
    const schema = new ToolSchemaBuilder()
      .addStringProperty("param1", "First parameter", true)
      .addNumberProperty("param2", "Second parameter", false)
      .build();

    expect(schema.type).toBe("object");
    expect(schema.properties.param1).toEqual({ type: "string", description: "First parameter" });
    expect(schema.properties.param2).toEqual({ type: "number", description: "Second parameter" });
    expect(schema.required).toContain("param1");
    expect(schema.required).not.toContain("param2");
  });
});

describe("CQRS & GoF Mediator / Decorator Patterns", () => {
  test("Mediator should correctly route commands and queries with decorators", async () => {
    const repository = new InMemoryToolRepository();
    const dispatcher = new EventDispatcher();
    const mediator = new Mediator();

    // Setup concrete strategy
    class MockStrategy implements ToolStrategy {
      async execute(args: Record<string, any>): Promise<string> {
        return `Hello ${args.target}`;
      }
    }

    // Wrap with Logging Decorator
    const registerHandler = new LoggingCommandHandlerDecorator(
      new RegisterToolCommandHandler(repository, dispatcher),
      () => {} // silence logging for tests
    );
    const executeHandler = new LoggingCommandHandlerDecorator(
      new ExecuteToolCommandHandler(repository, dispatcher),
      () => {}
    );
    const listHandler = new ListToolsQueryHandler(repository);

    mediator.registerCommand(RegisterToolCommand, registerHandler);
    mediator.registerCommand(ExecuteToolCommand, executeHandler);
    mediator.registerQuery(ListToolsQuery, listHandler);

    // Register Tool Command
    const registerCmd = new RegisterToolCommand(
      "test-tool",
      "Mock tool for tests",
      {
        type: "object",
        properties: { target: { type: "string", description: "Target entity" } },
        required: ["target"]
      },
      new MockStrategy()
    );

    const toolId = await mediator.send<string>(registerCmd);
    expect(toolId).toBeDefined();

    // Query ListTools
    const tools = await mediator.query<any>(new ListToolsQuery());
    expect(tools.length).toBe(1);
    expect(tools[0]!.name).toBe("test-tool");
    expect(tools[0]!.description).toBe("Mock tool for tests");

    // Execute Tool Command
    const executeResult = await mediator.send<string>(
      new ExecuteToolCommand("test-tool", { target: "Antigravity" })
    );
    expect(executeResult).toBe("Hello Antigravity");
  });
});

describe("Observer Pattern & Domain Events", () => {
  test("EventDispatcher should dispatch aggregate events to subscribers", async () => {
    const repository = new InMemoryToolRepository();
    const dispatcher = new EventDispatcher();
    
    let eventReceived = false;
    let receivedArgs: Record<string, any> = {};

    dispatcher.subscribe(ToolExecutedEvent, {
      async handle(event: ToolExecutedEvent) {
        eventReceived = true;
        receivedArgs = event.inputArguments;
      }
    });

    const handler = new ExecuteToolCommandHandler(repository, dispatcher);

    class MockStrategy implements ToolStrategy {
      async execute(): Promise<string> {
        return "Done";
      }
    }

    // Pre-save mock tool to repository
    const tool = Tool.create(
      new ToolId("t-123"),
      new ToolName("sample-tool"),
      new ToolDescription("A sample tool"),
      new ToolSchema({ type: "object" }),
      new MockStrategy()
    );
    await repository.save(tool);

    await handler.handle(new ExecuteToolCommand("sample-tool", { inputKey: "inputValue" }));

    expect(eventReceived).toBe(true);
    expect(receivedArgs.inputKey).toBe("inputValue");
  });
});
