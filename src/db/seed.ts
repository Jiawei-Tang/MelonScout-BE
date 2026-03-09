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

  console.log(`✅ Seeded ${defaultPlatforms.length} platforms`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
