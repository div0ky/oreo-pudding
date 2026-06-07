import { ValueObject } from "../../seedwork/ValueObject";

interface EventDetailsProps {
  title: string;
  description: string;
  location: string;
  url: string;
}

/**
 * Value Object encapsulating the details of a calendar event (title, description, location, URL).
 */
export class EventDetails extends ValueObject<EventDetailsProps> {
  /**
   * Createsvalidated EventDetails.
   */
  constructor(
    title: string,
    description: string = "",
    location: string = "",
    url: string = ""
  ) {
    if (!title || title.trim() === "") {
      throw new Error("Calendar event title cannot be empty.");
    }
    super({
      title: title.trim(),
      description: (description || "").trim(),
      location: (location || "").trim(),
      url: (url || "").trim()
    });
  }

  /**
   * Gets the event title.
   */
  public get title(): string {
    return this.props.title;
  }

  /**
   * Gets the event description/notes.
   */
  public get description(): string {
    return this.props.description;
  }

  /**
   * Gets the event physical/virtual location.
   */
  public get location(): string {
    return this.props.location;
  }

  /**
   * Gets the event associated URL.
   */
  public get url(): string {
    return this.props.url;
  }
}
