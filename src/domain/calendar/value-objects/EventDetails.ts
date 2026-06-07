import { ValueObject } from "../../seedwork/ValueObject";

interface EventDetailsProps {
  title: string;
  description: string;
}

export class EventDetails extends ValueObject<EventDetailsProps> {
  constructor(title: string, description: string = "") {
    if (!title || title.trim() === "") {
      throw new Error("Calendar event title cannot be empty.");
    }
    super({
      title: title.trim(),
      description: (description || "").trim()
    });
  }

  public get title(): string {
    return this.props.title;
  }

  public get description(): string {
    return this.props.description;
  }
}
