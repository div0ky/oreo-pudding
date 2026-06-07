import { ValueObject } from "../seedwork/ValueObject";

interface ToolNameProps {
  value: string;
}

export class ToolName extends ValueObject<ToolNameProps> {
  private static readonly NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

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

  public get value(): string {
    return this.props.value;
  }
}
