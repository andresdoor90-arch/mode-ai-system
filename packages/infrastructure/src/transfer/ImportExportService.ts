import { gunzipSync, gzipSync } from 'node:zlib';

import {
  type ICalendarEventRepository,
  type ICollectionRepository,
  type IGarmentRepository,
  type IOutfitRepository,
  type IStyleRuleRepository,
  type IUserProfileRepository,
} from '@mas/core';

import { TransferError, wrapAsync } from '../errors/InfrastructureError';
import {
  type CalendarEventRow,
  type CollectionRow,
  type GarmentRow,
  type OutfitRow,
  type StyleRuleRow,
  type UserProfileRow,
  calendarEventToDomain,
  calendarEventToRow,
  collectionToDomain,
  collectionToRow,
  garmentToDomain,
  garmentToRow,
  outfitToDomain,
  outfitToRow,
  styleRuleToDomain,
  styleRuleToRow,
  userProfileToDomain,
  userProfileToRow,
} from '../repositories/mappers';

/** The set of repositories the transfer service reads from / writes to. */
export interface TransferRepositories {
  readonly garments: IGarmentRepository;
  readonly outfits: IOutfitRepository;
  readonly profiles: IUserProfileRepository;
  readonly styleRules: IStyleRuleRepository;
  readonly collections: ICollectionRepository;
  readonly calendarEvents: ICalendarEventRepository;
}

/** Current portable-bundle format version. */
export const BUNDLE_FORMAT_VERSION = 1 as const;

/** A portable, self-contained snapshot of all user data. */
export interface DataBundle {
  readonly formatVersion: number;
  readonly exportedAt: string;
  readonly garments: readonly GarmentRow[];
  readonly outfits: readonly { readonly row: OutfitRow; readonly garmentIds: readonly string[] }[];
  readonly userProfiles: readonly UserProfileRow[];
  readonly styleRules: readonly StyleRuleRow[];
  readonly collections: readonly {
    readonly row: CollectionRow;
    readonly garmentIds: readonly string[];
  }[];
  readonly calendarEvents: readonly CalendarEventRow[];
}

/**
 * Exports and imports the user's data as a portable JSON bundle, working purely
 * through the domain repository interfaces. Because it never touches a concrete
 * database, the very same service can move data between any two storage
 * backends (SQLite ↔ in-memory ↔ a future cloud store) — the decoupling the
 * architecture requires.
 */
export class ImportExportService {
  public constructor(
    private readonly repos: TransferRepositories,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Build an in-memory {@link DataBundle} from the current data. */
  public async exportBundle(): Promise<DataBundle> {
    return wrapAsync(
      async () => {
        const garments = (await this.repos.garments.findAll()).map(garmentToRow);
        const outfits = (await this.repos.outfits.findAll()).map((outfit) => ({
          row: outfitToRow(outfit),
          garmentIds: outfit.garments.map((g) => g.id),
        }));
        const current = await this.repos.profiles.getCurrent();
        const userProfiles = current ? [userProfileToRow(current, true)] : [];
        const styleRules = (await this.repos.styleRules.findAll()).map(styleRuleToRow);
        const collections = (await this.repos.collections.findAll()).map((collection) => ({
          row: collectionToRow(collection),
          garmentIds: collection.garmentIds.map((id) => id as string),
        }));
        const calendarEvents = (await this.repos.calendarEvents.findAll()).map(
          calendarEventToRow,
        );

        return {
          formatVersion: BUNDLE_FORMAT_VERSION,
          exportedAt: this.now().toISOString(),
          garments,
          outfits,
          userProfiles,
          styleRules,
          collections,
          calendarEvents,
        };
      },
      (cause) => new TransferError('Failed to export data bundle.', cause),
    );
  }

  /** Serialise a bundle to a JSON string, optionally gzip-compressed. */
  public async exportToBytes(options: { compress?: boolean } = {}): Promise<Uint8Array> {
    const bundle = await this.exportBundle();
    const json = Buffer.from(`${JSON.stringify(bundle)}`, 'utf8');
    return options.compress ? new Uint8Array(gzipSync(json)) : new Uint8Array(json);
  }

  /** Restore data from a previously-exported bundle. Existing data is upserted. */
  public async importBundle(bundle: DataBundle): Promise<void> {
    if (bundle.formatVersion !== BUNDLE_FORMAT_VERSION) {
      throw new TransferError(
        `Unsupported bundle format version ${bundle.formatVersion} (expected ${BUNDLE_FORMAT_VERSION}).`,
      );
    }
    await wrapAsync(
      async () => {
        // Garments first: outfits and collections reference them.
        const garmentById = new Map<string, Awaited<ReturnType<IGarmentRepository['findById']>>>();
        for (const row of bundle.garments) {
          const garment = garmentToDomain(row);
          await this.repos.garments.save(garment);
          garmentById.set(garment.id, garment);
        }

        for (const { row, garmentIds } of bundle.outfits) {
          const garments = garmentIds.map((id) => {
            const garment = garmentById.get(id);
            if (garment === null || garment === undefined) {
              throw new TransferError(`Outfit ${row.id} references unknown garment ${id}.`);
            }
            return garment;
          });
          await this.repos.outfits.save(outfitToDomain(row, garments));
        }

        for (const row of bundle.userProfiles) {
          await this.repos.profiles.save(userProfileToDomain(row));
        }
        for (const row of bundle.styleRules) {
          await this.repos.styleRules.save(styleRuleToDomain(row));
        }
        for (const { row, garmentIds } of bundle.collections) {
          await this.repos.collections.save(collectionToDomain(row, garmentIds));
        }
        for (const row of bundle.calendarEvents) {
          await this.repos.calendarEvents.save(calendarEventToDomain(row));
        }
      },
      (cause) => new TransferError('Failed to import data bundle.', cause),
    );
  }

  /** Parse bytes (JSON, optionally gzipped) into a bundle and import it. */
  public async importFromBytes(bytes: Uint8Array): Promise<void> {
    const bundle = parseBundleBytes(bytes);
    await this.importBundle(bundle);
  }
}

/** Detect gzip magic bytes (0x1f 0x8b) and decode a bundle from raw bytes. */
export const parseBundleBytes = (bytes: Uint8Array): DataBundle => {
  try {
    const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
    const jsonBuffer = isGzip ? gunzipSync(Buffer.from(bytes)) : Buffer.from(bytes);
    return JSON.parse(jsonBuffer.toString('utf8')) as DataBundle;
  } catch (cause) {
    throw new TransferError('Failed to parse data bundle bytes.', cause);
  }
};
