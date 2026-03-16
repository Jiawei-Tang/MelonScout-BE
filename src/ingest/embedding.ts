import { resolveEnv } from "../config";
import type { EmbeddingProvider } from "./types";

class DoubaoEmbeddingProvider implements EmbeddingProvider {
  readonly modelName = "doubao-embedding-vision";
  readonly dimensions: number;
  private apiKey: string;
  private endpointId: string;
  private baseUrl = "https://ark.cn-beijing.volces.com/api/v3/embeddings/multimodal";

  constructor(apiKey: string, endpointId: string, dimensions: number) {
    this.apiKey = apiKey;
    this.endpointId = endpointId;
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    const resp = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.endpointId,
        input: [{ type: "text", text }],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Doubao embedding API ${resp.status}: ${body}`);
    }

    const json = (await resp.json()) as {
      data: { embedding: number[] };
      usage: { prompt_tokens: number; total_tokens: number };
    };
    return json.data.embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const CONCURRENCY = 5;
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += CONCURRENCY) {
      const batch = texts.slice(i, i + CONCURRENCY);
      const vecs = await Promise.all(batch.map((t) => this.embed(t)));
      results.push(...vecs);
    }
    return results;
  }
}

class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly modelName = "text-embedding-3-small";
  readonly dimensions: number;
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, dimensions: number, baseUrl = "https://api.openai.com/v1") {
    this.apiKey = apiKey;
    this.dimensions = dimensions;
    this.baseUrl = baseUrl;
  }

  async embed(text: string): Promise<number[]> {
    const [vec] = await this.embedBatch([text]);
    return vec;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const resp = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        input: texts,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`OpenAI embedding API ${resp.status}: ${body}`);
    }

    const json = (await resp.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };
    return json.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }
}

class MockEmbeddingProvider implements EmbeddingProvider {
  readonly modelName = "mock-embedding";
  readonly dimensions: number;

  constructor(dimensions: number) {
    this.dimensions = dimensions;
  }

  async embed(_text: string): Promise<number[]> {
    return Array.from({ length: this.dimensions }, () => Math.random() - 0.5);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}

export function createEmbeddingProvider(
  provider: string,
  apiKeyEnv: string,
  endpointId?: string,
  dimensions = 2048,
): EmbeddingProvider {
  const apiKey = resolveEnv(apiKeyEnv);

  if (!apiKey) {
    console.warn(`⚠️ ${apiKeyEnv} not set for embedding, using mock provider`);
    return new MockEmbeddingProvider(dimensions);
  }

  switch (provider) {
    case "doubao":
      if (!endpointId) {
        console.warn("⚠️ endpointId not set for doubao embedding, using mock");
        return new MockEmbeddingProvider(dimensions);
      }
      return new DoubaoEmbeddingProvider(apiKey, endpointId, dimensions);

    case "openai":
      return new OpenAIEmbeddingProvider(apiKey, dimensions);

    default:
      console.warn(`⚠️ Unknown embedding provider "${provider}", using mock`);
      return new MockEmbeddingProvider(dimensions);
  }
}
