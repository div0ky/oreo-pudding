import { ValueObject } from "../seedwork/ValueObject";

interface ToolSchemaProps {
  type: "object";
  properties?: Record<string, any>;
  required?: string[];
}

export class ToolSchema extends ValueObject<ToolSchemaProps> {
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

  public get type(): "object" {
    return this.props.type;
  }

  public get properties(): Record<string, any> {
    return this.props.properties || {};
  }

  public get required(): string[] {
    return this.props.required || [];
  }
}
