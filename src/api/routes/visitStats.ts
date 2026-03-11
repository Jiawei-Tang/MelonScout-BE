import { Hono } from "hono";
import { db } from "../../db";
import { visitStats } from "../../db/visitStats";
import { eq } from "drizzle-orm";

// 内存计数器
let visitCount = 0;
let lastDbCount = 0;
let lastUpdate = Date.now();

// 定时每分钟写入数据库
setInterval(async () => {
  const stats = await db.select().from(visitStats).limit(1);
  if (stats.length === 0) return;
  if (visitCount > 0) {
    const newCount = stats[0].count + visitCount;
    await db.update(visitStats)
      .set({ count: newCount, updatedAt: new Date() })
      .where(eq(visitStats.id, stats[0].id));
    lastDbCount = newCount;
    visitCount = 0;
    lastUpdate = Date.now();
  } else {
    lastDbCount = stats[0].count;
  }
}, 60 * 1000);

const router = new Hono();

router.get("/", async (c) => {
  // 判断是否需要自增
  const inc = c.req.query("inc") === "1";
  if (inc) visitCount += 1;
  // 返回最新的访问量（内存+数据库）
  const stats = await db.select().from(visitStats).limit(1);
  const base = stats.length > 0 ? stats[0].count : 0;
  const count = base + visitCount;
  return c.json({ count });
});

export default router;
