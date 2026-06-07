import { ValueObject } from "../seedwork/ValueObject";

interface ToolDescriptionProps {
  value: string;
}

/**
 * Value Object representing the description of an MCP tool.
 */
export class ToolDescription extends ValueObject<ToolDescriptionProps> {
  /**
   * Createsvalidated ToolDescription.
   */
  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("ToolDescription cannot be empty.");
    }
    super({ value: value.trim() });
  }

  /**
   * Gets the string value of the tool description.
   */
  public get value(): string {
    return this.props.value;
  }
}
