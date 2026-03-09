import api from "./api";
import { config } from "./config";
import { startCronJobs } from "./cron";

console.log("🍉 MelonScout Backend starting...");

startCronJobs();

export default {
  port: config.PORT,
  fetch: api.fetch,
};

console.log(`🚀 Server running at http://localhost:${config.PORT}`);
