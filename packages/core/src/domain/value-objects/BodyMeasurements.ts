import { type Result, ok, err } from '../../shared/Result';
import { ValidationError } from '../../shared/errors';
import { ValueObject } from '../../shared/ValueObject';

/** Recognised body-shape archetypes used to bias styling advice. */
export enum BodyShape {
  Rectangle = 'rectangle',
  Triangle = 'triangle',
  InvertedTriangle = 'inverted-triangle',
  Hourglass = 'hourglass',
  Oval = 'oval',
  Unspecified = 'unspecified',
}

interface BodyMeasurementsProps {
  readonly heightCm: number;
  readonly weightKg: number | undefined;
  readonly chestCm: number | undefined;
  readonly waistCm: number | undefined;
  readonly hipsCm: number | undefined;
  readonly inseamCm: number | undefined;
  readonly shape: BodyShape;
}

/**
 * Immutable set of body measurements used by sizing and fit recommendations.
 * Only height is mandatory; the rest are optional and validated when present.
 */
export class BodyMeasurements extends ValueObject<BodyMeasurementsProps> {
  private constructor(props: BodyMeasurementsProps) {
    super(props);
  }

  public static create(input: {
    heightCm: number;
    weightKg?: number;
    chestCm?: number;
    waistCm?: number;
    hipsCm?: number;
    inseamCm?: number;
    shape?: BodyShape;
  }): Result<BodyMeasurements, ValidationError> {
    if (!Number.isFinite(input.heightCm) || input.heightCm < 50 || input.heightCm > 260) {
      return err(new ValidationError('heightCm must be between 50 and 260.'));
    }
    const optionalFields: ReadonlyArray<[string, number | undefined, number, number]> = [
      ['weightKg', input.weightKg, 20, 400],
      ['chestCm', input.chestCm, 40, 200],
      ['waistCm', input.waistCm, 30, 200],
      ['hipsCm', input.hipsCm, 40, 200],
      ['inseamCm', input.inseamCm, 30, 130],
    ];
    for (const [field, value, min, max] of optionalFields) {
      if (value !== undefined && (!Number.isFinite(value) || value < min || value > max)) {
        return err(new ValidationError(`${field} must be between ${min} and ${max}.`));
      }
    }
    return ok(
      new BodyMeasurements({
        heightCm: input.heightCm,
        weightKg: input.weightKg,
        chestCm: input.chestCm,
        waistCm: input.waistCm,
        hipsCm: input.hipsCm,
        inseamCm: input.inseamCm,
        shape: input.shape ?? BodyShape.Unspecified,
      }),
    );
  }

  public get heightCm(): number {
    return this.props.heightCm;
  }

  public get waistCm(): number | undefined {
    return this.props.waistCm;
  }

  public get hipsCm(): number | undefined {
    return this.props.hipsCm;
  }

  public get chestCm(): number | undefined {
    return this.props.chestCm;
  }

  public get shape(): BodyShape {
    return this.props.shape;
  }
}
