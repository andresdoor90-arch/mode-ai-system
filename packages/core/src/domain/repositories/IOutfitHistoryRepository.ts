import { type GarmentId, type OutfitHistoryEntryId } from '../../shared/Identifier';
import { type OutfitHistoryEntry } from '../entities/OutfitHistoryEntry';

/**
 * Persistence contract for the definitive outfit-usage history. Declared in the
 * domain; implemented by infrastructure (SQLite) and by an in-memory adapter for
 * tests. Search / filter / sort / statistics are pure application logic over
 * {@link findAll} (consistent with the Phase 5 HistoryAnalyzer), so this port
 * stays small and storage-agnostic.
 */
export interface IOutfitHistoryRepository {
  save(entry: OutfitHistoryEntry): Promise<void>;
  findById(id: OutfitHistoryEntryId): Promise<OutfitHistoryEntry | null>;
  /** Every entry, most-recently-worn first. */
  findAll(): Promise<readonly OutfitHistoryEntry[]>;
  /** Entries that include the given garment. */
  findByGarment(garmentId: GarmentId): Promise<readonly OutfitHistoryEntry[]>;
  delete(id: OutfitHistoryEntryId): Promise<void>;
  count(): Promise<number>;
}
