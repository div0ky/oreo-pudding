import { ValueObject } from "../seedwork/ValueObject";

interface ToolSchemaProps {
  type: "object";
  properties?: Record<string, any>;
  required?: string[];
}

/**
 * Value Object representing the JSON Schema describing a tool's parameters.
 */
export class ToolSchema extends ValueObject<ToolSchemaProps> {
  /**
   * Creates validated ToolSchema.
   */
  constructor(props: ToolSchemaProps) {
    if (props.type !== "object") {
      throw new Error("ToolSchema type must be 'object'.");
    }
    super({
      type: "object",
      properties: props.properties ? { ...props.properties } : {},
      required: props.required ? [...props.required] : []
    });
  }

  /**
   * Gets the schema type, which is always 'object'.
   */
  public get type(): "object" {
    return this.props.type;
  }

  /**
   * Gets the property schemas for the parameters.
   */
  public get properties(): Record<string, any> {
    return this.props.properties || {};
  }

  /**
   * Gets the list of required parameter keys.
   */
  public get required(): string[] {
    return this.props.required || [];
  }
}
