/**
 * Branded identifier type.
 *
 * Entity ids are plain strings at runtime but are *branded* at the type level
 * so a `GarmentId` cannot be accidentally passed where an `OutfitId` is
 * expected. The brand is erased at compile time and costs nothing at runtime.
 */
export type Id<TBrand extends string> = string & { readonly __brand: TBrand };

/** Cast a raw string to a branded id. Validation happens at entity boundaries. */
export const toId = <TBrand extends string>(value: string): Id<TBrand> => value as Id<TBrand>;

export type GarmentId = Id<'Garment'>;
export type OutfitId = Id<'Outfit'>;
export type UserProfileId = Id<'UserProfile'>;
export type StyleRuleId = Id<'StyleRule'>;
export type CollectionId = Id<'Collection'>;
export type CalendarEventId = Id<'CalendarEvent'>;
export type WardrobeId = Id<'Wardrobe'>;
export type CategoryId = Id<'Category'>;
export type PhotoId = Id<'Photo'>;
export type OutfitHistoryEntryId = Id<'OutfitHistoryEntry'>;
