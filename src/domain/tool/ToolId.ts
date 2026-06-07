import { ValueObject } from "../seedwork/ValueObject";

interface ToolIdProps {
  value: string;
}

export class ToolId extends ValueObject<ToolIdProps> {
  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("ToolId value cannot be empty.");
    }
    super({ value: value.trim() });
  }

  public get value(): string {
    return this.props.value;
  }
}
