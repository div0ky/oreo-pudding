/**
 * Base abstract class representing a Domain Entity with unique identity.
 */
export abstract class Entity<TId> {
  public readonly id: TId;

  protected constructor(id: TId) {
    this.id = id;
  }

  /**
   * Compares the current entity with another entity to check for equality.
   */
  public equals(object?: Entity<TId>): boolean {
    if (object === null || object === undefined) {
      return false;
    }

    if (this === object) {
      return true;
    }

    if (!Object.is(Object.getPrototypeOf(this), Object.getPrototypeOf(object))) {
      return false;
    }

    // Support comparing structural equality of ValueObject IDs or primitives
    const thisId = this.id;
    const targetId = object.id;

    if (
      thisId &&
      typeof thisId === "object" &&
      "equals" in thisId &&
      typeof thisId.equals === "function"
    ) {
      return (thisId as any).equals(targetId);
    }

    return thisId === targetId;
  }
}
