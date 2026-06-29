import { Entity } from '../../shared/Entity';
import { type StyleRuleId } from '../../shared/Identifier';
import { type Result, ok, err } from '../../shared/Result';
import { ValidationError } from '../../shared/errors';
import { type GarmentCategory } from '../value-objects/GarmentCategory';
import { type Occasion } from '../value-objects/Occasion';
import { type Season } from '../value-objects/Season';

/** What a rule does when its conditions are met. */
export enum RuleEffect {
  Require = 'require',
  Forbid = 'forbid',
  Boost = 'boost',
  Penalize = 'penalize',
}

/** The context a rule is evaluated against. */
export interface RuleContext {
  readonly occasion: Occasion;
  readonly season: Season;
  readonly categories: readonly GarmentCategory[];
  readonly subcategories: readonly string[];
  readonly tags: readonly string[];
  readonly temperatureC: number | undefined;
}

/** Conditions that must all hold for a rule to fire (omitted fields = any). */
export interface RuleCondition {
  readonly occasions?: readonly Occasion[];
  readonly seasons?: readonly Season[];
  readonly requiresTags?: readonly string[];
  readonly maxTemperatureC?: number;
  readonly minTemperatureC?: number;
}

/** The action a rule recommends when it fires. */
export interface RuleRecommendation {
  readonly effect: RuleEffect;
  readonly targetSubcategories?: readonly string[];
  readonly targetTags?: readonly string[];
  readonly message: string;
}

export interface StyleRuleProps {
  readonly name: string;
  readonly condition: RuleCondition;
  readonly recommendation: RuleRecommendation;
  readonly priority: number;
  readonly enabled: boolean;
}

/**
 * A user- or system-defined styling rule. Pure: evaluating a rule against a
 * context never touches the outside world. Higher `priority` rules win when the
 * application layer resolves conflicts.
 */
export class StyleRule extends Entity<'StyleRule'> {
  private _name: string;
  private _condition: RuleCondition;
  private _recommendation: RuleRecommendation;
  private _priority: number;
  private _enabled: boolean;

  private constructor(id: StyleRuleId, props: StyleRuleProps) {
    super(id);
    this._name = props.name;
    this._condition = props.condition;
    this._recommendation = props.recommendation;
    this._priority = props.priority;
    this._enabled = props.enabled;
  }

  public static create(
    id: StyleRuleId,
    input: {
      name: string;
      condition: RuleCondition;
      recommendation: RuleRecommendation;
      priority?: number;
      enabled?: boolean;
    },
  ): Result<StyleRule, ValidationError> {
    if (typeof input.name !== 'string' || input.name.trim().length === 0) {
      return err(new ValidationError('Style rule name must be a non-empty string.'));
    }
    const priority = input.priority ?? 0;
    if (!Number.isInteger(priority) || priority < 0 || priority > 100) {
      return err(new ValidationError('Style rule priority must be an integer between 0 and 100.'));
    }
    if (
      typeof input.recommendation?.message !== 'string' ||
      input.recommendation.message.trim().length === 0
    ) {
      return err(new ValidationError('Style rule recommendation requires a message.'));
    }
    return ok(
      new StyleRule(id, {
        name: input.name.trim(),
        condition: input.condition,
        recommendation: input.recommendation,
        priority,
        enabled: input.enabled ?? true,
      }),
    );
  }

  public get name(): string {
    return this._name;
  }
  public get condition(): RuleCondition {
    return this._condition;
  }
  public get recommendation(): RuleRecommendation {
    return this._recommendation;
  }
  public get priority(): number {
    return this._priority;
  }
  public get enabled(): boolean {
    return this._enabled;
  }

  public enable(): void {
    this._enabled = true;
  }

  public disable(): void {
    this._enabled = false;
  }

  /** Whether the rule's conditions hold for the given context. */
  public appliesTo(context: RuleContext): boolean {
    if (!this._enabled) {
      return false;
    }
    const c = this._condition;
    if (c.occasions && !c.occasions.includes(context.occasion)) {
      return false;
    }
    if (c.seasons && !c.seasons.includes(context.season)) {
      return false;
    }
    if (c.requiresTags && !c.requiresTags.every((tag) => context.tags.includes(tag))) {
      return false;
    }
    if (
      c.maxTemperatureC !== undefined &&
      context.temperatureC !== undefined &&
      context.temperatureC > c.maxTemperatureC
    ) {
      return false;
    }
    if (
      c.minTemperatureC !== undefined &&
      context.temperatureC !== undefined &&
      context.temperatureC < c.minTemperatureC
    ) {
      return false;
    }
    return true;
  }
}
