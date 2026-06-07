import { ValueObject } from "../seedwork/ValueObject";

interface ToolDescriptionProps {
  value: string;
}

export class ToolDescription extends ValueObject<ToolDescriptionProps> {
  constructor(value: string) {
    if (!value || value.trim() === "") {
      throw new Error("ToolDescription cannot be empty.");
    }
    super({ value: value.trim() });
  }

  public get value(): string {
    return this.props.value;
  }
}
