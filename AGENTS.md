# Developer & Agent Guidelines (oreo-pudding)

Welcome! This codebase enforces strict DDD (Domain-Driven Design), CQRS, and Gang of Four design patterns. As an AI Agent or developer, you **MUST** adhere to the architectural rules described below. Do not bypass or simplify this structure for quick fixes.

---

## 1. Golden Rules of the Architecture

1. **Strict Dependency Flow**: Dependencies only point inward.
   - Domain has *zero* dependencies.
   - Application depends *only* on Domain.
   - Infrastructure depends on Application and Domain.
   - Interface depends on Application and Infrastructure.
2. **No Primitive Obsession**: Never pass raw primitives (like `string` or `number`) where domain semantics apply. Wrap them in Value Objects (e.g., use `ToolName` instead of `string` for a tool's name).
3. **No Direct Execution**: The Interface layer must never call repositories or execute business logic directly. It must dispatch a Command or Query through the `Mediator`.
4. **Thin Handlers**: Command/Query Handlers should only orchestrate. They retrieve aggregate roots from repositories, invoke business methods on those aggregate roots, save them back to repositories, and let the system handle side-effects via Domain Events.
5. **No Frameworks in Domain**: Never import anything from `@modelcontextprotocol/sdk` or file-system libraries inside the `src/domain/` directory.

---

## 2. Step-by-Step Guide: Adding a New Tool

To add a new tool to the MCP server, follow these exact steps:

### Step 1: Define the Execution Strategy
Create a new concrete implementation of `ToolStrategy` in `src/domain/tool/strategies/`.
```typescript
import type { ToolStrategy } from "../ToolStrategy";

export class MyNewToolStrategy implements ToolStrategy {
  async execute(args: Record<string, any>): Promise<string> {
    // Validate business arguments
    const target = args.target;
    // Perform execution logic
    return `Executed successfully on ${target}`;
  }
}
```

### Step 2: Register the Tool in Bootstrap
If it's a static tool, register it in the initialization code (e.g., `index.ts`) using the `RegisterToolCommand`.

```typescript
const registerCommand = new RegisterToolCommand(
  "my_new_tool",
  "Executes my brand new domain functionality",
  {
    type: "object",
    properties: {
      target: { type: "string", description: "The target execution item" }
    },
    required: ["target"]
  },
  new MyNewToolStrategy()
);

await mediator.send(registerCommand);
```

---

## 3. Step-by-Step Guide: Adding a New Bounded Context / Aggregate

If you are adding a completely new domain concept (e.g., "Prompts" or "Resources"):

1. **Domain Layer**:
   - Create `src/domain/your-concept/`.
   - Implement Value Objects, Entity base, and the Aggregate Root.
   - Define domain events that happen in this aggregate.
   - Create the interface for the Repository (`IYourConceptRepository`).
2. **Application Layer**:
   - Create `src/application/your-concept/`.
   - Define Commands (e.g., `CreatePromptCommand`) and Queries (e.g., `ListPromptsQuery`).
   - Implement the Handlers.
3. **Infrastructure Layer**:
   - Implement the concrete repository (e.g., `InMemoryYourConceptRepository`) in `src/infrastructure/repository/`.
   - Subscribe Event Handlers to your domain events in the `EventDispatcher`.
4. **Interface Layer**:
   - Register the new handlers in the `Mediator`.
   - Bind the corresponding JSON-RPC endpoint in `McpServerAdapter` to send queries/commands to the `Mediator`.

---

## 4. Code Quality & Standards

- **Types**: Always use strict typing. Avoid `any` except when representing generic JSON objects (like arguments or schemas), but constrain them where possible (e.g. `Record<string, unknown>`).
- **Tests**: Every new Command, Query, and Domain Aggregate must have an accompanying unit test in `src/**/*.test.ts` or a dedicated test folder. Run them using `bun test`.
