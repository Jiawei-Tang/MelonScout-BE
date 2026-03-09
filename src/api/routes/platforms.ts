import { Hono } from "hono";
import { db, schema } from "../../db";

const app = new Hono();

app.get("/", async (c) => {
  const allPlatforms = await db.select().from(schema.platforms);
  return c.json({ data: allPlatforms });
});

export default app;
