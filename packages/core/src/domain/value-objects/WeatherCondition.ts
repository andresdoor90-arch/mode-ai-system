import { type Result, ok, err } from '../../shared/Result';
import { ValidationError } from '../../shared/errors';
import { ValueObject } from '../../shared/ValueObject';
import { Season } from './Season';

/** Coarse sky/precipitation conditions. */
export enum Precipitation {
  None = 'none',
  Rain = 'rain',
  Snow = 'snow',
}

interface WeatherConditionProps {
  readonly temperatureC: number;
  readonly precipitation: Precipitation;
  readonly windKph: number;
  readonly humidityPct: number;
}

/** Temperature thresholds (°C) used by thermal-adequacy rules. */
export const TEMPERATURE_THRESHOLDS = {
  hot: 25,
  warm: 18,
  cool: 10,
  cold: 5,
} as const;

/**
 * A snapshot of weather conditions used by weather-aware recommendations and
 * the thermal-adequacy factor of outfit scoring.
 */
export class WeatherCondition extends ValueObject<WeatherConditionProps> {
  private constructor(props: WeatherConditionProps) {
    super(props);
  }

  public static create(input: {
    temperatureC: number;
    precipitation?: Precipitation;
    windKph?: number;
    humidityPct?: number;
  }): Result<WeatherCondition, ValidationError> {
    if (
      !Number.isFinite(input.temperatureC) ||
      input.temperatureC < -60 ||
      input.temperatureC > 60
    ) {
      return err(new ValidationError('temperatureC must be between -60 and 60.'));
    }
    const wind = input.windKph ?? 0;
    const humidity = input.humidityPct ?? 50;
    if (!Number.isFinite(wind) || wind < 0 || wind > 400) {
      return err(new ValidationError('windKph must be between 0 and 400.'));
    }
    if (!Number.isFinite(humidity) || humidity < 0 || humidity > 100) {
      return err(new ValidationError('humidityPct must be between 0 and 100.'));
    }
    return ok(
      new WeatherCondition({
        temperatureC: input.temperatureC,
        precipitation: input.precipitation ?? Precipitation.None,
        windKph: wind,
        humidityPct: humidity,
      }),
    );
  }

  public get temperatureC(): number {
    return this.props.temperatureC;
  }

  public get precipitation(): Precipitation {
    return this.props.precipitation;
  }

  public get windKph(): number {
    return this.props.windKph;
  }

  public get humidityPct(): number {
    return this.props.humidityPct;
  }

  public get isHot(): boolean {
    return this.props.temperatureC >= TEMPERATURE_THRESHOLDS.hot;
  }

  public get isCold(): boolean {
    return this.props.temperatureC <= TEMPERATURE_THRESHOLDS.cold;
  }

  /** The season this weather most resembles, for seasonal matching. */
  public inferSeason(): Season {
    if (this.isHot) {
      return Season.Summer;
    }
    if (this.temperatureC >= TEMPERATURE_THRESHOLDS.warm) {
      return Season.Spring;
    }
    if (this.temperatureC >= TEMPERATURE_THRESHOLDS.cool) {
      return Season.Autumn;
    }
    return Season.Winter;
  }
}
