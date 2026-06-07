import { ToolSchema } from "./ToolSchema";

/**
 * Builder class to fluently construct ToolSchema instances.
 */
export class ToolSchemaBuilder {
  private properties: Record<string, any> = {};
  private required: string[] = [];

  /**
   * Adds a string parameter to the schema.
   */
  public addStringProperty(name: string, description: string, isRequired = false): this {
    this.properties[name] = { type: "string", description };
    if (isRequired) {
      this.required.push(name);
    }
    return this;
  }

  /**
   * Adds a number parameter to the schema.
   */
  public addNumberProperty(name: string, description: string, isRequired = false): this {
    this.properties[name] = { type: "number", description };
    if (isRequired) {
      this.required.push(name);
    }
    return this;
  }

  /**
   * Adds a boolean parameter to the schema.
   */
  public addBooleanProperty(name: string, description: string, isRequired = false): this {
    this.properties[name] = { type: "boolean", description };
    if (isRequired) {
      this.required.push(name);
    }
    return this;
  }

  /**
   * Adds a generic property schema parameter to the schema.
   */
  public addProperty(name: string, schema: Record<string, any>, isRequired = false): this {
    this.properties[name] = schema;
    if (isRequired) {
      this.required.push(name);
    }
    return this;
  }

  /**
   * Constructs and returns the final ToolSchema instance.
   */
  public build(): ToolSchema {
    return new ToolSchema({
      type: "object",
      properties: this.properties,
      required: this.required
    });
  }
}
