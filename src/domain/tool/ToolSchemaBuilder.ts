import { ToolSchema } from "./ToolSchema";

export class ToolSchemaBuilder {
  private properties: Record<string, any> = {};
  private required: string[] = [];

  public addStringProperty(name: string, description: string, isRequired = false): this {
    this.properties[name] = { type: "string", description };
    if (isRequired) {
      this.required.push(name);
    }
    return this;
  }

  public addNumberProperty(name: string, description: string, isRequired = false): this {
    this.properties[name] = { type: "number", description };
    if (isRequired) {
      this.required.push(name);
    }
    return this;
  }

  public addBooleanProperty(name: string, description: string, isRequired = false): this {
    this.properties[name] = { type: "boolean", description };
    if (isRequired) {
      this.required.push(name);
    }
    return this;
  }

  public addProperty(name: string, schema: Record<string, any>, isRequired = false): this {
    this.properties[name] = schema;
    if (isRequired) {
      this.required.push(name);
    }
    return this;
  }

  public build(): ToolSchema {
    return new ToolSchema({
      type: "object",
      properties: this.properties,
      required: this.required
    });
  }
}
