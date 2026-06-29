/**
 * Embedding collection schema for garments.
 *
 * Describes *how* garment vectors are stored — collection name, vector
 * dimensionality, distance metric and the metadata fields kept alongside each
 * vector for filtering. This is configuration/plumbing only; it intentionally
 * says nothing about how embeddings are produced or used for recommendations.
 */

/** Distance metrics supported by the vector store. */
export enum DistanceMetric {
  Cosine = 'cosine',
  Euclidean = 'l2',
  InnerProduct = 'ip',
}

/** Definition of a vector collection. */
export interface CollectionSchema {
  readonly name: string;
  readonly dimension: number;
  readonly metric: DistanceMetric;
  /** Metadata keys persisted with each vector, used for filtered queries. */
  readonly metadataKeys: readonly string[];
}

/**
 * Default garment-embedding collection. The dimension matches a typical
 * sentence/image embedding size; it is configurable so different embedding
 * providers can be plugged in without code changes.
 */
export const GARMENT_COLLECTION: CollectionSchema = {
  name: 'garment_embeddings',
  dimension: 768,
  metric: DistanceMetric.Cosine,
  metadataKeys: ['category', 'subcategory', 'season', 'colorCategory', 'status'],
};

/** Build the metadata record stored alongside a garment vector. */
export const buildGarmentVectorMetadata = (input: {
  category: string;
  subcategory: string;
  season: string;
  colorCategory: string;
  status: string;
}): Readonly<Record<string, string>> => ({
  category: input.category,
  subcategory: input.subcategory,
  season: input.season,
  colorCategory: input.colorCategory,
  status: input.status,
});
