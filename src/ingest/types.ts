export interface EmbeddingProvider {
  readonly modelName: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export interface SimilarityMatch {
  id: number;
  title: string;
  similarity: number;
}

export interface AISimilarityResult {
  isSame: boolean;
  factTitle: string | null;
  confidence: number;
  reason: string;
}

export interface IngestStats {
  total: number;
  exactMatched: number;
  autoMerged: number;
  aiMerged: number;
  created: number;
  failed: number;
}
