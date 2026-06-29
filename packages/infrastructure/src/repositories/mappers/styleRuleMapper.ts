import { type RuleCondition, type RuleRecommendation, StyleRule, toId } from '@mas/core';

import { mustOk, parseJson, toBool, toJson } from './mapperUtils';

/** Raw `style_rules` table row. */
export interface StyleRuleRow {
  id: string;
  name: string;
  condition: string;
  recommendation: string;
  priority: number;
  enabled: number;
}

/** Reconstruct a {@link StyleRule} from a row. */
export const styleRuleToDomain = (row: StyleRuleRow): StyleRule =>
  mustOk(
    StyleRule.create(toId<'StyleRule'>(row.id), {
      name: row.name,
      condition: parseJson<RuleCondition>(row.condition, {}, `rule ${row.id} condition`),
      recommendation: parseJson<RuleRecommendation>(
        row.recommendation,
        { effect: 'boost', message: '' } as unknown as RuleRecommendation,
        `rule ${row.id} recommendation`,
      ),
      priority: row.priority,
      enabled: toBool(row.enabled),
    }),
    `rule ${row.id}`,
  );

/** Flatten a {@link StyleRule} into a row. */
export const styleRuleToRow = (rule: StyleRule): StyleRuleRow => ({
  id: rule.id,
  name: rule.name,
  condition: toJson(rule.condition),
  recommendation: toJson(rule.recommendation),
  priority: rule.priority,
  enabled: rule.enabled ? 1 : 0,
});
