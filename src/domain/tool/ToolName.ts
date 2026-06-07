import { ValueObject } from "../seedwork/ValueObject";

interface ToolNameProps {
  value: string;
}

/**
 * Value Object representing the name of a tool, validating alphanumeric, underscore, or hyphen format.
 */
export class ToolName extends ValueObject<ToolNameProps> {
  private static readonly NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

  /**
   * Creates validated ToolName.
   */
  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("ToolName cannot be empty.");
    }
    const trimmed = value.trim();
    if (!ToolName.NAME_REGEX.test(trimmed)) {
      throw new Error(
        `ToolName '${trimmed}' is invalid. It must only contain alphanumeric characters, underscores, or hyphens.`
      );
    }
    super({ value: trimmed });
  }

  /**
   * Gets the validated string name of the tool.
   */
  public get value(): string {
    return this.props.value;
  }
}
