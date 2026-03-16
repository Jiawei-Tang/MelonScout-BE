import { eq, gte, sql } from "drizzle-orm";
import { db, schema } from "../db";
import type { SimilarityMatch } from "./types";

export async function findExactTitle(
  title: string,
  windowDays: number,
): Promise<{ id: number } | null> {
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({ id: schema.hotSearches.id })
    .from(schema.hotSearches)
    .where(
      sql`${schema.hotSearches.title} = ${title}
        AND ${schema.hotSearches.createdAt} >= ${cutoff}`,
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findSimilar(
  embedding: number[],
  windowDays: number,
  limit: number,
): Promise<SimilarityMatch[]> {
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const vecLiteral = `[${embedding.join(",")}]`;

  const rows = await db.execute<{
    id: number;
    title: string;
    similarity: number;
  }>(sql`
    SELECT
      id,
      title,
      1 - (embedding <=> ${vecLiteral}::vector) AS similarity
    FROM hot_searches
    WHERE created_at >= ${cutoff}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vecLiteral}::vector
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    id: Number(r.id),
    title: String(r.title),
    similarity: Number(r.similarity),
  }));
}
