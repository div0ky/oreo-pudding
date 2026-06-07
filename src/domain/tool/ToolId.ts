import { ValueObject } from "../seedwork/ValueObject";

interface ToolIdProps {
  value: string;
}

/**
 * Value Object representing the unique domain ID of a registered tool.
 */
export class ToolId extends ValueObject<ToolIdProps> {
  /**
   * Createsvalidated ToolId.
   */
  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("ToolId value cannot be empty.");
    }
    super({ value: value.trim() });
  }

  /**
   * Gets the string identifier of the tool.
   */
  public get value(): string {
    return this.props.value;
  }
}
