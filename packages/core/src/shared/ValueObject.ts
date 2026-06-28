/**
 * Base class for value objects.
 *
 * Value objects are immutable and compared *by value* rather than identity.
 * Subclasses pass their structural properties to `super(...)`; equality is then
 * a deep structural comparison of those properties.
 */
export abstract class ValueObject<TProps extends object> {
  protected readonly props: Readonly<TProps>;

  protected constructor(props: TProps) {
    this.props = Object.freeze({ ...props });
  }

  /** Structural equality: two value objects are equal when their props match. */
  public equals(other?: ValueObject<TProps> | null): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (other.constructor !== this.constructor) {
      return false;
    }
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}
