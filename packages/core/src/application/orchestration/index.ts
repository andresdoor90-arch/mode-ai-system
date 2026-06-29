/**
 * AI orchestration layer — public barrel.
 *
 * The provider-agnostic cognitive engine of M-A-S. Everything here is pure
 * application/domain logic that depends only on the domain and the abstract
 * ports in {@link ./ports}; no AI SDK, vector DB, Electron or Node import lives
 * in this layer. Concrete providers/stores are injected from the infrastructure
 * layer at composition time.
 */
export * from './ports';
export * from './types';
export * from './ContextAnalyzer';
export * from './HistoryAnalyzer';
export * from './InventoryAnalyzer';
export * from './OutfitCandidateGenerator';
export * from './OutfitRankingEngine';
export * from './ExplanationGenerator';
export * from './PreferenceEngine';
export * from './MemoryEngine';
export * from './AIProviderRouter';
export * from './EmbeddingManager';
export * from './AIOrchestrator';
