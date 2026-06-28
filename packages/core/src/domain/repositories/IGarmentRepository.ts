import { type GarmentId } from '../../shared/Identifier';
import { type Garment, type GarmentStatus } from '../entities/Garment';
import { type GarmentCategory } from '../value-objects/GarmentCategory';
import { type Season } from '../value-objects/Season';

/** Filter criteria for querying garments. Omitted fields are not constrained. */
export interface GarmentQuery {
  readonly category?: GarmentCategory;
  readonly subcategory?: string;
  readonly season?: Season;
  readonly status?: GarmentStatus;
  readonly tags?: readonly string[];
}

/**
 * Persistence contract for {@link Garment} aggregates. Declared in the domain;
 * implemented by the infrastructure layer (Phase 3). All methods are async to
 * accommodate real I/O without leaking storage concerns into the domain.
 */
export interface IGarmentRepository {
  save(garment: Garment): Promise<void>;
  findById(id: GarmentId): Promise<Garment | null>;
  findAll(): Promise<readonly Garment[]>;
  query(criteria: GarmentQuery): Promise<readonly Garment[]>;
  findByCategory(category: GarmentCategory): Promise<readonly Garment[]>;
  delete(id: GarmentId): Promise<void>;
  count(): Promise<number>;
}
