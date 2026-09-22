import type { IQuery } from "../../seedwork/IQuery";

/**
 * Query to retrieve a privacy-masked Busy ICS feed within a date range.
 * Returns a complete RFC 5545 VCALENDAR string.
 */
export class GetBusyFeedQuery implements IQuery<string> {
  /**
   * Creates an instance of GetBusyFeedQuery.
   */
  constructor(
    public readonly startDate?: Date,
    public readonly endDate?: Date,
    public readonly omit?: string[],
    public readonly timezone?: string
  ) {}
}
