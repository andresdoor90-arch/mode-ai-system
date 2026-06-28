import { type StyleRuleId } from '../../shared/Identifier';
import { type StyleRule } from '../entities/StyleRule';

/**
 * Persistence contract for {@link StyleRule} entities.
 */
export interface IStyleRuleRepository {
  save(rule: StyleRule): Promise<void>;
  findById(id: StyleRuleId): Promise<StyleRule | null>;
  findAll(): Promise<readonly StyleRule[]>;
  /** Enabled rules ordered by descending priority. */
  findEnabledByPriority(): Promise<readonly StyleRule[]>;
  delete(id: StyleRuleId): Promise<void>;
}
