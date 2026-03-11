import { db, schema } from "./index";

const defaultPlatforms = [
  { name: "weibo", displayName: "微博" },
  { name: "zhihu", displayName: "知乎" },
  { name: "baidu", displayName: "百度" },
  { name: "douyin", displayName: "抖音" },
  { name: "bilibili", displayName: "哔哩哔哩" },
  { name: "toutiao", displayName: "今日头条" },
];

async function seed() {
  console.log("🌱 Seeding platforms...");

  for (const platform of defaultPlatforms) {
    await db
      .insert(schema.platforms)
      .values(platform)
      .onConflictDoNothing({ target: schema.platforms.name });
  }

  const visitStats = await db.select().from(schema.visitStats).limit(1);
  if (visitStats.length === 0) {
    await db.insert(schema.visitStats).values({ count: 0 });
    console.log("✅ Initialized visit_stats");
  }

  console.log(`✅ Seeded ${defaultPlatforms.length} platforms`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
