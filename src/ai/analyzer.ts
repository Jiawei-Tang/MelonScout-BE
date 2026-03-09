import { eq, isNull } from "drizzle-orm";
import { db, schema } from "../db";
import { aiProvider } from "./index";

export async function analyzeNewTitles(): Promise<number> {
  const unanalyzed = await db
    .select({
      id: schema.hotSearches.id,
      title: schema.hotSearches.title,
      description: schema.hotSearches.description,
    })
    .from(schema.hotSearches)
    .leftJoin(schema.aiAnalysis, eq(schema.hotSearches.id, schema.aiAnalysis.hotSearchId))
    .where(isNull(schema.aiAnalysis.id));

  console.log(`🤖 Analyzing ${unanalyzed.length} new titles with [${aiProvider.modelName}]...`);

  let analyzed = 0;
  for (const item of unanalyzed) {
    try {
      const result = await aiProvider.analyze(item.title, item.description);

      await db.insert(schema.aiAnalysis).values({
        hotSearchId: item.id,
        isClickbait: result.isClickbait,
        score: result.score,
        reason: result.reason,
        aiModel: aiProvider.modelName,
      });

      if (item.description === null && result.reason) {
        await db
          .update(schema.hotSearches)
          .set({ description: result.reason })
          .where(eq(schema.hotSearches.id, item.id));
      }

      analyzed++;
    } catch (err) {
      console.error(`❌ AI analysis failed for "${item.title}":`, err);
    }
  }

  console.log(`✅ AI analysis complete: ${analyzed}/${unanalyzed.length} titles analyzed`);
  return analyzed;
}
