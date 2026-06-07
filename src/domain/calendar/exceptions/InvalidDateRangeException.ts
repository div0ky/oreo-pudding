/**
 * Exception thrown when event end date is not chronologically after the start date.
 */
export class InvalidDateRangeException extends Error {
  /**
   * Creates an instance of InvalidDateRangeException.
   */
  constructor(startDate: Date, endDate: Date) {
    super(
      `Invalid date range: End date (${endDate.toISOString()}) must be chronologically greater than start date (${startDate.toISOString()}).`
    );
    this.name = "InvalidDateRangeException";
    // Maintain stack trace in environments supporting it
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidDateRangeException);
    }
  }
}
