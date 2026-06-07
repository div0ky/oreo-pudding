/**
 * Base abstract class for domain Value Objects.
 */
export abstract class ValueObject<T> {
  protected readonly props: T;

  /**
   * Creates an instance of ValueObject with immutable properties.
   */
  constructor(props: T) {
    this.props = Object.freeze(props);
  }

  /**
   * Compares the current ValueObject with another for structural equality.
   */
  public equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }
    if (vo.props === undefined) {
      return false;
    }
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }
}
