import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import platforms from "./routes/platforms";
import hotSearches from "./routes/hotSearches";
import analysis from "./routes/analysis";

const api = new Hono();

api.use("*", logger());
api.use("*", cors());

api.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

api.route("/api/platforms", platforms);
api.route("/api/hot-searches", hotSearches);
api.route("/api/analysis", analysis);

api.notFound((c) => c.json({ error: "Not Found" }, 404));

export default api;
