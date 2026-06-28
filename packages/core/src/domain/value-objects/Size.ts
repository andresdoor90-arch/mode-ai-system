import { type Result, ok, err } from '../../shared/Result';
import { ValidationError } from '../../shared/errors';
import { ValueObject } from '../../shared/ValueObject';

/** Sizing systems supported by the domain. */
export enum SizeSystem {
  AlphaNumeric = 'alpha', // XS, S, M, L, XL ...
  EU = 'eu',
  US = 'us',
  UK = 'uk',
  Numeric = 'numeric', // waist/length style numeric sizing
}

interface SizeProps {
  readonly system: SizeSystem;
  readonly value: string;
  /** Optional free-form measurements in centimetres (chest, waist, length...). */
  readonly measurements: Readonly<Record<string, number>>;
}

const ALPHA_VALUES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

/**
 * Size value object. Couples a sizing system with its label and an optional bag
 * of physical measurements (cm) so the domain can compare/normalise sizes.
 */
export class Size extends ValueObject<SizeProps> {
  private constructor(props: SizeProps) {
    super(props);
  }

  public static create(input: {
    system: SizeSystem;
    value: string;
    measurements?: Record<string, number>;
  }): Result<Size, ValidationError> {
    const value = input.value?.trim().toUpperCase();
    if (typeof value !== 'string' || value.length === 0) {
      return err(new ValidationError('Size value must be a non-empty string.'));
    }
    if (input.system === SizeSystem.AlphaNumeric && !ALPHA_VALUES.includes(value)) {
      return err(
        new ValidationError(`Alpha size "${value}" is not one of ${ALPHA_VALUES.join(', ')}.`),
      );
    }
    const measurements = input.measurements ?? {};
    for (const [part, cm] of Object.entries(measurements)) {
      if (!Number.isFinite(cm) || cm <= 0) {
        return err(new ValidationError(`Measurement "${part}" must be a positive number.`));
      }
    }
    return ok(new Size({ system: input.system, value, measurements }));
  }

  public get system(): SizeSystem {
    return this.props.system;
  }

  public get value(): string {
    return this.props.value;
  }

  public get measurements(): Readonly<Record<string, number>> {
    return this.props.measurements;
  }
}
