import {
  type IStyleRuleRepository,
  type StyleRule,
  type StyleRuleId,
} from '@mas/core';

import { DatabaseError, wrapSync } from '../errors/InfrastructureError';
import { type SqlDatabase } from '../database/SqlDatabase';
import {
  type StyleRuleRow,
  styleRuleToDomain,
  styleRuleToRow,
} from './mappers/styleRuleMapper';

/** SQLite-backed {@link IStyleRuleRepository}. */
export class SqlStyleRuleRepository implements IStyleRuleRepository {
  public constructor(private readonly db: SqlDatabase) {}

  public async save(rule: StyleRule): Promise<void> {
    const row = styleRuleToRow(rule);
    wrapSync(
      () =>
        this.db
          .prepare(
            'INSERT OR REPLACE INTO style_rules (id, name, condition, recommendation, priority, enabled) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(row.id, row.name, row.condition, row.recommendation, row.priority, row.enabled),
      (cause) => new DatabaseError(`Failed to save style rule ${rule.id}.`, cause),
    );
  }

  public async findById(id: StyleRuleId): Promise<StyleRule | null> {
    const row = wrapSync(
      () => this.db.prepare('SELECT * FROM style_rules WHERE id = ?').get<StyleRuleRow>(id),
      (cause) => new DatabaseError(`Failed to load style rule ${id}.`, cause),
    );
    return row ? styleRuleToDomain(row) : null;
  }

  public async findAll(): Promise<readonly StyleRule[]> {
    const rows = wrapSync(
      () => this.db.prepare('SELECT * FROM style_rules ORDER BY priority DESC').all<StyleRuleRow>(),
      (cause) => new DatabaseError('Failed to load style rules.', cause),
    );
    return rows.map(styleRuleToDomain);
  }

  public async findEnabledByPriority(): Promise<readonly StyleRule[]> {
    const rows = wrapSync(
      () =>
        this.db
          .prepare('SELECT * FROM style_rules WHERE enabled = 1 ORDER BY priority DESC')
          .all<StyleRuleRow>(),
      (cause) => new DatabaseError('Failed to load enabled style rules.', cause),
    );
    return rows.map(styleRuleToDomain);
  }

  public async delete(id: StyleRuleId): Promise<void> {
    wrapSync(
      () => this.db.prepare('DELETE FROM style_rules WHERE id = ?').run(id),
      (cause) => new DatabaseError(`Failed to delete style rule ${id}.`, cause),
    );
  }
}
